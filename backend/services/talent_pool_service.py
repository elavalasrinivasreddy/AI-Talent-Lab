"""
services/talent_pool_service.py – Business logic for talent pool.
Bulk upload, AI suggest (cosine similarity), auto-pool rules, add/remove.
"""
import json
import logging
import math
from typing import Optional

from backend.db.connection import get_connection
from backend.services.resume_service import extract_resume_text as _extract_async
from backend.adapters.llm.factory import get_llm

logger = logging.getLogger(__name__)


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two equal-length vectors."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


async def _get_embedding(text: str) -> list[float]:
    """Generate a text embedding using the LLM adapter."""
    try:
        from langchain_groq import ChatGroq
        from langchain_community.embeddings import FakeEmbeddings
        # Use a deterministic fallback if no embedding model configured
        embeddings = FakeEmbeddings(size=384)
        return await embeddings.aembed_query(text[:2000])
    except Exception:
        # Minimal random-like embedding as last resort
        return [0.0] * 384


class TalentPoolService:

    @staticmethod
    async def get_pool(
        org_id: int,
        search: Optional[str] = None,
        location: Optional[str] = None,
        source: Optional[str] = None,
        reason: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> dict:
        """List talent pool candidates with search and filters."""
        offset = (page - 1) * per_page
        filters = ["c.org_id=$1", "c.in_talent_pool=TRUE"]
        params: list = [org_id]
        i = 2

        if search:
            filters.append(f"(c.name ILIKE ${i} OR c.current_title ILIKE ${i} OR c.current_company ILIKE ${i})")
            params.append(f"%{search}%")
            i += 1
        if location:
            filters.append(f"c.location ILIKE ${i}")
            params.append(f"%{location}%")
            i += 1
        if source:
            filters.append(f"c.source=${i}")
            params.append(source)
            i += 1
        if reason:
            filters.append(f"c.talent_pool_reason=${i}")
            params.append(reason)
            i += 1

        where = " AND ".join(filters)

        async with get_connection() as conn:
            total = await conn.fetchval(
                f"SELECT COUNT(*) FROM candidates c WHERE {where}", *params
            )
            rows = await conn.fetch(
                f"""
                SELECT c.id, c.name, c.email, c.current_title, c.current_company,
                       c.location, c.experience_years, c.source, c.skill_tags,
                       c.talent_pool_reason, c.talent_pool_added_at, c.resume_embedding
                FROM candidates c
                WHERE {where}
                ORDER BY c.talent_pool_added_at DESC NULLS LAST, c.created_at DESC
                LIMIT ${i} OFFSET ${i+1}
                """,
                *params, per_page, offset
            )

        candidates = []
        for r in rows:
            d = dict(r)
            # Don't expose embedding in list view
            d.pop("resume_embedding", None)
            # Parse skill_tags if JSON string
            if d.get("skill_tags") and isinstance(d["skill_tags"], str):
                try:
                    d["skill_tags"] = json.loads(d["skill_tags"])
                except Exception:
                    d["skill_tags"] = []
            candidates.append(d)

        return {
            "candidates": candidates,
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": math.ceil(total / per_page) if total else 0,
        }

    @staticmethod
    async def bulk_upload(
        org_id: int,
        user_id: int,
        files: list[tuple[str, bytes]],  # [(filename, file_bytes), ...]
    ) -> dict:
        """
        Parse multiple resume files, deduplicate, and add to talent pool.
        Returns: { added, duplicates, errors }
        """
        added = []
        duplicates = []
        errors = []

        async with get_connection() as conn:
            for filename, file_bytes in files:
                try:
                    # Extract text
                    resume_text = await _extract_async(file_bytes, filename)

                    if not resume_text or len(resume_text.strip()) < 100:
                        errors.append({"file": filename, "reason": "Could not extract text"})
                        continue

                    # Use LLM to parse basic fields
                    parsed = await _parse_resume_fields(resume_text)
                    email = parsed.get("email", "")
                    name = parsed.get("name", filename.rsplit(".", 1)[0])

                    # Dedup check (email or phone within org)
                    existing = None
                    if email:
                        existing = await conn.fetchrow(
                            "SELECT id, name, updated_at FROM candidates WHERE org_id=$1 AND email=$2",
                            org_id, email
                        )

                    if existing:
                        import datetime
                        days_ago = (datetime.datetime.now(datetime.timezone.utc) - existing["updated_at"].replace(tzinfo=datetime.timezone.utc)).days
                        duplicates.append({
                            "candidate_id": existing["id"],
                            "name": existing["name"] or name,
                            "email": email,
                            "file": filename,
                            "days_since_update": days_ago,
                            "suggest_skip": days_ago <= 7,
                        })
                        continue

                    # Generate embedding
                    embedding = await _get_embedding(resume_text[:2000])

                    # Insert new candidate
                    row = await conn.fetchrow(
                        """
                        INSERT INTO candidates (
                            org_id, name, email, phone, current_title, current_company,
                            experience_years, location, source, resume_text, resume_embedding,
                            in_talent_pool, talent_pool_reason, talent_pool_added_at, created_by
                        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'upload',$9,$10,TRUE,'manual',NOW(),$11)
                        RETURNING id, name, email
                        """,
                        org_id,
                        name,
                        email or None,
                        parsed.get("phone"),
                        parsed.get("current_title"),
                        parsed.get("current_company"),
                        parsed.get("experience_years"),
                        parsed.get("location"),
                        resume_text,
                        json.dumps(embedding),
                        user_id,
                    )
                    added.append({"candidate_id": row["id"], "name": row["name"], "file": filename})

                except Exception as e:
                    logger.error(f"Bulk upload error for {filename}: {e}", exc_info=True)
                    errors.append({"file": filename, "reason": str(e)})

        return {
            "processed": len(files),
            "added": added,
            "duplicates": duplicates,
            "errors": errors,
        }

    @staticmethod
    async def update_duplicate(org_id: int, candidate_id: int, file_bytes: bytes, filename: str) -> dict:
        """Update an existing candidate's resume data (dedup resolution)."""
        resume_text = await _extract_async(file_bytes, filename)
        parsed = await _parse_resume_fields(resume_text)
        embedding = await _get_embedding(resume_text[:2000])

        async with get_connection() as conn:
            await conn.execute(
                """
                UPDATE candidates
                SET resume_text=$3, resume_embedding=$4, current_title=$5,
                    current_company=$6, updated_at=NOW()
                WHERE id=$1 AND org_id=$2
                """,
                candidate_id, org_id, resume_text,
                json.dumps(embedding),
                parsed.get("current_title"),
                parsed.get("current_company"),
            )
        return {"updated": True, "candidate_id": candidate_id}

    @staticmethod
    async def ai_suggest(org_id: int, position_id: int, threshold: float = 0.55) -> dict:
        """
        Find pool candidates matching a position using cosine similarity
        between resume_embedding and jd_embedding.
        """
        async with get_connection() as conn:
            pos = await conn.fetchrow(
                "SELECT jd_embedding, role_name FROM positions WHERE id=$1 AND org_id=$2",
                position_id, org_id
            )
            if not pos or not pos["jd_embedding"]:
                return {"matches": [], "position_id": position_id}

            jd_emb = json.loads(pos["jd_embedding"]) if isinstance(pos["jd_embedding"], str) else pos["jd_embedding"]

            pool = await conn.fetch(
                """
                SELECT id, name, email, current_title, current_company,
                       talent_pool_reason, resume_embedding
                FROM candidates
                WHERE org_id=$1 AND in_talent_pool=TRUE AND resume_embedding IS NOT NULL
                """,
                org_id
            )

        matches = []
        for c in pool:
            try:
                emb = json.loads(c["resume_embedding"]) if isinstance(c["resume_embedding"], str) else c["resume_embedding"]
                score = _cosine_similarity(jd_emb, emb)
                if score >= threshold:
                    matches.append({
                        "candidate_id": c["id"],
                        "name": c["name"],
                        "email": c["email"],
                        "current_title": c["current_title"],
                        "current_company": c["current_company"],
                        "talent_pool_reason": c["talent_pool_reason"],
                        "match_score": round(score * 100, 1),
                    })
            except Exception:
                continue

        matches.sort(key=lambda x: x["match_score"], reverse=True)
        return {"matches": matches[:20], "position_id": position_id}

    @staticmethod
    async def add_to_pipeline(
        org_id: int, candidate_id: int, position_id: int
    ) -> dict:
        """Move a pool candidate into a position's pipeline at 'sourced' stage."""
        async with get_connection() as conn:
            # Validate candidate and position belong to this org
            cand = await conn.fetchrow(
                "SELECT id FROM candidates WHERE id=$1 AND org_id=$2", candidate_id, org_id
            )
            pos = await conn.fetchrow(
                "SELECT id, department_id FROM positions WHERE id=$1 AND org_id=$2", position_id, org_id
            )
            if not cand or not pos:
                raise ValueError("Candidate or position not found")

            # Upsert application
            app = await conn.fetchrow(
                """
                INSERT INTO candidate_applications
                    (org_id, position_id, candidate_id, department_id, status)
                VALUES ($1,$2,$3,$4,'sourced')
                ON CONFLICT (position_id, candidate_id) DO UPDATE SET status='sourced'
                RETURNING id
                """,
                org_id, position_id, candidate_id, pos["department_id"]
            )
        return {"application_id": app["id"], "status": "sourced"}

    @staticmethod
    async def add_to_pool(org_id: int, candidate_id: int, reason: str = "manual") -> dict:
        """Manually add a candidate to the talent pool."""
        async with get_connection() as conn:
            await conn.execute(
                """
                UPDATE candidates
                SET in_talent_pool=TRUE, talent_pool_reason=$3, talent_pool_added_at=NOW()
                WHERE id=$1 AND org_id=$2
                """,
                candidate_id, org_id, reason
            )
        return {"added": True, "candidate_id": candidate_id}

    @staticmethod
    async def remove_from_pool(org_id: int, candidate_id: int) -> dict:
        """Remove a candidate from the talent pool."""
        async with get_connection() as conn:
            await conn.execute(
                "UPDATE candidates SET in_talent_pool=FALSE WHERE id=$1 AND org_id=$2",
                candidate_id, org_id
            )
        return {"removed": True}


async def _parse_resume_fields(resume_text: str) -> dict:
    """Quick LLM parse of basic candidate fields from resume text."""
    llm = get_llm(temperature=0.1, max_tokens=400)
    prompt = f"""Extract candidate info from this resume. Return ONLY valid JSON:
{{
  "name": "...",
  "email": "...",
  "phone": "...",
  "current_title": "...",
  "current_company": "...",
  "experience_years": 5,
  "location": "..."
}}
Use null for fields not found. Do not guess.

Resume (first 2000 chars):
{resume_text[:2000]}"""

    try:
        resp = await llm.ainvoke([{"role": "user", "content": prompt}])
        content = resp.content.strip()
        if "```" in content:
            content = content.split("```")[1].strip()
            if content.startswith("json"):
                content = content[4:].strip()
        return json.loads(content)
    except Exception as e:
        logger.warning(f"Resume parse failed: {e}")
        return {}
