"""
db/repositories/competitors.py – CompetitorRepository.
CRUD for competitors, scoped by org_id.
"""
from typing import Optional, List
import asyncpg


class CompetitorRepository:
    """Data access for the competitors table."""

    @staticmethod
    async def create(
        conn: asyncpg.Connection,
        org_id: int,
        name: str,
        website: Optional[str] = None,
        industry: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> dict:
        """Create a new competitor."""
        row = await conn.fetchrow(
            """
            INSERT INTO competitors (org_id, name, website, industry, notes)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, org_id, name, website, industry, notes, is_active
            """,
            org_id, name.strip(), website, industry, notes,
        )
        return dict(row)

    @staticmethod
    async def get_by_id(conn: asyncpg.Connection, competitor_id: int, org_id: int) -> Optional[dict]:
        """Get competitor by ID, scoped to org."""
        row = await conn.fetchrow(
            "SELECT * FROM competitors WHERE id = $1 AND org_id = $2",
            competitor_id, org_id,
        )
        return dict(row) if row else None

    @staticmethod
    async def list_by_org(conn: asyncpg.Connection, org_id: int, active_only: bool = True) -> List[dict]:
        """List competitors for an org."""
        if active_only:
            rows = await conn.fetch(
                "SELECT * FROM competitors WHERE org_id = $1 AND is_active = TRUE ORDER BY name",
                org_id,
            )
        else:
            rows = await conn.fetch(
                "SELECT * FROM competitors WHERE org_id = $1 ORDER BY name",
                org_id,
            )
        return [dict(r) for r in rows]

    @staticmethod
    async def update(
        conn: asyncpg.Connection,
        competitor_id: int,
        org_id: int,
        **fields,
    ) -> Optional[dict]:
        """Update competitor fields dynamically."""
        if not fields:
            return await CompetitorRepository.get_by_id(conn, competitor_id, org_id)

        set_clauses = []
        values = []
        for i, (key, val) in enumerate(fields.items(), start=1):
            set_clauses.append(f"{key} = ${i}")
            values.append(val)

        values.extend([competitor_id, org_id])
        query = f"""
            UPDATE competitors SET {', '.join(set_clauses)}
            WHERE id = ${len(values) - 1} AND org_id = ${len(values)}
            RETURNING *
        """
        row = await conn.fetchrow(query, *values)
        return dict(row) if row else None

    @staticmethod
    async def delete(conn: asyncpg.Connection, competitor_id: int, org_id: int) -> bool:
        """Delete a competitor. Returns True if deleted."""
        result = await conn.execute(
            "DELETE FROM competitors WHERE id = $1 AND org_id = $2",
            competitor_id, org_id,
        )
        return result == "DELETE 1"
