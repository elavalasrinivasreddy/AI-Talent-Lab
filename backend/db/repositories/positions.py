"""
db/repositories/positions.py – PositionRepository for managing job openings.
Handles persistence of JDs, variants, and position metadata.
"""
import logging
from typing import Any, Optional

from backend.db.connection import get_connection

logger = logging.getLogger(__name__)


class PositionRepository:

    @staticmethod
    async def create(
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
        """Create a new position."""
        async with get_connection() as conn:
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
    async def insert_variants(position_id: int, variants: list[dict]) -> None:
        """Insert JD variants generated during the chat."""
        if not variants:
            return
            
        async with get_connection() as conn:
            # Prepare bulk insert
            values = []
            for v in variants:
                values.append((
                    position_id,
                    v.get("type", "hybrid"),
                    v.get("summary", ""),
                    v.get("content", ""),
                    v.get("is_selected", False)
                ))
            
            await conn.executemany(
                """
                INSERT INTO jd_variants (position_id, variant_type, summary, content, is_selected)
                VALUES ($1, $2, $3, $4, $5)
                """,
                values
            )

    @staticmethod
    async def update_embedding(position_id: int, org_id: int, embedding_json: str) -> None:
        """Save the JSON stringified embedding back to position row if needed.
        (ChromaDB handles actual vector search, but DB can store the raw vector).
        """
        async with get_connection() as conn:
            await conn.execute(
                """
                UPDATE positions
                SET jd_embedding = $1, updated_at = NOW()
                WHERE id = $2 AND org_id = $3
                """,
                embedding_json, position_id, org_id
            )

    @staticmethod
    async def get_by_id(position_id: int, org_id: int) -> Optional[dict[str, Any]]:
        """Get position by ID ensuring it belongs to org_id."""
        async with get_connection() as conn:
            row = await conn.fetchrow(
                """
                SELECT * FROM positions
                WHERE id = $1 AND org_id = $2
                """,
                position_id, org_id
            )
            return dict(row) if row else None
