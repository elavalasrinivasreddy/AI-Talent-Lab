import asyncio
import difflib
import json
import logging
from typing import Dict, Any, List

from celery import shared_task
from backend.celery_app import celery_app
from backend.db.connection import get_connection
from backend.db.repositories.pre_evaluations import PreEvaluationRepository
from backend.db.repositories.positions import PositionRepository
from backend.db.repositories.candidates import CandidateRepository
from backend.adapters.llm.factory import get_llm
from backend.config import settings
from backend.services.llm_usage_logger import llm_context
from langchain_core.messages import SystemMessage, HumanMessage

logger = logging.getLogger(__name__)

async def _batch_grade_pre_evaluations():
    async with get_connection() as conn:
        # Fetch all pending submitted pre-evaluations
        rows = await conn.fetch(
            """
            SELECT pe.id, pe.org_id, pe.application_id, pe.questions, pe.answers,
                   p.id AS position_id, p.role_name, p.jd_markdown, ik.scorecard_template
            FROM pre_evaluations pe
            JOIN candidate_applications ca ON ca.id = pe.application_id
            JOIN positions p ON p.id = ca.position_id
            LEFT JOIN interview_kits ik ON ik.position_id = p.id
            WHERE pe.status = 'submitted'
            """
        )
        if not rows:
            logger.info("No submitted pre-evaluations to grade.")
            return

        logger.info(f"Found {len(rows)} pre-evaluations to grade.")
        
        for row in rows:
            await _grade_single(conn, row)

        await _detect_collusion(conn, rows)

async def _grade_single(conn, row):
    eval_id = row["id"]
    org_id = row["org_id"]
    application_id = row["application_id"]
    
    try:
        questions = json.loads(row["questions"]) if isinstance(row["questions"], str) else row["questions"]
        answers = json.loads(row["answers"]) if isinstance(row["answers"], str) else row["answers"]
        scorecard = json.loads(row["scorecard_template"]) if isinstance(row["scorecard_template"], str) else row["scorecard_template"]
        if not scorecard:
            # No interview kit for this position — grade against the JD with a generic rubric.
            scorecard = [{"dimension": "Overall fit", "description": "Relevance, correctness and depth of answers vs the role requirements."}]
        
        llm = get_llm(temperature=0.0, json_mode=True)
        sys_prompt = """You are an expert technical interviewer evaluating a candidate's written pre-evaluation test.
You will receive the Role Name, the Job Description, the Scorecard Template, the candidate's variant of Questions, and their Answers.
Grade the answers against the scorecard.
Return ONLY valid JSON strictly matching this schema:
{
    "score": "Float (0.0 to 100.0, overall score)",
    "feedback": "String (Brief feedback summarizing the evaluation)",
    "decision": "String (either 'pass' or 'fail')"
}"""
        
        human_prompt = f"""Role: {row['role_name']}
JD: {(row['jd_markdown'] or '')[:2000]}
Scorecard: {json.dumps(scorecard)}
Questions: {json.dumps(questions)}
Answers: {json.dumps(answers)}"""

        with llm_context(org_id=org_id, operation="pre_eval_grade", model=settings.LLM_PROVIDER):
            res = await llm.ainvoke([
                SystemMessage(content=sys_prompt),
                HumanMessage(content=human_prompt)
            ])
            
        content = res.content
        if isinstance(content, list):
            content = str(content[0]) if not isinstance(content[0], dict) else content[0].get("text", "")
        content = str(content)
        
        if "```json" in content:
            content = content.split("```json")[-1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].strip()
            
        data = json.loads(content)
        score = max(0.0, min(100.0, float(data.get("score", 0.0))))
        feedback = data.get("feedback", "No feedback provided.")
        decision = data.get("decision", "fail").lower()
        if decision not in ("pass", "fail"):
            decision = "fail"
        
        # Update evaluation record (sets status passed/failed + evaluated_at)
        await PreEvaluationRepository.update_score(conn, eval_id, score, feedback, decision=decision)

        # Route candidate. NOTE arg order: update_application(conn, application_id, org_id, data)
        new_status = "interview" if decision == "pass" else "rejected"
        await CandidateRepository.update_application(
            conn, application_id, org_id,
            {"status": new_status, "rejection_reason": "screening_failed"} if new_status == "rejected"
            else {"status": new_status},
        )
            
        logger.info(f"Graded pre-evaluation {eval_id} with score {score}. Decision: {decision}")
        
    except Exception as e:
        logger.error(f"Failed to grade pre-evaluation {eval_id}: {e}", exc_info=True)


def _answer_similarity(answers_a: dict, answers_b: dict) -> float:
    """Average SequenceMatcher ratio across shared question keys."""
    keys = set(answers_a) & set(answers_b)
    if not keys:
        return 0.0
    scores = []
    for k in keys:
        a = str(answers_a.get(k, "")).lower().strip()
        b = str(answers_b.get(k, "")).lower().strip()
        if not a and not b:
            continue
        scores.append(difflib.SequenceMatcher(None, a, b).ratio())
    return sum(scores) / len(scores) if scores else 0.0


async def _detect_collusion(conn, rows: list):
    """
    Group submitted evaluations by position. Flag both evaluations in any pair
    whose answer texts are >= COLLUSION_THRESHOLD similar, leaving them for human review
    instead of auto-routing to interview/rejected.

    Also reverts the application status to 'on_hold' so colluders don't silently
    advance to the Interview lane while awaiting HR review.
    """
    COLLUSION_THRESHOLD = 0.80

    # Build eval_id -> application_id map for reverting application status
    eval_to_app: Dict[int, int] = {row["id"]: row["application_id"] for row in rows}

    by_position: Dict[int, list] = {}
    for row in rows:
        by_position.setdefault(row["position_id"], []).append(row)

    flagged_ids = set()
    for position_id, position_rows in by_position.items():
        if len(position_rows) < 2:
            continue

        parsed = []
        for r in position_rows:
            try:
                answers = json.loads(r["answers"]) if isinstance(r["answers"], str) else r["answers"]
                # Answers are persisted as a list of {question_id, answer} dicts
                # (see routers/pre_evaluations.py). _answer_similarity expects a
                # {question_id: answer} mapping — set() over a list of dicts raises
                # TypeError (unhashable) and silently kills collusion detection.
                if isinstance(answers, list):
                    answers = {
                        item.get("question_id"): item.get("answer")
                        for item in answers
                        if isinstance(item, dict) and item.get("question_id") is not None
                    }
                parsed.append((r["id"], answers or {}))
            except Exception:
                parsed.append((r["id"], {}))

        for i in range(len(parsed)):
            for j in range(i + 1, len(parsed)):
                id_a, ans_a = parsed[i]
                id_b, ans_b = parsed[j]
                sim = _answer_similarity(ans_a, ans_b)
                if sim >= COLLUSION_THRESHOLD:
                    logger.warning(
                        "Collusion suspected: pre_evals %s and %s (position %s) similarity=%.2f — flagged for human review",
                        id_a, id_b, position_id, sim,
                    )
                    flagged_ids.add(id_a)
                    flagged_ids.add(id_b)

    if flagged_ids:
        # Mark pre-evaluations as flagged (overrides passed/failed set by _grade_single)
        await conn.execute(
            "UPDATE pre_evaluations SET status = 'flagged', updated_at = NOW() WHERE id = ANY($1::int[])",
            list(flagged_ids),
        )
        # Revert application status to on_hold so colluders don't reach the Interview lane
        flagged_app_ids = [eval_to_app[eid] for eid in flagged_ids if eid in eval_to_app]
        if flagged_app_ids:
            await conn.execute(
                """
                UPDATE candidate_applications
                SET status = 'on_hold', updated_at = NOW()
                WHERE id = ANY($1::int[])
                """,
                flagged_app_ids,
            )
        logger.info(
            "Flagged %d pre-evaluations for collusion review (eval ids: %s); reverted %d applications to on_hold",
            len(flagged_ids), flagged_ids, len(flagged_app_ids),
        )


@celery_app.task(name="tasks.pre_eval_grade")
def pre_eval_grade():
    """Nightly batch task to grade submitted pre-evaluations."""
    run_async(_batch_grade_pre_evaluations())
