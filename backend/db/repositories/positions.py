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
        """Get position with candidate pipeline counts and department info."""
        row = await conn.fetchrow(
            """
            SELECT p.*, d.name as department_name 
            FROM positions p
            LEFT JOIN departments d ON p.department_id = d.id AND d.org_id = $2
            WHERE p.id = $1 AND p.org_id = $2
            """,
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
        page_size: int = 20,
        assigned_to: Optional[int] = None,
        team_lead_id: Optional[int] = None,
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
        if assigned_to:
            conditions.append(f"p.assigned_to = ${idx}")
            params.append(assigned_to)
            idx += 1
        if team_lead_id:
            conditions.append(f"(p.created_by = ${idx} OR p.reviewer_id = ${idx} OR p.id IN (SELECT position_id FROM hire_requests WHERE requested_by = ${idx} AND position_id IS NOT NULL))")
            params.append(team_lead_id)
            idx += 1

        offset = (page - 1) * page_size
        where = " AND ".join(conditions)

        rows = await conn.fetch(
            f"""
            SELECT p.*,
                d.name AS department_name,
                COUNT(a.id) AS total_candidates,
                COUNT(a.id) FILTER (WHERE a.status = 'applied') AS applied_count,
                COUNT(a.id) FILTER (WHERE a.status = 'interview') AS interview_count
            FROM positions p
            LEFT JOIN departments d ON p.department_id = d.id
            LEFT JOIN candidate_applications a ON a.position_id = p.id
            WHERE {where}
            GROUP BY p.id, d.name
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
            "closed_at", "department_id", "followup_delay_hours",
            # JD-chat resubmit fields (item 52 update path) — without these they were
            # silently dropped, leaving stale values on the position.
            "role_name", "jd_variant_selected", "employment_type",
            "experience_min", "experience_max",
            # JD Workflow Rev 4: HR pickup + approval tracking
            "picked_up_by", "picked_up_at", "revision_cycle",
            "reviewer_id", "submitted_by_role", "reviewer_role_at_submit",
            "submitted_at", "review_notes",
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

    # ── JD Workflow: Atomic HR Pickup (CAS) ───────────────────────────────

    @staticmethod
    async def atomic_hr_pickup(
        conn: asyncpg.Connection,
        position_id: int,
        org_id: int,
        hr_user_id: int,
    ) -> bool:
        """Atomic CAS: claim a position for JD work.

        Guard: picked_up_by IS NULL and linked hire_request is approved/approved_modified.
        Returns True if this HR user acquired the lock, False if already taken or
        hire_request was cancelled after approval.
        """
        result = await conn.execute(
            """
            UPDATE positions
               SET picked_up_by = $1,
                   picked_up_at = NOW(),
                   status = 'jd_in_progress',
                   updated_at = NOW()
             WHERE id = $2 AND org_id = $3
               AND picked_up_by IS NULL
               AND EXISTS (
                   SELECT 1 FROM hire_requests
                    WHERE position_id = $2
                      AND org_id = $3
                      AND status IN ('approved', 'approved_modified')
               )
            """,
            hr_user_id, position_id, org_id,
        )
        return result.endswith("1")

    # ── JD Workflow: Submit for JD Approval ───────────────────────────────

    @staticmethod
    async def submit_for_jd_approval(
        conn: asyncpg.Connection,
        position_id: int,
        org_id: int,
        *,
        reviewer_id: int,
        submitted_by_role: str,
        reviewer_role_at_submit: str,
    ) -> None:
        """Set position into pending_jd_approval state with reviewer snapshot.

        Increments revision_cycle if this is a re-submission (review_notes is set),
        otherwise leaves it at 0.
        """
        result = await conn.execute(
            """
            UPDATE positions
               SET status = 'pending_jd_approval',
                   approval_status = 'pending',
                   requires_approval = TRUE,
                   reviewer_id = $1,
                   submitted_by_role = $2,
                   reviewer_role_at_submit = $3,
                   submitted_at = NOW(),
                   review_notes = NULL,
                   updated_at = NOW()
             WHERE id = $4 AND org_id = $5
               AND status IN ('jd_in_progress', 'draft_needs_revision')
            """,
            reviewer_id, submitted_by_role, reviewer_role_at_submit,
            position_id, org_id,
        )
        return result.endswith("1")

    @staticmethod
    async def increment_revision_cycle(
        conn: asyncpg.Connection,
        position_id: int,
        org_id: int,
    ) -> int:
        """Increment revision_cycle counter. Returns the new value."""
        new_cycle = await conn.fetchval(
            """
            UPDATE positions
               SET revision_cycle = revision_cycle + 1,
                   updated_at = NOW()
             WHERE id = $1 AND org_id = $2
            RETURNING revision_cycle
            """,
            position_id, org_id,
        )
        return new_cycle or 0

    # ── Item 6: TL cancel-after-pickup (jd_in_progress → cancelled) ───────

    @staticmethod
    async def cancel_jd_in_progress(
        conn: asyncpg.Connection,
        position_id: int,
        org_id: int,
    ) -> bool:
        """Atomic: jd_in_progress → cancelled. Returns True on success."""
        result = await conn.execute(
            """
            UPDATE positions
               SET status = 'cancelled',
                   updated_at = NOW()
             WHERE id = $1 AND org_id = $2
               AND status = 'jd_in_progress'
            """,
            position_id, org_id,
        )
        return result.endswith("1")

    # ── Item 7: HR withdraw (pending_jd_approval → jd_in_progress) ────────

    @staticmethod
    async def withdraw_submission(
        conn: asyncpg.Connection,
        position_id: int,
        org_id: int,
    ) -> bool:
        """Atomic: pending_jd_approval → jd_in_progress. Bias resets."""
        result = await conn.execute(
            """
            UPDATE positions
               SET status = 'jd_in_progress',
                   approval_status = NULL,
                   reviewer_id = NULL,
                   submitted_at = NULL,
                   review_notes = NULL,
                   updated_at = NOW()
             WHERE id = $1 AND org_id = $2
               AND status = 'pending_jd_approval'
            """,
            position_id, org_id,
        )
        return result.endswith("1")

    # ── Item 11: Transactional approval (pending_jd_approval → open) ──────

    @staticmethod
    async def approve_and_open(
        conn: asyncpg.Connection,
        position_id: int,
        org_id: int,
        approver_user_id: int,
    ) -> bool:
        """Atomic: pending_jd_approval → open with approval_status='approved'."""
        result = await conn.execute(
            """
            UPDATE positions
               SET status = 'open',
                   approval_status = 'approved',
                   approved_by = $1,
                   approved_at = NOW(),
                   review_notes = NULL,
                   updated_at = NOW()
             WHERE id = $2 AND org_id = $3
               AND status = 'pending_jd_approval'
            """,
            approver_user_id, position_id, org_id,
        )
        return result.endswith("1")

    @staticmethod
    async def reject_to_revision(
        conn: asyncpg.Connection,
        position_id: int,
        org_id: int,
        notes: str,
    ) -> bool:
        """Atomic: pending_jd_approval → draft_needs_revision."""
        result = await conn.execute(
            """
            UPDATE positions
               SET status = 'draft_needs_revision',
                   approval_status = 'changes_requested',
                   review_notes = $1,
                   updated_at = NOW()
             WHERE id = $2 AND org_id = $3
               AND status = 'pending_jd_approval'
            """,
            notes, position_id, org_id,
        )
        return result.endswith("1")

    # ── Item 11 (cont.): Fulfill hire request in same transaction ─────────

    @staticmethod
    async def fulfill_hire_request(
        conn: asyncpg.Connection,
        position_id: int,
        org_id: int,
    ) -> None:
        """Set the linked hire_request to 'fulfilled' (Flow 1 only)."""
        await conn.execute(
            """
            UPDATE hire_requests
               SET status = 'fulfilled',
                   updated_at = NOW()
             WHERE position_id = $1 AND org_id = $2
               AND status IN ('approved', 'approved_modified', 'accepted')
            """,
            position_id, org_id,
        )

    # ── Item 19: Org_head direct-to-open bypass ───────────────────────────

    @staticmethod
    async def org_head_direct_approve(
        conn: asyncpg.Connection,
        position_id: int,
        org_id: int,
        user_id: int,
    ) -> bool:
        """Flow 2 bypass: org_head creates → position goes to open directly.

        Guard: position must still be in jd_in_progress or draft_needs_revision.
        Returns True on success, False if status changed concurrently.
        """
        result = await conn.execute(
            """
            UPDATE positions
               SET status = 'open',
                   approval_status = 'approved',
                   approved_by = $1,
                   approved_at = NOW(),
                   requires_approval = FALSE,
                   updated_at = NOW()
             WHERE id = $2 AND org_id = $3
               AND status IN ('jd_in_progress', 'draft_needs_revision')
            """,
            user_id, position_id, org_id,
        )
        return result.endswith("1")

    # ── Item 12: Re-resolve reviewer when user deleted ────────────────────

    @staticmethod
    async def get_positions_pending_review_by_user(
        conn: asyncpg.Connection,
        user_id: int,
        org_id: int,
    ) -> list[dict]:
        """Find positions where a deleted/deactivated user is the reviewer."""
        rows = await conn.fetch(
            """
            SELECT id, department_id, created_by
            FROM positions
            WHERE org_id = $1
              AND reviewer_id = $2
              AND status = 'pending_jd_approval'
            """,
            org_id, user_id,
        )
        return [dict(r) for r in rows]

    @staticmethod
    async def reassign_reviewer(
        conn: asyncpg.Connection,
        position_id: int,
        org_id: int,
        new_reviewer_id: int,
        new_reviewer_role: str,
    ) -> None:
        """Reassign the reviewer on a pending position."""
        await conn.execute(
            """
            UPDATE positions
               SET reviewer_id = $1,
                   reviewer_role_at_submit = $2,
                   updated_at = NOW()
             WHERE id = $3 AND org_id = $4
            """,
            new_reviewer_id, new_reviewer_role, position_id, org_id,
        )

    # ── Item 22: Same-title duplicate check ───────────────────────────────

    @staticmethod
    async def find_same_title(
        conn: asyncpg.Connection,
        org_id: int,
        role_name: str,
    ) -> list[dict]:
        """Find active positions with the same title (case-insensitive)."""
        rows = await conn.fetch(
            """
            SELECT id, status, role_name
            FROM positions
            WHERE org_id = $1
              AND LOWER(role_name) = LOWER($2)
              AND status != 'cancelled'
            """,
            org_id, role_name,
        )
        return [dict(r) for r in rows]

    @staticmethod
    async def compute_title_suffix(
        conn: asyncpg.Connection,
        org_id: int,
        role_name: str,
    ) -> int:
        """Transactional suffix to prevent TOCTOU on same-title."""
        count = await conn.fetchval(
            """
            SELECT COUNT(*) + 1 FROM positions
            WHERE org_id = $1 AND LOWER(role_name) = LOWER($2)
            FOR UPDATE
            """,
            org_id, role_name,
        )
        return count or 1
