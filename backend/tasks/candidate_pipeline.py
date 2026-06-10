"""
tasks/candidate_pipeline.py – Celery background task
Source → Dedup → ATS Score → Notify
Triggered when recruiter saves a position or clicks "Run Search Now".
"""
import json
import logging
import time
from datetime import datetime, timedelta, timezone

from backend.celery_app import celery_app
from backend.config import settings
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
def run_candidate_search(self, position_id: int, org_id: int, department_id: int, triggered_by: int | None = None):
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
    position_id: int, org_id: int, department_id: int, triggered_by: int | None = None
):
    """Async implementation of the candidate pipeline."""
    _task_start = time.time()
    _sourced_count = 0
    _task_failed = False

    try:
        logger.info(f"[Pipeline] Starting search for position {position_id} (org {org_id})")

        async with get_connection() as conn:
            position = await PositionRepository.get(conn, position_id, org_id)
            org = await OrgRepository.get_by_id(conn, org_id)

        if not position or position.get("status") not in ("open", "draft"):
            logger.info(f"[Pipeline] Position {position_id} not open — skipping")
            return

        # ── Step 1: Source candidates ──────────────────────────────────────────────
        # Per-org sourcing config (Settings → Sourcing) decides the adapter; falls back
        # to settings.DEFAULT_SOURCE_ADAPTER when the org hasn't configured one.
        _sourcing_cfg = (org or {}).get("sourcing_config") or {}
        if isinstance(_sourcing_cfg, str):
            try:
                _sourcing_cfg = json.loads(_sourcing_cfg)
            except Exception:
                _sourcing_cfg = {}
        adapter = get_candidate_source_adapter(_sourcing_cfg.get("source_adapter"))
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
            next_search = datetime.now(timezone.utc) + timedelta(hours=interval_hours)
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

        _sourced_count = sourced_count
        logger.info(
            f"[Pipeline] Finished position {position_id}: "
            f"{sourced_count} candidates, {above_threshold_count} above threshold"
        )
    except Exception as exc:
        _task_failed = True
        _duration = int((time.time() - _task_start) * 1000)
        try:
            async with get_connection() as conn:
                await conn.execute(
                    """INSERT INTO task_run_log
                       (org_id, task_type, position_id, status, duration_ms, error_message)
                       VALUES ($1, 'candidate_search', $2, 'failed', $3, $4)""",
                    org_id, position_id, _duration, str(exc)[:500],
                )
        except Exception:
            pass
        raise
    finally:
        if not _task_failed:
            _duration = int((time.time() - _task_start) * 1000)
            try:
                async with get_connection() as conn:
                    await conn.execute(
                        """INSERT INTO task_run_log
                           (org_id, task_type, position_id, status,
                            candidates_found, duration_ms)
                           VALUES ($1, 'candidate_search', $2, 'success', $3, $4)""",
                        org_id, position_id, _sourced_count, _duration,
                    )
            except Exception:
                pass


async def _process_candidate(
    raw: dict,
    position: dict,
    org: dict,
    position_id: int,
    org_id: int,
    department_id: int,
    ats_threshold: float,
    triggered_by: int | None = None
) -> None:
    """Dedup → create/update → score a single candidate."""
    email = raw.get("email", "").strip().lower() or None
    source_profile_url = raw.get("source_profile_url", "").strip() or None

    if not email and not source_profile_url:
        return  # Skip candidates without both email and profile url (can't dedup)

    async with get_connection() as conn:
        # ── Dedup within org ───────────────────────────────────────────────────
        existing = None
        if email:
            existing = await CandidateRepository.get_by_email(conn, email, org_id)
        elif source_profile_url:
            # We need a new repo method or just raw query
            existing = await conn.fetchrow(
                "SELECT * FROM candidates WHERE org_id = $1 AND source_profile_url = $2",
                org_id, source_profile_url
            )

        if existing:
            candidate_id = existing["id"]
            # Update profile if stale (>7 days)
            updated_at = existing.get("updated_at")
            is_stale = True
            if updated_at:
                age_days = (datetime.now(timezone.utc) - updated_at.replace(tzinfo=timezone.utc)).days
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

            # Phase 2: Enrichment if email is missing — only when the org has enabled it.
            # If enrichment is off (or the provider isn't implemented), we DO NOT fabricate
            # an email; the candidate is kept as a no-contact lead for manual outreach.
            if not email:
                sourcing_config = org.get("sourcing_config") or {}
                if isinstance(sourcing_config, str):
                    try:
                        sourcing_config = json.loads(sourcing_config)
                    except Exception:
                        sourcing_config = {}

                if sourcing_config.get("enrichment_enabled"):
                    from backend.adapters.enrichment import get_enrichment_adapter
                    provider = sourcing_config.get("enrichment_provider") or settings.ENRICHMENT_PROVIDER
                    enrichment_adapter = get_enrichment_adapter(provider)
                    if enrichment_adapter is not None:
                        try:
                            enrichment_result = await enrichment_adapter.enrich_profile(
                                name=candidate_data["name"] or "",
                                company=candidate_data["current_company"],
                                profile_url=candidate_data["source_profile_url"]
                            )
                            if enrichment_result and enrichment_result.get("email"):
                                candidate_data["email"] = enrichment_result["email"].strip().lower()
                        except Exception as e:
                            logger.warning(f"[Pipeline] Enrichment failed for candidate {candidate_data['name']}: {e}")

            # If still no email, mark as no_contact
            if not candidate_data["email"]:
                candidate_data["contact_status"] = "no_contact"
            else:
                candidate_data["contact_status"] = "active"

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
            "emb_score": score_result.get("emb_score"),
            "skills_match": score_result.get("skills_match"),
            "experience_match": score_result.get("experience_match"),
            "career_trajectory": score_result.get("career_trajectory", "unknown"),
            "red_flags": score_result.get("red_flags", []),
            "method": score_result.get("method", ""),
        })

        async with get_connection() as conn:
            new_status = "screening" if score >= ats_threshold else "on_hold"
            await CandidateRepository.update_application(
                conn, application_id, org_id, {
                    "skill_match_score": score,
                    "skill_match_data": skill_match_data,
                    "status": new_status
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


@celery_app.task(name="tasks.source_candidates_for_position")
def source_candidates_for_position(position_id: int, org_id: int):
    """
    Alias called by scheduled_search — looks up department_id and
    delegates to the main run_candidate_search task.
    """
    import asyncio

    async def _get_dept():
        async with get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT department_id, created_by FROM positions WHERE id=$1 AND org_id=$2",
                position_id, org_id,
            )
        return row

    try:
        loop = asyncio.get_event_loop()
        row = loop.run_until_complete(_get_dept())
    except RuntimeError:
        row = asyncio.run(_get_dept())

    if not row:
        logger.warning(f"Position {position_id} not found for scheduled search")
        return

    run_candidate_search.delay(
        position_id, org_id, row["department_id"], row.get("created_by")
    )


@celery_app.task(
    name="tasks.score_candidate_application",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    acks_late=True
)
def score_candidate_application(self, candidate_id: int, application_id: int, position_id: int, org_id: int):
    """
    ATS Score an organic application after the candidate completes the apply chat.
    """
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        loop.run_until_complete(
            _score_application(candidate_id, application_id, position_id, org_id)
        )
    except RuntimeError:
        asyncio.run(_score_application(candidate_id, application_id, position_id, org_id))
    except Exception as exc:
        logger.error(f"Organic ATS scoring failed for {application_id}: {exc}", exc_info=True)
        raise self.retry(exc=exc)


async def _score_application(candidate_id: int, application_id: int, position_id: int, org_id: int):
    _start = time.time()
    logger.info(f"Starting ATS scoring for organic application {application_id}")
    try:
        async with get_connection() as conn:
            position = await PositionRepository.get(conn, position_id, org_id)
            if not position:
                logger.error(f"Position {position_id} not found for scoring application {application_id}")
                return
            ats_threshold = float(position.get("ats_threshold") or 80.0)

        score_result = await compute_ats_score(candidate_id, application_id, position_id, org_id)
        score = score_result.get("score", 0)
        skill_match_data = json.dumps({
            "matched_skills": score_result.get("matched_skills", []),
            "missing_skills": score_result.get("missing_skills", []),
            "extra_skills": score_result.get("extra_skills", []),
            "summary": score_result.get("summary", ""),
            "emb_score": score_result.get("emb_score"),
            "skills_match": score_result.get("skills_match"),
            "experience_match": score_result.get("experience_match"),
            "career_trajectory": score_result.get("career_trajectory", "unknown"),
            "red_flags": score_result.get("red_flags", []),
            "method": score_result.get("method", ""),
        })

        async with get_connection() as conn:
            new_status = "screening" if score >= ats_threshold else "on_hold"
            await CandidateRepository.update_application(
                conn, application_id, org_id, {
                    "skill_match_score": score,
                    "skill_match_data": skill_match_data,
                    "status": new_status
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
                    "above_threshold": score >= ats_threshold,
                    "source": "organic_apply"
                }
            })
            logger.info(f"Organic application {application_id} scored: {score}")
            if score >= ats_threshold:
                trigger_pre_evaluation.delay(application_id, candidate_id, position_id, org_id)

        _duration = int((time.time() - _start) * 1000)
        try:
            async with get_connection() as conn:
                await conn.execute(
                    """INSERT INTO task_run_log
                       (org_id, task_type, position_id, status,
                        candidates_processed, duration_ms)
                       VALUES ($1, 'ats_scoring', $2, 'success', 1, $3)""",
                    org_id, position_id, _duration,
                )
        except Exception:
            pass
    except Exception as exc:
        _duration = int((time.time() - _start) * 1000)
        try:
            async with get_connection() as conn:
                await conn.execute(
                    """INSERT INTO task_run_log
                       (org_id, task_type, position_id, status,
                        duration_ms, error_message)
                       VALUES ($1, 'ats_scoring', $2, 'failed', $3, $4)""",
                    org_id, position_id, _duration, str(exc)[:500],
                )
        except Exception:
            pass
        raise

@celery_app.task(name="tasks.trigger_pre_evaluation")
def trigger_pre_evaluation(application_id: int, candidate_id: int, position_id: int, org_id: int):
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        loop.run_until_complete(_trigger_pre_evaluation(application_id, candidate_id, position_id, org_id))
    except RuntimeError:
        asyncio.run(_trigger_pre_evaluation(application_id, candidate_id, position_id, org_id))

async def _trigger_pre_evaluation(application_id: int, candidate_id: int, position_id: int, org_id: int):
    import secrets
    import json
    import random
    from datetime import datetime, timedelta, timezone
    from backend.db.repositories.pre_evaluations import PreEvaluationRepository
    
    async with get_connection() as conn:
        from backend.db.repositories.positions import PositionRepository
        position = await PositionRepository.get(conn, position_id, org_id)
        if not position:
            logger.error(f"Position {position_id} not found. Skipping pre-evaluation.")
            return

        kit = await PositionRepository.get_interview_kit(conn, position_id, org_id)
        if not kit:
            logger.info(f"No interview kit for position {position_id}. Skipping pre-evaluation.")
            return
            
        questions = json.loads(kit["questions"]) if isinstance(kit["questions"], str) else kit["questions"]
        if not questions:
            return

        # Pick 3-5 random questions to form the pre-evaluation
        num_questions = min(len(questions), random.randint(3, 5))
        selected_qs = random.sample(questions, num_questions)
        
        # Paraphrasing using LLM to prevent cheating
        from backend.adapters.llm.factory import get_llm
        from backend.config import settings
        from backend.services.llm_usage_logger import llm_context
        from langchain_core.messages import SystemMessage, HumanMessage
        
        try:
            llm = get_llm(temperature=0.7, json_mode=True)
            sys_prompt = "You are a recruiting assistant. Paraphrase the following interview questions slightly so they look unique per candidate. Return ONLY valid JSON with structure: {\"questions\": [{\"id\": ..., \"text\": \"...\"}]}"
            human_prompt = f"Questions: {json.dumps([{'id': i, 'text': q.get('question', q.get('text', ''))} for i, q in enumerate(selected_qs)])}"
            
            with llm_context(org_id=org_id, operation="pre_eval_paraphrase", model=settings.LLM_PROVIDER):
                res = await llm.ainvoke([SystemMessage(content=sys_prompt), HumanMessage(content=human_prompt)])
                
            resp_content = res.content
            if isinstance(resp_content, list):
                resp_content = str(resp_content[0]) if not isinstance(resp_content[0], dict) else resp_content[0].get("text", "")
            resp_content = str(resp_content)
            
            if "```json" in resp_content:
                resp_content = resp_content.split("```json")[-1].split("```")[0].strip()
            elif "```" in resp_content:
                resp_content = resp_content.split("```")[1].strip()
                
            data = json.loads(resp_content)
            eval_questions = data.get("questions", [])
        except Exception as e:
            logger.error(f"Failed to paraphrase questions: {e}")
            eval_questions = [{"id": i, "text": q.get("question", q.get("text", ""))} for i, q in enumerate(selected_qs)]

        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)

        await PreEvaluationRepository.create(conn, org_id, {
            "application_id": application_id,
            "candidate_id": candidate_id,
            "token": token,
            "questions": eval_questions,
            "expires_at": expires_at
        })
        
        # Send email invite with magic link to set password
        from backend.db.repositories.candidates import CandidateRepository
        from backend.db.repositories.organizations import OrgRepository
        from backend.services.email_service import EmailService
        from backend.utils.security import create_magic_link_token

        candidate = await CandidateRepository.get(conn, candidate_id, org_id)
        org = await OrgRepository.get_by_id(conn, org_id)

        if candidate and org and candidate.get("email"):
            # Dedicated candidate-setup token type (single-use, consumed by the portal).
            setup_token = create_magic_link_token("candidate_setup", candidate_id, expires_hours=168)  # 7 days
            setup_url = f"{settings.FRONTEND_URL}/candidate/setup-password?token={setup_token}"
            
            await EmailService.send_pre_evaluation_invite(
                to_email=candidate["email"],
                candidate_name=candidate.get("name", "Applicant"),
                role_name=position.get("role_name", "the position"),
                org_name=org.get("name", "our company"),
                setup_url=setup_url
            )
            
        logger.info(f"Triggered pre-evaluation for application {application_id} with token {token}")

# NOTE: Pre-evaluation grading is handled exclusively by the nightly batch task in
# backend/tasks/pre_eval_grade.py (registered in celery beat). The earlier per-submission
# grader here was removed — it referenced a non-existent column and did not route the
# candidate to interview/rejected.

