import json
import logging
from backend.db.connection import get_connection
from backend.db.repositories.candidates import CandidateRepository
from backend.db.repositories.pipeline_events import PipelineEventRepository

logger = logging.getLogger(__name__)

class PositionPipeline:
    @staticmethod
    async def trigger_search_now(
        position_id: int, org_id: int, department_id: int, user_id: int
    ) -> dict:
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
