"""
db/repositories/scorecard_templates.py – ScorecardTemplateRepository.
CRUD for scorecard templates, scoped by org_id.
"""
from typing import Optional, List
import asyncpg


class ScorecardTemplateRepository:
    """Data access for the scorecard_templates table."""

    @staticmethod
    async def create(
        conn: asyncpg.Connection,
        org_id: int,
        name: str,
        dimensions: str,
        is_default: bool = False,
    ) -> dict:
        """Create a new scorecard template. dimensions is JSON string."""
        row = await conn.fetchrow(
            """
            INSERT INTO scorecard_templates (org_id, name, dimensions, is_default)
            VALUES ($1, $2, $3, $4)
            RETURNING id, org_id, name, dimensions, is_default, created_at
            """,
            org_id, name, dimensions, is_default,
        )
        return dict(row)

    @staticmethod
    async def get_by_id(conn: asyncpg.Connection, template_id: int, org_id: int) -> Optional[dict]:
        """Get scorecard template by ID, scoped to org."""
        row = await conn.fetchrow(
            "SELECT * FROM scorecard_templates WHERE id = $1 AND org_id = $2",
            template_id, org_id,
        )
        return dict(row) if row else None

    @staticmethod
    async def list_by_org(conn: asyncpg.Connection, org_id: int) -> List[dict]:
        """List all scorecard templates for an org."""
        rows = await conn.fetch(
            """
            SELECT * FROM scorecard_templates
            WHERE org_id = $1
            ORDER BY is_default DESC, name
            """,
            org_id,
        )
        return [dict(r) for r in rows]

    @staticmethod
    async def get_default(conn: asyncpg.Connection, org_id: int) -> Optional[dict]:
        """Get the default scorecard template."""
        row = await conn.fetchrow(
            "SELECT * FROM scorecard_templates WHERE org_id = $1 AND is_default = TRUE",
            org_id,
        )
        return dict(row) if row else None

    @staticmethod
    async def update(
        conn: asyncpg.Connection,
        template_id: int,
        org_id: int,
        **fields,
    ) -> Optional[dict]:
        """Update scorecard template fields dynamically."""
        if not fields:
            return await ScorecardTemplateRepository.get_by_id(conn, template_id, org_id)

        set_clauses = []
        values = []
        for i, (key, val) in enumerate(fields.items(), start=1):
            set_clauses.append(f"{key} = ${i}")
            values.append(val)

        values.extend([template_id, org_id])
        query = f"""
            UPDATE scorecard_templates SET {', '.join(set_clauses)}
            WHERE id = ${len(values) - 1} AND org_id = ${len(values)}
            RETURNING *
        """
        row = await conn.fetchrow(query, *values)
        return dict(row) if row else None
