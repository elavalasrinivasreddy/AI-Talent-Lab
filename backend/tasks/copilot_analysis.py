"""
tasks/copilot_analysis.py – Hourly AI Copilot suggestion generation.
Runs for every active org and writes fresh suggestions to copilot_suggestions.
"""
import logging
import asyncio

from backend.celery_app import celery_app
from backend.services.copilot_service import CopilotService

logger = logging.getLogger(__name__)


@celery_app.task(name="backend.tasks.copilot_analysis.generate_copilot_suggestions")
def generate_copilot_suggestions() -> dict:
    """
    Hourly task: generate AI Copilot suggestions for all active orgs.
    Analyses pipeline data and writes actionable suggestions to DB.
    """
    logger.info("Starting copilot suggestion generation...")

    async def _run():
        from backend.db.connection import get_connection
        async with get_connection() as conn:
            org_ids = await conn.fetch(
                "SELECT id FROM organizations ORDER BY id"
            )

        total = 0
        for row in org_ids:
            try:
                count = await CopilotService.generate_for_org(row["id"])
                total += count
            except Exception as e:
                logger.error(f"Copilot generation failed for org {row['id']}: {e}")

        return total

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, _run())
                total = future.result(timeout=300)
        else:
            total = loop.run_until_complete(_run())

        logger.info(f"Copilot: generated {total} suggestions across all orgs")
        return {"status": "ok", "suggestions_created": total}
    except Exception as e:
        logger.error(f"Copilot task failed: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}
