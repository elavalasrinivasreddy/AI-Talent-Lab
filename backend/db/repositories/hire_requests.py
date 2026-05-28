"""
db/repositories/hire_requests.py – HireRequestRepository.

All SQL for the `hire_requests` table lives here. Every method is scoped by
org_id (enforced by callers — the service layer); no method bypasses tenant
isolation. Status transitions are intentionally guarded at the service layer,
not here, so the repo stays a thin data-access surface.

Status lifecycle:
    pending → approved → accepted → fulfilled
       │         │
       │         └→ cancelled
       └→ rejected (terminal, with reason)
       └→ cancelled
"""
from typing import Optional, List
import asyncpg


# Columns we always want back for list/detail rendering. Joined fields
# (department_name, requested_by_name, position info) come from the SELECT
# wrappers, not the bare table.
_BASE_RETURN = """
    hr.id, hr.org_id, hr.department_id, hr.requested_by, hr.accepted_by,
    hr.role_name, hr.headcount, hr.work_type,
    hr.experience_min, hr.experience_max,
    hr.target_start, hr.requirements,
    hr.comp_min, hr.comp_max, hr.location,
    hr.status, hr.chat_session_id, hr.position_id,
    hr.approved_by, hr.approved_at, hr.rejection_reason,
    hr.created_at, hr.updated_at
"""

_LIST_SELECT = f"""
SELECT {_BASE_RETURN},
       d.name AS department_name,
       u.name AS requested_by_name,
       u.email AS requested_by_email,
       acc.name AS accepted_by_name,
       appr.name AS approved_by_name,
       p.role_name AS position_role_name,
       p.status AS position_status,
       p.approval_status AS position_approval_status,
       (SELECT COUNT(*) FROM candidate_applications ca
            WHERE ca.position_id = hr.position_id) AS candidate_count,
       (SELECT COUNT(*) FROM interviews i
            WHERE i.position_id = hr.position_id) AS interview_count
  FROM hire_requests hr
  LEFT JOIN departments d  ON d.id  = hr.department_id
  LEFT JOIN users u        ON u.id  = hr.requested_by
  LEFT JOIN users acc      ON acc.id = hr.accepted_by
  LEFT JOIN users appr     ON appr.id = hr.approved_by
  LEFT JOIN positions p    ON p.id  = hr.position_id
"""


class HireRequestRepository:
    """Data access for the hire_requests table. All queries are org-scoped."""

    # ── Reads ─────────────────────────────────────────────────────────────

    @staticmethod
    async def get_by_id(
        conn: asyncpg.Connection,
        request_id: int,
        org_id: int,
    ) -> Optional[dict]:
        """Fetch one hire request (with joined display fields). None if missing."""
        row = await conn.fetchrow(
            f"{_LIST_SELECT} WHERE hr.id = $1 AND hr.org_id = $2",
            request_id, org_id,
        )
        return dict(row) if row else None

    @staticmethod
    async def list_for_org(
        conn: asyncpg.Connection,
        org_id: int,
        *,
        status: Optional[str] = None,
        requested_by: Optional[int] = None,
        department_id: Optional[int] = None,
        limit: int = 100,
    ) -> List[dict]:
        """List hire requests with optional filters."""
        where = ["hr.org_id = $1"]
        params: list = [org_id]
        if status is not None:
            params.append(status)
            where.append(f"hr.status = ${len(params)}")
        if requested_by is not None:
            params.append(requested_by)
            where.append(f"hr.requested_by = ${len(params)}")
        if department_id is not None:
            params.append(department_id)
            where.append(f"hr.department_id = ${len(params)}")
        params.append(limit)
        sql = (
            f"{_LIST_SELECT} WHERE {' AND '.join(where)} "
            f"ORDER BY hr.created_at DESC LIMIT ${len(params)}"
        )
        rows = await conn.fetch(sql, *params)
        return [dict(r) for r in rows]

    @staticmethod
    async def count_pending_for_org(conn: asyncpg.Connection, org_id: int) -> int:
        """Cheap counter for sidebar badge — counts requests needing action.

        Returns approved (awaiting HR pickup) + pending (awaiting dept_admin approval).
        """
        return await conn.fetchval(
            "SELECT COUNT(*) FROM hire_requests WHERE org_id = $1 AND status IN ('pending', 'approved')",
            org_id,
        )

    # ── Writes ────────────────────────────────────────────────────────────

    @staticmethod
    async def create(
        conn: asyncpg.Connection,
        *,
        org_id: int,
        requested_by: int,
        role_name: str,
        department_id: Optional[int] = None,
        headcount: int = 1,
        work_type: str = "onsite",
        experience_min: Optional[int] = None,
        experience_max: Optional[int] = None,
        target_start: Optional[str] = None,
        requirements: Optional[str] = None,
        comp_min: Optional[int] = None,
        comp_max: Optional[int] = None,
        location: Optional[str] = None,
    ) -> dict:
        row = await conn.fetchrow(
            """
            INSERT INTO hire_requests (
                org_id, department_id, requested_by, role_name,
                headcount, work_type, experience_min, experience_max,
                target_start, requirements, comp_min, comp_max, location,
                status
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending')
            RETURNING id
            """,
            org_id, department_id, requested_by, role_name.strip(),
            headcount, work_type, experience_min, experience_max,
            target_start, requirements, comp_min, comp_max, location,
        )
        return await HireRequestRepository.get_by_id(conn, row["id"], org_id)

    @staticmethod
    async def update(
        conn: asyncpg.Connection,
        request_id: int,
        org_id: int,
        **fields,
    ) -> Optional[dict]:
        """Partial update on caller-supplied fields, org-scoped."""
        # Restrict to known-safe columns. Anything else is silently dropped.
        allowed = {
            "department_id", "role_name", "headcount", "work_type",
            "experience_min", "experience_max", "target_start",
            "requirements", "comp_min", "comp_max", "location",
        }
        sanitized = {k: v for k, v in fields.items() if k in allowed}
        if not sanitized:
            return await HireRequestRepository.get_by_id(conn, request_id, org_id)

        set_parts: list[str] = []
        params: list = []
        for i, (k, v) in enumerate(sanitized.items(), start=1):
            set_parts.append(f"{k} = ${i}")
            params.append(v)
        params.extend([request_id, org_id])
        sql = (
            f"UPDATE hire_requests SET {', '.join(set_parts)}, updated_at = NOW() "
            f"WHERE id = ${len(params) - 1} AND org_id = ${len(params)} "
            "RETURNING id"
        )
        row = await conn.fetchrow(sql, *params)
        if not row:
            return None
        return await HireRequestRepository.get_by_id(conn, row["id"], org_id)

    @staticmethod
    async def approve(
        conn: asyncpg.Connection,
        request_id: int,
        org_id: int,
        approved_by: int,
    ) -> None:
        """Mark `pending` → `approved`. Caller verifies state + permission."""
        await conn.execute(
            """
            UPDATE hire_requests
               SET status = 'approved',
                   approved_by = $1,
                   approved_at = NOW(),
                   updated_at = NOW()
             WHERE id = $2 AND org_id = $3
            """,
            approved_by, request_id, org_id,
        )

    @staticmethod
    async def reject(
        conn: asyncpg.Connection,
        request_id: int,
        org_id: int,
        rejection_reason: str,
    ) -> None:
        """Mark `pending` → `rejected` (terminal). Caller verifies state + permission."""
        await conn.execute(
            """
            UPDATE hire_requests
               SET status = 'rejected',
                   rejection_reason = $1,
                   updated_at = NOW()
             WHERE id = $2 AND org_id = $3
            """,
            rejection_reason, request_id, org_id,
        )

    @staticmethod
    async def accept(
        conn: asyncpg.Connection,
        request_id: int,
        org_id: int,
        accepted_by: int,
        chat_session_id: Optional[str] = None,
    ) -> None:
        """Mark `approved` → `accepted` by a recruiter. Caller verifies state first."""
        await conn.execute(
            """
            UPDATE hire_requests
               SET status = 'accepted',
                   accepted_by = $1,
                   chat_session_id = COALESCE($2, chat_session_id),
                   updated_at = NOW()
             WHERE id = $3 AND org_id = $4
            """,
            accepted_by, chat_session_id, request_id, org_id,
        )

    @staticmethod
    async def link_position(
        conn: asyncpg.Connection,
        request_id: int,
        org_id: int,
        position_id: int,
    ) -> None:
        """Link to created position and mark `fulfilled`."""
        await conn.execute(
            """
            UPDATE hire_requests
               SET position_id = $1, status = 'fulfilled', updated_at = NOW()
             WHERE id = $2 AND org_id = $3
            """,
            position_id, request_id, org_id,
        )

    @staticmethod
    async def cancel(
        conn: asyncpg.Connection,
        request_id: int,
        org_id: int,
    ) -> None:
        await conn.execute(
            """
            UPDATE hire_requests
               SET status = 'cancelled', updated_at = NOW()
             WHERE id = $1 AND org_id = $2
            """,
            request_id, org_id,
        )
