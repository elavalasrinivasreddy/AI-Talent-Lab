from typing import Optional
import asyncpg

from backend.db.repositories.hire_requests import HireRequestRepository
from backend.db.repositories.audit import AuditLogRepository
from backend.exceptions import InsufficientPermissionsError, ValidationError
from .crud import get, _BadTransitionError, _APPROVER_ROLES
from .notifications import _notify, _notify_role


async def begin_review(
    conn: asyncpg.Connection,
    request_id: int,
    org_id: int,
    *,
    user_id: int,
    role: str,
    ip_address: Optional[str] = None,
) -> dict:
    if role not in _APPROVER_ROLES:
        raise InsufficientPermissionsError("Only dept_admin or org_head can review hire requests.")

    acquired = await HireRequestRepository.begin_review(conn, request_id, org_id, admin_user_id=user_id)
    if acquired:
        await AuditLogRepository.create(
            conn, org_id=org_id, user_id=user_id, action="hire_request_review_started",
            entity_type="hire_request", entity_id=str(request_id), ip_address=ip_address,
        )
        return await get(conn, request_id, org_id)

    existing = await get(conn, request_id, org_id)

    if existing["status"] == "admin_reviewing":
        if existing.get("reviewing_locked_by") == user_id:
            return existing

        took = await HireRequestRepository.takeover_review(conn, request_id, org_id, admin_user_id=user_id)
        if not took:
            locked_name = existing.get("reviewing_locked_by_name") or "another admin"
            raise _BadTransitionError(
                f"This request is currently being reviewed by {locked_name}. Try again in a few minutes."
            )

        await AuditLogRepository.create(
            conn, org_id=org_id, user_id=user_id, action="hire_request_review_takeover",
            entity_type="hire_request", entity_id=str(request_id), ip_address=ip_address,
        )
        return await get(conn, request_id, org_id)

    raise _BadTransitionError(
        f"Can only begin review on a submitted request; current status is '{existing['status']}'."
    )


async def release_review(
    conn: asyncpg.Connection,
    request_id: int,
    org_id: int,
    *,
    user_id: int,
    ip_address: Optional[str] = None,
) -> dict:
    existing = await get(conn, request_id, org_id)

    if existing["status"] != "admin_reviewing":
        raise _BadTransitionError("Request is not currently under review.")

    if existing.get("reviewing_locked_by") != user_id:
        from backend.db.repositories.users import UserRepository
        user = await UserRepository.get_by_id(conn, user_id, org_id)
        if not user or user.get("role") != "org_head":
            raise InsufficientPermissionsError("Only the reviewing admin or org_head can release this lock.")

    await HireRequestRepository.release_review_lock(conn, request_id, org_id)

    await AuditLogRepository.create(
        conn, org_id=org_id, user_id=user_id, action="hire_request_review_released",
        entity_type="hire_request", entity_id=str(request_id), ip_address=ip_address,
    )
    return await get(conn, request_id, org_id)


async def approve_modified(
    conn: asyncpg.Connection,
    request_id: int,
    org_id: int,
    *,
    user_id: int,
    role: str,
    dept_id: Optional[int],
    notes: str,
    modification_diff: dict,
    ip_address: Optional[str] = None,
) -> dict:
    if role not in _APPROVER_ROLES:
        raise InsufficientPermissionsError("Only dept_admin or org_head can approve hire requests.")
    if not notes or not notes.strip():
        raise ValidationError("Notes are required when approving with modifications.")

    existing = await get(conn, request_id, org_id)

    if role == "dept_admin":
        if not existing.get("department_id"):
            raise InsufficientPermissionsError("Org-level hire requests can only be approved by org_head.")
        if dept_id != existing["department_id"]:
            raise InsufficientPermissionsError("You can only approve hire requests for your own department.")

    if existing["status"] not in ("pending", "submitted", "admin_reviewing"):
        raise _BadTransitionError(
            f"Can only approve a pending/reviewing request; current status is '{existing['status']}'."
        )

    async with conn.transaction():
        await HireRequestRepository.approve_modified(
            conn, request_id, org_id, approved_by=user_id,
            notes=notes.strip(), modification_diff=modification_diff,
        )

        if existing["requested_by"]:
            await _notify(
                conn, org_id=org_id, user_id=existing["requested_by"],
                type="hire_request_approved_modified",
                title="Your hire request was approved with modifications",
                message=(
                    f"Your request for {existing['role_name']} was approved "
                    f"with a note from the reviewer: {notes.strip()}"
                ),
                action_url=f"/hire-requests/{request_id}",
            )

        await _notify_role(
            conn, org_id=org_id, role="hr", type="hire_request_approved",
            title="Hire request ready for pickup (modified)",
            message=f"{existing['role_name']} hire request is ready for pickup with modifications.",
            action_url=f"/hire-requests/{request_id}",
            department_id=existing.get("department_id"),
        )

        await AuditLogRepository.create(
            conn, org_id=org_id, user_id=user_id, action="hire_request_approved_modified",
            entity_type="hire_request", entity_id=str(request_id),
            details={"notes": notes.strip()}, ip_address=ip_address,
        )

    updated = await get(conn, request_id, org_id)

    from backend.services.email_service import EmailService
    approver_name = updated.get("approved_by_name") or "Your approver"
    request_url = f"/hire-requests/{request_id}"

    if existing.get("requested_by_email"):
        await EmailService.send_hire_request_approved(
            to_email=existing["requested_by_email"],
            recipient_name=existing.get("requested_by_name") or "Team member",
            role_name=existing["role_name"],
            dept_name=existing.get("department_name") or "General",
            approver_name=approver_name,
            request_url=request_url,
            note=notes.strip(),
        )

    return updated
