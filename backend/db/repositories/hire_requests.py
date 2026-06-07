"""
db/repositories/hire_requests.py – HireRequestRepository.

All SQL for the `hire_requests` table lives here. Every method is scoped by
org_id (enforced by callers — the service layer); no method bypasses tenant
isolation. Status transitions are intentionally guarded at the service layer,
not here, so the repo stays a thin data-access surface.

Status lifecycle (Design Rev 4):
    draft → submitted → admin_reviewing → approved | approved_modified | rejected | cancelled
                │                │
                └→ cancelled     └→ submitted (close/TTL release)
    approved / approved_modified → cancelled (TL, before HR pickup)
"""
from typing import Optional, List, Tuple
import asyncpg


# Columns we always want back for list/detail rendering. Joined fields
# (department_name, requested_by_name, position info) come from the SELECT
# wrappers, not the bare table.
_BASE_RETURN = """
    hr.id, hr.org_id, hr.department_id, hr.requested_by, hr.accepted_by,
    hr.role_name, hr.headcount, hr.priority, hr.work_type,
    hr.experience_min, hr.experience_max,
    hr.target_start, hr.requirements,
    hr.comp_min, hr.comp_max, hr.location,
    hr.status, hr.chat_session_id, hr.position_id,
    hr.approved_by, hr.approved_at, hr.rejection_reason,
    hr.reviewing_locked_by, hr.reviewing_locked_at,
    hr.modification_diff, hr.notes,
    hr.created_at, hr.updated_at
"""

_LIST_SELECT = f"""
SELECT {_BASE_RETURN},
       d.name AS department_name,
       u.name AS requested_by_name,
       u.email AS requested_by_email,
       acc.name AS accepted_by_name,
       appr.name AS approved_by_name,
       lockuser.name AS reviewing_locked_by_name,
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
  LEFT JOIN users lockuser ON lockuser.id = hr.reviewing_locked_by
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
        cursor_created_at: Optional[str] = None,
        cursor_id: Optional[int] = None,
        limit: int = 50,
    ) -> Tuple[List[dict], Optional[dict]]:
        """List hire requests with optional filters. Returns (rows, next_cursor).

        Uses seek/keyset pagination on (created_at DESC, id DESC) for stable,
        efficient cursoring even on large result sets. Pass cursor_created_at +
        cursor_id from the previous page's next_cursor to fetch the next page.
        """
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
        if cursor_created_at is not None and cursor_id is not None:
            params.append(cursor_created_at)
            params.append(cursor_id)
            at_idx = len(params) - 1
            id_idx = len(params)
            where.append(
                f"(hr.created_at, hr.id) < (${at_idx}::timestamptz, ${id_idx})"
            )
        params.append(limit)
        sql = (
            f"{_LIST_SELECT} WHERE {' AND '.join(where)} "
            f"ORDER BY hr.created_at DESC, hr.id DESC LIMIT ${len(params)}"
        )
        rows = await conn.fetch(sql, *params)
        result = [dict(r) for r in rows]
        next_cursor: Optional[dict] = None
        if len(result) == limit:
            last = result[-1]
            next_cursor = {
                "created_at": last["created_at"].isoformat() if hasattr(last["created_at"], "isoformat") else str(last["created_at"]),
                "id": last["id"],
            }
        return result, next_cursor

    @staticmethod
    async def count_pending(
        conn: asyncpg.Connection,
        org_id: int,
        department_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> int:
        """Cheap counter for sidebar badge — counts requests needing action.

        If status is not provided, defaults to pending/submitted/approved/approved_modified.
        """
        where = ["org_id = $1"]
        params: list = [org_id]

        if department_id is not None:
            params.append(department_id)
            where.append(f"department_id = ${len(params)}")

        if status is not None:
            params.append(status)
            where.append(f"status = ${len(params)}")
        else:
            where.append("status IN ('pending', 'submitted', 'approved', 'approved_modified')")

        sql = f"SELECT COUNT(*) FROM hire_requests WHERE {' AND '.join(where)}"
        val = await conn.fetchval(sql, *params)
        return int(val) if val is not None else 0

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
        priority: str = "normal",
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
                headcount, priority, work_type, experience_min, experience_max,
                target_start, requirements, comp_min, comp_max, location,
                status
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending')
            RETURNING id
            """,
            org_id, department_id, requested_by, role_name.strip(),
            headcount, priority, work_type, experience_min, experience_max,
            target_start, requirements, comp_min, comp_max, location,
        )
        if row is None:
            raise RuntimeError("Database failed to return an ID for the new hire request")
            
        res = await HireRequestRepository.get_by_id(conn, row["id"], org_id)
        if res is None:
            raise RuntimeError("Failed to retrieve newly created hire request")
        return res

    @staticmethod
    async def update(
        conn: asyncpg.Connection,
        request_id: int,
        org_id: int,
        **fields,
    ) -> Optional[dict]:
        """Partial update on caller-supplied fields, org-scoped."""
        allowed = {
            "department_id", "role_name", "headcount", "priority", "work_type",
            "experience_min", "experience_max", "target_start",
            "requirements", "comp_min", "comp_max", "location", "notes",
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
        approved_by: Optional[int],
    ) -> None:
        """Mark → `approved`. Clears review lock. Caller verifies state + permission."""
        await conn.execute(
            """
            UPDATE hire_requests
               SET status = 'approved',
                   approved_by = $1,
                   approved_at = NOW(),
                   reviewing_locked_by = NULL,
                   reviewing_locked_at = NULL,
                   updated_at = NOW()
             WHERE id = $2 AND org_id = $3
            """,
            approved_by, request_id, org_id,
        )

    @staticmethod
    async def approve_modified(
        conn: asyncpg.Connection,
        request_id: int,
        org_id: int,
        approved_by: int,
        notes: str,
        modification_diff: dict,
    ) -> None:
        """Mark → `approved_modified` with diff JSONB and notes. Clears lock."""
        import json
        await conn.execute(
            """
            UPDATE hire_requests
               SET status = 'approved_modified',
                   approved_by = $1,
                   approved_at = NOW(),
                   notes = $2,
                   modification_diff = $3::jsonb,
                   reviewing_locked_by = NULL,
                   reviewing_locked_at = NULL,
                   updated_at = NOW()
             WHERE id = $4 AND org_id = $5
            """,
            approved_by, notes, json.dumps({"schema_version": 1, **modification_diff}),
            request_id, org_id,
        )

    @staticmethod
    async def reject(
        conn: asyncpg.Connection,
        request_id: int,
        org_id: int,
        rejection_reason: str,
    ) -> None:
        """Mark → `rejected` (terminal). Clears lock. Caller verifies state + permission."""
        await conn.execute(
            """
            UPDATE hire_requests
               SET status = 'rejected',
                   rejection_reason = $1,
                   notes = $1,
                   reviewing_locked_by = NULL,
                   reviewing_locked_at = NULL,
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
        notes: Optional[str] = None,
    ) -> bool:
        """Cancel a request. Returns True if the row was actually updated."""
        row_id = await conn.fetchval(
            """
            UPDATE hire_requests
               SET status = 'cancelled',
                   notes = COALESCE($1, notes),
                   reviewing_locked_by = NULL,
                   reviewing_locked_at = NULL,
                   updated_at = NOW()
             WHERE id = $2 AND org_id = $3
               AND status IN ('pending', 'submitted', 'approved', 'approved_modified', 'admin_reviewing')
            RETURNING id
            """,
            notes, request_id, org_id,
        )
        return row_id is not None

    # ── Admin Reviewing Lock (Atomic CAS) ─────────────────────────────────

    @staticmethod
    async def begin_review(
        conn: asyncpg.Connection,
        request_id: int,
        org_id: int,
        admin_user_id: int,
    ) -> bool:
        """Atomic CAS: submitted → admin_reviewing with lock.

        Returns True if this admin acquired the lock.
        Returns False if another admin already has it (zero rows updated).
        """
        result = await conn.execute(
            """
            UPDATE hire_requests
               SET status = 'admin_reviewing',
                   reviewing_locked_by = $1,
                   reviewing_locked_at = NOW(),
                   updated_at = NOW()
             WHERE id = $2 AND org_id = $3
               AND status IN ('pending', 'submitted')
            """,
            admin_user_id, request_id, org_id,
        )
        # asyncpg returns "UPDATE N" — parse the count
        return result.endswith("1")

    @staticmethod
    async def takeover_review(
        conn: asyncpg.Connection,
        request_id: int,
        org_id: int,
        admin_user_id: int,
    ) -> bool:
        """Takeover: admin_reviewing by another admin (after 10-min threshold).

        Returns True if takeover succeeded.
        """
        result = await conn.execute(
            """
            UPDATE hire_requests
               SET reviewing_locked_by = $1,
                   reviewing_locked_at = NOW(),
                   updated_at = NOW()
             WHERE id = $2 AND org_id = $3
               AND status = 'admin_reviewing'
               AND reviewing_locked_at < NOW() - INTERVAL '10 minutes'
            """,
            admin_user_id, request_id, org_id,
        )
        return result.endswith("1")

    @staticmethod
    async def release_review_lock(
        conn: asyncpg.Connection,
        request_id: int,
        org_id: int,
    ) -> None:
        """Release lock: admin_reviewing → submitted (close without action)."""
        await conn.execute(
            """
            UPDATE hire_requests
               SET status = 'submitted',
                   reviewing_locked_by = NULL,
                   reviewing_locked_at = NULL,
                   updated_at = NOW()
             WHERE id = $1 AND org_id = $2
               AND status = 'admin_reviewing'
            """,
            request_id, org_id,
        )

    @staticmethod
    async def release_expired_locks(
        conn: asyncpg.Connection,
    ) -> int:
        """Background job: release all locks older than 30 minutes.

        Returns count of released locks.
        """
        result = await conn.execute(
            """
            UPDATE hire_requests
               SET status = 'submitted',
                   reviewing_locked_by = NULL,
                   reviewing_locked_at = NULL,
                   updated_at = NOW()
             WHERE status = 'admin_reviewing'
               AND reviewing_locked_at < NOW() - INTERVAL '30 minutes'
            """
        )
        # Parse "UPDATE N"
        try:
            return int(result.split()[-1])
        except (ValueError, IndexError):
            return 0
