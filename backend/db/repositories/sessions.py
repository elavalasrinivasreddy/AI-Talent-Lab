"""
db/repositories/sessions.py – Session repositories.
Manages chat_sessions (recruiter JD flow) and candidate_sessions (magic link).
"""
import json
import logging
from typing import Any, Optional
from datetime import datetime

from backend.db.connection import get_connection

logger = logging.getLogger(__name__)


class ChatSessionRepository:
    """Repository for Recruiter JD Chat Sessions."""

    @staticmethod
    async def create(
        session_id: str,
        org_id: int,
        user_id: int,
        department_id: Optional[int] = None,
    ) -> dict[str, Any]:
        async with get_connection() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO chat_sessions (id, org_id, department_id, user_id)
                VALUES ($1, $2, $3, $4)
                RETURNING *
                """,
                session_id, org_id, department_id, user_id
            )
            return dict(row)

    @staticmethod
    async def get(session_id: str, org_id: int) -> Optional[dict[str, Any]]:
        """Fetch session, state, and recent messages."""
        async with get_connection() as conn:
            row = await conn.fetchrow(
                """
                SELECT * FROM chat_sessions
                WHERE id = $1 AND org_id = $2
                """,
                session_id, org_id
            )
            if not row:
                return None
                
            session_data = dict(row)
            
            # Fetch messages
            msgs = await conn.fetch(
                """
                SELECT id, role, content, extras, created_at
                FROM chat_messages
                WHERE session_id = $1
                ORDER BY created_at ASC
                """,
                session_id
            )
            
            messages = []
            for m in msgs:
                msg_dict = dict(m)
                if msg_dict.get("extras"):
                    msg_dict["extras"] = json.loads(msg_dict["extras"])
                messages.append(msg_dict)
                
            session_data["messages"] = messages
            
            # Parse graph state
            if session_data.get("graph_state"):
                try:
                    session_data["graph_state_parsed"] = json.loads(session_data["graph_state"])
                except json.JSONDecodeError:
                    session_data["graph_state_parsed"] = {}
            else:
                session_data["graph_state_parsed"] = {}
                
            return session_data

    @staticmethod
    async def update_state(
        session_id: str,
        org_id: int,
        workflow_stage: str,
        graph_state: dict,
    ) -> None:
        """Save the LangGraph state JSON."""
        state_json = json.dumps(graph_state)
        async with get_connection() as conn:
            await conn.execute(
                """
                UPDATE chat_sessions
                SET workflow_stage = $1, graph_state = $2, updated_at = NOW()
                WHERE id = $3 AND org_id = $4
                """,
                workflow_stage, state_json, session_id, org_id
            )

    @staticmethod
    async def update_title(session_id: str, org_id: int, title: str) -> None:
        async with get_connection() as conn:
            await conn.execute(
                """
                UPDATE chat_sessions
                SET title = $1, updated_at = NOW()
                WHERE id = $2 AND org_id = $3
                """,
                title, session_id, org_id
            )

    @staticmethod
    async def list_visible(
        user_id: int,
        org_id: int,
        role: str,
        dept_id: Optional[int] = None,
    ) -> list[dict[str, Any]]:
        """
        List visible sessions for sidebar history.
        - Admin: all org sessions
        - Department users: sessions within same department + their own legacy sessions without department
        - Users without department: only their own sessions
        """
        async with get_connection() as conn:
            if role == "admin":
                rows = await conn.fetch(
                    """
                    SELECT id, title, workflow_stage, updated_at, position_id, department_id, user_id
                    FROM chat_sessions
                    WHERE org_id = $1
                      AND (status IS NULL OR status != 'deleted')
                    ORDER BY updated_at DESC
                    LIMIT 200
                    """,
                    org_id,
                )
            elif dept_id is not None:
                rows = await conn.fetch(
                    """
                    SELECT id, title, workflow_stage, updated_at, position_id, department_id, user_id
                    FROM chat_sessions
                    WHERE org_id = $1
                      AND (
                        department_id = $2
                        OR (department_id IS NULL AND user_id = $3)
                      )
                      AND (status IS NULL OR status != 'deleted')
                    ORDER BY updated_at DESC
                    LIMIT 200
                    """,
                    org_id, dept_id, user_id
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT id, title, workflow_stage, updated_at, position_id, department_id, user_id
                    FROM chat_sessions
                    WHERE user_id = $1 AND org_id = $2
                      AND (status IS NULL OR status != 'deleted')
                    ORDER BY updated_at DESC
                    LIMIT 200
                    """,
                    user_id, org_id
                )
            return [dict(r) for r in rows]

    @staticmethod
    async def delete(session_id: str, org_id: int) -> bool:
        """Soft-delete: sets status='deleted'. Record is preserved in DB for audit."""
        async with get_connection() as conn:
            res = await conn.execute(
                """
                UPDATE chat_sessions
                SET status = 'deleted', updated_at = NOW()
                WHERE id = $1 AND org_id = $2 AND status != 'deleted'
                """,
                session_id, org_id
            )
            return res == "UPDATE 1"


    @staticmethod
    async def add_message(
        session_id: str,
        role: str,
        content: str,
        extras: Optional[dict] = None
    ) -> dict[str, Any]:
        """Insert a message to the DB to persist log.
        Note: The graph_state also holds messages. This is redundant but useful for analytics/querying without parsing large state json.
        """
        extras_json = json.dumps(extras) if extras else "{}"
        async with get_connection() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO chat_messages (session_id, role, content, extras)
                VALUES ($1, $2, $3, $4)
                RETURNING *
                """,
                session_id, role, content, extras_json
            )
            return dict(row)

    @staticmethod
    async def link_position(session_id: str, org_id: int, position_id: int) -> None:
        async with get_connection() as conn:
            await conn.execute(
                """
                UPDATE chat_sessions
                SET position_id = $1, updated_at = NOW()
                WHERE id = $2 AND org_id = $3
                """,
                position_id, session_id, org_id
            )


class CandidateSessionRepository:
    """Repository for Candidate Chat Sessions (Magic Links)."""
    # TODO: Implement full logic in Step 5
    pass
