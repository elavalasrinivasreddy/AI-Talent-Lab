"""
tasks/rejection_task.py – Background task for drafting rejection emails.
Uses Celery. Called when interview result is set to 'rejected'.
"""
import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def draft_rejection_async(self, interview_id: int, org_id: int, user_id: int):
    """
    Draft a rejection email for the candidate when interview result = rejected.
    Stores the draft in notifications so recruiter can review + send.
    """
    import asyncio
    from backend.db.connection import get_connection
    from backend.agents.interview_agents import draft_rejection_email
    from backend.db.repositories.notifications import NotificationRepository

    async def _run():
        try:
            async with get_connection() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT
                        i.candidate_id, i.position_id, i.round_name,
                        c.name AS candidate_name,
                        p.role_name, p.created_by,
                        o.name AS org_name,
                        u.name AS recruiter_name
                    FROM interviews i
                    JOIN candidates c ON c.id = i.candidate_id
                    JOIN positions p ON p.id = i.position_id
                    JOIN organizations o ON o.id = i.org_id
                    LEFT JOIN users u ON u.id = $3
                    WHERE i.id = $1 AND i.org_id = $2
                    """,
                    interview_id, org_id, user_id
                )
                if not row:
                    logger.warning(f"rejection_task: interview {interview_id} not found")
                    return

                draft = await draft_rejection_email(
                    candidate_name=row["candidate_name"],
                    role_name=row["role_name"],
                    org_name=row["org_name"],
                    round_name=row["round_name"],
                    recruiter_name=row["recruiter_name"],
                )

                import json
                # Notify recruiter to review and send
                await NotificationRepository.create(conn, {
                    "org_id": org_id,
                    "user_id": row["created_by"] or user_id,
                    "type": "rejection_draft_ready",
                    "title": "Rejection Email Draft Ready",
                    "message": f"Review and send rejection to {row['candidate_name']} — {draft.get('subject', '')}",
                    "action_url": f"/candidates/{row['candidate_id']}",
                    "meta": json.dumps(draft),
                })
                logger.info(f"Rejection draft created for candidate {row['candidate_id']}")
        except Exception as exc:
            logger.error(f"rejection_task failed: {exc}", exc_info=True)
            raise self.retry(exc=exc)

    asyncio.get_event_loop().run_until_complete(_run())
