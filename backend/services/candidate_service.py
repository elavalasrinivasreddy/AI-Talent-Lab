"""
services/candidate_service.py – Business logic for candidate management.
Implements two-step semantic ATS scoring per docs/BACKEND_PLAN.md §15.
"""
import json
import logging
import math
from typing import Optional, Any

from backend.adapters.llm.factory import get_llm, get_embedding_model
from backend.db.connection import get_connection
from backend.db.repositories.candidates import CandidateRepository
from backend.db.repositories.positions import PositionRepository
from backend.db.repositories.pipeline_events import PipelineEventRepository
from backend.db.repositories.notifications import NotificationRepository
from backend.db.repositories.audit import AuditLogRepository

logger = logging.getLogger(__name__)


# ── Embedding Utilities ────────────────────────────────────────────────────────

def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two float vectors."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(y * y for y in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


async def generate_resume_embedding(resume_text: str) -> list[float]:
    """Generate embedding for resume text. Called once on resume ingest."""
    try:
        embedding_model = get_embedding_model()
        embedding = await embedding_model.aembed_query(resume_text[:8000])
        return embedding
    except Exception as e:
        logger.warning(f"Resume embedding failed: {e}")
        return []


# ── ATS Scoring (§15) ──────────────────────────────────────────────────────────

async def compute_ats_score(
    candidate_id: int,
    application_id: int,
    position_id: int,
    org_id: int
) -> dict:
    """
    Two-step semantic ATS scoring per docs/BACKEND_PLAN.md §15.
    Step 1: Embedding cosine similarity (fast)
    Step 2: LLM structured analysis (deep, only above embedding threshold)
    """
    async with get_connection() as conn:
        position = await PositionRepository.get(conn, position_id, org_id)
        candidate = await CandidateRepository.get(conn, candidate_id, org_id)

    if not position or not candidate:
        return _fallback_score("Position or candidate not found")

    jd_embedding_raw = position.get("jd_embedding")
    resume_embedding_raw = candidate.get("resume_embedding")

    # ── Step 1: Embedding Similarity ──────────────────────────────────────────
    if jd_embedding_raw and resume_embedding_raw:
        try:
            jd_embedding = json.loads(jd_embedding_raw)
            resume_embedding = json.loads(resume_embedding_raw)
            emb_score = cosine_similarity(jd_embedding, resume_embedding)
        except Exception as e:
            logger.warning(f"Embedding comparison failed: {e}")
            emb_score = 0.5  # neutral fallback
    else:
        emb_score = 0.5  # neutral — proceed to LLM scoring

    # Very poor match — skip expensive LLM call
    if emb_score < 0.35:
        score = round(emb_score * 100, 1)
        return {
            "score": max(score, 5.0),
            "matched_skills": [],
            "missing_skills": [],
            "extra_skills": [],
            "summary": "Candidate profile does not closely match the role requirements.",
            "method": "embedding_only"
        }

    # ── Step 2: LLM Structured Analysis ───────────────────────────────────────
    jd_text = position.get("jd_markdown") or position.get("role_name", "")
    resume_text = candidate.get("resume_text") or ""

    if not resume_text.strip():
        # No resume — score based on embedding only
        score = round(emb_score * 100, 1)
        return {
            "score": score,
            "matched_skills": [],
            "missing_skills": [],
            "extra_skills": [],
            "summary": "No resume available. Score based on profile similarity only.",
            "method": "embedding_only"
        }

    try:
        llm = get_llm(temperature=0.1, max_tokens=1000)
        prompt = f"""Analyze this candidate's fit for the role. Return ONLY valid JSON.

JD Requirements (first 2000 chars):
{jd_text[:2000]}

Candidate Resume (first 2000 chars):
{resume_text[:2000]}

Return this exact JSON structure:
{{
  "matched_skills": ["Python", "FastAPI"],
  "missing_skills": ["Kubernetes"],
  "extra_skills": ["GraphQL"],
  "experience_match": 0.85,
  "skills_match": 0.78,
  "summary": "One paragraph AI analysis of candidate fit"
}}

Rules:
- matched_skills: skills in both JD and resume
- missing_skills: skills required by JD but absent in resume
- extra_skills: candidate skills not mentioned in JD (bonuses)
- experience_match: 0.0-1.0 score for experience alignment
- skills_match: 0.0-1.0 score for overall skills fit"""

        response = await llm.ainvoke([{"role": "user", "content": prompt}])
        content = response.content.strip()
        if "```json" in content:
            content = content.split("```json")[-1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].strip()

        parsed = json.loads(content)

        # Weighted final score (§15 formula)
        skills_match = float(parsed.get("skills_match", 0.6))
        experience_match = float(parsed.get("experience_match", 0.6))
        final_score = (
            emb_score * 0.40 +
            skills_match * 0.40 +
            experience_match * 0.20
        ) * 100

        return {
            "score": round(final_score, 1),
            "matched_skills": parsed.get("matched_skills", []),
            "missing_skills": parsed.get("missing_skills", []),
            "extra_skills": parsed.get("extra_skills", []),
            "summary": parsed.get("summary", ""),
            "method": "semantic_full"
        }

    except Exception as e:
        logger.warning(f"LLM ATS scoring failed for candidate {candidate_id}: {e}")
        score = round(emb_score * 100, 1)
        return {
            "score": score,
            "matched_skills": [],
            "missing_skills": [],
            "extra_skills": [],
            "summary": "Score computed from profile similarity.",
            "method": "embedding_fallback"
        }


def _fallback_score(reason: str) -> dict:
    return {
        "score": 0.0,
        "matched_skills": [],
        "missing_skills": [],
        "extra_skills": [],
        "summary": reason,
        "method": "error"
    }


# ── Candidate Service Methods ─────────────────────────────────────────────────

class CandidateService:

    @staticmethod
    async def get_candidate_detail(
        candidate_id: int, position_id: Optional[int], org_id: int
    ) -> dict:
        async with get_connection() as conn:
            if position_id:
                candidate = await CandidateRepository.get_with_application(
                    conn, candidate_id, position_id, org_id
                )
            else:
                candidate = await CandidateRepository.get(conn, candidate_id, org_id)

            if not candidate:
                return None

            tags = await CandidateRepository.get_tags(conn, candidate_id, org_id)
            candidate["tags"] = tags

            # Parse JSON fields
            for field in ["skill_match_data", "resume_parsed", "screening_responses"]:
                val = candidate.get(field)
                if val and isinstance(val, str):
                    try:
                        candidate[field] = json.loads(val)
                    except Exception:
                        pass

            return candidate

    @staticmethod
    async def update_status(
        application_id: int,
        org_id: int,
        new_status: str,
        user_id: int,
        candidate_id: int,
        position_id: int
    ) -> dict:
        """Update pipeline status and create pipeline event."""
        allowed_statuses = [
            "sourced", "emailed", "applied", "screening",
            "interview", "on_hold", "selected", "rejected"
        ]
        if new_status not in allowed_statuses:
            raise ValueError(f"Invalid status: {new_status}")

        async with get_connection() as conn:
            app = await CandidateRepository.update_application(
                conn, application_id, org_id, {"status": new_status}
            )
            await PipelineEventRepository.create(conn, {
                "org_id": org_id,
                "candidate_id": candidate_id,
                "position_id": position_id,
                "application_id": application_id,
                "user_id": user_id,
                "event_type": "status_changed",
                "event_data": {"old_status": app.get("status"), "new_status": new_status}
            })
        return app

    @staticmethod
    async def get_timeline(
        candidate_id: int, org_id: int, position_id: Optional[int] = None
    ) -> list[dict]:
        async with get_connection() as conn:
            events = await PipelineEventRepository.list_for_candidate(
                conn, candidate_id, org_id, position_id
            )
        # Parse event_data JSON for each event
        for evt in events:
            if evt.get("event_data") and isinstance(evt["event_data"], str):
                try:
                    evt["event_data"] = json.loads(evt["event_data"])
                except Exception:
                    pass
        return events

    @staticmethod
    async def add_tag(candidate_id: int, org_id: int, tag: str, user_id: int) -> list[str]:
        async with get_connection() as conn:
            await CandidateRepository.add_tag(conn, candidate_id, org_id, tag, user_id)
            return await CandidateRepository.get_tags(conn, candidate_id, org_id)

    @staticmethod
    async def remove_tag(candidate_id: int, org_id: int, tag: str) -> list[str]:
        async with get_connection() as conn:
            await CandidateRepository.remove_tag(conn, candidate_id, org_id, tag)
            return await CandidateRepository.get_tags(conn, candidate_id, org_id)

    @staticmethod
    async def mark_selected(
        candidate_id: int, application_id: int, position_id: int, org_id: int, user_id: int
    ) -> dict:
        async with get_connection() as conn:
            app = await CandidateRepository.update_application(
                conn, application_id, org_id, {"status": "selected"}
            )
            await PipelineEventRepository.create(conn, {
                "org_id": org_id,
                "candidate_id": candidate_id,
                "position_id": position_id,
                "application_id": application_id,
                "user_id": user_id,
                "event_type": "selected",
                "event_data": {}
            })
            await NotificationRepository.create(conn, {
                "org_id": org_id,
                "user_id": user_id,
                "type": "candidate_selected",
                "title": "Candidate Marked as Selected",
                "message": "A candidate has been marked as selected for a position.",
                "action_url": f"/positions/{position_id}?tab=candidates"
            })
        return app

    @staticmethod
    async def list_for_position(
        position_id: int, org_id: int,
        status: Optional[str] = None,
        page: int = 1
    ) -> list[dict]:
        async with get_connection() as conn:
            candidates = await CandidateRepository.list_for_position(
                conn, position_id, org_id, status, page
            )
        for c in candidates:
            if c.get("skill_match_data") and isinstance(c["skill_match_data"], str):
                try:
                    c["skill_match_data"] = json.loads(c["skill_match_data"])
                except Exception:
                    pass
        return candidates
