"""
tasks/gdpr_cleanup.py – Periodic GDPR data retention cleanup.
Runs weekly via Celery Beat to anonymize candidates past their retention date.
Per project rules: Celery + Redis for ALL background tasks from day one.
"""
import logging
import asyncio

from backend.celery_app import celery_app
from backend.services.gdpr_service import GDPRService

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.gdpr_cleanup.cleanup_expired_data")
def cleanup_expired_data() -> dict:
    """
    Weekly task: find candidates whose data retention period has expired
    and anonymize their data per GDPR/DPDP requirements.

    Schedule: Every Sunday at 3:00 AM IST (configured in celery_app.py beat_schedule)
    """
    logger.info("Starting GDPR retention cleanup task...")

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If already in an async context, create a new loop
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                result = pool.submit(
                    asyncio.run,
                    GDPRService.cleanup_expired_data()
                ).result()
        else:
            result = loop.run_until_complete(GDPRService.cleanup_expired_data())
    except RuntimeError:
        result = asyncio.run(GDPRService.cleanup_expired_data())

    logger.info(f"GDPR cleanup complete: {result}")
    return result


@celery_app.task(name="tasks.gdpr_cleanup.process_verified_deletions")
def process_verified_deletions() -> dict:
    """
    Hourly task: process any verified but not-yet-processed deletion requests.
    This ensures deletions happen promptly after email verification.
    """
    logger.info("Processing verified deletion requests...")

    async def _process():
        from backend.db.connection import get_connection
        async with get_connection() as conn:
            pending = await conn.fetch(
                """
                SELECT id FROM data_deletion_requests
                WHERE status='verified'
                ORDER BY verified_at ASC
                LIMIT 50
                """
            )

        processed = 0
        for req in pending:
            try:
                await GDPRService.process_deletion(req["id"])
                processed += 1
            except Exception as e:
                logger.error(f"Failed to process deletion request {req['id']}: {e}")

        return {"processed": processed, "total_pending": len(pending)}

    try:
        result = asyncio.run(_process())
    except RuntimeError:
        loop = asyncio.get_event_loop()
        result = loop.run_until_complete(_process())

    logger.info(f"Verified deletions processed: {result}")
    return result
