"""
db/repositories/screening_questions.py – ScreeningQuestionRepository.
CRUD + reorder + dept filter for screening questions, scoped by org_id.
"""
from typing import Optional, List
import asyncpg


class ScreeningQuestionRepository:
    """Data access for the screening_questions table."""

    @staticmethod
    async def create(
        conn: asyncpg.Connection,
        org_id: int,
        field_key: str,
        label: str,
        field_type: str = "text",
        options: Optional[str] = None,
        is_required: bool = False,
        department_id: Optional[int] = None,
        sort_order: int = 0,
    ) -> dict:
        """Create a new screening question."""
        row = await conn.fetchrow(
            """
            INSERT INTO screening_questions
                (org_id, department_id, field_key, label, field_type, options, is_required, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, org_id, department_id, field_key, label, field_type,
                      options, is_required, sort_order, is_active, created_at
            """,
            org_id, department_id, field_key, label, field_type,
            options, is_required, sort_order,
        )
        return dict(row)

    @staticmethod
    async def get_by_id(conn: asyncpg.Connection, question_id: int, org_id: int) -> Optional[dict]:
        """Get screening question by ID, scoped to org."""
        row = await conn.fetchrow(
            "SELECT * FROM screening_questions WHERE id = $1 AND org_id = $2",
            question_id, org_id,
        )
        return dict(row) if row else None

    @staticmethod
    async def list_by_org(
        conn: asyncpg.Connection,
        org_id: int,
        department_id: Optional[int] = None,
    ) -> List[dict]:
        """
        List screening questions. If department_id is given and that dept
        has questions, return those. Otherwise return org-wide defaults
        (department_id IS NULL).
        """
        if department_id is not None:
            # Check if dept has its own questions
            dept_rows = await conn.fetch(
                """
                SELECT * FROM screening_questions
                WHERE org_id = $1 AND department_id = $2 AND is_active = TRUE
                ORDER BY sort_order, id
                """,
                org_id, department_id,
            )
            if dept_rows:
                return [dict(r) for r in dept_rows]

        # Fallback to org defaults (no department_id)
        rows = await conn.fetch(
            """
            SELECT * FROM screening_questions
            WHERE org_id = $1 AND department_id IS NULL AND is_active = TRUE
            ORDER BY sort_order, id
            """,
            org_id,
        )
        return [dict(r) for r in rows]

    @staticmethod
    async def list_all_by_org(conn: asyncpg.Connection, org_id: int) -> List[dict]:
        """List ALL screening questions (for settings page — includes dept-specific)."""
        rows = await conn.fetch(
            """
            SELECT sq.*, d.name AS department_name
            FROM screening_questions sq
            LEFT JOIN departments d ON sq.department_id = d.id
            WHERE sq.org_id = $1 AND sq.is_active = TRUE
            ORDER BY sq.department_id NULLS FIRST, sq.sort_order, sq.id
            """,
            org_id,
        )
        return [dict(r) for r in rows]

    @staticmethod
    async def update(
        conn: asyncpg.Connection,
        question_id: int,
        org_id: int,
        **fields,
    ) -> Optional[dict]:
        """Update screening question fields dynamically."""
        if not fields:
            return await ScreeningQuestionRepository.get_by_id(conn, question_id, org_id)

        set_clauses = []
        values = []
        for i, (key, val) in enumerate(fields.items(), start=1):
            set_clauses.append(f"{key} = ${i}")
            values.append(val)

        values.extend([question_id, org_id])
        query = f"""
            UPDATE screening_questions SET {', '.join(set_clauses)}
            WHERE id = ${len(values) - 1} AND org_id = ${len(values)}
            RETURNING *
        """
        row = await conn.fetchrow(query, *values)
        return dict(row) if row else None

    @staticmethod
    async def reorder(
        conn: asyncpg.Connection,
        org_id: int,
        order: List[dict],
    ) -> None:
        """
        Reorder screening questions. order is a list of {id, sort_order}.
        """
        for item in order:
            await conn.execute(
                """
                UPDATE screening_questions SET sort_order = $1
                WHERE id = $2 AND org_id = $3
                """,
                item["sort_order"], item["id"], org_id,
            )

    @staticmethod
    async def delete(conn: asyncpg.Connection, question_id: int, org_id: int) -> bool:
        """Delete (soft-delete by setting is_active=FALSE)."""
        result = await conn.execute(
            "UPDATE screening_questions SET is_active = FALSE WHERE id = $1 AND org_id = $2",
            question_id, org_id,
        )
        return "UPDATE 1" in result
