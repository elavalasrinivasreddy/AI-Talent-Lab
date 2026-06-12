import asyncpg
import json
from typing import Optional, List, Dict

class ApplicationRepository:
    
    @staticmethod
    async def get_application(conn: asyncpg.Connection, application_id: int, org_id: int) -> Optional[asyncpg.Record]:
        return await conn.fetchrow(
            """
            SELECT ca.*, p.role_name, p.location, p.work_type, o.name AS org_name
            FROM candidate_applications ca
            JOIN positions p ON p.id = ca.position_id
            JOIN organizations o ON o.id = p.org_id
            WHERE ca.id=$1 AND ca.org_id=$2
            """,
            application_id, org_id
        )

    @staticmethod
    async def record_consent(conn: asyncpg.Connection, application_id: int, org_id: int):
        await conn.execute(
            "UPDATE candidate_applications SET consent_given_at = NOW() WHERE id = $1 AND org_id = $2",
            application_id, org_id
        )

    @staticmethod
    async def record_video_intro(conn: asyncpg.Connection, application_id: int, org_id: int, video_url: str):
        await conn.execute(
            "UPDATE candidate_applications SET video_intro_url=$1 WHERE id=$2 AND org_id=$3",
            video_url, application_id, org_id
        )

    @staticmethod
    async def upsert_application(
        conn: asyncpg.Connection, 
        org_id: int, position_id: int, candidate_id: int, department_id: int, status: str
    ) -> asyncpg.Record:
        return await conn.fetchrow(
            """
            INSERT INTO candidate_applications
                (org_id, position_id, candidate_id, department_id, status)
            VALUES ($1,$2,$3,$4,$5)
            ON CONFLICT (position_id, candidate_id) DO UPDATE SET status=$5
            RETURNING id
            """,
            org_id, position_id, candidate_id, department_id, status
        )

    @staticmethod
    async def bulk_reject(conn: asyncpg.Connection, org_id: int, position_id: int, threshold_float: float) -> tuple[list[int], list]:
        # Get all applications for this position in 'on_hold' status with score < threshold
        rows = await conn.fetch(
            """
            SELECT id, candidate_id 
            FROM candidate_applications 
            WHERE position_id = $1 AND org_id = $2 
            AND status = 'on_hold'
            AND skill_match_score < $3
            """,
            position_id, org_id, threshold_float
        )
        
        if not rows:
            return [], []
            
        app_ids = [row["id"] for row in rows]
        
        # Update status
        await conn.execute(
            """
            UPDATE candidate_applications
            SET status = 'rejected', rejection_reason = 'ats_score', updated_at = NOW()
            WHERE id = ANY($1::int[]) AND org_id = $2
            """,
            app_ids, org_id
        )
        return app_ids, rows

    @staticmethod
    async def store_magic_link(conn: asyncpg.Connection, application_id: int, token: str):
        await conn.execute(
            "UPDATE candidate_applications SET magic_link_token=$1, magic_link_sent_at=NOW() WHERE id=$2",
            token, application_id
        )

    @staticmethod
    async def get_application_by_status_token(conn: asyncpg.Connection, status_token: str) -> Optional[asyncpg.Record]:
        return await conn.fetchrow(
            """
            SELECT ca.candidate_id, ca.org_id
            FROM candidate_applications ca
            WHERE ca.status_token = $1
            """,
            status_token,
        )
