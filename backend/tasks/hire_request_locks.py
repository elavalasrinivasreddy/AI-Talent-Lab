"""
tasks/hire_request_locks.py – Periodic lock cleanup Celery task.

Runs every 5 minutes via Celery Beat. Releases stale admin_reviewing locks
that have been held for more than 30 minutes without action.

Per project rules: Celery + Redis for ALL background tasks from day one.
"""
import asyncio
import logging

from backend.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine from a sync Celery task."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            from backend.utils.async_runner import run_async
            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(run_async, coro).result()
        return loop.run_until_complete(coro)
    except RuntimeError:
        from backend.utils.async_runner import run_async
        return run_async(coro)


@celery_app.task(name="backend.tasks.hire_request_locks.release_stale_review_locks")
def release_stale_review_locks() -> dict:
    """
    Periodic task (every 5 minutes): release admin_reviewing locks that have
    been held for more than 30 minutes.

    When an admin opens a hire request for review, the request transitions to
    `admin_reviewing` with a lock (`reviewing_locked_by` + `reviewing_locked_at`).
    If the admin closes the browser, navigates away, or loses connectivity
    without explicitly releasing, the lock becomes stale. This task ensures
    those requests return to `submitted` so other admins can act on them.

    Lock lifecycle:
      - Fresh (< 10 min): Only the locking admin can act or release.
      - Stale (10–30 min): Another admin can takeover via the API.
      - Expired (> 30 min): This task auto-releases back to `submitted`.
    """
    async def _cleanup():
        from backend.db.connection import get_connection
        from backend.db.repositories.hire_requests import HireRequestRepository

        async with get_connection() as conn:
            released = await HireRequestRepository.release_expired_locks(conn)

        return {
            "released": released,
            "message": (
                f"Released {released} stale review lock(s)"
                if released > 0
                else "No stale locks found"
            ),
        }

    result = _run_async(_cleanup())
    if result["released"] > 0:
        logger.info(f"Lock cleanup: {result['message']}")
    else:
        logger.debug(f"Lock cleanup: {result['message']}")
    return result
