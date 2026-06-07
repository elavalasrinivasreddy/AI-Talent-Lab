"""
services/notification_service.py – Notification business logic.

Per project rules:
- Three-layer: Router → Service → Repository
- All queries filter by org_id for tenant isolation
- All mutations logged to audit_log

Notification types (from docs/architecture/03_backend.md §3):
  application_received, candidate_applied, interview_scheduled,
  feedback_submitted, position_filled, sourcing_complete,
  magic_link_clicked, candidate_rejected, system_alert
"""
import json
import logging
from typing import Optional

from backend.db.connection import get_connection

logger = logging.getLogger(__name__)


class NotificationService:
    """Create, list, mark-read, and delete notifications for users."""

    @staticmethod
    async def create(
        org_id: int,
        user_id: int,
        type: str,
        title: str,
        message: str,
        action_url: Optional[str] = None,
    ) -> dict:
        """Create a notification. Returns the created notification."""
        async with get_connection() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO notifications (org_id, user_id, type, title, message, action_url)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, org_id, user_id, type, title, message, action_url, is_read, created_at
                """,
                org_id, user_id, type, title, message, action_url,
            )
        return dict(row) if row else {}

    @staticmethod
    async def create_for_role(
        org_id: int,
        role: str,
        type: str,
        title: str,
        message: str,
        action_url: Optional[str] = None,
    ) -> int:
        """
        Broadcast a notification to all users with a given role in the org.
        Returns count of notifications created.
        """
        async with get_connection() as conn:
            users = await conn.fetch(
                "SELECT id FROM users WHERE org_id=$1 AND role=$2 AND is_active=TRUE",
                org_id, role,
            )
            for u in users:
                await conn.execute(
                    """
                    INSERT INTO notifications (org_id, user_id, type, title, message, action_url)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    """,
                    org_id, u["id"], type, title, message, action_url,
                )
        return len(users)

    @staticmethod
    async def list_for_user(
        org_id: int,
        user_id: int,
        unread_only: bool = False,
        limit: int = 50,
    ) -> list[dict]:
        """List notifications for a user, newest first."""
        async with get_connection() as conn:
            where = "org_id=$1 AND user_id=$2"
            params = [org_id, user_id]
            if unread_only:
                where += " AND is_read=FALSE"
            rows = await conn.fetch(
                f"""
                SELECT id, type, title, message, action_url, is_read, created_at
                FROM notifications
                WHERE {where}
                ORDER BY created_at DESC
                LIMIT $3
                """,
                *params, limit,
            )
        return [dict(r) for r in rows]

    @staticmethod
    async def mark_read(org_id: int, user_id: int, notification_id: int) -> bool:
        """Mark a single notification as read."""
        async with get_connection() as conn:
            result = await conn.execute(
                "UPDATE notifications SET is_read=TRUE WHERE id=$1 AND org_id=$2 AND user_id=$3",
                notification_id, org_id, user_id,
            )
        return "UPDATE 1" in (result or "")

    @staticmethod
    async def mark_all_read(org_id: int, user_id: int) -> int:
        """Mark all notifications for a user as read. Returns count updated."""
        async with get_connection() as conn:
            result = await conn.execute(
                "UPDATE notifications SET is_read=TRUE WHERE org_id=$1 AND user_id=$2 AND is_read=FALSE",
                org_id, user_id,
            )
        # Extract count from "UPDATE N"
        try:
            return int(result.split()[-1])
        except (IndexError, ValueError):
            return 0

    @staticmethod
    async def unread_count(org_id: int, user_id: int) -> int:
        """Count unread notifications for badge display."""
        async with get_connection() as conn:
            return await conn.fetchval(
                "SELECT COUNT(*) FROM notifications WHERE org_id=$1 AND user_id=$2 AND is_read=FALSE",
                org_id, user_id,
            ) or 0

    @staticmethod
    async def delete_old(org_id: int, days: int = 90) -> int:
        """Delete notifications older than `days`. Returns count deleted."""
        async with get_connection() as conn:
            result = await conn.execute(
                "DELETE FROM notifications WHERE org_id=$1 AND created_at < NOW() - ($2 || ' days')::interval",
                org_id, str(days),
            )
        try:
            return int(result.split()[-1])
        except (IndexError, ValueError):
            return 0

    # ── Convenience helpers ─────────────────────────────────────────────────

    @staticmethod
    async def notify_application_received(
        org_id: int, recruiter_id: int,
        candidate_name: str, role_name: str, position_id: int
    ) -> dict:
        """Notify recruiter when a candidate applies."""
        return await NotificationService.create(
            org_id=org_id,
            user_id=recruiter_id,
            type="application_received",
            title=f"New Application — {role_name}",
            message=f"{candidate_name} has submitted their application.",
            action_url=f"/positions/{position_id}?tab=candidates",
        )

    @staticmethod
    async def notify_interview_scheduled(
        org_id: int, recruiter_id: int,
        candidate_name: str, round_name: str, interview_id: int
    ) -> dict:
        """Notify recruiter when an interview is scheduled."""
        return await NotificationService.create(
            org_id=org_id,
            user_id=recruiter_id,
            type="interview_scheduled",
            title=f"Interview Scheduled — {round_name}",
            message=f"{candidate_name} interview has been scheduled.",
            action_url=f"/interviews/{interview_id}",
        )

    @staticmethod
    async def notify_feedback_submitted(
        org_id: int, recruiter_id: int,
        panelist_name: str, candidate_name: str, interview_id: int
    ) -> dict:
        """Notify recruiter when a panelist submits feedback."""
        return await NotificationService.create(
            org_id=org_id,
            user_id=recruiter_id,
            type="feedback_submitted",
            title=f"Feedback Received — {candidate_name}",
            message=f"{panelist_name} has submitted their scorecard.",
            action_url=f"/interviews/{interview_id}",
        )

    @staticmethod
    async def notify_sourcing_complete(
        org_id: int, recruiter_id: int,
        role_name: str, count: int, position_id: int
    ) -> dict:
        """Notify recruiter when sourcing completes for a position."""
        return await NotificationService.create(
            org_id=org_id,
            user_id=recruiter_id,
            type="sourcing_complete",
            title=f"Sourcing Complete — {role_name}",
            message=f"{count} candidates have been sourced and scored.",
            action_url=f"/positions/{position_id}?tab=candidates",
        )
