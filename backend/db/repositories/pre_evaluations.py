import asyncpg
import json
from typing import Optional

class PreEvaluationRepository:
    
    @staticmethod
    async def create(conn: asyncpg.Connection, org_id: int, data: dict) -> Optional[dict]:
        row = await conn.fetchrow(
            """
            INSERT INTO pre_evaluations (
                org_id, application_id, candidate_id, status, token, questions,
                expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            """,
            org_id,
            data["application_id"],
            data["candidate_id"],
            data.get("status", "pending"),
            data["token"],
            json.dumps(data["questions"]),
            data.get("expires_at")
        )
        return dict(row) if row else None

    @staticmethod
    async def get_by_token(conn: asyncpg.Connection, token: str) -> Optional[dict]:
        row = await conn.fetchrow(
            "SELECT * FROM pre_evaluations WHERE token = $1",
            token
        )
        return dict(row) if row else None

    @staticmethod
    async def get_by_application(conn: asyncpg.Connection, org_id: int, application_id: int) -> Optional[dict]:
        row = await conn.fetchrow(
            "SELECT * FROM pre_evaluations WHERE org_id = $1 AND application_id = $2 ORDER BY created_at DESC LIMIT 1",
            org_id, application_id
        )
        return dict(row) if row else None

    @staticmethod
    async def submit_answers(conn: asyncpg.Connection, eval_id: int, answers: list) -> Optional[dict]:
        row = await conn.fetchrow(
            """
            UPDATE pre_evaluations
            SET answers = $1, status = 'submitted', completed_at = NOW(), updated_at = NOW()
            WHERE id = $2
            RETURNING *
            """,
            json.dumps(answers), eval_id
        )
        return dict(row) if row else None

    @staticmethod
    async def update_score(
        conn: asyncpg.Connection, eval_id: int, score: float, feedback: str,
        decision: str = "fail",
    ) -> Optional[dict]:
        # status reflects the grading outcome: 'passed' / 'failed' (or 'flagged' for collusion).
        status = "passed" if decision == "pass" else ("flagged" if decision == "flagged" else "failed")
        row = await conn.fetchrow(
            """
            UPDATE pre_evaluations
            SET score = $1, feedback = $2, status = $3,
                evaluated_at = NOW(), updated_at = NOW()
            WHERE id = $4
            RETURNING *
            """,
            score, feedback, status, eval_id
        )
        return dict(row) if row else None
