"""
services/position_service.py – Business logic for position management.
CRUD, status transitions, search-now trigger, interview kit.
"""
import json
import logging
from typing import Optional, Any

from backend.db.connection import get_connection
from backend.db.repositories.positions import PositionRepository
from backend.db.repositories.candidates import CandidateRepository
from backend.db.repositories.pipeline_events import PipelineEventRepository
from backend.db.repositories.audit import AuditLogRepository
from backend.db.repositories.notifications import NotificationRepository

logger = logging.getLogger(__name__)

VALID_STATUSES = {
    "draft", "jd_in_progress", "pending_jd_approval",
    "draft_needs_revision", "open", "on_hold", "closed",
    "archived", "cancelled",
}


class PositionService:

    @staticmethod
    async def get_position(position_id: int, org_id: int) -> Optional[dict]:
        async with get_connection() as conn:
            pos = await PositionRepository.get_with_stats(conn, position_id, org_id)
            if not pos:
                return None
            # Parse JSON embedding (don't send to client — large)
            pos.pop("jd_embedding", None)
            # Get variants
            pos["variants"] = await PositionRepository.get_variants(conn, position_id)
        return pos

    @staticmethod
    async def list_positions(
        org_id: int,
        department_id: Optional[int] = None,
        status: Optional[str] = None,
        page: int = 1,
        assigned_to: Optional[int] = None,
        team_lead_id: Optional[int] = None,
        team_lead_dept_id: Optional[int] = None,
    ) -> list[dict]:
        async with get_connection() as conn:
            positions = await PositionRepository.list_for_org(
                conn, org_id, department_id, status, page,
                page_size=20, assigned_to=assigned_to,
                team_lead_id=team_lead_id, team_lead_dept_id=team_lead_dept_id,
            )
        for p in positions:
            p.pop("jd_embedding", None)
        return positions

    @staticmethod
    async def update_position(
        position_id: int, org_id: int, user_id: int, data: dict
    ) -> Optional[dict]:
        # Strip fields that shouldn't be updated via this endpoint
        data.pop("jd_embedding", None)
        data.pop("id", None)
        data.pop("org_id", None)
        async with get_connection() as conn:
            pos = await PositionRepository.update(conn, position_id, org_id, data)
            if pos:
                await AuditLogRepository.create(conn, {
                    "org_id": org_id,
                    "user_id": user_id,
                    "action": "position_updated",
                    "entity_type": "position",
                    "entity_id": str(position_id),
                    "details": json.dumps({"fields": list(data.keys())})
                })
        if pos:
            pos.pop("jd_embedding", None)
        return pos

    @staticmethod
    async def update_status(
        position_id: int, org_id: int, user_id: int, new_status: str
    ) -> Optional[dict]:
        if new_status not in VALID_STATUSES:
            raise ValueError(f"Invalid status: {new_status}")

        update_data: dict = {"status": new_status}
        if new_status == "closed":
            update_data["closed_at"] = "NOW()"

        async with get_connection() as conn:
            async with conn.transaction():
                pos = await PositionRepository.update(conn, position_id, org_id, update_data)
                if not pos:
                    return None

                await PipelineEventRepository.create(conn, {
                    "org_id": org_id,
                    "position_id": position_id,
                    "user_id": user_id,
                    "event_type": "status_changed",
                    "event_data": {"new_status": new_status}
                })
                await AuditLogRepository.create(conn, {
                    "org_id": org_id,
                    "user_id": user_id,
                    "action": f"position_{new_status}",
                    "entity_type": "position",
                    "entity_id": str(position_id),
                    "details": json.dumps({"status": new_status})
                })

                # When closed/archived → auto-add non-selected candidates to talent pool
                if new_status in ("closed", "archived"):
                    await _auto_pool_candidates(conn, position_id, org_id)

        if pos:
            pos.pop("jd_embedding", None)
        return pos

    @staticmethod
    async def trigger_search_now(
        position_id: int, org_id: int, department_id: int, user_id: int
    ) -> dict:
        """Trigger an immediate candidate search via Celery."""
        try:
            from backend.tasks.candidate_pipeline import run_candidate_search
            task = run_candidate_search.delay(position_id, org_id, department_id, user_id)
            return {"queued": True, "task_id": task.id}
        except Exception as e:
            logger.warning(f"Could not queue search task: {e}")
            return {"queued": False, "error": str(e)}

    @staticmethod
    async def get_kanban(position_id: int, org_id: int) -> dict:
        async with get_connection() as conn:
            kanban = await CandidateRepository.get_pipeline_kanban(conn, position_id, org_id)
        # Parse skill_match_data JSON for each card
        for stage, cards in kanban.items():
            for card in cards:
                if card.get("skill_match_data") and isinstance(card["skill_match_data"], str):
                    try:
                        card["skill_match_data"] = json.loads(card["skill_match_data"])
                    except Exception:
                        pass
        return kanban

    @staticmethod
    async def get_activity(position_id: int, org_id: int) -> list[dict]:
        async with get_connection() as conn:
            events = await PipelineEventRepository.list_for_position(conn, position_id, org_id)
        for evt in events:
            if evt.get("event_data") and isinstance(evt["event_data"], str):
                try:
                    evt["event_data"] = json.loads(evt["event_data"])
                except Exception:
                    pass
        return events

    @staticmethod
    async def submit_for_approval(
        position_id: int,
        org_id: int,
        submitted_by_user_id: int,
        ats_threshold: Optional[float] = None,
        search_interval_hours: Optional[int] = None,
    ) -> None:
        """
        Submit position for JD approval.

        Item 10: ATS config + status transition in ONE transaction (atomic)
        Item 17: Block when no reviewer
        Item 19: Org_head bypass (direct to open)
        Item 20: Full department matrix via resolve_reviewer
        """
        from backend.services.email_service import EmailService
        from backend.config import settings

        # Resolve reviewer first — read-only, safe to do before the transaction.
        # The transaction below uses FOR UPDATE to re-validate status hasn't changed.
        reviewer_info = await PositionService.resolve_reviewer(
            position_id, org_id, submitted_by_user_id,
        )

        # Item 17: Block early if no reviewer resolved
        if not reviewer_info.get("is_bypass") and not reviewer_info.get("reviewer_id"):
            raise ValueError(
                reviewer_info.get("warning")
                or "No reviewer available. Ask your workspace admin to assign an org head before submitting."
            )

        role_name = None
        dept_id = None
        hr_name = "HR"
        reviewer_row = None
        is_bypass = reviewer_info.get("is_bypass", False)
        reviewer_id = reviewer_info.get("reviewer_id")

        async with get_connection() as conn:
            async with conn.transaction():
                # Lock the row — prevents concurrent double-submits
                pos_row = await conn.fetchrow(
                    """SELECT id, role_name, department_id, status
                       FROM positions WHERE id=$1 AND org_id=$2 FOR UPDATE""",
                    position_id, org_id,
                )
                if not pos_row:
                    raise ValueError(f"Position {position_id} not found")

                if pos_row["status"] not in ("jd_in_progress", "draft_needs_revision"):
                    raise ValueError(
                        f"Cannot submit from status '{pos_row['status']}'. "
                        f"Position must be in jd_in_progress or draft_needs_revision."
                    )

                role_name = pos_row["role_name"]
                dept_id = pos_row["department_id"]

                # Read submitter — check auto_approve_jds on the SUBMITTER, not hire_request creator
                submitter_row = await conn.fetchrow(
                    "SELECT name, role, auto_approve_jds FROM users WHERE id=$1 AND org_id=$2",
                    submitted_by_user_id, org_id,
                )
                hr_name = submitter_row["name"] if submitter_row else "HR"
                submitter_role = submitter_row["role"] if submitter_row else "hr"
                auto_approve = bool(submitter_row and submitter_row.get("auto_approve_jds"))

                # Item 10: ATS config update in same transaction as status change
                if ats_threshold is not None or search_interval_hours is not None:
                    ats_update = {}
                    if ats_threshold is not None:
                        ats_update["ats_threshold"] = ats_threshold
                    if search_interval_hours is not None:
                        ats_update["search_interval_hours"] = search_interval_hours
                    await PositionRepository.update(conn, position_id, org_id, ats_update)

                if is_bypass:
                    # Item 19: Org_head direct-to-open
                    success = await PositionRepository.org_head_direct_approve(
                        conn, position_id, org_id, submitted_by_user_id,
                    )
                    if not success:
                        raise ValueError("Submit failed: position status changed concurrently.")
                    await PositionRepository.fulfill_hire_request(conn, position_id, org_id)
                    await AuditLogRepository.create(conn, {
                        "org_id": org_id,
                        "user_id": submitted_by_user_id,
                        "action": "position_approved_bypass",
                        "entity_type": "position",
                        "entity_id": str(position_id),
                        "details": json.dumps({"role_name": role_name, "reason": "org_head_bypass"})
                    })

                elif auto_approve:
                    # Auto-approve: set pending_jd_approval then immediately open — all in one txn
                    submitted = await PositionRepository.submit_for_jd_approval(
                        conn, position_id, org_id,
                        reviewer_id=reviewer_id,
                        submitted_by_role=submitter_role,
                        reviewer_role_at_submit=reviewer_info.get("reviewer_role") or "org_head",
                    )
                    if not submitted:
                        raise ValueError("Auto-approve failed: position status changed concurrently.")
                    success = await PositionRepository.approve_and_open(
                        conn, position_id, org_id, submitted_by_user_id,
                    )
                    if not success:
                        raise ValueError("Auto-approve open failed: position status changed concurrently.")
                    await PositionRepository.fulfill_hire_request(conn, position_id, org_id)
                    await AuditLogRepository.create(conn, {
                        "org_id": org_id,
                        "user_id": submitted_by_user_id,
                        "action": "position_auto_approved",
                        "entity_type": "position",
                        "entity_id": str(position_id),
                        "details": json.dumps({"role_name": role_name})
                    })

                else:
                    # Normal submit → pending_jd_approval
                    submitted = await PositionRepository.submit_for_jd_approval(
                        conn, position_id, org_id,
                        reviewer_id=reviewer_id,
                        submitted_by_role=submitter_role,
                        reviewer_role_at_submit=reviewer_info.get("reviewer_role") or "org_head",
                    )
                    if not submitted:
                        raise ValueError("Submit failed: position status changed concurrently.")

                    await AuditLogRepository.create(conn, {
                        "org_id": org_id,
                        "user_id": submitted_by_user_id,
                        "action": "position_submitted_for_approval",
                        "entity_type": "position",
                        "entity_id": str(position_id),
                        "details": json.dumps({
                            "role_name": role_name,
                            "reviewer_id": reviewer_id,
                            "reviewer_role": reviewer_info.get("reviewer_role"),
                        })
                    })

                    await conn.execute(
                        """
                        INSERT INTO notifications (org_id, user_id, type, title, message, action_url)
                        VALUES ($1,$2,'jd_pending_approval','JD ready for your approval',$3,$4)
                        """,
                        org_id, reviewer_id,
                        f"\"{role_name}\" was submitted by {hr_name} and is waiting for your approval.",
                        f"/positions/{position_id}/jd",
                    )

                    reviewer_row = await conn.fetchrow(
                        "SELECT name, email FROM users WHERE id=$1 AND org_id=$2",
                        reviewer_id, org_id,
                    )

        # Post-commit: email and Celery (non-blocking, outside transaction)
        if is_bypass or auto_approve:
            try:
                from backend.tasks.candidate_pipeline import run_candidate_search
                run_candidate_search.delay(position_id, org_id, dept_id, submitted_by_user_id)
                logger.info(f"Candidate pipeline queued for position {position_id}")
            except Exception as e:
                logger.warning(f"Could not enqueue candidate pipeline: {e}")
        elif reviewer_row and reviewer_row.get("email"):
            base_url = getattr(settings, "APP_BASE_URL", "https://app.aitalentlab.com")
            try:
                await EmailService.send_jd_ready_for_review(
                    to_email=reviewer_row["email"],
                    team_lead_name=reviewer_row["name"],
                    role_name=role_name,
                    hr_name=hr_name,
                    review_url=f"{base_url}/positions/{position_id}/jd",
                )
            except Exception as e:
                logger.warning(f"Could not email reviewer {reviewer_id} for approval: {e}")

    @staticmethod
    async def record_approval_decision(
        position_id: int,
        org_id: int,
        approver_user_id: int,
        decision: str,
        notes: str = "",
    ) -> None:
        """
        Persist the approval decision, notify the HR author, send email, and
        — on 'approved' only — fire the Celery candidate pipeline.

        Item 4:  pending_jd_approval → open directly (no phantom 'approved' state)
        Item 9:  Cross-dept authority check (reviewer_id match + dept scope)
        Item 11: Single transaction for status + hire_request fulfillment
        """
        from backend.services.email_service import EmailService
        from backend.config import settings

        async with get_connection() as conn:
            # Read approver first (doesn't need lock)
            approver_row = await conn.fetchrow(
                "SELECT id, name, role, department_id FROM users WHERE id=$1 AND org_id=$2",
                approver_user_id, org_id,
            )
            if not approver_row:
                raise ValueError("Approver user not found")
            approver_name = approver_row["name"]
            approver_role = approver_row["role"]

            hr_row = None
            hr_user_id = None

            # ── Item 4 + 9 + 11: Single transaction with FOR UPDATE ───────
            # FOR UPDATE ensures permission check reads fresh reviewer_id —
            # prevents TOCTOU where a withdrawn/reassigned reviewer still approves.
            async with conn.transaction():
                pos_row = await conn.fetchrow(
                    """
                    SELECT role_name, created_by, department_id, approval_status,
                           status, reviewer_id
                    FROM positions WHERE id=$1 AND org_id=$2 FOR UPDATE
                    """,
                    position_id, org_id,
                )
                if not pos_row:
                    raise ValueError(f"Position {position_id} not found")

                # ── Item 9: Cross-dept authority check (on fresh locked row) ──
                if approver_role != "org_head":
                    # reviewer_id=NULL means no reviewer assigned; only org_head may act
                    if pos_row["reviewer_id"] is None:
                        raise PermissionError(
                            "No reviewer assigned to this position. Only org_head can approve."
                        )
                    if approver_user_id != pos_row["reviewer_id"]:
                        raise PermissionError(
                            "You are not the assigned reviewer for this position."
                        )
                    # Must have dept_scope over this position
                    if pos_row["department_id"] and approver_row["department_id"]:
                        if approver_row["department_id"] != pos_row["department_id"]:
                            raise PermissionError(
                                "You can only review positions in your own department."
                            )

                # Idempotency: prevent double-fire
                target_status = "approved" if decision == "approved" else "changes_requested"
                if pos_row["approval_status"] == target_status:
                    return

                hr_user_id = pos_row["created_by"]
                hr_row = await conn.fetchrow(
                    "SELECT name, email FROM users WHERE id=$1 AND org_id=$2",
                    hr_user_id, org_id,
                ) if hr_user_id else None
                hr_name = hr_row["name"] if hr_row else "HR"
                hr_email = hr_row["email"] if hr_row else None
                if decision == "approved":
                    # pending_jd_approval → open (atomic CAS)
                    success = await PositionRepository.approve_and_open(
                        conn, position_id, org_id, approver_user_id,
                    )
                    if not success:
                        raise ValueError(
                            f"Cannot approve — position is not pending approval "
                            f"(current status: {pos_row['status']})"
                        )
                    # Item 11: Fulfill linked hire_request in same transaction
                    await PositionRepository.fulfill_hire_request(
                        conn, position_id, org_id,
                    )
                else:
                    # pending_jd_approval → draft_needs_revision
                    success = await PositionRepository.reject_to_revision(
                        conn, position_id, org_id, notes or None,
                    )
                    if not success:
                        raise ValueError(
                            f"Cannot reject — position is not pending approval "
                            f"(current status: {pos_row['status']})"
                        )
                    # Increment revision cycle for re-submission tracking
                    new_cycle = await PositionRepository.increment_revision_cycle(
                        conn, position_id, org_id,
                    )

                    # ── Item 13: Idempotent Feedback Injection ────────────
                    session_row = await conn.fetchrow(
                        """
                        SELECT cs.id FROM chat_sessions cs
                         WHERE cs.position_id = $1 AND cs.org_id = $2
                         ORDER BY cs.created_at DESC LIMIT 1
                        """,
                        position_id, org_id,
                    )
                    if session_row:
                        feedback_content = (
                            f"**Reviewer Feedback (Revision {new_cycle}):**\n\n"
                            f"{notes or 'Changes requested — no specific notes provided.'}\n\n"
                            f"_Please revise the JD based on this feedback and resubmit._"
                        )
                        try:
                            await conn.execute(
                                """
                                INSERT INTO chat_messages (
                                    session_id, org_id, role, content,
                                    message_type, revision_cycle
                                )
                                VALUES ($1, $2, 'system', $3, 'feedback_injection', $4)
                                ON CONFLICT (session_id, message_type, revision_cycle)
                                    WHERE message_type = 'feedback_injection'
                                DO NOTHING
                                """,
                                session_row["id"], org_id, feedback_content, new_cycle,
                            )
                        except Exception as e:
                            logger.warning(f"Feedback injection failed: {e}")

                # Notification to HR
                if hr_user_id:
                    msg = (
                        f"\"{pos_row['role_name']}\" was approved by {approver_name}. Sourcing has started."
                        if decision == "approved"
                        else f"\"{pos_row['role_name']}\" needs changes. Notes: {notes or '—'}"
                    )
                    await conn.execute(
                        """
                        INSERT INTO notifications (org_id, user_id, type, title, message, action_url)
                        VALUES ($1,$2,'jd_approval_decision','JD approval update',$3,$4)
                        """,
                        org_id, hr_user_id, msg,
                        f"/positions/{position_id}/jd",
                    )

                # Audit log
                await AuditLogRepository.create(conn, {
                    "org_id": org_id,
                    "user_id": approver_user_id,
                    "action": f"position_{decision}",
                    "entity_type": "position",
                    "entity_id": str(position_id),
                    "details": json.dumps({"role_name": pos_row["role_name"], "notes": notes})
                })

            dept_id = pos_row["department_id"]

        # ── Post-commit async jobs (Item 11) ─────────────────────────────
        # Email HR
        base_url = getattr(settings, "APP_BASE_URL", "https://app.aitalentlab.com")
        position_url = f"{base_url}/positions/{position_id}/jd"
        if hr_email:
            try:
                if decision == "approved":
                    await EmailService.send_jd_approved(
                        to_email=hr_email,
                        hr_name=hr_name,
                        role_name=pos_row["role_name"],
                        team_lead_name=approver_name,
                        position_url=position_url,
                    )
                else:
                    await EmailService.send_jd_changes_requested(
                        to_email=hr_email,
                        hr_name=hr_name,
                        role_name=pos_row["role_name"],
                        team_lead_name=approver_name,
                        reason=notes,
                        position_url=position_url,
                    )
            except Exception as e:
                logger.warning(f"Could not send approval-decision email: {e}")

        # Fire Celery sourcing ONLY on approved
        if decision == "approved":
            try:
                from backend.tasks.candidate_pipeline import run_candidate_search
                run_candidate_search.delay(
                    position_id, org_id, dept_id, approver_user_id
                )
                logger.info(f"Candidate pipeline queued for position {position_id}")
            except Exception as e:
                logger.warning(f"Could not enqueue candidate pipeline: {e}")

    # ── Item 6: TL cancel-after-pickup (jd_in_progress → cancelled) ───────

    @staticmethod
    async def cancel_jd_in_progress(
        position_id: int,
        org_id: int,
        user_id: int,
        role: str,
        notes: str,
    ) -> dict:
        """
        Team lead cancels a position that is in jd_in_progress.
        Only allowed before HR submits for approval.
        """
        if not notes or not notes.strip():
            raise ValueError("Cancellation notes are required.")

        async with get_connection() as conn:
            pos = await PositionRepository.get(conn, position_id, org_id)
            if not pos:
                raise ValueError(f"Position {position_id} not found")

            if pos["status"] != "jd_in_progress":
                raise ValueError(
                    f"Can only cancel a position in jd_in_progress; "
                    f"current status is '{pos['status']}'."
                )

            if role != "team_lead":
                raise PermissionError("Only the team_lead who raised the hire request can cancel a JD in progress.")

            async with conn.transaction():
                success = await PositionRepository.cancel_jd_in_progress(
                    conn, position_id, org_id,
                )
                if not success:
                    raise ValueError("Position status changed concurrently.")

                # Notify the HR who picked it up
                if pos.get("picked_up_by"):
                    tl_row = await conn.fetchrow(
                        "SELECT name FROM users WHERE id=$1 AND org_id=$2",
                        user_id, org_id,
                    )
                    tl_name = tl_row["name"] if tl_row else "Team Lead"
                    await conn.execute(
                        """
                        INSERT INTO notifications (org_id, user_id, type, title, message, action_url)
                        VALUES ($1,$2,'jd_cancelled','Hire request cancelled',
                                $3, $4)
                        """,
                        org_id, pos["picked_up_by"],
                        f"The hire request for \"{pos['role_name']}\" was cancelled by {tl_name}. Notes: {notes.strip()}",
                        f"/positions/{position_id}",
                    )

                await AuditLogRepository.create(conn, {
                    "org_id": org_id,
                    "user_id": user_id,
                    "action": "position_cancelled_by_tl",
                    "entity_type": "position",
                    "entity_id": str(position_id),
                    "details": json.dumps({"notes": notes.strip()})
                })

        return {"ok": True, "status": "cancelled"}

    # ── Item 7: HR withdraw submission ────────────────────────────────────

    @staticmethod
    async def withdraw_submission(
        position_id: int,
        org_id: int,
        user_id: int,
    ) -> dict:
        """
        HR withdraws a submitted JD (pending_jd_approval → jd_in_progress).
        Bias resets on withdraw. revision_cycle does NOT increment.
        """
        async with get_connection() as conn:
            pos = await PositionRepository.get(conn, position_id, org_id)
            if not pos:
                raise ValueError(f"Position {position_id} not found")

            if pos["status"] != "pending_jd_approval":
                raise ValueError(
                    f"Can only withdraw a position in pending_jd_approval; "
                    f"current status is '{pos['status']}'."
                )

            reviewer_id = pos.get("reviewer_id")

            async with conn.transaction():
                success = await PositionRepository.withdraw_submission(
                    conn, position_id, org_id,
                )
                if not success:
                    raise ValueError("Position status changed concurrently.")

                # Notify the reviewer that submission was withdrawn
                if reviewer_id:
                    hr_row = await conn.fetchrow(
                        "SELECT name FROM users WHERE id=$1 AND org_id=$2",
                        user_id, org_id,
                    )
                    hr_name = hr_row["name"] if hr_row else "HR"
                    await conn.execute(
                        """
                        INSERT INTO notifications (org_id, user_id, type, title, message, action_url)
                        VALUES ($1,$2,'submission_withdrawn','JD submission withdrawn',
                                $3, $4)
                        """,
                        org_id, reviewer_id,
                        f"The JD for \"{pos['role_name']}\" was withdrawn by {hr_name}. No action needed.",
                        f"/positions/{position_id}/jd",
                    )

                await AuditLogRepository.create(conn, {
                    "org_id": org_id,
                    "user_id": user_id,
                    "action": "position_submission_withdrawn",
                    "entity_type": "position",
                    "entity_id": str(position_id),
                    "details": json.dumps({"role_name": pos["role_name"]})
                })

        return {"ok": True, "status": "jd_in_progress"}

    # ── Item 16: Resolve reviewer endpoint ────────────────────────────────

    @staticmethod
    async def resolve_reviewer(
        position_id: int,
        org_id: int,
        user_id: int,
    ) -> dict:
        """
        Resolve who will review the JD. Called when chat reaches final_jd stage.
        Returns reviewer info for the FinalJDCard preview.

        Item 20: Full department matrix for Flow 2
        """
        async with get_connection() as conn:
            pos = await PositionRepository.get(conn, position_id, org_id)
            if not pos:
                raise ValueError(f"Position {position_id} not found")

            dept_id = pos.get("department_id")

            # Get the submitter's role
            user_row = await conn.fetchrow(
                "SELECT id, role, name, department_id FROM users WHERE id=$1 AND org_id=$2 AND is_active=TRUE",
                user_id, org_id,
            )
            if not user_row:
                return {"reviewer_id": None, "warning": "User not found", "is_bypass": False}

            creator_role = user_row["role"]

            # Item 19: Org_head bypass
            if creator_role == "org_head":
                return {
                    "reviewer_id": None,
                    "reviewer_name": None,
                    "reviewer_role": None,
                    "department": None,
                    "is_bypass": True,
                    "warning": None,
                }

            # Item 20: Full department matrix
            reviewer_id = None
            reviewer_name = None
            reviewer_role = None
            reviewer_dept = None
            warning = None

            # Check org settings for approval toggles (Item 21).
            # Org settings live in the organizations.ai_behavior_settings JSONB
            # column — there is NO plain "settings" column. The old query
            # `SELECT settings FROM organizations` threw
            # 'column "settings" does not exist', which bubbled up and aborted
            # submit_for_approval: the position was created but never submitted,
            # so no reviewer was set, the team lead got no notification, and the
            # stage stayed at "JD generation". Use the shared decoder instead.
            from backend.services.settings_service import SettingsService
            org_settings = await SettingsService.get_ai_behavior(conn, org_id)
            hr_requires_review = org_settings.get("direct_hire_hr_requires_review", True)
            dept_admin_requires_org_review = org_settings.get("direct_hire_dept_admin_requires_org_head_review", True)

            if creator_role == "dept_admin":
                if not dept_admin_requires_org_review:
                    return {
                        "reviewer_id": None, "reviewer_name": None,
                        "reviewer_role": None, "department": None,
                        "is_bypass": True, "warning": None,
                    }
                # dept_admin → org_head
                oh = await conn.fetchrow(
                    "SELECT id, name FROM users WHERE org_id=$1 AND role='org_head' AND is_active=TRUE ORDER BY id LIMIT 1",
                    org_id,
                )
                if oh:
                    reviewer_id = oh["id"]
                    reviewer_name = oh["name"]
                    reviewer_role = "org_head"
                else:
                    warning = "No org head configured. Contact your workspace admin."

            elif creator_role == "hr":
                if not hr_requires_review:
                    return {
                        "reviewer_id": None, "reviewer_name": None,
                        "reviewer_role": None, "department": None,
                        "is_bypass": True, "warning": None,
                    }

                # Flow 1: if a hire_request exists for this position, the reviewer
                # is the team_lead who raised it — not the dept_admin.
                tl_row = await conn.fetchrow(
                    """
                    SELECT u.id, u.name FROM hire_requests h
                      JOIN users u ON u.id = h.requested_by
                     WHERE h.position_id = $1 AND h.org_id = $2
                       AND h.status IN ('approved', 'approved_modified', 'fulfilled')
                       AND u.is_active = TRUE
                     ORDER BY h.id DESC LIMIT 1
                    """,
                    position_id, org_id,
                )
                if tl_row:
                    reviewer_id = tl_row["id"]
                    reviewer_name = tl_row["name"]
                    reviewer_role = "team_lead"
                elif dept_id:
                    # Flow 2: hr + dept → dept_admin of that dept
                    da = await conn.fetchrow(
                        "SELECT id, name FROM users WHERE org_id=$1 AND role='dept_admin' AND department_id=$2 AND is_active=TRUE ORDER BY id LIMIT 1",
                        org_id, dept_id,
                    )
                    if da:
                        reviewer_id = da["id"]
                        reviewer_name = da["name"]
                        reviewer_role = "dept_admin"
                        dept_row = await conn.fetchrow("SELECT name FROM departments WHERE id=$1", dept_id)
                        reviewer_dept = dept_row["name"] if dept_row else None
                    else:
                        # No dept_admin → escalate to org_head
                        oh = await conn.fetchrow(
                            "SELECT id, name FROM users WHERE org_id=$1 AND role='org_head' AND is_active=TRUE ORDER BY id LIMIT 1",
                            org_id,
                        )
                        if oh:
                            reviewer_id = oh["id"]
                            reviewer_name = oh["name"]
                            reviewer_role = "org_head"
                            warning = "No dept admin configured. Defaulting to org head."
                        else:
                            warning = "No reviewer available. Contact your workspace admin."
                else:
                    # Flow 2: hr + no dept → org_head
                    oh = await conn.fetchrow(
                        "SELECT id, name FROM users WHERE org_id=$1 AND role='org_head' AND is_active=TRUE ORDER BY id LIMIT 1",
                        org_id,
                    )
                    if oh:
                        reviewer_id = oh["id"]
                        reviewer_name = oh["name"]
                        reviewer_role = "org_head"
                    else:
                        warning = "No org head configured. Contact your workspace admin."

            elif creator_role == "team_lead":
                # Flow 1: TL raised hire request → dept_admin or org_head reviews
                if dept_id:
                    da = await conn.fetchrow(
                        "SELECT id, name FROM users WHERE org_id=$1 AND role='dept_admin' AND department_id=$2 AND is_active=TRUE ORDER BY id LIMIT 1",
                        org_id, dept_id,
                    )
                    if da:
                        reviewer_id = da["id"]
                        reviewer_name = da["name"]
                        reviewer_role = "dept_admin"
                    else:
                        oh = await conn.fetchrow(
                            "SELECT id, name FROM users WHERE org_id=$1 AND role='org_head' AND is_active=TRUE ORDER BY id LIMIT 1",
                            org_id,
                        )
                        if oh:
                            reviewer_id = oh["id"]
                            reviewer_name = oh["name"]
                            reviewer_role = "org_head"
                            warning = "No dept admin configured. Defaulting to org head."
                else:
                    oh = await conn.fetchrow(
                        "SELECT id, name FROM users WHERE org_id=$1 AND role='org_head' AND is_active=TRUE ORDER BY id LIMIT 1",
                        org_id,
                    )
                    if oh:
                        reviewer_id = oh["id"]
                        reviewer_name = oh["name"]
                        reviewer_role = "org_head"

            # Self-approval blocked: if resolved == creator → escalate
            if reviewer_id and reviewer_id == user_id:
                oh = await conn.fetchrow(
                    "SELECT id, name FROM users WHERE org_id=$1 AND role='org_head' AND is_active=TRUE AND id != $2 ORDER BY id LIMIT 1",
                    org_id, user_id,
                )
                if oh:
                    reviewer_id = oh["id"]
                    reviewer_name = oh["name"]
                    reviewer_role = "org_head"
                    warning = "Self-approval blocked. Escalated to org head."
                else:
                    reviewer_id = None
                    warning = "No reviewer available. Ask your workspace admin to assign an org head."

        return {
            "reviewer_id": reviewer_id,
            "reviewer_name": reviewer_name,
            "reviewer_role": reviewer_role,
            "department": reviewer_dept,
            "is_bypass": False,
            "warning": warning,
        }

    # ── Item 12: Re-resolve reviewers on user deletion ────────────────────

    @staticmethod
    async def re_resolve_reviewers_on_user_delete(
        deleted_user_id: int,
        org_id: int,
    ) -> int:
        """
        When a user is deleted/deactivated, find all pending positions where
        they are the reviewer and reassign to the next available reviewer.
        """
        reassigned = 0
        async with get_connection() as conn:
            positions = await PositionRepository.get_positions_pending_review_by_user(
                conn, deleted_user_id, org_id,
            )
            for pos in positions:
                dept_id = pos.get("department_id")
                # Try dept_admin first, then org_head
                new_reviewer = None
                new_role = None

                if dept_id:
                    da = await conn.fetchrow(
                        "SELECT id FROM users WHERE org_id=$1 AND role='dept_admin' AND department_id=$2 AND is_active=TRUE AND id != $3 ORDER BY id LIMIT 1",
                        org_id, dept_id, deleted_user_id,
                    )
                    if da:
                        new_reviewer = da["id"]
                        new_role = "dept_admin"

                if not new_reviewer:
                    oh = await conn.fetchrow(
                        "SELECT id FROM users WHERE org_id=$1 AND role='org_head' AND is_active=TRUE AND id != $2 ORDER BY id LIMIT 1",
                        org_id, deleted_user_id,
                    )
                    if oh:
                        new_reviewer = oh["id"]
                        new_role = "org_head"

                if new_reviewer:
                    await PositionRepository.reassign_reviewer(
                        conn, pos["id"], org_id, new_reviewer, new_role,
                    )
                    # Notify new reviewer
                    await conn.execute(
                        """
                        INSERT INTO notifications (org_id, user_id, type, title, message, action_url)
                        VALUES ($1,$2,'reviewer_reassigned','JD review assigned to you',
                                $3, $4)
                        """,
                        org_id, new_reviewer,
                        f"You have been assigned to review a JD (position #{pos['id']}).",
                        f"/positions/{pos['id']}/jd",
                    )
                    reassigned += 1

        return reassigned

    # ── Item 24: ATS config update post-open (role-gated) ─────────────────

    @staticmethod
    async def update_ats_config_post_open(
        position_id: int,
        org_id: int,
        user_id: int,
        role: str,
        ats_threshold: Optional[float] = None,
        search_interval_hours: Optional[int] = None,
    ) -> dict:
        """
        Only org_head and dept_admin can edit ATS config after position is open.
        Only ats_threshold and search_interval_hours are editable.
        """
        if role not in ("org_head", "dept_admin"):
            raise PermissionError("Only org_head or dept_admin can edit ATS config on open positions.")

        async with get_connection() as conn:
            pos = await PositionRepository.get(conn, position_id, org_id)
            if not pos:
                raise ValueError(f"Position {position_id} not found")
            if pos["status"] != "open":
                raise ValueError("ATS config can only be edited on open positions.")

            update_data = {}
            if ats_threshold is not None:
                update_data["ats_threshold"] = ats_threshold
            if search_interval_hours is not None:
                update_data["search_interval_hours"] = search_interval_hours

            if not update_data:
                return dict(pos)

            result = await PositionRepository.update(conn, position_id, org_id, update_data)
            await AuditLogRepository.create(conn, {
                "org_id": org_id,
                "user_id": user_id,
                "action": "ats_config_updated",
                "entity_type": "position",
                "entity_id": str(position_id),
                "details": json.dumps(update_data)
            })

        return result or {}

    @staticmethod
    async def get_interview_kit(position_id: int, org_id: int) -> Optional[dict]:
        async with get_connection() as conn:
            kit = await PositionRepository.get_interview_kit(conn, position_id, org_id)
        if kit:
            if kit.get("questions") and isinstance(kit["questions"], str):
                try:
                    kit["questions"] = json.loads(kit["questions"])
                except Exception:
                    pass
            if kit.get("scorecard_template") and isinstance(kit["scorecard_template"], str):
                try:
                    kit["scorecard_template"] = json.loads(kit["scorecard_template"])
                except Exception:
                    pass
        return kit

    @staticmethod
    async def generate_interview_kit(
        position_id: int, org_id: int, user_id: int
    ) -> dict:
        """AI-generate interview kit for position. Stores in interview_kits table."""
        async with get_connection() as conn:
            pos = await PositionRepository.get(conn, position_id, org_id)
        if not pos:
            raise ValueError("Position not found")

        from backend.agents.interview_kit import generate_interview_kit as ai_generate
        kit_data = await ai_generate(pos.get("jd_markdown", ""), pos.get("role_name", ""))

        async with get_connection() as conn:
            # Upsert interview kit
            existing = await PositionRepository.get_interview_kit(conn, position_id, org_id)
            if existing:
                await conn.execute(
                    """
                    UPDATE interview_kits
                    SET questions=$1, scorecard_template=$2, generated_at=NOW(),
                        regenerated_count=regenerated_count+1
                    WHERE position_id=$3 AND org_id=$4
                    """,
                    json.dumps(kit_data.get("questions", [])),
                    json.dumps(kit_data.get("scorecard_template", [])),
                    position_id, org_id
                )
            else:
                await conn.execute(
                    """
                    INSERT INTO interview_kits (position_id, org_id, questions, scorecard_template)
                    VALUES ($1,$2,$3,$4)
                    """,
                    position_id, org_id,
                    json.dumps(kit_data.get("questions", [])),
                    json.dumps(kit_data.get("scorecard_template", []))
                )

            await PipelineEventRepository.create(conn, {
                "org_id": org_id,
                "position_id": position_id,
                "user_id": user_id,
                "event_type": "interview_kit_generated",
                "event_data": {"question_count": len(kit_data.get("questions", []))}
            })

        return kit_data


async def _auto_pool_candidates(conn, position_id: int, org_id: int) -> None:
    """When position closes/archives, add all non-selected candidates to talent pool."""
    apps = await conn.fetch(
        """
        SELECT candidate_id FROM candidate_applications
        WHERE position_id=$1 AND org_id=$2 AND status NOT IN ('selected','rejected')
        """,
        position_id, org_id
    )
    for app in apps:
        await conn.execute(
            """
            UPDATE candidates
            SET in_talent_pool=TRUE, talent_pool_reason='position_closed',
                talent_pool_added_at=NOW()
            WHERE id=$1 AND org_id=$2
            """,
            app["candidate_id"], org_id
        )
