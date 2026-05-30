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

VALID_STATUSES = {"draft", "open", "on_hold", "closed", "archived"}


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
    ) -> list[dict]:
        async with get_connection() as conn:
            positions = await PositionRepository.list_for_org(
                conn, org_id, department_id, status, page
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
    ) -> None:
        """
        Set approval_status='pending', notify all team_leads in the department,
        and send an email to each of them.

        Judgement call: we notify ALL team_leads whose department matches the
        position's department_id (or all org-level team_leads if the position
        has no department). The first one to act wins — the router already
        writes the decision atomically. If there are no team_leads we still
        set pending so an org_head or dept_admin can unblock it.
        """
        from backend.services.email_service import EmailService
        from backend.config import settings

        async with get_connection() as conn:
            # Fetch the position + submitting user
            pos_row = await conn.fetchrow(
                "SELECT id, role_name, department_id FROM positions WHERE id=$1 AND org_id=$2",
                position_id, org_id,
            )
            if not pos_row:
                raise ValueError(f"Position {position_id} not found")
            
            role_name = pos_row["role_name"]
            dept_id = pos_row["department_id"]

            # Check if auto-approve is enabled for the requester of the hire request
            hr_row = await conn.fetchrow(
                "SELECT requested_by FROM hire_requests WHERE position_id=$1 AND org_id=$2",
                position_id, org_id
            )
            is_auto_approved = False
            auto_approve_user_id = None
            if hr_row and hr_row["requested_by"]:
                user_row = await conn.fetchrow(
                    "SELECT id, auto_approve_jds FROM users WHERE id=$1 AND org_id=$2",
                    hr_row["requested_by"], org_id
                )
                if user_row and user_row["auto_approve_jds"]:
                    is_auto_approved = True
                    auto_approve_user_id = user_row["id"]

            submitter_row = await conn.fetchrow(
                "SELECT name, email FROM users WHERE id=$1 AND org_id=$2",
                submitted_by_user_id, org_id,
            )
            hr_name = submitter_row["name"] if submitter_row else "HR"

        if is_auto_approved:
            # We exit the connection context and call record_approval_decision directly
            await PositionService.record_approval_decision(
                position_id=position_id,
                org_id=org_id,
                approver_user_id=auto_approve_user_id,
                decision="approved",
                notes="Auto-approved via user settings."
            )
            return

        async with get_connection() as conn:
            # Set approval_status = pending
            await conn.execute(
                "UPDATE positions SET approval_status='pending', updated_at=NOW() WHERE id=$1",
                position_id,
            )

            # Audit log
            await AuditLogRepository.create(conn, {
                "org_id": org_id,
                "user_id": submitted_by_user_id,
                "action": "position_submitted_for_approval",
                "entity_type": "position",
                "entity_id": str(position_id),
                "details": json.dumps({"role_name": role_name})
            })

            # Find all team_leads in the same department (or org-wide if no dept)
            if dept_id:
                team_leads = await conn.fetch(
                    """
                    SELECT id, name, email FROM users
                    WHERE org_id=$1 AND role='team_lead' AND is_active=TRUE
                      AND (department_id=$2 OR department_id IS NULL)
                    ORDER BY id
                    """,
                    org_id, dept_id,
                )
            else:
                team_leads = await conn.fetch(
                    "SELECT id, name, email FROM users WHERE org_id=$1 AND role='team_lead' AND is_active=TRUE ORDER BY id",
                    org_id,
                )

            # In-app notification to each team_lead
            for tl in team_leads:
                await conn.execute(
                    """
                    INSERT INTO notifications (org_id, user_id, type, title, message, action_url)
                    VALUES ($1,$2,'jd_pending_approval','JD ready for your approval',
                            $3, $4)
                    """,
                    org_id, tl["id"],
                    f"\"{role_name}\" was submitted by {hr_name} and is waiting for your approval.",
                    f"/positions/{position_id}",
                )

        # Email each team_lead (outside the conn block — non-blocking)
        base_url = getattr(settings, "APP_BASE_URL", "https://app.aitalentlab.com")
        review_url = f"{base_url}/positions/{position_id}"
        for tl in team_leads:
            try:
                await EmailService.send_jd_ready_for_review(
                    to_email=tl["email"],
                    team_lead_name=tl["name"],
                    role_name=role_name,
                    hr_name=hr_name,
                    review_url=review_url,
                )
            except Exception as e:
                logger.warning(f"Could not email team_lead {tl['id']} for approval: {e}")

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
        """
        from backend.services.email_service import EmailService
        from backend.config import settings

        async with get_connection() as conn:
            pos_row = await conn.fetchrow(
                "SELECT role_name, created_by, department_id, approval_status FROM positions WHERE id=$1 AND org_id=$2",
                position_id, org_id,
            )
            if not pos_row:
                raise ValueError(f"Position {position_id} not found")

            # Idempotency: prevent double-fire of Celery sourcing on concurrent approvals.
            target_status = "approved" if decision == "approved" else "changes_requested"
            if pos_row["approval_status"] == target_status:
                return

            approver_row = await conn.fetchrow(
                "SELECT name FROM users WHERE id=$1 AND org_id=$2",
                approver_user_id, org_id,
            )
            approver_name = approver_row["name"] if approver_row else "Team Lead"

            hr_user_id = pos_row["created_by"]
            hr_row = await conn.fetchrow(
                "SELECT name, email FROM users WHERE id=$1 AND org_id=$2",
                hr_user_id, org_id,
            ) if hr_user_id else None
            hr_name = hr_row["name"] if hr_row else "HR"
            hr_email = hr_row["email"] if hr_row else None

            # On approved → flip status to open so the position is live
            if decision == "approved":
                await conn.execute(
                    """
                    UPDATE positions
                    SET approval_status='approved', approved_by=$1, approved_at=NOW(),
                        status='open', updated_at=NOW()
                    WHERE id=$2
                    """,
                    approver_user_id, position_id,
                )
            else:
                await conn.execute(
                    """
                    UPDATE positions
                    SET approval_status='changes_requested', updated_at=NOW()
                    WHERE id=$1
                    """,
                    position_id,
                )

            # In-app notification to HR
            if hr_user_id:
                msg = (
                    f"\"{pos_row['role_name']}\" was approved by {approver_name}. Sourcing has started."
                    if decision == "approved"
                    else f"\"{pos_row['role_name']}\" needs changes before approval. Notes: {notes or '—'}"
                )
                await conn.execute(
                    """
                    INSERT INTO notifications (org_id, user_id, type, title, message, action_url)
                    VALUES ($1,$2,'jd_approval_decision','JD approval update',$3,$4)
                    """,
                    org_id, hr_user_id, msg,
                    f"/positions/{position_id}",
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

        # Email HR (outside conn block)
        base_url = getattr(settings, "APP_BASE_URL", "https://app.aitalentlab.com")
        position_url = f"{base_url}/positions/{position_id}"
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
                logger.warning(f"Could not send approval-decision email to HR {hr_user_id}: {e}")

        # Fire Celery sourcing ONLY on approved
        if decision == "approved":
            try:
                from backend.tasks.candidate_pipeline import run_candidate_search
                run_candidate_search.delay(
                    position_id, org_id, dept_id, approver_user_id
                )
                logger.info(f"Candidate pipeline queued for position {position_id} after approval")
            except Exception as e:
                logger.warning(f"Could not enqueue candidate pipeline after approval: {e}")

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
