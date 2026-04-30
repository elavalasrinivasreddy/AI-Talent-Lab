"""
db/repositories/notifications.py – NotificationRepository
In-app notifications for recruiter users.
"""
import logging
from typing import Optional
import asyncpg

logger = logging.getLogger(__name__)


class NotificationRepository:

    @staticmethod
    async def create(conn: asyncpg.Connection, data: dict) -> dict:
        row = await conn.fetchrow(
            """
            INSERT INTO notifications (org_id, user_id, type, title, message, action_url)
            VALUES ($1,$2,$3,$4,$5,$6)
            RETURNING *
            """,
            data["org_id"], data.get("user_id"), data["type"],
            data["title"], data["message"], data.get("action_url"),
        )
        return dict(row)

    @staticmethod
    async def list_for_user(
        conn: asyncpg.Connection, user_id: int, org_id: int, limit: int = 20
    ) -> list[dict]:
        rows = await conn.fetch(
            """
            SELECT * FROM notifications
            WHERE (user_id = $1 OR user_id IS NULL) AND org_id = $2
            ORDER BY created_at DESC
            LIMIT $3
            """,
            user_id, org_id, limit
        )
        return [dict(r) for r in rows]

    @staticmethod
    async def get_unread_count(conn: asyncpg.Connection, user_id: int, org_id: int) -> int:
        row = await conn.fetchrow(
            "SELECT COUNT(*) AS c FROM notifications WHERE (user_id=$1 OR user_id IS NULL) AND org_id=$2 AND is_read=FALSE",
            user_id, org_id
        )
        return row["c"] if row else 0

    @staticmethod
    async def mark_read(conn: asyncpg.Connection, notification_id: int, user_id: int, org_id: int) -> None:
        await conn.execute(
            "UPDATE notifications SET is_read=TRUE WHERE id=$1 AND org_id=$2 AND (user_id=$3 OR user_id IS NULL)",
            notification_id, org_id, user_id
        )

    @staticmethod
    async def mark_all_read(conn: asyncpg.Connection, user_id: int, org_id: int) -> None:
        await conn.execute(
            "UPDATE notifications SET is_read=TRUE WHERE (user_id=$1 OR user_id IS NULL) AND org_id=$2",
            user_id, org_id
        )
