"""
tasks/email_outreach.py – Celery tasks for email outreach.

Per project rules: Celery + Redis for ALL background tasks from day one.

Tasks:
  send_outreach_batch    — Send personalized magic-link emails to sourced candidates
  send_followup_reminders — Re-send to candidates who haven't clicked after N hours
  send_interview_invites  — Email interview invitations to candidates
  send_panel_invites      — Email panel feedback links to interviewers
  send_rejection_emails   — Send rejection notices
"""
import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone

from backend.celery_app import celery_app
from backend.db.connection import get_connection
from backend.services.email_service import EmailService

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


# ── Outreach batch ────────────────────────────────────────────────────────────

@celery_app.task(name="backend.tasks.email_outreach.send_outreach_batch")
def send_outreach_batch(application_ids: list[int], org_id: int | None = None) -> dict:
    """
    Send personalized outreach emails with magic links to a batch of candidates.
    Called after sourcing + ATS scoring finds new candidates for a position.
    `org_id` (when given) scopes the batch to one tenant. Apply tokens are
    generated on the fly for freshly sourced candidates that don't have one yet.
    """
    async def _send():
        from backend.services.apply_service import generate_apply_token
        from backend.config import settings
        base = settings.MAGIC_LINK_BASE_URL or settings.FRONTEND_URL
        sent = 0
        failed = 0
        async with get_connection() as conn:
            for app_id in application_ids:
                row = await conn.fetchrow(
                    """
                    SELECT ca.id, ca.candidate_id, ca.magic_link_token, ca.org_id,
                           c.name AS candidate_name, c.email,
                           p.role_name, o.name AS org_name
                    FROM candidate_applications ca
                    JOIN candidates c ON c.id = ca.candidate_id
                    JOIN positions p ON p.id = ca.position_id
                    JOIN organizations o ON o.id = ca.org_id
                    WHERE ca.id = $1 AND ca.status = 'sourced'
                      AND ca.magic_link_sent_at IS NULL
                      AND ($2::int IS NULL OR ca.org_id = $2)
                    """,
                    app_id, org_id,
                )
                if not row or not row["email"]:
                    failed += 1
                    continue

                # Generate an apply token if the candidate doesn't have one yet
                # (sourcing inserts rows without tokens; without this, outreach
                # would silently skip every freshly sourced candidate).
                token = row["magic_link_token"]
                if not token:
                    token = generate_apply_token(row["id"], row["candidate_id"], row["org_id"])
                    await conn.execute(
                        "UPDATE candidate_applications SET magic_link_token=$1, "
                        "magic_link_expires_at=NOW() + interval '14 days' WHERE id=$2",
                        token, row["id"],
                    )

                # Build the apply link
                apply_url = f"{base}/apply/{token}"

                ok = await EmailService.send_candidate_outreach(
                    to_email=row["email"],
                    candidate_name=row["candidate_name"],
                    role_name=row["role_name"],
                    org_name=row["org_name"],
                    apply_url=apply_url,
                )

                if ok:
                    await conn.execute(
                        """
                        UPDATE candidate_applications
                        SET magic_link_sent_at=NOW(), status='magic_link_sent'
                        WHERE id=$1
                        """,
                        app_id,
                    )
                    # Pipeline event
                    await conn.execute(
                        """
                        INSERT INTO pipeline_events (org_id, candidate_id, position_id, application_id, event_type, event_data)
                        SELECT ca.org_id, ca.candidate_id, ca.position_id, ca.id, 'outreach_sent',
                               '{"channel": "email"}'
                        FROM candidate_applications ca WHERE ca.id = $1
                        """,
                        app_id,
                    )
                    sent += 1
                else:
                    failed += 1

        return {"sent": sent, "failed": failed, "total": len(application_ids)}

    result = _run_async(_send())
    logger.info(f"Outreach batch complete: {result}")
    return result


# ── Follow-up reminders ───────────────────────────────────────────────────────

@celery_app.task(name="backend.tasks.email_outreach.send_followup_reminders")
def send_followup_reminders() -> dict:
    """
    Re-send outreach to candidates who were emailed but haven't clicked
    their magic link after the position's followup_delay_hours.
    Runs hourly via Celery Beat.
    """
    async def _followup():
        sent = 0
        async with get_connection() as conn:
            rows = await conn.fetch(
                """
                SELECT ca.id, ca.magic_link_token, ca.org_id,
                       c.name AS candidate_name, c.email,
                       p.role_name, p.followup_delay_hours,
                       o.name AS org_name
                FROM candidate_applications ca
                JOIN candidates c ON c.id = ca.candidate_id
                JOIN positions p ON p.id = ca.position_id
                JOIN organizations o ON o.id = ca.org_id
                WHERE ca.status = 'magic_link_sent'
                  AND ca.magic_link_clicked_at IS NULL
                  AND ca.followup_sent_at IS NULL
                  AND ca.magic_link_sent_at < NOW() - (COALESCE(p.followup_delay_hours, 48) || ' hours')::interval
                  AND ca.magic_link_expires_at > NOW()
                LIMIT 100
                """
            )

            for row in rows:
                apply_url = f"https://app.aitalentlab.com/apply/{row['magic_link_token']}"
                ok = await EmailService.send_candidate_followup(
                    to_email=row["email"],
                    candidate_name=row["candidate_name"],
                    role_name=row["role_name"],
                    org_name=row["org_name"],
                    apply_url=apply_url,
                )
                if ok:
                    await conn.execute(
                        "UPDATE candidate_applications SET followup_sent_at=NOW() WHERE id=$1",
                        row["id"],
                    )
                    sent += 1

        return {"followups_sent": sent}

    result = _run_async(_followup())
    logger.info(f"Follow-up reminders: {result}")
    return result


# ── Interview reminders (24h before) ──────────────────────────────────────────

@celery_app.task(name="backend.tasks.email_outreach.send_interview_reminders")
def send_interview_reminders() -> dict:
    """Email a reminder to candidates whose interview is within the next 24h and
    who haven't been reminded yet. Runs hourly via Celery Beat; reminder_sent_at
    guards against duplicates."""
    async def _remind():
        sent = 0
        async with get_connection() as conn:
            rows = await conn.fetch(
                """
                SELECT i.id, i.scheduled_at, i.meeting_link, i.round_name,
                       c.name AS candidate_name, c.email AS candidate_email,
                       p.role_name, o.name AS org_name
                FROM interviews i
                JOIN candidates c ON c.id = i.candidate_id
                JOIN positions p ON p.id = i.position_id
                JOIN organizations o ON o.id = i.org_id
                WHERE i.status NOT IN ('cancelled', 'completed')
                  AND i.reminder_sent_at IS NULL
                  AND i.scheduled_at IS NOT NULL
                  AND i.scheduled_at BETWEEN NOW() AND NOW() + interval '24 hours'
                LIMIT 200
                """
            )
            for row in rows:
                if not row["candidate_email"]:
                    continue
                ok = await EmailService.send_interview_reminder(
                    to_email=row["candidate_email"],
                    candidate_name=row["candidate_name"],
                    role_name=row["role_name"],
                    org_name=row["org_name"],
                    round_name=row["round_name"] or "Interview",
                    scheduled_at=row["scheduled_at"],
                    meeting_link=row["meeting_link"],
                )
                if ok:
                    await conn.execute(
                        "UPDATE interviews SET reminder_sent_at=NOW() WHERE id=$1", row["id"]
                    )
                    sent += 1
        return {"reminders_sent": sent}

    result = _run_async(_remind())
    logger.info(f"Interview reminders: {result}")
    return result


# ── Interview invites ─────────────────────────────────────────────────────────

@celery_app.task(name="backend.tasks.email_outreach.send_interview_invite")
def send_interview_invite(interview_id: int) -> dict:
    """Send interview invitation email to the candidate."""
    async def _send():
        async with get_connection() as conn:
            row = await conn.fetchrow(
                """
                SELECT i.id, i.scheduled_at, i.duration_minutes, i.meeting_link,
                       i.round_name, i.round_type, i.org_id,
                       c.name AS candidate_name, c.email AS candidate_email,
                       p.role_name, o.name AS org_name
                FROM interviews i
                JOIN candidates c ON c.id = i.candidate_id
                JOIN positions p ON p.id = i.position_id
                JOIN organizations o ON o.id = i.org_id
                WHERE i.id = $1
                """,
                interview_id,
            )
            if not row or not row["candidate_email"]:
                return {"sent": False, "reason": "interview or email not found"}

            ok = await EmailService.send_interview_invite(
                to_email=row["candidate_email"],
                candidate_name=row["candidate_name"],
                role_name=row["role_name"],
                org_name=row["org_name"],
                round_name=row["round_name"] or f"Interview",
                scheduled_at=row["scheduled_at"],
                duration_minutes=row["duration_minutes"],
                meeting_link=row["meeting_link"],
            )

            if ok:
                await conn.execute(
                    "UPDATE interviews SET invite_sent_at=NOW() WHERE id=$1",
                    interview_id,
                )
            return {"sent": ok}

    return _run_async(_send())


# ── Panel feedback invites ────────────────────────────────────────────────────

@celery_app.task(name="backend.tasks.email_outreach.send_panel_invite")
def send_panel_invite(panel_member_id: int) -> dict:
    """Send panel feedback magic link to an interviewer."""
    async def _send():
        async with get_connection() as conn:
            row = await conn.fetchrow(
                """
                SELECT ip.panelist_name, ip.panelist_email, ip.magic_link_token,
                       i.round_name, i.org_id,
                       c.name AS candidate_name,
                       p.role_name, o.name AS org_name
                FROM interview_panel ip
                JOIN interviews i ON i.id = ip.interview_id
                JOIN candidates c ON c.id = i.candidate_id
                JOIN positions p ON p.id = i.position_id
                JOIN organizations o ON o.id = i.org_id
                WHERE ip.id = $1
                """,
                panel_member_id,
            )
            if not row or not row["panelist_email"]:
                return {"sent": False, "reason": "panel member or email not found"}

            feedback_url = f"https://app.aitalentlab.com/panel/{row['magic_link_token']}"

            ok = await EmailService.send_panel_feedback_link(
                to_email=row["panelist_email"],
                panelist_name=row["panelist_name"],
                candidate_name=row["candidate_name"],
                role_name=row["role_name"],
                org_name=row["org_name"],
                round_name=row["round_name"] or "Interview",
                feedback_url=feedback_url,
            )

            if ok:
                await conn.execute(
                    "UPDATE interview_panel SET invite_sent_at=NOW() WHERE id=$1",
                    panel_member_id,
                )
            return {"sent": ok}

    return _run_async(_send())


# ── Rejection emails ──────────────────────────────────────────────────────────

@celery_app.task(name="backend.tasks.email_outreach.send_rejection_email")
def send_rejection_email(application_id: int) -> dict:
    """Send rejection notification to a candidate."""
    async def _send():
        async with get_connection() as conn:
            row = await conn.fetchrow(
                """
                SELECT ca.id, ca.rejection_draft, ca.org_id,
                       c.name AS candidate_name, c.email,
                       p.role_name, o.name AS org_name
                FROM candidate_applications ca
                JOIN candidates c ON c.id = ca.candidate_id
                JOIN positions p ON p.id = ca.position_id
                JOIN organizations o ON o.id = ca.org_id
                WHERE ca.id = $1 AND ca.status = 'rejected'
                """,
                application_id,
            )
            if not row or not row["email"]:
                return {"sent": False, "reason": "application or email not found"}

            ok = await EmailService.send_rejection(
                to_email=row["email"],
                candidate_name=row["candidate_name"],
                role_name=row["role_name"],
                org_name=row["org_name"],
                rejection_message=row["rejection_draft"],
            )

            if ok:
                await conn.execute(
                    "UPDATE candidate_applications SET rejection_sent_at=NOW() WHERE id=$1",
                    application_id,
                )
            return {"sent": ok}

    return _run_async(_send())
