"""
db/repositories/positions.py – PositionRepository
All SQL for positions and jd_variants. Filters by org_id on every query.
"""
import logging
from typing import Any, Optional

import asyncpg

logger = logging.getLogger(__name__)


class PositionRepository:

    @staticmethod
    async def create(
        conn: asyncpg.Connection,
        org_id: int,
        department_id: int,
        session_id: Optional[str],
        role_name: str,
        jd_markdown: str,
        jd_variant_selected: Optional[str],
        status: str = "draft",
        priority: str = "normal",
        headcount: int = 1,
        location: Optional[str] = None,
        work_type: str = "onsite",
        employment_type: str = "full_time",
        experience_min: Optional[int] = None,
        experience_max: Optional[int] = None,
        salary_min: Optional[float] = None,
        salary_max: Optional[float] = None,
        currency: str = "INR",
        ats_threshold: float = 80.0,
        search_interval_hours: int = 24,
        is_on_career_page: bool = True,
        created_by: Optional[int] = None,
    ) -> dict[str, Any]:
        """Create a new position. Accepts explicit conn for use in transactions."""
        row = await conn.fetchrow(
            """
            INSERT INTO positions (
                org_id, department_id, session_id, role_name, jd_markdown,
                jd_variant_selected, status, priority, headcount, location,
                work_type, employment_type, experience_min, experience_max,
                salary_min, salary_max, currency, ats_threshold,
                search_interval_hours, is_on_career_page, created_by
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18,
                $19, $20, $21
            )
            RETURNING *
            """,
            org_id, department_id, session_id, role_name, jd_markdown,
            jd_variant_selected, status, priority, headcount, location,
            work_type, employment_type, experience_min, experience_max,
            salary_min, salary_max, currency, ats_threshold,
            search_interval_hours, is_on_career_page, created_by
        )
        return dict(row)

    @staticmethod
    async def insert_variants(conn: asyncpg.Connection, position_id: int, variants: list[dict]) -> None:
        """Bulk-insert JD variants."""
        if not variants:
            return
            
        values = [
            (
                position_id,
                v.get("type", "hybrid"),
                v.get("summary", ""),
                v.get("content", ""),
                v.get("is_selected", False)
            )
            for v in variants
        ]
        await conn.executemany(
            """
            INSERT INTO jd_variants (position_id, variant_type, summary, content, is_selected)
            VALUES ($1, $2, $3, $4, $5)
            """,
            values
        )

    @staticmethod
    async def get(conn: asyncpg.Connection, position_id: int, org_id: int) -> Optional[dict[str, Any]]:
        """Get position by ID scoped to org."""
        row = await conn.fetchrow(
            "SELECT * FROM positions WHERE id = $1 AND org_id = $2",
            position_id, org_id
        )
        return dict(row) if row else None

    @staticmethod
    async def get_with_stats(conn: asyncpg.Connection, position_id: int, org_id: int) -> Optional[dict]:
        """Get position with candidate pipeline counts."""
        row = await conn.fetchrow(
            "SELECT * FROM positions WHERE id = $1 AND org_id = $2",
            position_id, org_id
        )
        if not row:
            return None
        position = dict(row)

        # Candidate counts per status
        counts = await conn.fetch(
            """
            SELECT status, COUNT(*) AS count
            FROM candidate_applications
            WHERE position_id = $1 AND org_id = $2
            GROUP BY status
            """,
            position_id, org_id
        )
        position["pipeline_counts"] = {r["status"]: r["count"] for r in counts}
        position["total_candidates"] = sum(r["count"] for r in counts)
        return position

    @staticmethod
    async def list_for_org(
        conn: asyncpg.Connection,
        org_id: int,
        department_id: Optional[int] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> list[dict]:
        """List positions for an org with optional filters."""
        conditions = ["p.org_id = $1"]
        params: list = [org_id]
        idx = 2

        if department_id:
            conditions.append(f"p.department_id = ${idx}")
            params.append(department_id)
            idx += 1
        if status:
            conditions.append(f"p.status = ${idx}")
            params.append(status)
            idx += 1

        offset = (page - 1) * page_size
        where = " AND ".join(conditions)

        rows = await conn.fetch(
            f"""
            SELECT p.*,
                COUNT(a.id) AS total_candidates,
                COUNT(a.id) FILTER (WHERE a.status = 'applied') AS applied_count,
                COUNT(a.id) FILTER (WHERE a.status = 'interview') AS interview_count
            FROM positions p
            LEFT JOIN candidate_applications a ON a.position_id = p.id
            WHERE {where}
            GROUP BY p.id
            ORDER BY p.created_at DESC
            LIMIT {page_size} OFFSET {offset}
            """,
            *params
        )
        return [dict(r) for r in rows]

    @staticmethod
    async def update(conn: asyncpg.Connection, position_id: int, org_id: int, data: dict) -> Optional[dict]:
        """Update position fields."""
        allowed = {
            "status", "priority", "headcount", "ats_threshold", "search_interval_hours",
            "deadline", "is_on_career_page", "assigned_to", "location", "work_type",
            "jd_markdown", "jd_embedding", "last_search_at", "next_search_at",
            "closed_at", "department_id", "followup_delay_hours"
        }
        fields = {k: v for k, v in data.items() if k in allowed}
        if not fields:
            return await PositionRepository.get(conn, position_id, org_id)

        set_clauses = ", ".join(f"{k} = ${i + 3}" for i, k in enumerate(fields.keys()))
        values = list(fields.values())
        row = await conn.fetchrow(
            f"""
            UPDATE positions SET {set_clauses}, updated_at = NOW()
            WHERE id = $1 AND org_id = $2
            RETURNING *
            """,
            position_id, org_id, *values
        )
        return dict(row) if row else None

    @staticmethod
    async def update_embedding(
        conn: asyncpg.Connection, position_id: int, org_id: int, embedding_json: str
    ) -> None:
        await conn.execute(
            """
            UPDATE positions SET jd_embedding = $1, updated_at = NOW()
            WHERE id = $2 AND org_id = $3
            """,
            embedding_json, position_id, org_id
        )

    @staticmethod
    async def get_variants(conn: asyncpg.Connection, position_id: int) -> list[dict]:
        rows = await conn.fetch(
            "SELECT * FROM jd_variants WHERE position_id = $1 ORDER BY created_at",
            position_id
        )
        return [dict(r) for r in rows]

    @staticmethod
    async def get_interview_kit(conn: asyncpg.Connection, position_id: int, org_id: int) -> Optional[dict]:
        row = await conn.fetchrow(
            "SELECT * FROM interview_kits WHERE position_id = $1 AND org_id = $2",
            position_id, org_id
        )
        return dict(row) if row else None
