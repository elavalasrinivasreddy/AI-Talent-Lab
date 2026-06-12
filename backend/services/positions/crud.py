import json
import logging
from typing import Optional

from backend.db.connection import get_connection
from backend.db.repositories.positions import PositionRepository
from backend.db.repositories.pipeline_events import PipelineEventRepository
from backend.db.repositories.audit import AuditLogRepository

logger = logging.getLogger(__name__)

VALID_STATUSES = {
    "draft", "jd_in_progress", "pending_jd_approval",
    "draft_needs_revision", "open", "on_hold", "closed",
    "archived", "cancelled",
}

class PositionCRUD:
    @staticmethod
    async def get_position(position_id: int, org_id: int) -> Optional[dict]:
        async with get_connection() as conn:
            pos = await PositionRepository.get_with_stats(conn, position_id, org_id)
            if not pos:
                return None
            pos.pop("jd_embedding", None)
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

                if new_status in ("closed", "archived"):
                    await PositionRepository.auto_pool_candidates(conn, position_id, org_id)

        if pos:
            pos.pop("jd_embedding", None)
        return pos

    @staticmethod
    async def update_ats_config_post_open(
        position_id: int,
        org_id: int,
        user_id: int,
        role: str,
        ats_threshold: Optional[float] = None,
        search_interval_hours: Optional[int] = None,
    ) -> dict:
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
