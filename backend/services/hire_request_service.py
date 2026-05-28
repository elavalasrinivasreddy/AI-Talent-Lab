"""
services/hire_request_service.py – Business logic for hire requests.

Stateless; operates on the connection passed in. Enforces:
  • who can create / edit / accept / cancel
  • status-transition rules
  • notification fan-out
  • audit log

Status lifecycle (Phase 1 — simple):
    pending → accepted (recruiter pickup) → fulfilled (JD chat saves a position)
       │
       └→ cancelled
The full multi-approver relay (dept-head → finance → recruiter) is Phase 2 per
docs/redesign/09_hire_request.md §13.
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


# Roles allowed to file a hire request. dept_admin and hiring_manager are the
# obvious filers; admin can file on behalf of either (e.g. demo seeding).
_FILER_ROLES = {"team_lead", "dept_admin", "org_head"}

# Roles allowed to pick up a pending request.
_PICKUP_ROLES = {"hr", "org_head"}

_VALID_WORK_TYPES = ("onsite", "remote", "hybrid")


class _BadTransitionError(AppError):
    """Raised when the caller asks for a status transition that isn't allowed."""

    def __init__(self, message: str):
        super().__init__("INVALID_TRANSITION", message, 400)


class HireRequestService:
    """All mutating + filtered-read operations for hire requests."""

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
    ) -> List[dict]:
        """
        Role-aware list. Caller can override with explicit `status`/`department_id`.

        scope:
          "default" — role-appropriate default view:
              admin / recruiter   → all `pending` (the work queue)
              hiring_manager      → only the user's own requests (all statuses)
              dept_admin          → all requests in their department
          "mine"     — only requests filed by this user
          "all"      — every request in the org (admin/recruiter only)
        """
        eff_status = status

        if scope == "mine":
            return await HireRequestRepository.list_for_org(
                conn, org_id, status=eff_status, requested_by=user_id,
                department_id=department_id,
            )

        if scope == "all":
            if role not in ("org_head", "hr"):
                raise InsufficientPermissionsError(
                    "Only admins or recruiters can list all hire requests."
                )
            return await HireRequestRepository.list_for_org(
                conn, org_id, status=eff_status, department_id=department_id,
            )

        # scope == "default"
        if role == "team_lead":
            return await HireRequestRepository.list_for_org(
                conn, org_id, status=eff_status, requested_by=user_id,
            )
        if role == "dept_admin":
            # dept_admin sees their dept; if they have no dept they see nothing
            # rather than the whole org — safer default.
            from backend.db.repositories.users import UserRepository
            user = await UserRepository.get_by_id(conn, user_id, org_id)
            return await HireRequestRepository.list_for_org(
                conn, org_id, status=eff_status,
                department_id=(user or {}).get("department_id"),
            )
        # admin / recruiter — default to the pending work queue
        return await HireRequestRepository.list_for_org(
            conn, org_id, status=eff_status or "pending",
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
        return row

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

            # Notify admins + recruiters that there's new work.
            # Explicit ::text casts: asyncpg cannot infer TEXT context for the
            # int params used inside the ' || ' concatenation chain.
            msg = f"{role_name} ({headcount} headcount)"
            action_url = f"/hire-requests/{created['id']}"
            await conn.execute(
                """
                INSERT INTO notifications (org_id, user_id, type, title, message, action_url)
                SELECT $1, u.id, 'hire_request',
                       'New hire request', $2, $3
                  FROM users u
                 WHERE u.org_id = $1
                   AND u.role IN ('admin', 'recruiter')
                   AND u.is_active = TRUE
                """,
                org_id, msg, action_url,
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
        return created

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

    # ── Accept (recruiter pickup) ─────────────────────────────────────────

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
                "Only recruiters or admins can pick up hire requests."
            )
        existing = await HireRequestService.get(conn, request_id, org_id)
        if existing["status"] == "accepted":
            raise _BadTransitionError(
                f"Already picked up by {existing.get('accepted_by_name') or 'someone'}."
            )
        if existing["status"] != "pending":
            raise _BadTransitionError(
                f"Request is {existing['status']} — cannot pick up."
            )

        async with conn.transaction():
            await HireRequestRepository.accept(
                conn, request_id, org_id, accepted_by=user_id,
                chat_session_id=chat_session_id,
            )

            if existing["requested_by"]:
                await conn.execute(
                    """
                    INSERT INTO notifications (org_id, user_id, type, title, message, action_url)
                    VALUES ($1, $2, 'hire_request_accepted',
                            'Your hire request was picked up',
                            $3, $4)
                    """,
                    org_id, existing["requested_by"],
                    f"{existing['role_name']} is being processed.",
                    f"/hire-requests/{request_id}",
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
        return await HireRequestService.get(conn, request_id, org_id)

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
        if existing["status"] in ("cancelled", "fulfilled"):
            raise _BadTransitionError(
                f"Request is already {existing['status']}."
            )

        async with conn.transaction():
            await HireRequestRepository.cancel(conn, request_id, org_id)

            # Notify the recruiter who had it (if accepted)
            if existing["status"] == "accepted" and existing["accepted_by"]:
                await conn.execute(
                    """
                    INSERT INTO notifications (org_id, user_id, type, title, message, action_url)
                    VALUES ($1, $2, 'hire_request_cancelled',
                            'Hire request cancelled',
                            $3, $4)
                    """,
                    org_id, existing["accepted_by"],
                    f"{existing['role_name']} was cancelled by the requester.",
                    f"/hire-requests/{request_id}",
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
        if existing["status"] not in ("accepted", "pending"):
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
                await conn.execute(
                    """
                    INSERT INTO notifications (org_id, user_id, type, title, message, action_url)
                    VALUES ($1, $2, 'jd_ready_for_approval',
                            'JD ready for your review',
                            $3, $4)
                    """,
                    org_id, existing["requested_by"],
                    f"{existing['role_name']} job description is ready — review and approve.",
                    f"/hire-requests/{request_id}",
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
        if not role_name or not str(role_name).strip():
            raise ValidationError("Role name is required.")
        if len(str(role_name).strip()) > 200:
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
