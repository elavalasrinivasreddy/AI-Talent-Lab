"""
db/repositories/interviews.py – InterviewRepository
All SQL for interviews, interview_panel, and scorecards. Filters by org_id.
"""
import logging
from typing import Optional
import asyncpg

logger = logging.getLogger(__name__)


class InterviewRepository:

    # ── Interviews ─────────────────────────────────────────────────────────────

    @staticmethod
    async def create(conn: asyncpg.Connection, data: dict) -> dict:
        """Create a new interview round."""
        row = await conn.fetchrow(
            """
            INSERT INTO interviews (
                org_id, department_id, position_id, candidate_id, application_id,
                round_number, round_name, round_type, scheduled_at,
                duration_minutes, meeting_link, status, notes
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            RETURNING *
            """,
            data["org_id"], data["department_id"], data["position_id"],
            data["candidate_id"], data["application_id"],
            data.get("round_number", 1), data.get("round_name"),
            data.get("round_type", "technical"), data.get("scheduled_at"),
            data.get("duration_minutes", 60), data.get("meeting_link"),
            data.get("status", "scheduled"), data.get("notes"),
        )
        return dict(row)

    @staticmethod
    async def get(conn: asyncpg.Connection, interview_id: int, org_id: int) -> Optional[dict]:
        row = await conn.fetchrow(
            "SELECT * FROM interviews WHERE id=$1 AND org_id=$2",
            interview_id, org_id
        )
        return dict(row) if row else None

    @staticmethod
    async def update(conn: asyncpg.Connection, interview_id: int, org_id: int, data: dict) -> Optional[dict]:
        allowed = {
            "round_name", "round_type", "scheduled_at", "duration_minutes",
            "meeting_link", "status", "overall_result", "invite_sent_at", "notes"
        }
        fields = {k: v for k, v in data.items() if k in allowed}
        if not fields:
            return await InterviewRepository.get(conn, interview_id, org_id)
        set_clauses = ", ".join(f"{k}=${i+3}" for i, k in enumerate(fields.keys()))
        row = await conn.fetchrow(
            f"""
            UPDATE interviews SET {set_clauses}, updated_at=NOW()
            WHERE id=$1 AND org_id=$2
            RETURNING *
            """,
            interview_id, org_id, *list(fields.values())
        )
        return dict(row) if row else None

    @staticmethod
    async def list_for_candidate(
        conn: asyncpg.Connection, candidate_id: int, org_id: int
    ) -> list[dict]:
        rows = await conn.fetch(
            """
            SELECT i.*,
                COUNT(ip.id) AS panel_count,
                COUNT(ip.id) FILTER (WHERE ip.feedback_submitted=TRUE) AS submitted_count
            FROM interviews i
            LEFT JOIN interview_panel ip ON ip.interview_id = i.id
            WHERE i.candidate_id=$1 AND i.org_id=$2
            GROUP BY i.id
            ORDER BY i.round_number, i.created_at
            """,
            candidate_id, org_id
        )
        return [dict(r) for r in rows]

    @staticmethod
    async def list_for_position(
        conn: asyncpg.Connection, position_id: int, org_id: int
    ) -> list[dict]:
        rows = await conn.fetch(
            """
            SELECT i.*,
                c.name AS candidate_name,
                COUNT(ip.id) AS panel_count,
                COUNT(ip.id) FILTER (WHERE ip.feedback_submitted=TRUE) AS submitted_count
            FROM interviews i
            JOIN candidates c ON c.id = i.candidate_id
            LEFT JOIN interview_panel ip ON ip.interview_id = i.id
            WHERE i.position_id=$1 AND i.org_id=$2
            GROUP BY i.id, c.name
            ORDER BY i.scheduled_at DESC NULLS LAST
            """,
            position_id, org_id
        )
        return [dict(r) for r in rows]


class PanelRepository:

    @staticmethod
    async def add_panel_member(conn: asyncpg.Connection, data: dict) -> dict:
        row = await conn.fetchrow(
            """
            INSERT INTO interview_panel
                (interview_id, user_id, panelist_name, panelist_email,
                 magic_link_token, magic_link_expires_at)
            VALUES ($1,$2,$3,$4,$5,$6)
            ON CONFLICT (magic_link_token) DO UPDATE SET panelist_name=EXCLUDED.panelist_name
            RETURNING *
            """,
            data["interview_id"], data.get("user_id"),
            data["panelist_name"], data["panelist_email"],
            data.get("magic_link_token"), data.get("magic_link_expires_at"),
        )
        return dict(row)

    @staticmethod
    async def get_panel(conn: asyncpg.Connection, interview_id: int) -> list[dict]:
        rows = await conn.fetch(
            """
            SELECT ip.*, u.name AS user_full_name
            FROM interview_panel ip
            LEFT JOIN users u ON u.id = ip.user_id
            WHERE ip.interview_id=$1
            ORDER BY ip.created_at
            """,
            interview_id
        )
        return [dict(r) for r in rows]

    @staticmethod
    async def get_by_token(conn: asyncpg.Connection, token: str) -> Optional[dict]:
        row = await conn.fetchrow(
            """
            SELECT ip.*,
                i.round_name, i.round_number, i.scheduled_at, i.status AS interview_status,
                i.position_id, i.candidate_id, i.org_id, i.notes AS interview_notes,
                c.name AS candidate_name, c.resume_text,
                p.role_name, p.jd_markdown, p.department_id,
                o.name AS org_name, o.logo_url
            FROM interview_panel ip
            JOIN interviews i ON i.id = ip.interview_id
            JOIN candidates c ON c.id = i.candidate_id
            JOIN positions p ON p.id = i.position_id
            JOIN organizations o ON o.id = i.org_id
            WHERE ip.magic_link_token=$1
            """,
            token
        )
        return dict(row) if row else None

    @staticmethod
    async def mark_submitted(conn: asyncpg.Connection, panel_member_id: int) -> None:
        await conn.execute(
            "UPDATE interview_panel SET feedback_submitted=TRUE WHERE id=$1",
            panel_member_id
        )

    @staticmethod
    async def mark_not_attended(conn: asyncpg.Connection, panel_member_id: int) -> None:
        await conn.execute(
            "UPDATE interview_panel SET not_attended=TRUE WHERE id=$1",
            panel_member_id
        )


class ScorecardRepository:

    @staticmethod
    async def upsert(conn: asyncpg.Connection, data: dict) -> dict:
        """Create or update a scorecard (supports save-draft)."""
        row = await conn.fetchrow(
            """
            INSERT INTO scorecards (
                interview_id, panel_member_id, candidate_id, position_id, org_id,
                is_draft, ratings, overall_score, recommendation,
                strengths, concerns, additional_comments,
                raw_notes_strengths, raw_notes_concerns, submitted_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
                CASE WHEN $6 THEN NULL ELSE NOW() END)
            ON CONFLICT (interview_id, panel_member_id)
            DO UPDATE SET
                is_draft=$6, ratings=$7, overall_score=$8, recommendation=$9,
                strengths=$10, concerns=$11, additional_comments=$12,
                raw_notes_strengths=$13, raw_notes_concerns=$14,
                submitted_at=CASE WHEN $6 THEN scorecards.submitted_at ELSE NOW() END
            RETURNING *
            """,
            data["interview_id"], data["panel_member_id"],
            data["candidate_id"], data["position_id"], data["org_id"],
            data.get("is_draft", False), data["ratings"],
            data.get("overall_score"), data.get("recommendation"),
            data.get("strengths"), data.get("concerns"),
            data.get("additional_comments"),
            data.get("raw_notes_strengths"), data.get("raw_notes_concerns"),
        )
        return dict(row)

    @staticmethod
    async def list_for_interview(conn: asyncpg.Connection, interview_id: int) -> list[dict]:
        rows = await conn.fetch(
            """
            SELECT s.*, ip.panelist_name, ip.panelist_email
            FROM scorecards s
            JOIN interview_panel ip ON ip.id = s.panel_member_id
            WHERE s.interview_id=$1 AND s.is_draft=FALSE
            ORDER BY s.submitted_at
            """,
            interview_id
        )
        return [dict(r) for r in rows]

    @staticmethod
    async def get_for_panel_member(
        conn: asyncpg.Connection, interview_id: int, panel_member_id: int
    ) -> Optional[dict]:
        row = await conn.fetchrow(
            "SELECT * FROM scorecards WHERE interview_id=$1 AND panel_member_id=$2",
            interview_id, panel_member_id
        )
        return dict(row) if row else None
