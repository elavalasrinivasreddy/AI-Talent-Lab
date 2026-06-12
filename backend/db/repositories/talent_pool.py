import asyncpg
import json
from typing import Optional

class TalentPoolRepository:
    
    @staticmethod
    async def get_pool_count(conn: asyncpg.Connection, org_id: int, filters: list[str], params: list) -> int:
        where = " AND ".join(filters)
        return await conn.fetchval(
            f"SELECT COUNT(*) FROM candidates c WHERE {where}", *params
        )

    @staticmethod
    async def get_pool_rows(conn: asyncpg.Connection, org_id: int, filters: list[str], params: list, per_page: int, offset: int, i: int) -> list[asyncpg.Record]:
        where = " AND ".join(filters)
        return await conn.fetch(
            f"""
            SELECT c.id, c.name, c.email, c.current_title, c.current_company,
                   c.location, c.experience_years, c.source, c.skill_tags,
                   c.talent_pool_reason, c.talent_pool_added_at,
                   COALESCE(c.contact_status, 'active') AS contact_status
            FROM candidates c
            WHERE {where}
            ORDER BY c.talent_pool_added_at DESC NULLS LAST, c.created_at DESC
            LIMIT ${i} OFFSET ${i+1}
            """,
            *params, per_page, offset
        )

    @staticmethod
    async def check_duplicate(conn: asyncpg.Connection, org_id: int, email: str) -> Optional[asyncpg.Record]:
        return await conn.fetchrow(
            "SELECT id, name, updated_at FROM candidates WHERE org_id=$1 AND email=$2",
            org_id, email
        )

    @staticmethod
    async def insert_candidate(
        conn: asyncpg.Connection,
        org_id: int, name: str, email: Optional[str], phone: Optional[str],
        current_title: Optional[str], current_company: Optional[str],
        experience_years: Optional[int], location: Optional[str],
        resume_text: str, resume_links_json: str, embedding_json: str,
        user_id: int
    ) -> asyncpg.Record:
        return await conn.fetchrow(
            """
            INSERT INTO candidates (
                org_id, name, email, phone, current_title, current_company,
                experience_years, location, source, resume_text, resume_parsed, resume_embedding,
                in_talent_pool, talent_pool_reason, talent_pool_added_at, created_by
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'upload',$9,$10,$11,TRUE,'manual',NOW(),$12)
            RETURNING id, name, email
            """,
            org_id, name, email, phone, current_title, current_company,
            experience_years, location, resume_text, resume_links_json, embedding_json, user_id
        )

    @staticmethod
    async def add_to_pool(conn: asyncpg.Connection, org_id: int, candidate_id: int, reason: str):
        await conn.execute(
            "UPDATE candidates SET in_talent_pool=TRUE, talent_pool_reason=$1, talent_pool_added_at=NOW() WHERE id=$2 AND org_id=$3",
            reason, candidate_id, org_id
        )

    @staticmethod
    async def remove_from_pool(conn: asyncpg.Connection, org_id: int, candidate_id: int):
        await conn.execute(
            "UPDATE candidates SET in_talent_pool=FALSE, talent_pool_reason=NULL, talent_pool_added_at=NULL WHERE id=$1 AND org_id=$2",
            candidate_id, org_id
        )

    @staticmethod
    async def get_auto_pool_candidates(conn: asyncpg.Connection, org_id: int, role_title: str) -> list[asyncpg.Record]:
        return await conn.fetch(
            """
            SELECT id, name, current_title, skill_tags, resume_embedding 
            FROM candidates 
            WHERE org_id=$1 AND in_talent_pool=TRUE
            """,
            org_id
        )
