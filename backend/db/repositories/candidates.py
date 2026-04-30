"""
db/repositories/candidates.py – CandidateRepository
Handles all candidate + candidate_applications SQL. Filters by org_id on every query.
"""
import json
import logging
from typing import Optional

import asyncpg

logger = logging.getLogger(__name__)


class CandidateRepository:

    # ── Candidate CRUD ─────────────────────────────────────────────────────────

    @staticmethod
    async def create(conn: asyncpg.Connection, data: dict) -> dict:
        """Insert a new candidate. Returns created row."""
        row = await conn.fetchrow(
            """
            INSERT INTO candidates
                (org_id, name, email, phone, current_title, current_company,
                 experience_years, location, resume_text, resume_parsed,
                 resume_embedding, source, source_profile_url, notes)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            RETURNING *
            """,
            data["org_id"], data.get("name"), data.get("email"),
            data.get("phone"), data.get("current_title"), data.get("current_company"),
            data.get("experience_years"), data.get("location"),
            data.get("resume_text"), data.get("resume_parsed"),
            data.get("resume_embedding"), data.get("source", "manual"),
            data.get("source_profile_url"), data.get("notes"),
        )
        return dict(row)

    @staticmethod
    async def get(conn: asyncpg.Connection, candidate_id: int, org_id: int) -> Optional[dict]:
        """Get candidate by ID scoped to org."""
        row = await conn.fetchrow(
            "SELECT * FROM candidates WHERE id = $1 AND org_id = $2",
            candidate_id, org_id
        )
        return dict(row) if row else None

    @staticmethod
    async def get_by_email(conn: asyncpg.Connection, email: str, org_id: int) -> Optional[dict]:
        """Dedup check — find candidate by email within org."""
        row = await conn.fetchrow(
            "SELECT * FROM candidates WHERE email = $1 AND org_id = $2",
            email, org_id
        )
        return dict(row) if row else None

    @staticmethod
    async def update(conn: asyncpg.Connection, candidate_id: int, org_id: int, data: dict) -> Optional[dict]:
        """Update candidate fields. Only updates provided keys."""
        allowed = {
            "name", "phone", "current_title", "current_company", "experience_years",
            "location", "resume_text", "resume_parsed", "resume_embedding",
            "source", "source_profile_url", "in_talent_pool", "talent_pool_reason",
            "talent_pool_added_at", "notes"
        }
        fields = {k: v for k, v in data.items() if k in allowed}
        if not fields:
            return await CandidateRepository.get(conn, candidate_id, org_id)

        set_clauses = ", ".join(f"{k} = ${i+3}" for i, k in enumerate(fields.keys()))
        values = list(fields.values())
        row = await conn.fetchrow(
            f"""
            UPDATE candidates SET {set_clauses}, updated_at = NOW()
            WHERE id = $1 AND org_id = $2
            RETURNING *
            """,
            candidate_id, org_id, *values
        )
        return dict(row) if row else None

    # ── Application CRUD ───────────────────────────────────────────────────────

    @staticmethod
    async def create_application(conn: asyncpg.Connection, data: dict) -> dict:
        """Link a candidate to a position (sourced/emailed/applied)."""
        row = await conn.fetchrow(
            """
            INSERT INTO candidate_applications
                (candidate_id, position_id, org_id, department_id,
                 skill_match_score, skill_match_data, status)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT (candidate_id, position_id) DO NOTHING
            RETURNING *
            """,
            data["candidate_id"], data["position_id"], data["org_id"],
            data["department_id"], data.get("skill_match_score"),
            data.get("skill_match_data"), data.get("status", "sourced"),
        )
        if row is None:
            # already exists — return existing
            row = await conn.fetchrow(
                "SELECT * FROM candidate_applications WHERE candidate_id=$1 AND position_id=$2",
                data["candidate_id"], data["position_id"]
            )
        return dict(row)

    @staticmethod
    async def get_application(conn: asyncpg.Connection, application_id: int, org_id: int) -> Optional[dict]:
        row = await conn.fetchrow(
            "SELECT * FROM candidate_applications WHERE id=$1 AND org_id=$2",
            application_id, org_id
        )
        return dict(row) if row else None

    @staticmethod
    async def get_application_by_candidate_position(
        conn: asyncpg.Connection, candidate_id: int, position_id: int
    ) -> Optional[dict]:
        row = await conn.fetchrow(
            "SELECT * FROM candidate_applications WHERE candidate_id=$1 AND position_id=$2",
            candidate_id, position_id
        )
        return dict(row) if row else None

    @staticmethod
    async def update_application(
        conn: asyncpg.Connection, application_id: int, org_id: int, data: dict
    ) -> Optional[dict]:
        allowed = {
            "skill_match_score", "skill_match_data", "status", "applied_at",
            "screening_responses", "magic_link_token", "magic_link_sent_at",
            "magic_link_clicked_at", "magic_link_expires_at", "rejection_draft",
            "rejection_sent_at", "followup_sent_at"
        }
        fields = {k: v for k, v in data.items() if k in allowed}
        if not fields:
            return await CandidateRepository.get_application(conn, application_id, org_id)
        set_clauses = ", ".join(f"{k} = ${i+3}" for i, k in enumerate(fields.keys()))
        values = list(fields.values())
        row = await conn.fetchrow(
            f"""
            UPDATE candidate_applications SET {set_clauses}, updated_at = NOW()
            WHERE id = $1 AND org_id = $2
            RETURNING *
            """,
            application_id, org_id, *values
        )
        return dict(row) if row else None

    # ── Position-scoped listing (for Kanban / Candidates tab) ─────────────────

    @staticmethod
    async def list_for_position(
        conn: asyncpg.Connection,
        position_id: int,
        org_id: int,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 50
    ) -> list[dict]:
        """List all candidates for a position with application data joined."""
        offset = (page - 1) * page_size
        where_status = "AND a.status = $3" if status else ""
        status_val = status or None

        query = f"""
            SELECT
                c.id, c.name, c.email, c.current_title, c.current_company,
                c.experience_years, c.location, c.source, c.source_profile_url,
                c.resume_text,
                a.id AS application_id, a.status, a.skill_match_score,
                a.skill_match_data, a.applied_at, a.magic_link_sent_at,
                a.magic_link_clicked_at, a.created_at AS sourced_at
            FROM candidate_applications a
            JOIN candidates c ON c.id = a.candidate_id
            WHERE a.position_id = $1 AND a.org_id = $2 {where_status}
            ORDER BY a.skill_match_score DESC NULLS LAST, a.created_at DESC
            LIMIT {page_size} OFFSET {offset}
        """
        params = [position_id, org_id]
        if status:
            params.append(status_val)
        rows = await conn.fetch(query, *params)
        return [dict(r) for r in rows]

    @staticmethod
    async def get_pipeline_kanban(conn: asyncpg.Connection, position_id: int, org_id: int) -> dict:
        """Return candidates grouped by pipeline stage for Kanban board."""
        rows = await conn.fetch(
            """
            SELECT
                c.id, c.name, c.email, c.current_title, c.current_company,
                c.experience_years, c.location, c.source,
                a.id AS application_id, a.status, a.skill_match_score,
                a.skill_match_data, a.created_at AS sourced_at
            FROM candidate_applications a
            JOIN candidates c ON c.id = a.candidate_id
            WHERE a.position_id = $1 AND a.org_id = $2
            ORDER BY a.skill_match_score DESC NULLS LAST
            """,
            position_id, org_id
        )
        stages = ["sourced", "emailed", "applied", "screening", "interview", "selected", "rejected", "on_hold"]
        kanban: dict = {s: [] for s in stages}
        for r in rows:
            d = dict(r)
            stage = d.get("status", "sourced")
            if stage not in kanban:
                kanban[stage] = []
            kanban[stage].append(d)
        return kanban

    # ── Candidate detail (with application context for a position) ────────────

    @staticmethod
    async def get_with_application(
        conn: asyncpg.Connection, candidate_id: int, position_id: int, org_id: int
    ) -> Optional[dict]:
        row = await conn.fetchrow(
            """
            SELECT
                c.*, a.id AS application_id, a.status AS pipeline_status,
                a.skill_match_score, a.skill_match_data, a.applied_at,
                a.screening_responses, a.rejection_draft, a.rejection_sent_at,
                a.magic_link_token, a.magic_link_sent_at, a.magic_link_clicked_at
            FROM candidates c
            LEFT JOIN candidate_applications a
                ON a.candidate_id = c.id AND a.position_id = $2
            WHERE c.id = $1 AND c.org_id = $3
            """,
            candidate_id, position_id, org_id
        )
        return dict(row) if row else None

    # ── Tags ───────────────────────────────────────────────────────────────────

    @staticmethod
    async def get_tags(conn: asyncpg.Connection, candidate_id: int, org_id: int) -> list[str]:
        rows = await conn.fetch(
            "SELECT tag FROM candidate_tags WHERE candidate_id=$1 AND org_id=$2 ORDER BY created_at",
            candidate_id, org_id
        )
        return [r["tag"] for r in rows]

    @staticmethod
    async def add_tag(conn: asyncpg.Connection, candidate_id: int, org_id: int, tag: str, user_id: int) -> None:
        await conn.execute(
            """
            INSERT INTO candidate_tags (org_id, candidate_id, tag, created_by)
            VALUES ($1,$2,$3,$4)
            ON CONFLICT (org_id, candidate_id, tag) DO NOTHING
            """,
            org_id, candidate_id, tag.lower().strip(), user_id
        )

    @staticmethod
    async def remove_tag(conn: asyncpg.Connection, candidate_id: int, org_id: int, tag: str) -> None:
        await conn.execute(
            "DELETE FROM candidate_tags WHERE candidate_id=$1 AND org_id=$2 AND tag=$3",
            candidate_id, org_id, tag.lower().strip()
        )

    # ── Dedup + bulk queries ───────────────────────────────────────────────────

    @staticmethod
    async def count_for_position(conn: asyncpg.Connection, position_id: int, org_id: int) -> dict:
        """Count candidates per status for stats row."""
        rows = await conn.fetch(
            """
            SELECT status, COUNT(*) AS count
            FROM candidate_applications
            WHERE position_id=$1 AND org_id=$2
            GROUP BY status
            """,
            position_id, org_id
        )
        return {r["status"]: r["count"] for r in rows}

    @staticmethod
    async def list_applications_for_outreach(
        conn: asyncpg.Connection, application_ids: list[int], org_id: int
    ) -> list[dict]:
        """Fetch full application + candidate data for bulk outreach."""
        rows = await conn.fetch(
            """
            SELECT a.*, c.name, c.email, c.current_title
            FROM candidate_applications a
            JOIN candidates c ON c.id = a.candidate_id
            WHERE a.id = ANY($1) AND a.org_id = $2
            """,
            application_ids, org_id
        )
        return [dict(r) for r in rows]
