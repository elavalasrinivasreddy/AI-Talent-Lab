"""
db/repositories/pipeline_events.py – PipelineEventRepository
Immutable event log. All pipeline actions create an event.
"""
import json
import logging
from typing import Optional

import asyncpg

logger = logging.getLogger(__name__)


class PipelineEventRepository:

    @staticmethod
    async def create(conn: asyncpg.Connection, data: dict) -> dict:
        """Insert a new pipeline event. All fields optional except org_id and event_type."""
        row = await conn.fetchrow(
            """
            INSERT INTO pipeline_events
                (org_id, candidate_id, position_id, application_id,
                 interview_id, user_id, event_type, event_data)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            RETURNING *
            """,
            data["org_id"],
            data.get("candidate_id"),
            data.get("position_id"),
            data.get("application_id"),
            data.get("interview_id"),
            data.get("user_id"),
            data["event_type"],
            json.dumps(data.get("event_data", {})) if data.get("event_data") else None,
        )
        return dict(row)

    @staticmethod
    async def list_for_candidate(
        conn: asyncpg.Connection,
        candidate_id: int,
        org_id: int,
        position_id: Optional[int] = None,
        limit: int = 100
    ) -> list[dict]:
        """Get all timeline events for a candidate (optionally scoped to a position)."""
        if position_id:
            rows = await conn.fetch(
                """
                SELECT pe.*, u.name AS user_name, u.avatar_url AS user_avatar
                FROM pipeline_events pe
                LEFT JOIN users u ON u.id = pe.user_id
                WHERE pe.candidate_id = $1 AND pe.org_id = $2 AND pe.position_id = $3
                ORDER BY pe.created_at DESC
                LIMIT $4
                """,
                candidate_id, org_id, position_id, limit
            )
        else:
            rows = await conn.fetch(
                """
                SELECT pe.*, u.name AS user_name, u.avatar_url AS user_avatar
                FROM pipeline_events pe
                LEFT JOIN users u ON u.id = pe.user_id
                WHERE pe.candidate_id = $1 AND pe.org_id = $2
                ORDER BY pe.created_at DESC
                LIMIT $3
                """,
                candidate_id, org_id, limit
            )
        return [dict(r) for r in rows]

    @staticmethod
    async def list_for_position(
        conn: asyncpg.Connection,
        position_id: int,
        org_id: int,
        limit: int = 50
    ) -> list[dict]:
        """Get recent events for a position's activity tab."""
        rows = await conn.fetch(
            """
            SELECT pe.*, u.name AS user_name, u.avatar_url AS user_avatar,
                   c.name AS candidate_name
            FROM pipeline_events pe
            LEFT JOIN users u ON u.id = pe.user_id
            LEFT JOIN candidates c ON c.id = pe.candidate_id
            WHERE pe.position_id = $1 AND pe.org_id = $2
            ORDER BY pe.created_at DESC
            LIMIT $3
            """,
            position_id, org_id, limit
        )
        return [dict(r) for r in rows]

    @staticmethod
    async def list_recent(
        conn: asyncpg.Connection,
        org_id: int,
        limit: int = 30
    ) -> list[dict]:
        """Dashboard activity feed — recent org-wide events."""
        rows = await conn.fetch(
            """
            SELECT pe.*, u.name AS user_name,
                   c.name AS candidate_name,
                   p.role_name AS position_title
            FROM pipeline_events pe
            LEFT JOIN users u ON u.id = pe.user_id
            LEFT JOIN candidates c ON c.id = pe.candidate_id
            LEFT JOIN positions p ON p.id = pe.position_id
            WHERE pe.org_id = $1
            ORDER BY pe.created_at DESC
            LIMIT $2
            """,
            org_id, limit
        )
        return [dict(r) for r in rows]
