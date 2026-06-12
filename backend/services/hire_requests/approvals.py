from typing import Optional
import asyncpg

from backend.db.repositories.hire_requests import HireRequestRepository
from backend.db.repositories.audit import AuditLogRepository
from backend.exceptions import InsufficientPermissionsError, ValidationError
from .crud import get, _BadTransitionError, _APPROVER_ROLES, _PICKUP_ROLES
from .notifications import _notify, _notify_role


async def approve_request(
    conn: asyncpg.Connection,
    request_id: int,
    org_id: int,
    *,
    user_id: int,
    role: str,
    dept_id: Optional[int],
    note: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> dict:
    note = note.strip() if note else None
    if role not in _APPROVER_ROLES:
        raise InsufficientPermissionsError("Only dept_admin or org_head can approve hire requests.")

    existing = await get(conn, request_id, org_id)

    if not note and existing.get("notes"):
        note = existing["notes"].strip()

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
        await HireRequestRepository.approve(conn, request_id, org_id, approved_by=user_id)

        if existing["requested_by"]:
            if note:
                raiser_title = "Your hire request was reviewed and approved"
                raiser_message = (
                    f"Your request for {existing['role_name']} was approved "
                    f"with a note from the reviewer: {note}"
                )
            else:
                raiser_title = "Your hire request was approved"
                raiser_message = f"Your request for {existing['role_name']} has been approved."
            await _notify(
                conn, org_id=org_id, user_id=existing["requested_by"],
                type="hire_request_approved", title=raiser_title, message=raiser_message,
                action_url=f"/hire-requests/{request_id}",
            )

        await _notify_role(
            conn, org_id=org_id, role="hr", type="hire_request_approved",
            title="Hire request ready for pickup",
            message=f"{existing['role_name']} hire request is ready for pickup.",
            action_url=f"/hire-requests/{request_id}",
            department_id=existing.get("department_id"),
        )

        await AuditLogRepository.create(
            conn, org_id=org_id, user_id=user_id, action="hire_request_approved",
            entity_type="hire_request", entity_id=str(request_id),
            details={"note": note} if note else None, ip_address=ip_address,
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
            note=note,
        )

    hr_users = await HireRequestRepository.get_active_users_by_role(conn, org_id, role="hr")
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
    if role not in _APPROVER_ROLES:
        raise InsufficientPermissionsError("Only dept_admin or org_head can reject hire requests.")
    if not reason or not reason.strip():
        raise ValidationError("A rejection reason is required.")

    existing = await get(conn, request_id, org_id)

    if role == "dept_admin":
        if not existing.get("department_id"):
            raise InsufficientPermissionsError("Org-level hire requests can only be rejected by org_head.")
        if dept_id != existing["department_id"]:
            raise InsufficientPermissionsError("You can only reject hire requests for your own department.")

    if existing["status"] not in ("pending", "submitted", "admin_reviewing"):
        raise _BadTransitionError(
            f"Can only reject a pending/reviewing request; current status is '{existing['status']}'."
        )

    async with conn.transaction():
        await HireRequestRepository.reject(conn, request_id, org_id, rejection_reason=reason.strip())

        if existing["requested_by"]:
            await _notify(
                conn, org_id=org_id, user_id=existing["requested_by"],
                type="hire_request_rejected", title="Your hire request was not approved",
                message=f"Your request for {existing['role_name']} was not approved.",
                action_url=f"/hire-requests/{request_id}",
            )

        await AuditLogRepository.create(
            conn, org_id=org_id, user_id=user_id, action="hire_request_rejected",
            entity_type="hire_request", entity_id=str(request_id),
            details={"reason": reason.strip()}, ip_address=ip_address,
        )

    updated = await get(conn, request_id, org_id)

    from backend.services.email_service import EmailService
    approver_name = await HireRequestRepository.get_user_name(conn, user_id) or "Your approver"

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
        raise InsufficientPermissionsError("Only HR or org_head can pick up hire requests.")
    existing = await get(conn, request_id, org_id)
    if existing["status"] == "accepted":
        raise _BadTransitionError(f"Already picked up by {existing.get('accepted_by_name') or 'someone'}.")
    if existing["status"] in ("pending", "submitted", "admin_reviewing"):
        raise _BadTransitionError(
            "This request is still awaiting admin approval. It must be approved before HR can pick it up."
        )
    if existing["status"] not in ("approved", "approved_modified"):
        raise _BadTransitionError(f"Request is {existing['status']} — cannot pick up.")

    async with conn.transaction():
        await HireRequestRepository.accept(
            conn, request_id, org_id, accepted_by=user_id, chat_session_id=chat_session_id
        )

        if existing["requested_by"]:
            await _notify(
                conn, org_id=org_id, user_id=existing["requested_by"],
                type="hire_request_accepted", title="HR is now working on your hire request",
                message=f"{existing['role_name']} is being processed by HR.",
                action_url=f"/hire-requests/{request_id}",
            )

        await AuditLogRepository.create(
            conn, org_id=org_id, user_id=user_id, action="hire_request_accepted",
            entity_type="hire_request", entity_id=str(request_id), ip_address=ip_address,
        )

    updated = await get(conn, request_id, org_id)

    from backend.services.email_service import EmailService
    hr_name = await HireRequestRepository.get_user_name(conn, user_id) or "HR"

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
