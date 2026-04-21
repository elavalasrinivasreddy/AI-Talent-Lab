"""
db/repositories/message_templates.py – MessageTemplateRepository.
CRUD for message templates, scoped by org_id.
"""
from typing import Optional, List
import asyncpg


class MessageTemplateRepository:
    """Data access for the message_templates table."""

    @staticmethod
    async def create(
        conn: asyncpg.Connection,
        org_id: int,
        name: str,
        category: str,
        body: str,
        subject: Optional[str] = None,
        is_default: bool = False,
    ) -> dict:
        """Create a new message template."""
        row = await conn.fetchrow(
            """
            INSERT INTO message_templates (org_id, name, category, subject, body, is_default)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, org_id, name, category, subject, body, is_default, is_active, created_at
            """,
            org_id, name, category, subject, body, is_default,
        )
        return dict(row)

    @staticmethod
    async def get_by_id(conn: asyncpg.Connection, template_id: int, org_id: int) -> Optional[dict]:
        """Get template by ID, scoped to org."""
        row = await conn.fetchrow(
            "SELECT * FROM message_templates WHERE id = $1 AND org_id = $2 AND is_active = TRUE",
            template_id, org_id,
        )
        return dict(row) if row else None

    @staticmethod
    async def list_by_org(
        conn: asyncpg.Connection,
        org_id: int,
        category: Optional[str] = None,
    ) -> List[dict]:
        """List templates for an org, optionally filtered by category."""
        if category:
            rows = await conn.fetch(
                """
                SELECT * FROM message_templates
                WHERE org_id = $1 AND category = $2 AND is_active = TRUE
                ORDER BY is_default DESC, name
                """,
                org_id, category,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT * FROM message_templates
                WHERE org_id = $1 AND is_active = TRUE
                ORDER BY category, is_default DESC, name
                """,
                org_id,
            )
        return [dict(r) for r in rows]

    @staticmethod
    async def get_default(conn: asyncpg.Connection, org_id: int, category: str) -> Optional[dict]:
        """Get the default template for a category."""
        row = await conn.fetchrow(
            """
            SELECT * FROM message_templates
            WHERE org_id = $1 AND category = $2 AND is_default = TRUE AND is_active = TRUE
            """,
            org_id, category,
        )
        return dict(row) if row else None

    @staticmethod
    async def update(
        conn: asyncpg.Connection,
        template_id: int,
        org_id: int,
        **fields,
    ) -> Optional[dict]:
        """Update template fields dynamically."""
        if not fields:
            return await MessageTemplateRepository.get_by_id(conn, template_id, org_id)

        set_clauses = []
        values = []
        for i, (key, val) in enumerate(fields.items(), start=1):
            set_clauses.append(f"{key} = ${i}")
            values.append(val)

        values.extend([template_id, org_id])
        query = f"""
            UPDATE message_templates SET {', '.join(set_clauses)}
            WHERE id = ${len(values) - 1} AND org_id = ${len(values)} AND is_active = TRUE
            RETURNING *
        """
        row = await conn.fetchrow(query, *values)
        return dict(row) if row else None

    @staticmethod
    async def delete(conn: asyncpg.Connection, template_id: int, org_id: int) -> bool:
        """Soft-delete a template."""
        result = await conn.execute(
            "UPDATE message_templates SET is_active = FALSE WHERE id = $1 AND org_id = $2",
            template_id, org_id,
        )
        return "UPDATE 1" in result
