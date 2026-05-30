"""
tasks/scheduled_search.py – Periodic scheduled search Celery task.

Runs hourly via Celery Beat. For each open position whose `next_search_at`
is in the past, triggers a new candidate sourcing + ATS scoring cycle.

Per project rules: Celery + Redis for ALL background tasks from day one.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from backend.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine from a sync Celery task."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(asyncio.run, coro).result()
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


@celery_app.task(name="backend.tasks.scheduled_search.run_scheduled_searches")
def run_scheduled_searches() -> dict:
    """
    Hourly task: find open positions that need re-searching and trigger
    candidate sourcing for each.

    A position needs re-searching when:
      - status is 'open'
      - next_search_at is NULL or in the past
      - jd_markdown is not empty (has a JD to match against)
    """
    async def _search():
        from backend.db.connection import get_connection

        async with get_connection() as conn:
            positions = await conn.fetch(
                """
                SELECT id, org_id, role_name, search_interval_hours,
                       last_search_at, jd_markdown
                FROM positions
                WHERE status='open'
                  AND jd_markdown IS NOT NULL
                  AND jd_markdown != ''
                  AND (next_search_at IS NULL OR next_search_at <= NOW())
                ORDER BY next_search_at ASC NULLS FIRST
                LIMIT 20
                """
            )

            if not positions:
                return {"searched": 0, "message": "No positions need re-searching"}

            searched = 0
            for pos in positions:
                try:
                    # Update search timestamps
                    interval = pos["search_interval_hours"] or 24
                    await conn.execute(
                        """
                        UPDATE positions
                        SET last_search_at = NOW(),
                            next_search_at = NOW() + ($2 || ' hours')::interval
                        WHERE id = $1
                        """,
                        pos["id"], str(interval),
                    )

                    # Trigger the candidate pipeline task
                    from backend.tasks.candidate_pipeline import source_candidates_for_position
                    source_candidates_for_position.delay(pos["id"], pos["org_id"])

                    logger.info(
                        f"Triggered sourcing for position {pos['id']} "
                        f"({pos['role_name']}) — next search in {interval}h"
                    )
                    searched += 1
                except Exception as e:
                    logger.error(f"Failed to trigger search for position {pos['id']}: {e}")

            return {"searched": searched, "total_due": len(positions)}

    result = _run_async(_search())
    logger.info(f"Scheduled search complete: {result}")
    return result
