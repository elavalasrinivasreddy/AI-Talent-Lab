"""
db/repositories/organizations.py – OrgRepository.
CRUD for organizations. All queries parameterized.
"""
from typing import Optional
import asyncpg


class OrgRepository:
    """Data access for the organizations table."""

    @staticmethod
    async def create(
        conn: asyncpg.Connection,
        name: str,
        slug: str,
        segment: str,
        size: str,
        website: Optional[str] = None,
    ) -> dict:
        """Create a new organization. Returns the created record."""
        row = await conn.fetchrow(
            """
            INSERT INTO organizations (name, slug, segment, size, website)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, name, slug, segment, size, website, created_at
            """,
            name, slug, segment, size, website,
        )
        return dict(row)

    @staticmethod
    async def get_by_id(conn: asyncpg.Connection, org_id: int) -> Optional[dict]:
        """Get organization by ID."""
        row = await conn.fetchrow(
            "SELECT * FROM organizations WHERE id = $1", org_id
        )
        return dict(row) if row else None

    @staticmethod
    async def get_by_slug(conn: asyncpg.Connection, slug: str) -> Optional[dict]:
        """Get organization by slug."""
        row = await conn.fetchrow(
            "SELECT * FROM organizations WHERE slug = $1", slug
        )
        return dict(row) if row else None

    @staticmethod
    async def get_by_name(conn: asyncpg.Connection, name: str) -> Optional[dict]:
        """Get organization by name."""
        row = await conn.fetchrow(
            "SELECT * FROM organizations WHERE name = $1", name
        )
        return dict(row) if row else None

    @staticmethod
    async def slug_exists(conn: asyncpg.Connection, slug: str) -> bool:
        """Check if a slug already exists."""
        result = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM organizations WHERE slug = $1)", slug
        )
        return result

    @staticmethod
    async def update(
        conn: asyncpg.Connection,
        org_id: int,
        **fields,
    ) -> Optional[dict]:
        """Update organization fields dynamically."""
        if not fields:
            return await OrgRepository.get_by_id(conn, org_id)

        set_clauses = []
        values = []
        for i, (key, val) in enumerate(fields.items(), start=1):
            set_clauses.append(f"{key} = ${i}")
            values.append(val)

        values.append(org_id)
        query = f"""
            UPDATE organizations SET {', '.join(set_clauses)}
            WHERE id = ${len(values)}
            RETURNING *
        """
        row = await conn.fetchrow(query, *values)
        return dict(row) if row else None
