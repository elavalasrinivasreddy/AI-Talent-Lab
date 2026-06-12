from typing import Optional
import asyncpg

from backend.db.repositories.hire_requests import HireRequestRepository
from backend.db.repositories.audit import AuditLogRepository
from backend.exceptions import NotFoundError, InsufficientPermissionsError, ValidationError, AppError
from .notifications import _notify_role, _notify_approvers_on_create, _notify

_VALID_WORK_TYPES = ("onsite", "remote", "hybrid")
_FILER_ROLES = {"team_lead", "dept_admin", "org_head"}
_APPROVER_ROLES = {"dept_admin", "org_head"}
_PICKUP_ROLES = {"hr", "org_head"}


class _BadTransitionError(AppError):
    def __init__(self, message: str):
        super().__init__("INVALID_TRANSITION", message, 400)


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
        raise ValidationError(f"Work type must be one of: {', '.join(_VALID_WORK_TYPES)}.")
    if (experience_min is not None and experience_min < 0) or (experience_max is not None and experience_max < 0):
        raise ValidationError("Experience must be a non-negative number.")
    if experience_min is not None and experience_max is not None and experience_min > experience_max:
        raise ValidationError("Min experience can't exceed max experience.")
    if (comp_min is not None and comp_min < 0) or (comp_max is not None and comp_max < 0):
        raise ValidationError("Compensation values must be non-negative.")
    if comp_min is not None and comp_max is not None and comp_min > comp_max:
        raise ValidationError("Comp min can't exceed comp max.")


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
    eff_status = status
    if eff_status is None:
        if role in ("hr", "org_head") and scope not in ("mine", "all"):
            eff_status = "approved"
    if eff_status == "all":
        eff_status = None

    if scope == "mine":
        return await HireRequestRepository.list_for_org(
            conn, org_id, status=eff_status, requested_by=user_id,
            department_id=department_id, cursor_created_at=cursor_created_at,
            cursor_id=cursor_id, limit=limit,
        )
    if scope == "all":
        if role not in ("org_head", "hr"):
            raise InsufficientPermissionsError("Only admins or recruiters can list all hire requests.")
        return await HireRequestRepository.list_for_org(
            conn, org_id, status=eff_status, department_id=department_id,
            cursor_created_at=cursor_created_at, cursor_id=cursor_id, limit=limit,
        )

    if role == "team_lead":
        return await HireRequestRepository.list_for_org(
            conn, org_id, status=eff_status, requested_by=user_id,
            cursor_created_at=cursor_created_at, cursor_id=cursor_id, limit=limit,
        )
    if role == "dept_admin":
        from backend.db.repositories.users import UserRepository
        user = await UserRepository.get_by_id(conn, user_id, org_id)
        return await HireRequestRepository.list_for_org(
            conn, org_id, status=eff_status,
            department_id=(user or {}).get("department_id"),
            cursor_created_at=cursor_created_at, cursor_id=cursor_id, limit=limit,
        )
    if role == "hr":
        from backend.db.repositories.users import UserRepository
        user = await UserRepository.get_by_id(conn, user_id, org_id)
        hr_dept_id = (user or {}).get("department_id")
        if hr_dept_id is None:
            return [], None
        return await HireRequestRepository.list_for_org(
            conn, org_id, status=eff_status, department_id=hr_dept_id,
            cursor_created_at=cursor_created_at, cursor_id=cursor_id, limit=limit,
        )
    return await HireRequestRepository.list_for_org(
        conn, org_id, status=eff_status,
        cursor_created_at=cursor_created_at, cursor_id=cursor_id, limit=limit,
    )


async def get_pending_count_for_user(
    conn: asyncpg.Connection, *, org_id: int, user_id: int, role: str
) -> int:
    from backend.db.repositories.users import UserRepository
    user = await UserRepository.get_by_id(conn, user_id, org_id)
    department_id = (user or {}).get("department_id")

    if role == "dept_admin":
        return await HireRequestRepository.count_pending(conn, org_id, department_id=department_id, status="pending")
    elif role == "hr":
        return await HireRequestRepository.count_pending(conn, org_id, department_id=department_id, status="approved")
    elif role == "org_head":
        return await HireRequestRepository.count_pending(conn, org_id, status="approved")
    return 0


async def get(conn: asyncpg.Connection, request_id: int, org_id: int) -> dict:
    row = await HireRequestRepository.get_by_id(conn, request_id, org_id)
    if not row:
        raise NotFoundError("Hire request not found")
    return dict(row)


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
    priority: str = "normal",
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
        raise InsufficientPermissionsError("Your role can't file hire requests.")
    _validate_payload(
        role_name=role_name, headcount=headcount, work_type=work_type,
        experience_min=experience_min, experience_max=experience_max,
        comp_min=comp_min, comp_max=comp_max,
    )

    is_auto_approved = False
    created = None

    async with conn.transaction():
        created = await HireRequestRepository.create(
            conn, org_id=org_id, requested_by=user_id, role_name=role_name,
            department_id=department_id, headcount=headcount, priority=priority,
            work_type=work_type, experience_min=experience_min,
            experience_max=experience_max, target_start=target_start,
            requirements=requirements, comp_min=comp_min, comp_max=comp_max,
            location=location,
        )

        if department_id is not None:
            from backend.db.repositories.departments import DeptRepository
            dept = await DeptRepository.get_by_id(conn, department_id, org_id)
            if dept and dept.get("auto_approve_hire_requests"):
                is_auto_approved = True

        if is_auto_approved:
            await HireRequestRepository.approve(conn, created["id"], org_id, approved_by=None)
            await AuditLogRepository.create(
                conn, org_id=org_id, user_id=user_id, action="hire_request_auto_approved",
                entity_type="hire_request", entity_id=str(created["id"]),
                details={"role_name": role_name, "headcount": headcount},
                ip_address=ip_address,
            )
            await _notify_role(
                conn, org_id=org_id, role="hr", type="hire_request_approved",
                title="Hire request ready for pickup (Auto-approved)",
                message=f"{role_name} hire request is ready for pickup.",
                action_url=f"/hire-requests/{created['id']}", department_id=department_id,
            )
        else:
            action_url = f"/hire-requests/{created['id']}"
            msg = f"New hire request: {role_name} ({headcount} headcount)"
            if department_id:
                await _notify_role(
                    conn, org_id=org_id, role="dept_admin", type="hire_request_pending",
                    title="New hire request awaiting approval", message=msg,
                    action_url=action_url, department_id=department_id,
                )
            else:
                await _notify_role(
                    conn, org_id=org_id, role="org_head", type="hire_request_pending",
                    title="New hire request awaiting approval", message=msg,
                    action_url=action_url,
                )

        await AuditLogRepository.create(
            conn, org_id=org_id, user_id=user_id, action="hire_request_created",
            entity_type="hire_request", entity_id=str(created["id"]),
            details={"role_name": role_name, "headcount": headcount},
            ip_address=ip_address,
        )

    if not is_auto_approved:
        await _notify_approvers_on_create(
            conn, org_id=org_id, request_id=created["id"], role_name=role_name,
            department_id=department_id, action_url=f"/hire-requests/{created['id']}",
        )
    else:
        reloaded = await HireRequestRepository.get_by_id(conn, created["id"], org_id)
        if reloaded is not None:
            created = reloaded

    if created is None:
        raise RuntimeError("Failed to process hire request")

    return created


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
    existing = await get(conn, request_id, org_id)
    is_owner = existing["requested_by"] == user_id
    is_admin = role in ("org_head", "dept_admin")
    if not (is_owner or is_admin):
        raise InsufficientPermissionsError("You can only edit your own hire requests.")
    if existing["status"] != "pending":
        raise _BadTransitionError(f"Cannot edit a request that is already {existing['status']}.")
    _validate_payload(
        role_name=fields.get("role_name", existing["role_name"]),
        headcount=fields.get("headcount", existing["headcount"]),
        work_type=fields.get("work_type", existing["work_type"]),
        experience_min=fields.get("experience_min", existing["experience_min"]),
        experience_max=fields.get("experience_max", existing["experience_max"]),
        comp_min=fields.get("comp_min", existing["comp_min"]),
        comp_max=fields.get("comp_max", existing["comp_max"]),
    )
    updated = await HireRequestRepository.update(conn, request_id, org_id, **fields)
    if updated is None:
        raise NotFoundError("Hire request not found")

    await AuditLogRepository.create(
        conn, org_id=org_id, user_id=user_id, action="hire_request_updated",
        entity_type="hire_request", entity_id=str(request_id),
        details={k: v for k, v in fields.items() if v is not None},
        ip_address=ip_address,
    )
    return updated


async def cancel(
    conn: asyncpg.Connection,
    request_id: int,
    org_id: int,
    *,
    user_id: int,
    role: str,
    caller_dept_id: Optional[int] = None,
    ip_address: Optional[str] = None,
) -> dict:
    existing = await get(conn, request_id, org_id)
    is_owner = existing["requested_by"] == user_id
    is_admin = role in ("org_head", "dept_admin")
    if not (is_owner or is_admin):
        raise InsufficientPermissionsError("You can only cancel your own hire requests.")
    if role == "dept_admin" and caller_dept_id != existing.get("department_id"):
        raise InsufficientPermissionsError("You can only cancel hire requests in your department.")
    if existing["status"] in ("cancelled", "fulfilled", "rejected"):
        raise _BadTransitionError(f"Request is already {existing['status']}.")

    async with conn.transaction():
        cancelled = await HireRequestRepository.cancel(conn, request_id, org_id, notes=None)
        if not cancelled:
            return await get(conn, request_id, org_id)

        if existing["requested_by"] and existing["requested_by"] != user_id:
            canceller_name = await HireRequestRepository.get_user_name(conn, user_id) or "An admin"
            await _notify(
                conn, org_id=org_id, user_id=existing["requested_by"],
                type="hire_request_cancelled", title="Hire request cancelled",
                message=f"Your request for {existing['role_name']} was cancelled by {canceller_name}.",
                action_url=f"/hire-requests/{request_id}",
            )

        if existing["status"] == "accepted" and existing["accepted_by"]:
            await _notify(
                conn, org_id=org_id, user_id=existing["accepted_by"],
                type="hire_request_cancelled", title="Hire request cancelled",
                message=f"{existing['role_name']} was cancelled by the requester.",
                action_url=f"/hire-requests/{request_id}",
            )

        await AuditLogRepository.create(
            conn, org_id=org_id, user_id=user_id, action="hire_request_cancelled",
            entity_type="hire_request", entity_id=str(request_id),
            ip_address=ip_address,
        )
    return await get(conn, request_id, org_id)


async def link_session_to_position(
    conn: asyncpg.Connection,
    request_id: int,
    org_id: int,
    *,
    user_id: int,
    session_id: str,
    ip_address: Optional[str] = None,
) -> dict:
    position_id = await HireRequestRepository.get_chat_session_position(conn, session_id, org_id)
    if not position_id:
        raise ValidationError("Session has no linked position yet.")

    existing = await get(conn, request_id, org_id)
    if existing["status"] not in ("accepted", "approved"):
        return existing

    async with conn.transaction():
        await HireRequestRepository.link_position(conn, request_id, org_id, position_id=position_id)
        await HireRequestRepository.submit_position_for_approval(conn, position_id, org_id)

        if existing["requested_by"]:
            await _notify(
                conn, org_id=org_id, user_id=existing["requested_by"],
                type="jd_ready_for_approval", title="JD ready for your review",
                message=f"{existing['role_name']} job description is ready — review and approve.",
                action_url=f"/hire-requests/{request_id}",
            )

        await AuditLogRepository.create(
            conn, org_id=org_id, user_id=user_id, action="hire_request_fulfilled",
            entity_type="hire_request", entity_id=str(request_id),
            details={"position_id": position_id}, ip_address=ip_address,
        )
    return await get(conn, request_id, org_id)
