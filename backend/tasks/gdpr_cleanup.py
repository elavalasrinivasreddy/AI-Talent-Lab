"""
tasks/gdpr_cleanup.py – Periodic GDPR data retention cleanup.
Runs weekly via Celery Beat to anonymize candidates past their retention date.
Per project rules: Celery + Redis for ALL background tasks from day one.
"""
import logging

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

    from backend.utils.async_runner import run_async
    result = run_async(GDPRService.cleanup_expired_data())

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
        from backend.db.connection import get_admin_connection
        async with get_admin_connection() as conn:
            pending = await conn.fetch(
                """
                SELECT id, org_id FROM data_deletion_requests
                WHERE status='verified'
                ORDER BY verified_at ASC
                LIMIT 50
                """
            )

        processed = 0
        for req in pending:
            try:
                await GDPRService.process_deletion(req["id"], req["org_id"])
                processed += 1
            except Exception as e:
                logger.error(f"Failed to process deletion request {req['id']}: {e}")

        return {"processed": processed, "total_pending": len(pending)}

    from backend.utils.async_runner import run_async
    result = run_async(_process())

    logger.info(f"Verified deletions processed: {result}")
    return result
