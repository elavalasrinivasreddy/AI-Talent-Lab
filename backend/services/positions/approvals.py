import json
import logging
from typing import Optional

from backend.db.connection import get_connection
from backend.db.repositories.positions import PositionRepository
from backend.db.repositories.audit import AuditLogRepository
from backend.db.repositories.notifications import NotificationRepository
from backend.db.repositories.users import UserRepository

logger = logging.getLogger(__name__)

class PositionApprovals:
    @staticmethod
    async def resolve_reviewer(
        position_id: int,
        org_id: int,
        user_id: int,
    ) -> dict:
        async with get_connection() as conn:
            pos = await PositionRepository.get(conn, position_id, org_id)
            if not pos:
                raise ValueError(f"Position {position_id} not found")

            dept_id = pos.get("department_id")

            user_row = await UserRepository.get_by_id(conn, user_id, org_id)
            if not user_row or not user_row.get("is_active"):
                return {"reviewer_id": None, "warning": "User not found or inactive", "is_bypass": False}

            creator_role = user_row["role"]

            if creator_role == "org_head":
                return {
                    "reviewer_id": None, "reviewer_name": None, "reviewer_role": None,
                    "department": None, "is_bypass": True, "warning": None,
                }

            reviewer_id = None
            reviewer_name = None
            reviewer_role = None
            reviewer_dept = None
            warning = None

            from backend.services.settings_service import SettingsService
            org_settings = await SettingsService.get_ai_behavior(conn, org_id)
            hr_requires_review = org_settings.get("direct_hire_hr_requires_review", True)
            dept_admin_requires_org_review = org_settings.get("direct_hire_dept_admin_requires_org_head_review", True)

            async def get_active_user_by_role(role_name: str, dept_id: Optional[int] = None):
                query = f"SELECT id, name FROM users WHERE org_id=$1 AND role=$2 AND is_active=TRUE"
                params = [org_id, role_name]
                if dept_id:
                    query += f" AND department_id=$3"
                    params.append(dept_id)
                query += " ORDER BY id LIMIT 1"
                return await conn.fetchrow(query, *params)

            if creator_role == "dept_admin":
                if not dept_admin_requires_org_review:
                    return {
                        "reviewer_id": None, "reviewer_name": None, "reviewer_role": None,
                        "department": None, "is_bypass": True, "warning": None,
                    }
                oh = await get_active_user_by_role('org_head')
                if oh:
                    reviewer_id = oh["id"]
                    reviewer_name = oh["name"]
                    reviewer_role = "org_head"
                else:
                    warning = "No org head configured. Contact your workspace admin."

            elif creator_role == "hr":
                if not hr_requires_review:
                    return {
                        "reviewer_id": None, "reviewer_name": None, "reviewer_role": None,
                        "department": None, "is_bypass": True, "warning": None,
                    }

                tl_row = await PositionRepository.get_team_lead_from_hire_request(conn, position_id, org_id)
                if tl_row:
                    reviewer_id = tl_row["id"]
                    reviewer_name = tl_row["name"]
                    reviewer_role = "team_lead"
                elif dept_id:
                    da = await get_active_user_by_role('dept_admin', dept_id)
                    if da:
                        reviewer_id = da["id"]
                        reviewer_name = da["name"]
                        reviewer_role = "dept_admin"
                        dept_row = await conn.fetchrow("SELECT name FROM departments WHERE id=$1", dept_id)
                        reviewer_dept = dept_row["name"] if dept_row else None
                    else:
                        oh = await get_active_user_by_role('org_head')
                        if oh:
                            reviewer_id = oh["id"]
                            reviewer_name = oh["name"]
                            reviewer_role = "org_head"
                            warning = "No dept admin configured. Defaulting to org head."
                        else:
                            warning = "No reviewer available. Contact your workspace admin."
                else:
                    oh = await get_active_user_by_role('org_head')
                    if oh:
                        reviewer_id = oh["id"]
                        reviewer_name = oh["name"]
                        reviewer_role = "org_head"
                    else:
                        warning = "No org head configured. Contact your workspace admin."

            elif creator_role == "team_lead":
                if dept_id:
                    da = await get_active_user_by_role('dept_admin', dept_id)
                    if da:
                        reviewer_id = da["id"]
                        reviewer_name = da["name"]
                        reviewer_role = "dept_admin"
                    else:
                        oh = await get_active_user_by_role('org_head')
                        if oh:
                            reviewer_id = oh["id"]
                            reviewer_name = oh["name"]
                            reviewer_role = "org_head"
                            warning = "No dept admin configured. Defaulting to org head."
                else:
                    oh = await get_active_user_by_role('org_head')
                    if oh:
                        reviewer_id = oh["id"]
                        reviewer_name = oh["name"]
                        reviewer_role = "org_head"

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

    @staticmethod
    async def submit_for_approval(
        position_id: int,
        org_id: int,
        submitted_by_user_id: int,
        ats_threshold: Optional[float] = None,
        search_interval_hours: Optional[int] = None,
    ) -> None:
        from backend.services.email_service import EmailService
        from backend.config import settings

        reviewer_info = await PositionApprovals.resolve_reviewer(
            position_id, org_id, submitted_by_user_id,
        )

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
                pos_row = await PositionRepository.get_for_update(conn, position_id, org_id)
                if not pos_row:
                    raise ValueError(f"Position {position_id} not found")

                if pos_row["status"] not in ("jd_in_progress", "draft_needs_revision"):
                    raise ValueError(
                        f"Cannot submit from status '{pos_row['status']}'. "
                        f"Position must be in jd_in_progress or draft_needs_revision."
                    )

                role_name = pos_row["role_name"]
                dept_id = pos_row["department_id"]

                submitter_row = await UserRepository.get_by_id(conn, submitted_by_user_id, org_id)
                hr_name = submitter_row["name"] if submitter_row else "HR"
                submitter_role = submitter_row["role"] if submitter_row else "hr"
                auto_approve = bool(submitter_row and submitter_row.get("auto_approve_jds"))

                if ats_threshold is not None or search_interval_hours is not None:
                    ats_update = {}
                    if ats_threshold is not None:
                        ats_update["ats_threshold"] = ats_threshold
                    if search_interval_hours is not None:
                        ats_update["search_interval_hours"] = search_interval_hours
                    await PositionRepository.update(conn, position_id, org_id, ats_update)

                if is_bypass:
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

                    await NotificationRepository.create(conn, {
                        "org_id": org_id,
                        "user_id": reviewer_id,
                        "type": "jd_pending_approval",
                        "title": "JD ready for your approval",
                        "message": f"\"{role_name}\" was submitted by {hr_name} and is waiting for your approval.",
                        "action_url": f"/positions/{position_id}/jd"
                    })

                    reviewer_row = await UserRepository.get_by_id(conn, reviewer_id, org_id)

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
        from backend.services.email_service import EmailService
        from backend.config import settings

        async with get_connection() as conn:
            approver_row = await UserRepository.get_by_id(conn, approver_user_id, org_id)
            if not approver_row:
                raise ValueError("Approver user not found")
            approver_name = approver_row["name"]
            approver_role = approver_row["role"]

            hr_row = None
            hr_user_id = None

            async with conn.transaction():
                pos_row = await PositionRepository.get_for_update(conn, position_id, org_id)
                if not pos_row:
                    raise ValueError(f"Position {position_id} not found")

                if approver_role != "org_head":
                    if pos_row["reviewer_id"] is None:
                        raise PermissionError(
                            "No reviewer assigned to this position. Only org_head can approve."
                        )
                    if approver_user_id != pos_row["reviewer_id"]:
                        raise PermissionError(
                            "You are not the assigned reviewer for this position."
                        )
                    if pos_row["department_id"] and approver_row["department_id"]:
                        if approver_row["department_id"] != pos_row["department_id"]:
                            raise PermissionError(
                                "You can only review positions in your own department."
                            )

                target_status = "approved" if decision == "approved" else "changes_requested"
                if pos_row["approval_status"] == target_status:
                    return

                hr_user_id = pos_row["created_by"]
                if hr_user_id:
                    hr_row = await UserRepository.get_by_id(conn, hr_user_id, org_id)
                hr_name = hr_row["name"] if hr_row else "HR"
                hr_email = hr_row["email"] if hr_row else None

                if decision == "approved":
                    success = await PositionRepository.approve_and_open(
                        conn, position_id, org_id, approver_user_id,
                    )
                    if not success:
                        raise ValueError(
                            f"Cannot approve — position is not pending approval "
                            f"(current status: {pos_row['status']})"
                        )
                    await PositionRepository.fulfill_hire_request(
                        conn, position_id, org_id,
                    )
                else:
                    success = await PositionRepository.reject_to_revision(
                        conn, position_id, org_id, notes or None,
                    )
                    if not success:
                        raise ValueError(
                            f"Cannot reject — position is not pending approval "
                            f"(current status: {pos_row['status']})"
                        )
                    new_cycle = await PositionRepository.increment_revision_cycle(
                        conn, position_id, org_id,
                    )

                    try:
                        await PositionRepository.inject_feedback(
                            conn, position_id, org_id, notes, new_cycle
                        )
                    except Exception as e:
                        logger.warning(f"Feedback injection failed: {e}")

                if hr_user_id:
                    msg = (
                        f"\"{pos_row['role_name']}\" was approved by {approver_name}. Sourcing has started."
                        if decision == "approved"
                        else f"\"{pos_row['role_name']}\" needs changes. Notes: {notes or '—'}"
                    )
                    await NotificationRepository.create(conn, {
                        "org_id": org_id,
                        "user_id": hr_user_id,
                        "type": "jd_approval_decision",
                        "title": "JD approval update",
                        "message": msg,
                        "action_url": f"/positions/{position_id}/jd"
                    })

                await AuditLogRepository.create(conn, {
                    "org_id": org_id,
                    "user_id": approver_user_id,
                    "action": f"position_{decision}",
                    "entity_type": "position",
                    "entity_id": str(position_id),
                    "details": json.dumps({"role_name": pos_row["role_name"], "notes": notes})
                })

            dept_id = pos_row["department_id"]

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

        if decision == "approved":
            try:
                from backend.tasks.candidate_pipeline import run_candidate_search
                run_candidate_search.delay(
                    position_id, org_id, dept_id, approver_user_id
                )
                logger.info(f"Candidate pipeline queued for position {position_id}")
            except Exception as e:
                logger.warning(f"Could not enqueue candidate pipeline: {e}")

    @staticmethod
    async def cancel_jd_in_progress(
        position_id: int,
        org_id: int,
        user_id: int,
        role: str,
        notes: str,
    ) -> dict:
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

                if pos.get("picked_up_by"):
                    tl_row = await UserRepository.get_by_id(conn, user_id, org_id)
                    tl_name = tl_row["name"] if tl_row else "Team Lead"
                    await NotificationRepository.create(conn, {
                        "org_id": org_id,
                        "user_id": pos["picked_up_by"],
                        "type": "jd_cancelled",
                        "title": "Hire request cancelled",
                        "message": f"The hire request for \"{pos['role_name']}\" was cancelled by {tl_name}. Notes: {notes.strip()}",
                        "action_url": f"/positions/{position_id}"
                    })

                await AuditLogRepository.create(conn, {
                    "org_id": org_id,
                    "user_id": user_id,
                    "action": "position_cancelled_by_tl",
                    "entity_type": "position",
                    "entity_id": str(position_id),
                    "details": json.dumps({"notes": notes.strip()})
                })

        return {"ok": True, "status": "cancelled"}

    @staticmethod
    async def withdraw_submission(
        position_id: int,
        org_id: int,
        user_id: int,
    ) -> dict:
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

                if reviewer_id:
                    hr_row = await UserRepository.get_by_id(conn, user_id, org_id)
                    hr_name = hr_row["name"] if hr_row else "HR"
                    await NotificationRepository.create(conn, {
                        "org_id": org_id,
                        "user_id": reviewer_id,
                        "type": "submission_withdrawn",
                        "title": "JD submission withdrawn",
                        "message": f"The JD for \"{pos['role_name']}\" was withdrawn by {hr_name}. No action needed.",
                        "action_url": f"/positions/{position_id}/jd"
                    })

                await AuditLogRepository.create(conn, {
                    "org_id": org_id,
                    "user_id": user_id,
                    "action": "position_submission_withdrawn",
                    "entity_type": "position",
                    "entity_id": str(position_id),
                    "details": json.dumps({"role_name": pos["role_name"]})
                })

        return {"ok": True, "status": "jd_in_progress"}

    @staticmethod
    async def re_resolve_reviewers_on_user_delete(
        deleted_user_id: int,
        org_id: int,
    ) -> int:
        reassigned = 0
        async with get_connection() as conn:
            positions = await PositionRepository.get_positions_pending_review_by_user(
                conn, deleted_user_id, org_id,
            )
            for pos in positions:
                dept_id = pos.get("department_id")
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
                    await NotificationRepository.create(conn, {
                        "org_id": org_id,
                        "user_id": new_reviewer,
                        "type": "reviewer_reassigned",
                        "title": "JD review assigned to you",
                        "message": f"You have been assigned to review a JD (position #{pos['id']}).",
                        "action_url": f"/positions/{pos['id']}/jd"
                    })
                    reassigned += 1

        return reassigned
