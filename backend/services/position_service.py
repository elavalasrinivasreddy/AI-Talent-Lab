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
    async def get_interview_kit(position_id: int, org_id: int) -> Optional[dict]:
        async with get_connection() as conn:
            kit = await PositionRepository.get_interview_kit(conn, position_id, org_id)
        if kit and kit.get("questions") and isinstance(kit["questions"], str):
            try:
                kit["questions"] = json.loads(kit["questions"])
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
