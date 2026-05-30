"""
services/hire_request_service.py – Business logic for hire requests.

Stateless; operates on the connection passed in. Enforces:
  • who can create / edit / approve / reject / accept / cancel
  • status-transition rules
  • notification fan-out
  • audit log

Status lifecycle:
    pending → approved  (dept_admin or org_head approves)
       │         │
       │         └→ accepted (HR pickup) → fulfilled (JD chat saves position)
       │         │
       │         └→ cancelled
       └→ rejected  (terminal; dept_admin/org_head rejects with reason)
       └→ cancelled

Email touchpoints:
    create   → send_hire_request_raised        → dept_admins of the dept (or org_head)
    approve  → send_hire_request_approved      → raiser + all HR in the org
    reject   → send_hire_request_rejected      → raiser
    accept   → send_hire_request_picked_up     → raiser
"""
from typing import Optional, List
import asyncpg

from backend.db.repositories.hire_requests import HireRequestRepository
from backend.db.repositories.audit import AuditLogRepository
from backend.exceptions import (
    NotFoundError,
    ValidationError,
    InsufficientPermissionsError,
    AppError,
)

# ── Status constants ───────────────────────────────────────────────────────────

STATUSES = {"pending", "approved", "rejected", "accepted", "cancelled", "fulfilled"}

# Roles allowed to file a hire request.
_FILER_ROLES = {"team_lead", "dept_admin", "org_head"}

# Roles allowed to approve/reject (dept_admin checked by dept match in service).
_APPROVER_ROLES = {"dept_admin", "org_head"}

# Roles allowed to pick up an approved request.
_PICKUP_ROLES = {"hr", "org_head"}

_VALID_WORK_TYPES = ("onsite", "remote", "hybrid")


class _BadTransitionError(AppError):
    """Raised when the caller asks for a status transition that isn't allowed."""

    def __init__(self, message: str):
        super().__init__("INVALID_TRANSITION", message, 400)


class HireRequestService:
    """All mutating + filtered-read operations for hire requests."""

    # ── Notification helpers (in-transaction, share caller's connection) ────

    @staticmethod
    async def _notify(conn, *, org_id, user_id, type, title, message, action_url=None):
        await conn.execute(
            "INSERT INTO notifications (org_id, user_id, type, title, message, action_url) VALUES ($1,$2,$3,$4,$5,$6)",
            org_id, user_id, type, title, message, action_url,
        )

    @staticmethod
    async def _notify_role(conn, *, org_id, role, type, title, message, action_url=None, department_id=None):
        """Notify all active users with the given role (optionally scoped to a department)."""
        query = "SELECT id FROM users WHERE org_id=$1 AND role=$2 AND is_active=TRUE"
        params = [org_id, role]
        if department_id is not None:
            query += " AND department_id=$3"
            params.append(department_id)
        users = await conn.fetch(query, *params)
        for u in users:
            await conn.execute(
                "INSERT INTO notifications (org_id, user_id, type, title, message, action_url) VALUES ($1,$2,$3,$4,$5,$6)",
                org_id, u["id"], type, title, message, action_url,
            )

    # ── List ──────────────────────────────────────────────────────────────

    @staticmethod
    async def list_for_user(
        conn: asyncpg.Connection,
        *,
        org_id: int,
        user_id: int,
        role: str,
        scope: str = "default",
        status: Optional[str] = None,
        department_id: Optional[int] = None,
        cursor_created_at: Optional[str] = None,
        cursor_id: Optional[int] = None,
        limit: int = 50,
    ):
        """
        Role-aware list. Caller can override with explicit `status`/`department_id`.
        Returns (rows, next_cursor) for seek pagination.

        scope:
          "default" — role-appropriate default view:
              hr / org_head   → approved requests (the HR work queue)
              team_lead       → only the user's own requests (all statuses)
              dept_admin      → dept's requests, no status filter (they see pending
                                prominently and can act on them)
          "mine"     — only requests filed by this user
          "all"      — every request in the org (org_head/hr only)
        """
        eff_status = status

        if scope == "mine":
            return await HireRequestRepository.list_for_org(
                conn, org_id, status=eff_status, requested_by=user_id,
                department_id=department_id,
                cursor_created_at=cursor_created_at, cursor_id=cursor_id,
                limit=limit,
            )

        if scope == "all":
            if role not in ("org_head", "hr"):
                raise InsufficientPermissionsError(
                    "Only admins or recruiters can list all hire requests."
                )
            return await HireRequestRepository.list_for_org(
                conn, org_id, status=eff_status, department_id=department_id,
                cursor_created_at=cursor_created_at, cursor_id=cursor_id,
                limit=limit,
            )

        # scope == "default"
        if role == "team_lead":
            return await HireRequestRepository.list_for_org(
                conn, org_id, status=eff_status, requested_by=user_id,
                cursor_created_at=cursor_created_at, cursor_id=cursor_id,
                limit=limit,
            )
        if role == "dept_admin":
            # dept_admin sees their dept; if they have no dept they see nothing
            # rather than the whole org — safer default.
            from backend.db.repositories.users import UserRepository
            user = await UserRepository.get_by_id(conn, user_id, org_id)
            return await HireRequestRepository.list_for_org(
                conn, org_id, status=eff_status,
                department_id=(user or {}).get("department_id"),
                cursor_created_at=cursor_created_at, cursor_id=cursor_id,
                limit=limit,
            )
        if role == "hr":
            # hr sees approved requests for their dept; if they have no dept they see nothing
            from backend.db.repositories.users import UserRepository
            user = await UserRepository.get_by_id(conn, user_id, org_id)
            return await HireRequestRepository.list_for_org(
                conn, org_id, status=eff_status or "approved",
                department_id=(user or {}).get("department_id"),
                cursor_created_at=cursor_created_at, cursor_id=cursor_id,
                limit=limit,
            )
        # org_head — default to the approved work queue (ready for pickup) across the org
        return await HireRequestRepository.list_for_org(
            conn, org_id, status=eff_status or "approved",
            cursor_created_at=cursor_created_at, cursor_id=cursor_id,
            limit=limit,
        )

    # ── Get one ───────────────────────────────────────────────────────────

    @staticmethod
    async def get(
        conn: asyncpg.Connection,
        request_id: int,
        org_id: int,
    ) -> dict:
        row = await HireRequestRepository.get_by_id(conn, request_id, org_id)
        if not row:
            raise NotFoundError("Hire request not found")
        return dict(row)

    # ── Create ────────────────────────────────────────────────────────────

    @staticmethod
    async def create(
        conn: asyncpg.Connection,
        *,
        org_id: int,
        user_id: int,
        role: str,
        ip_address: Optional[str] = None,
        role_name: str,
        department_id: Optional[int] = None,
        headcount: int = 1,
        work_type: str = "onsite",
        experience_min: Optional[int] = None,
        experience_max: Optional[int] = None,
        target_start: Optional[str] = None,
        requirements: Optional[str] = None,
        comp_min: Optional[int] = None,
        comp_max: Optional[int] = None,
        location: Optional[str] = None,
    ) -> dict:
        if role not in _FILER_ROLES:
            raise InsufficientPermissionsError(
                "Your role can't file hire requests."
            )
        HireRequestService._validate_payload(
            role_name=role_name,
            headcount=headcount,
            work_type=work_type,
            experience_min=experience_min,
            experience_max=experience_max,
            comp_min=comp_min,
            comp_max=comp_max,
        )

        async with conn.transaction():
            created = await HireRequestRepository.create(
                conn,
                org_id=org_id,
                requested_by=user_id,
                role_name=role_name,
                department_id=department_id,
                headcount=headcount,
                work_type=work_type,
                experience_min=experience_min,
                experience_max=experience_max,
                target_start=target_start,
                requirements=requirements,
                comp_min=comp_min,
                comp_max=comp_max,
                location=location,
            )

            is_auto_approved = False
            if department_id:
                from backend.db.repositories.departments import DeptRepository
                dept = await DeptRepository.get_by_id(conn, department_id, org_id)
                if dept and dept.get("auto_approve_hire_requests"):
                    is_auto_approved = True

            if is_auto_approved:
                # Bypass pending, go straight to approved
                await HireRequestRepository.approve(conn, created["id"], org_id, approved_by=None)
                
                await AuditLogRepository.create(
                    conn,
                    org_id=org_id,
                    user_id=user_id,
                    action="hire_request_auto_approved",
                    entity_type="hire_request",
                    entity_id=str(created["id"]),
                    details={"role_name": role_name, "headcount": headcount},
                    ip_address=ip_address,
                )
                
                # Notify HR directly
                await HireRequestService._notify_role(
                    conn,
                    org_id=org_id,
                    role="hr",
                    type="hire_request_approved",
                    title="Hire request ready for pickup (Auto-approved)",
                    message=f"{role_name} hire request is ready for pickup.",
                    action_url=f"/hire-requests/{created['id']}",
                    department_id=department_id,
                )
            else:
                # Notify dept_admins (or org_head if no dept_admins) about new request.
                action_url = f"/hire-requests/{created['id']}"
                msg = f"New hire request: {role_name} ({headcount} headcount)"
                if department_id:
                    await HireRequestService._notify_role(
                        conn,
                        org_id=org_id,
                        role="dept_admin",
                        type="hire_request_pending",
                        title="New hire request awaiting approval",
                        message=msg,
                        action_url=action_url,
                        department_id=department_id,
                    )
                else:
                    # No dept — notify org_head
                    await HireRequestService._notify_role(
                        conn,
                        org_id=org_id,
                        role="org_head",
                        type="hire_request_pending",
                        title="New hire request awaiting approval",
                        message=msg,
                        action_url=action_url,
                    )

            await AuditLogRepository.create(
                conn,
                org_id=org_id,
                user_id=user_id,
                action="hire_request_created",
                entity_type="hire_request",
                entity_id=str(created["id"]),
                details={"role_name": role_name, "headcount": headcount},
                ip_address=ip_address,
            )

        if not is_auto_approved:
            # Fire email to dept_admins (or org_head) — outside transaction so it
            # doesn't block / roll back the create on email failure.
            await HireRequestService._notify_approvers_on_create(
                conn,
                org_id=org_id,
                request_id=created["id"],
                role_name=role_name,
                department_id=department_id,
                action_url=f"/hire-requests/{created['id']}",
            )
        else:
            # Need to reload it to get the updated status for response
            created = await HireRequestRepository.get_by_id(conn, created["id"], org_id)

        return created

    @staticmethod
    async def _notify_approvers_on_create(
        conn: asyncpg.Connection,
        *,
        org_id: int,
        request_id: int,
        role_name: str,
        department_id: Optional[int],
        action_url: str,
    ) -> None:
        """Send hire_request_raised email to dept_admins (or org_head fallback)."""
        from backend.services.email_service import EmailService

        # Get raiser info from the request itself
        req = await HireRequestRepository.get_by_id(conn, request_id, org_id)
        req_dict = dict(req) if req else {}
        raiser_name = req_dict.get("requested_by_name") or "A team member"
        dept_name = req_dict.get("department_name") or "General"

        if department_id:
            approvers = await conn.fetch(
                """
                SELECT u.email, u.name
                  FROM users u
                 WHERE u.org_id = $1
                   AND u.role = 'dept_admin'
                   AND u.department_id = $2
                   AND u.is_active = TRUE
                """,
                org_id, department_id,
            )
        else:
            approvers = []

        if not approvers:
            # Fallback: org_head
            approvers = await conn.fetch(
                """
                SELECT u.email, u.name
                  FROM users u
                 WHERE u.org_id = $1
                   AND u.role = 'org_head'
                   AND u.is_active = TRUE
                """,
                org_id,
            )

        for approver in approvers:
            await EmailService.send_hire_request_raised(
                to_email=approver["email"],
                dept_admin_name=approver["name"],
                raiser_name=raiser_name,
                role_name=role_name,
                dept_name=dept_name,
                request_url=action_url,
            )

    # ── Approve ───────────────────────────────────────────────────────────

    @staticmethod
    async def approve_request(
        conn: asyncpg.Connection,
        request_id: int,
        org_id: int,
        *,
        user_id: int,
        role: str,
        dept_id: Optional[int],
        ip_address: Optional[str] = None,
    ) -> dict:
        """
        Transition pending → approved.

        Permission: dept_admin whose dept matches the request's department_id,
        or org_head (can approve any request).
        """
        if role not in _APPROVER_ROLES:
            raise InsufficientPermissionsError(
                "Only dept_admin or org_head can approve hire requests."
            )

        existing = await HireRequestService.get(conn, request_id, org_id)

        # dept_admin can only approve requests scoped to their own department.
        # Org-level requests (department_id is NULL) must be approved by org_head.
        if role == "dept_admin":
            if not existing.get("department_id"):
                raise InsufficientPermissionsError(
                    "Org-level hire requests can only be approved by org_head."
                )
            if dept_id != existing["department_id"]:
                raise InsufficientPermissionsError(
                    "You can only approve hire requests for your own department."
                )

        if existing["status"] != "pending":
            raise _BadTransitionError(
                f"Can only approve a pending request; current status is '{existing['status']}'."
            )

        async with conn.transaction():
            await HireRequestRepository.approve(
                conn, request_id, org_id, approved_by=user_id,
            )

            # Notify raiser
            if existing["requested_by"]:
                await HireRequestService._notify(
                    conn,
                    org_id=org_id,
                    user_id=existing["requested_by"],
                    type="hire_request_approved",
                    title="Your hire request was approved",
                    message=f"Your request for {existing['role_name']} has been approved.",
                    action_url=f"/hire-requests/{request_id}",
                )

            # Notify HR users (all HR in org; or dept-scoped if dept set)
            await HireRequestService._notify_role(
                conn,
                org_id=org_id,
                role="hr",
                type="hire_request_approved",
                title="Hire request ready for pickup",
                message=f"{existing['role_name']} hire request is ready for pickup.",
                action_url=f"/hire-requests/{request_id}",
                department_id=existing.get("department_id"),
            )

            await AuditLogRepository.create(
                conn,
                org_id=org_id,
                user_id=user_id,
                action="hire_request_approved",
                entity_type="hire_request",
                entity_id=str(request_id),
                ip_address=ip_address,
            )

        updated = await HireRequestService.get(conn, request_id, org_id)

        # Send emails outside transaction
        from backend.services.email_service import EmailService

        approver_name = updated.get("approved_by_name") or "Your approver"
        request_url = f"/hire-requests/{request_id}"

        # Email raiser
        if existing.get("requested_by_email"):
            await EmailService.send_hire_request_approved(
                to_email=existing["requested_by_email"],
                recipient_name=existing.get("requested_by_name") or "Team member",
                role_name=existing["role_name"],
                dept_name=existing.get("department_name") or "General",
                approver_name=approver_name,
                request_url=request_url,
            )

        # Email all HR users in org
        hr_users = await conn.fetch(
            "SELECT email, name FROM users WHERE org_id = $1 AND role = 'hr' AND is_active = TRUE",
            org_id,
        )
        for hr in hr_users:
            await EmailService.send_hire_request_approved(
                to_email=hr["email"],
                recipient_name=hr["name"],
                role_name=existing["role_name"],
                dept_name=existing.get("department_name") or "General",
                approver_name=approver_name,
                request_url=request_url,
            )

        return updated

    # ── Reject ────────────────────────────────────────────────────────────

    @staticmethod
    async def reject_request(
        conn: asyncpg.Connection,
        request_id: int,
        org_id: int,
        *,
        user_id: int,
        role: str,
        dept_id: Optional[int],
        reason: str,
        ip_address: Optional[str] = None,
    ) -> dict:
        """
        Transition pending → rejected (terminal).

        Permission: dept_admin (dept-matched) or org_head.
        """
        if role not in _APPROVER_ROLES:
            raise InsufficientPermissionsError(
                "Only dept_admin or org_head can reject hire requests."
            )
        if not reason or not reason.strip():
            raise ValidationError("A rejection reason is required.")

        existing = await HireRequestService.get(conn, request_id, org_id)

        # Same scoping as approve_request — dept_admin cannot act on deptless requests.
        if role == "dept_admin":
            if not existing.get("department_id"):
                raise InsufficientPermissionsError(
                    "Org-level hire requests can only be rejected by org_head."
                )
            if dept_id != existing["department_id"]:
                raise InsufficientPermissionsError(
                    "You can only reject hire requests for your own department."
                )

        if existing["status"] != "pending":
            raise _BadTransitionError(
                f"Can only reject a pending request; current status is '{existing['status']}'."
            )

        async with conn.transaction():
            await HireRequestRepository.reject(
                conn, request_id, org_id, rejection_reason=reason.strip(),
            )

            # Notify raiser
            if existing["requested_by"]:
                await HireRequestService._notify(
                    conn,
                    org_id=org_id,
                    user_id=existing["requested_by"],
                    type="hire_request_rejected",
                    title="Your hire request was not approved",
                    message=f"Your request for {existing['role_name']} was not approved.",
                    action_url=f"/hire-requests/{request_id}",
                )

            await AuditLogRepository.create(
                conn,
                org_id=org_id,
                user_id=user_id,
                action="hire_request_rejected",
                entity_type="hire_request",
                entity_id=str(request_id),
                details={"reason": reason.strip()},
                ip_address=ip_address,
            )

        updated = await HireRequestService.get(conn, request_id, org_id)

        # Email raiser outside transaction
        from backend.services.email_service import EmailService

        # Fetch approver name
        approver_row = await conn.fetchrow(
            "SELECT name FROM users WHERE id = $1", user_id,
        )
        approver_name = (approver_row["name"] if approver_row else None) or "Your approver"

        raiser_email = existing.get("requested_by_email")
        if raiser_email:
            await EmailService.send_hire_request_rejected(
                to_email=raiser_email,
                raiser_name=existing.get("requested_by_name") or "Team member",
                role_name=existing["role_name"],
                reason=reason.strip(),
                approver_name=approver_name,
            )

        return updated

    # ── Update (editable while pending) ──────────────────────────────────

    @staticmethod
    async def update(
        conn: asyncpg.Connection,
        request_id: int,
        org_id: int,
        *,
        user_id: int,
        role: str,
        ip_address: Optional[str] = None,
        **fields,
    ) -> dict:
        existing = await HireRequestService.get(conn, request_id, org_id)
        is_owner = existing["requested_by"] == user_id
        is_admin = role in ("org_head", "dept_admin")
        if not (is_owner or is_admin):
            raise InsufficientPermissionsError(
                "You can only edit your own hire requests."
            )
        if existing["status"] != "pending":
            raise _BadTransitionError(
                f"Cannot edit a request that is already {existing['status']}."
            )
        HireRequestService._validate_payload(
            role_name=fields.get("role_name", existing["role_name"]),
            headcount=fields.get("headcount", existing["headcount"]),
            work_type=fields.get("work_type", existing["work_type"]),
            experience_min=fields.get("experience_min", existing["experience_min"]),
            experience_max=fields.get("experience_max", existing["experience_max"]),
            comp_min=fields.get("comp_min", existing["comp_min"]),
            comp_max=fields.get("comp_max", existing["comp_max"]),
        )
        updated = await HireRequestRepository.update(
            conn, request_id, org_id, **fields,
        )
        if updated is None:
            raise NotFoundError("Hire request not found")

        await AuditLogRepository.create(
            conn,
            org_id=org_id,
            user_id=user_id,
            action="hire_request_updated",
            entity_type="hire_request",
            entity_id=str(request_id),
            details={k: v for k, v in fields.items() if v is not None},
            ip_address=ip_address,
        )
        return updated

    # ── Accept (HR pickup) ────────────────────────────────────────────────

    @staticmethod
    async def accept(
        conn: asyncpg.Connection,
        request_id: int,
        org_id: int,
        *,
        user_id: int,
        role: str,
        chat_session_id: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> dict:
        if role not in _PICKUP_ROLES:
            raise InsufficientPermissionsError(
                "Only HR or org_head can pick up hire requests."
            )
        existing = await HireRequestService.get(conn, request_id, org_id)
        if existing["status"] == "accepted":
            raise _BadTransitionError(
                f"Already picked up by {existing.get('accepted_by_name') or 'someone'}."
            )
        if existing["status"] == "pending":
            raise _BadTransitionError(
                "This request is still awaiting dept_admin approval. "
                "It must be approved before HR can pick it up."
            )
        if existing["status"] != "approved":
            raise _BadTransitionError(
                f"Request is {existing['status']} — cannot pick up."
            )

        async with conn.transaction():
            await HireRequestRepository.accept(
                conn, request_id, org_id, accepted_by=user_id,
                chat_session_id=chat_session_id,
            )

            if existing["requested_by"]:
                await HireRequestService._notify(
                    conn,
                    org_id=org_id,
                    user_id=existing["requested_by"],
                    type="hire_request_accepted",
                    title="HR is now working on your hire request",
                    message=f"{existing['role_name']} is being processed by HR.",
                    action_url=f"/hire-requests/{request_id}",
                )

            await AuditLogRepository.create(
                conn,
                org_id=org_id,
                user_id=user_id,
                action="hire_request_accepted",
                entity_type="hire_request",
                entity_id=str(request_id),
                ip_address=ip_address,
            )

        updated = await HireRequestService.get(conn, request_id, org_id)

        # Email raiser: HR picked up
        from backend.services.email_service import EmailService
        hr_row = await conn.fetchrow(
            "SELECT name FROM users WHERE id = $1", user_id,
        )
        hr_name = (hr_row["name"] if hr_row else None) or "HR"

        raiser_email = existing.get("requested_by_email")
        if raiser_email:
            await EmailService.send_hire_request_picked_up(
                to_email=raiser_email,
                raiser_name=existing.get("requested_by_name") or "Team member",
                role_name=existing["role_name"],
                hr_name=hr_name,
                request_url=f"/hire-requests/{request_id}",
            )

        return updated

    # ── Cancel ────────────────────────────────────────────────────────────

    @staticmethod
    async def cancel(
        conn: asyncpg.Connection,
        request_id: int,
        org_id: int,
        *,
        user_id: int,
        role: str,
        ip_address: Optional[str] = None,
    ) -> dict:
        existing = await HireRequestService.get(conn, request_id, org_id)
        is_owner = existing["requested_by"] == user_id
        is_admin = role in ("org_head", "dept_admin")
        if not (is_owner or is_admin):
            raise InsufficientPermissionsError(
                "You can only cancel your own hire requests."
            )
        if existing["status"] in ("cancelled", "fulfilled", "rejected"):
            raise _BadTransitionError(
                f"Request is already {existing['status']}."
            )

        async with conn.transaction():
            await HireRequestRepository.cancel(conn, request_id, org_id)

            # Notify the recruiter who had it (if accepted)
            if existing["status"] == "accepted" and existing["accepted_by"]:
                await HireRequestService._notify(
                    conn,
                    org_id=org_id,
                    user_id=existing["accepted_by"],
                    type="hire_request_cancelled",
                    title="Hire request cancelled",
                    message=f"{existing['role_name']} was cancelled by the requester.",
                    action_url=f"/hire-requests/{request_id}",
                )

            await AuditLogRepository.create(
                conn,
                org_id=org_id,
                user_id=user_id,
                action="hire_request_cancelled",
                entity_type="hire_request",
                entity_id=str(request_id),
                ip_address=ip_address,
            )
        return await HireRequestService.get(conn, request_id, org_id)

    # ── Link to position created by JD chat ──────────────────────────────

    @staticmethod
    async def link_session_to_position(
        conn: asyncpg.Connection,
        request_id: int,
        org_id: int,
        *,
        user_id: int,
        session_id: str,
        ip_address: Optional[str] = None,
    ) -> dict:
        """
        Called by the chat client when the JD generation step persists a
        position. Reads `chat_sessions.position_id`, links it to the request,
        and auto-submits the position for HM JD approval.
        """
        session = await conn.fetchrow(
            "SELECT position_id FROM chat_sessions WHERE id = $1 AND org_id = $2",
            session_id, org_id,
        )
        if not session or not session["position_id"]:
            raise ValidationError("Session has no linked position yet.")

        position_id = session["position_id"]
        existing = await HireRequestService.get(conn, request_id, org_id)
        if existing["status"] not in ("accepted", "approved"):
            # If it's already fulfilled/cancelled, leave it alone.
            return existing

        async with conn.transaction():
            await HireRequestRepository.link_position(
                conn, request_id, org_id, position_id=position_id,
            )

            # Auto-submit the position for hiring-manager JD approval
            await conn.execute(
                """
                UPDATE positions
                   SET requires_approval = TRUE,
                       approval_status = 'pending',
                       updated_at = NOW()
                 WHERE id = $1 AND org_id = $2
                """,
                position_id, org_id,
            )

            if existing["requested_by"]:
                await HireRequestService._notify(
                    conn,
                    org_id=org_id,
                    user_id=existing["requested_by"],
                    type="jd_ready_for_approval",
                    title="JD ready for your review",
                    message=f"{existing['role_name']} job description is ready — review and approve.",
                    action_url=f"/hire-requests/{request_id}",
                )

            await AuditLogRepository.create(
                conn,
                org_id=org_id,
                user_id=user_id,
                action="hire_request_fulfilled",
                entity_type="hire_request",
                entity_id=str(request_id),
                details={"position_id": position_id},
                ip_address=ip_address,
            )
        return await HireRequestService.get(conn, request_id, org_id)

    # ── Helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def _validate_payload(
        *,
        role_name: Optional[str],
        headcount: Optional[int],
        work_type: Optional[str],
        experience_min: Optional[int],
        experience_max: Optional[int],
        comp_min: Optional[int],
        comp_max: Optional[int],
    ) -> None:
        if not role_name or not role_name.strip():
            raise ValidationError("Role name is required.")
        if len(role_name.strip()) > 200:
            raise ValidationError("Role name is too long.")
        if headcount is not None and (headcount < 1 or headcount > 100):
            raise ValidationError("Headcount must be between 1 and 100.")
        if work_type and work_type not in _VALID_WORK_TYPES:
            raise ValidationError(
                f"Work type must be one of: {', '.join(_VALID_WORK_TYPES)}."
            )
        if (experience_min is not None and experience_min < 0) or (
            experience_max is not None and experience_max < 0
        ):
            raise ValidationError("Experience must be a non-negative number.")
        if (
            experience_min is not None and experience_max is not None
            and experience_min > experience_max
        ):
            raise ValidationError("Min experience can't exceed max experience.")
        if (comp_min is not None and comp_min < 0) or (
            comp_max is not None and comp_max < 0
        ):
            raise ValidationError("Compensation values must be non-negative.")
        if (
            comp_min is not None and comp_max is not None
            and comp_min > comp_max
        ):
            raise ValidationError("Comp min can't exceed comp max.")
