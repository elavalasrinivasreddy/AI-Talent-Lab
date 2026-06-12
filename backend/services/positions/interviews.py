import json
from typing import Optional

from backend.db.connection import get_connection
from backend.db.repositories.positions import PositionRepository
from backend.db.repositories.pipeline_events import PipelineEventRepository

class PositionInterviews:
    @staticmethod
    async def get_interview_kit(position_id: int, org_id: int) -> Optional[dict]:
        async with get_connection() as conn:
            kit = await PositionRepository.get_interview_kit(conn, position_id, org_id)
        if kit:
            if kit.get("questions") and isinstance(kit["questions"], str):
                try:
                    kit["questions"] = json.loads(kit["questions"])
                except Exception:
                    pass
            if kit.get("scorecard_template") and isinstance(kit["scorecard_template"], str):
                try:
                    kit["scorecard_template"] = json.loads(kit["scorecard_template"])
                except Exception:
                    pass
        return kit

    @staticmethod
    async def generate_interview_kit(
        position_id: int, org_id: int, user_id: int
    ) -> dict:
        async with get_connection() as conn:
            pos = await PositionRepository.get(conn, position_id, org_id)
        if not pos:
            raise ValueError("Position not found")

        from backend.agents.interview_kit import generate_interview_kit as ai_generate
        kit_data = await ai_generate(pos.get("jd_markdown", ""), pos.get("role_name", ""))

        async with get_connection() as conn:
            await PositionRepository.upsert_interview_kit(
                conn, position_id, org_id,
                kit_data.get("questions", []), kit_data.get("scorecard_template", [])
            )

            await PipelineEventRepository.create(conn, {
                "org_id": org_id,
                "position_id": position_id,
                "user_id": user_id,
                "event_type": "interview_kit_generated",
                "event_data": {"question_count": len(kit_data.get("questions", []))}
            })

        return kit_data
