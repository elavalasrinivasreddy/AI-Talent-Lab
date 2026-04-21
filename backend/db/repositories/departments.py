"""
db/repositories/departments.py – DeptRepository.
CRUD for departments, scoped by org_id. Includes hierarchy + delete validation.
"""
from typing import Optional, List
import asyncpg


class DeptRepository:
    """Data access for the departments table."""

    @staticmethod
    async def create(
        conn: asyncpg.Connection,
        org_id: int,
        name: str,
        description: Optional[str] = None,
        parent_dept_id: Optional[int] = None,
        head_user_id: Optional[int] = None,
    ) -> dict:
        """Create a new department."""
        row = await conn.fetchrow(
            """
            INSERT INTO departments (org_id, name, description, parent_dept_id, head_user_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, org_id, name, description, parent_dept_id, head_user_id, created_at
            """,
            org_id, name.strip(), description, parent_dept_id, head_user_id,
        )
        return dict(row)

    @staticmethod
    async def get_by_id(conn: asyncpg.Connection, dept_id: int, org_id: int) -> Optional[dict]:
        """Get department by ID, scoped to org."""
        row = await conn.fetchrow(
            "SELECT * FROM departments WHERE id = $1 AND org_id = $2",
            dept_id, org_id,
        )
        return dict(row) if row else None

    @staticmethod
    async def list_by_org(conn: asyncpg.Connection, org_id: int) -> List[dict]:
        """List all departments in an org with user and position counts."""
        rows = await conn.fetch(
            """
            SELECT d.*,
                   COALESCE(u.user_count, 0) AS user_count,
                   COALESCE(p.position_count, 0) AS position_count,
                   h.name AS head_name
            FROM departments d
            LEFT JOIN (
                SELECT department_id, COUNT(*) AS user_count
                FROM users WHERE org_id = $1 AND is_active = TRUE
                GROUP BY department_id
            ) u ON d.id = u.department_id
            LEFT JOIN (
                SELECT department_id, COUNT(*) AS position_count
                FROM positions WHERE org_id = $1
                GROUP BY department_id
            ) p ON d.id = p.department_id
            LEFT JOIN users h ON d.head_user_id = h.id
            WHERE d.org_id = $1
            ORDER BY d.name
            """,
            org_id,
        )
        return [dict(r) for r in rows]

    @staticmethod
    async def update(
        conn: asyncpg.Connection,
        dept_id: int,
        org_id: int,
        **fields,
    ) -> Optional[dict]:
        """Update department fields dynamically."""
        if not fields:
            return await DeptRepository.get_by_id(conn, dept_id, org_id)

        set_clauses = []
        values = []
        for i, (key, val) in enumerate(fields.items(), start=1):
            set_clauses.append(f"{key} = ${i}")
            values.append(val)

        values.extend([dept_id, org_id])
        query = f"""
            UPDATE departments SET {', '.join(set_clauses)}
            WHERE id = ${len(values) - 1} AND org_id = ${len(values)}
            RETURNING *
        """
        row = await conn.fetchrow(query, *values)
        return dict(row) if row else None

    @staticmethod
    async def has_dependencies(conn: asyncpg.Connection, dept_id: int, org_id: int) -> dict:
        """Check if department has users or positions (prevents delete)."""
        user_count = await conn.fetchval(
            "SELECT COUNT(*) FROM users WHERE department_id = $1 AND org_id = $2",
            dept_id, org_id,
        )
        position_count = await conn.fetchval(
            "SELECT COUNT(*) FROM positions WHERE department_id = $1 AND org_id = $2",
            dept_id, org_id,
        )
        child_count = await conn.fetchval(
            "SELECT COUNT(*) FROM departments WHERE parent_dept_id = $1 AND org_id = $2",
            dept_id, org_id,
        )
        return {
            "user_count": user_count,
            "position_count": position_count,
            "child_count": child_count,
            "has_dependencies": (user_count + position_count + child_count) > 0,
        }

    @staticmethod
    async def delete(conn: asyncpg.Connection, dept_id: int, org_id: int) -> bool:
        """Delete a department. Returns True if deleted."""
        result = await conn.execute(
            "DELETE FROM departments WHERE id = $1 AND org_id = $2",
            dept_id, org_id,
        )
        return result == "DELETE 1"
