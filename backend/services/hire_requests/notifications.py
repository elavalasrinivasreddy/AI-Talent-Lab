from typing import Optional
import asyncpg

from backend.db.repositories.hire_requests import HireRequestRepository


async def _notify(
    conn: asyncpg.Connection,
    *,
    org_id: int,
    user_id: int,
    type: str,
    title: str,
    message: str,
    action_url: Optional[str] = None,
) -> None:
    await HireRequestRepository.create_notification(conn, org_id, user_id, type, title, message, action_url)


async def _notify_role(
    conn: asyncpg.Connection,
    *,
    org_id: int,
    role: str,
    type: str,
    title: str,
    message: str,
    action_url: Optional[str] = None,
    department_id: Optional[int] = None,
) -> None:
    users = await HireRequestRepository.get_active_users_by_role(conn, org_id, role, department_id)
    for u in users:
        await HireRequestRepository.create_notification(conn, org_id, u["id"], type, title, message, action_url)


async def _notify_approvers_on_create(
    conn: asyncpg.Connection,
    *,
    org_id: int,
    request_id: int,
    role_name: str,
    department_id: Optional[int],
    action_url: str,
) -> None:
    from backend.services.email_service import EmailService
    req = await HireRequestRepository.get_by_id(conn, request_id, org_id)
    req_dict = dict(req) if req else {}
    raiser_name = req_dict.get("requested_by_name") or "A team member"
    dept_name = req_dict.get("department_name") or "General"

    approvers = await HireRequestRepository.get_approvers_for_dept(conn, org_id, department_id)
    for approver in approvers:
        await EmailService.send_hire_request_raised(
            to_email=approver["email"],
            dept_admin_name=approver["name"],
            raiser_name=raiser_name,
            role_name=role_name,
            dept_name=dept_name,
            request_url=action_url,
        )
