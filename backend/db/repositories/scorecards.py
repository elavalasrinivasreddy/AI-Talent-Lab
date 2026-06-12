import asyncpg
from typing import Optional, List, Dict

class ScorecardRepository:
    
    @staticmethod
    async def list_for_interview(conn: asyncpg.Connection, interview_id: int) -> List[asyncpg.Record]:
        return await conn.fetch("SELECT * FROM scorecards WHERE interview_id=$1", interview_id)

    @staticmethod
    async def list_for_candidate(conn: asyncpg.Connection, candidate_id: int, org_id: int) -> List[asyncpg.Record]:
        return await conn.fetch(
            """
            SELECT s.* 
            FROM scorecards s
            JOIN interviews i ON i.id = s.interview_id
            JOIN candidate_applications ca ON ca.id = i.application_id
            WHERE ca.candidate_id=$1 AND ca.org_id=$2 AND s.is_draft=FALSE
            """,
            candidate_id, org_id
        )

    @staticmethod
    async def get_scorecard(conn: asyncpg.Connection, interview_id: int, panel_member_id: int) -> Optional[asyncpg.Record]:
        return await conn.fetchrow(
            "SELECT * FROM scorecards WHERE interview_id=$1 AND panel_member_id=$2",
            interview_id, panel_member_id
        )

    @staticmethod
    async def upsert_scorecard(
        conn: asyncpg.Connection, 
        interview_id: int, panel_member_id: int, 
        overall_score: int, criteria_scores: str, notes: str, is_draft: bool
    ) -> asyncpg.Record:
        return await conn.fetchrow(
            """
            INSERT INTO scorecards (
                interview_id, panel_member_id, overall_score, criteria_scores, notes, is_draft, submitted_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $6 THEN NULL ELSE NOW() END)
            ON CONFLICT (interview_id, panel_member_id) DO UPDATE SET
                overall_score=EXCLUDED.overall_score,
                criteria_scores=EXCLUDED.criteria_scores,
                notes=EXCLUDED.notes,
                is_draft=EXCLUDED.is_draft,
                submitted_at=CASE WHEN EXCLUDED.is_draft THEN scorecards.submitted_at ELSE NOW() END
            RETURNING id
            """,
            interview_id, panel_member_id, overall_score, criteria_scores, notes, is_draft
        )

    @staticmethod
    async def anonymize_scorecards(conn: asyncpg.Connection, candidate_id: int):
        await conn.execute(
            """
            UPDATE scorecards
            SET notes='[Redacted for GDPR]'
            WHERE interview_id IN (
                SELECT i.id FROM interviews i
                JOIN candidate_applications ca ON ca.id = i.application_id
                WHERE ca.candidate_id=$1
            )
            """,
            candidate_id
        )
