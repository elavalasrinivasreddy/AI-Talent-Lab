"""
tasks/auth_cleanup.py – Periodic cleanup of consumed magic links.
Runs daily via Celery Beat to purge consumed_magic_links rows older than 30 days.
Per project rules: Celery + Redis for ALL background tasks from day one.

Recommended cron schedule (Celery Beat):
    "auth-cleanup-consumed-magic-links": {
        "task": "backend.tasks.auth_cleanup.cleanup_consumed_magic_links",
        "schedule": 86400.0,  # every 24 hours (daily)
    }
"""
import logging
import asyncio

from backend.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.auth_cleanup.cleanup_consumed_magic_links")
def cleanup_consumed_magic_links() -> dict:
    """
    Daily task: delete rows from consumed_magic_links where consumed_at is
    older than 30 days. These tokens have already been used (consumed) and
    serve no purpose once past the retention window.

    Schedule: Every day at 2:00 AM IST (configured in celery_app.py beat_schedule)
    """
    logger.info("Starting consumed magic links cleanup task...")

    async def _cleanup():
        from backend.db.connection import get_connection
        async with get_connection() as conn:
            result = await conn.fetchrow(
                """
                WITH deleted AS (
                    DELETE FROM consumed_magic_links
                    WHERE consumed_at < NOW() - INTERVAL '30 days'
                    RETURNING id
                )
                SELECT COUNT(*) AS deleted_count FROM deleted
                """
            )
            deleted_count = result["deleted_count"] if result else 0
        return {"deleted_count": deleted_count}

    from backend.utils.async_runner import run_async
    result = run_async(_cleanup())

    logger.info(
        f"Consumed magic links cleanup complete: {result['deleted_count']} row(s) deleted."
    )
    return result
