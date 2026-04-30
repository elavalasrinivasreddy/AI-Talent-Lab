"""
tasks/candidate_pipeline.py – Celery background task
Source → Dedup → ATS Score → Notify
Triggered when recruiter saves a position or clicks "Run Search Now".
"""
import json
import logging
from datetime import datetime, timedelta

from backend.celery_app import celery_app
from backend.adapters.candidate_sources import get_candidate_source_adapter
from backend.db.connection import get_connection
from backend.db.repositories.candidates import CandidateRepository
from backend.db.repositories.positions import PositionRepository
from backend.db.repositories.organizations import OrgRepository
from backend.db.repositories.pipeline_events import PipelineEventRepository
from backend.db.repositories.notifications import NotificationRepository
from backend.services.candidate_service import (
    compute_ats_score,
    generate_resume_embedding,
)

logger = logging.getLogger(__name__)


@celery_app.task(
    name="tasks.run_candidate_search",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
    acks_late=True
)
def run_candidate_search(self, position_id: int, org_id: int, department_id: int, triggered_by: int = None):
    """
    Full candidate sourcing pipeline for a single position.
    Runs as a Celery task.

    Steps:
    1. Load position + org context
    2. Source candidates via adapter
    3. For each candidate: dedup → create/update → ATS score
    4. Update position last_search_at / next_search_at
    5. Create pipeline events
    6. Notify recruiter
    """
    import asyncio
    # Celery tasks are sync — wrap async calls
    try:
        asyncio.get_event_loop().run_until_complete(
            _run_pipeline(position_id, org_id, department_id, triggered_by)
        )
    except Exception as exc:
        logger.error(f"Candidate pipeline failed for position {position_id}: {exc}", exc_info=True)
        raise self.retry(exc=exc)


async def _run_pipeline(
    position_id: int, org_id: int, department_id: int, triggered_by: int = None
):
    """Async implementation of the candidate pipeline."""
    logger.info(f"[Pipeline] Starting search for position {position_id} (org {org_id})")

    async with get_connection() as conn:
        position = await PositionRepository.get(conn, position_id, org_id)
        org = await OrgRepository.get_by_id(conn, org_id)

    if not position or position.get("status") not in ("open", "draft"):
        logger.info(f"[Pipeline] Position {position_id} not open — skipping")
        return

    # ── Step 1: Source candidates ──────────────────────────────────────────────
    adapter = get_candidate_source_adapter()
    limit = 20  # MVP: 20 per run
    try:
        raw_candidates = await adapter.search(position, org or {}, limit=limit)
        logger.info(f"[Pipeline] Sourced {len(raw_candidates)} raw candidates")
    except Exception as e:
        logger.error(f"[Pipeline] Source adapter failed: {e}")
        raw_candidates = []

    sourced_count = 0
    above_threshold_count = 0
    ats_threshold = float(position.get("ats_threshold") or 80.0)

    for raw in raw_candidates:
        try:
            await _process_candidate(
                raw, position, org or {}, position_id, org_id, department_id,
                ats_threshold, triggered_by
            )
            sourced_count += 1
        except Exception as e:
            logger.warning(f"[Pipeline] Failed to process candidate {raw.get('email')}: {e}")
            continue

    # ── Step 2: Update position search timestamps ──────────────────────────────
    async with get_connection() as conn:
        interval_hours = position.get("search_interval_hours") or 24
        next_search = datetime.utcnow() + timedelta(hours=interval_hours)
        await conn.execute(
            """
            UPDATE positions
            SET last_search_at = NOW(), next_search_at = $1, updated_at = NOW()
            WHERE id = $2 AND org_id = $3
            """,
            next_search, position_id, org_id
        )

        # ── Step 3: Create "search completed" pipeline event ───────────────────
        await PipelineEventRepository.create(conn, {
            "org_id": org_id,
            "position_id": position_id,
            "user_id": None,  # system event
            "event_type": "search_completed",
            "event_data": {
                "candidates_found": sourced_count,
                "above_threshold": above_threshold_count,
                "threshold": ats_threshold
            }
        })

        # ── Step 4: Notify recruiter ───────────────────────────────────────────
        if triggered_by:
            await NotificationRepository.create(conn, {
                "org_id": org_id,
                "user_id": triggered_by,
                "type": "search_complete",
                "title": f"Search complete — {position.get('role_name')}",
                "message": (
                    f"Found {sourced_count} candidate(s). "
                    f"{above_threshold_count} scored above {ats_threshold:.0f}% threshold."
                ),
                "action_url": f"/positions/{position_id}?tab=pipeline"
            })

    logger.info(
        f"[Pipeline] Finished position {position_id}: "
        f"{sourced_count} candidates, {above_threshold_count} above threshold"
    )


async def _process_candidate(
    raw: dict,
    position: dict,
    org: dict,
    position_id: int,
    org_id: int,
    department_id: int,
    ats_threshold: float,
    triggered_by: int = None
) -> None:
    """Dedup → create/update → score a single candidate."""
    email = raw.get("email", "").strip().lower()
    if not email:
        return  # Skip candidates without email (can't dedup)

    async with get_connection() as conn:
        # ── Dedup within org ───────────────────────────────────────────────────
        existing = await CandidateRepository.get_by_email(conn, email, org_id)

        if existing:
            candidate_id = existing["id"]
            # Update profile if stale (>7 days)
            updated_at = existing.get("updated_at")
            is_stale = True
            if updated_at:
                age_days = (datetime.utcnow() - updated_at.replace(tzinfo=None)).days
                is_stale = age_days > 7

            if is_stale:
                await CandidateRepository.update(conn, candidate_id, org_id, {
                    "current_title": raw.get("current_title"),
                    "current_company": raw.get("current_company"),
                    "experience_years": raw.get("experience_years"),
                    "location": raw.get("location"),
                    "source_profile_url": raw.get("source_profile_url"),
                    "resume_text": raw.get("resume_text"),
                })
        else:
            # Generate resume embedding before insert
            resume_text = raw.get("resume_text") or ""
            resume_embedding = []
            if resume_text:
                try:
                    resume_embedding = await generate_resume_embedding(resume_text)
                except Exception as e:
                    logger.warning(f"Embedding failed for {email}: {e}")

            candidate_data = {
                "org_id": org_id,
                "name": raw.get("name"),
                "email": email,
                "phone": raw.get("phone"),
                "current_title": raw.get("current_title"),
                "current_company": raw.get("current_company"),
                "experience_years": raw.get("experience_years"),
                "location": raw.get("location"),
                "resume_text": resume_text,
                "resume_embedding": json.dumps(resume_embedding) if resume_embedding else None,
                "source": raw.get("source", "simulation"),
                "source_profile_url": raw.get("source_profile_url"),
            }
            new_candidate = await CandidateRepository.create(conn, candidate_data)
            candidate_id = new_candidate["id"]

            # Pipeline event: sourced
            await PipelineEventRepository.create(conn, {
                "org_id": org_id,
                "candidate_id": candidate_id,
                "position_id": position_id,
                "user_id": None,
                "event_type": "sourced",
                "event_data": {
                    "source": raw.get("source"),
                    "source_profile_url": raw.get("source_profile_url")
                }
            })

        # ── Create application if not exists ──────────────────────────────────
        app = await CandidateRepository.create_application(conn, {
            "candidate_id": candidate_id,
            "position_id": position_id,
            "org_id": org_id,
            "department_id": department_id,
            "status": "sourced"
        })
        application_id = app["id"]

    # ── ATS Scoring (outside connection — it opens its own) ───────────────────
    try:
        score_result = await compute_ats_score(
            candidate_id, application_id, position_id, org_id
        )
        score = score_result.get("score", 0)
        skill_match_data = json.dumps({
            "matched_skills": score_result.get("matched_skills", []),
            "missing_skills": score_result.get("missing_skills", []),
            "extra_skills": score_result.get("extra_skills", []),
            "summary": score_result.get("summary", ""),
            "method": score_result.get("method", ""),
        })

        async with get_connection() as conn:
            await CandidateRepository.update_application(
                conn, application_id, org_id, {
                    "skill_match_score": score,
                    "skill_match_data": skill_match_data
                }
            )
            await PipelineEventRepository.create(conn, {
                "org_id": org_id,
                "candidate_id": candidate_id,
                "position_id": position_id,
                "application_id": application_id,
                "user_id": None,
                "event_type": "ats_scored",
                "event_data": {
                    "score": score,
                    "method": score_result.get("method"),
                    "above_threshold": score >= ats_threshold
                }
            })

    except Exception as e:
        logger.warning(f"[Pipeline] ATS scoring failed for candidate {candidate_id}: {e}")
