import asyncio
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
                   p.role_name, p.jd_text, ik.scorecard_template
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
        
        # We will process them concurrently but could batch by position if we wanted to check for collusion.
        # For simplicity and robustness, grade each individually first.
        for row in rows:
            await _grade_single(conn, row)
            
        # TODO: Implement collusion detection across candidates for the same position

async def _grade_single(conn, row):
    eval_id = row["id"]
    org_id = row["org_id"]
    application_id = row["application_id"]
    
    try:
        questions = json.loads(row["questions"]) if isinstance(row["questions"], str) else row["questions"]
        answers = json.loads(row["answers"]) if isinstance(row["answers"], str) else row["answers"]
        scorecard = json.loads(row["scorecard_template"]) if isinstance(row["scorecard_template"], str) else row["scorecard_template"]
        
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
JD: {row['jd_text'][:2000]}
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
        score = float(data.get("score", 0.0))
        feedback = data.get("feedback", "No feedback provided.")
        decision = data.get("decision", "fail").lower()
        
        # Update evaluation record
        await PreEvaluationRepository.update_score(conn, eval_id, score, feedback)
        
        # Route candidate
        new_status = "interview" if decision == "pass" else "rejected"
        await CandidateRepository.update_application(conn, org_id, application_id, {"status": new_status})
        
        if new_status == "rejected":
            # Set rejection reason
            await conn.execute(
                "UPDATE candidate_applications SET rejection_reason = $1 WHERE id = $2 AND org_id = $3",
                "screening_failed", application_id, org_id
            )
            
        logger.info(f"Graded pre-evaluation {eval_id} with score {score}. Decision: {decision}")
        
    except Exception as e:
        logger.error(f"Failed to grade pre-evaluation {eval_id}: {e}", exc_info=True)


@celery_app.task(name="tasks.pre_eval_grade")
def pre_eval_grade():
    """Nightly batch task to grade submitted pre-evaluations."""
    try:
        loop = asyncio.get_event_loop()
        loop.run_until_complete(_batch_grade_pre_evaluations())
    except RuntimeError:
        asyncio.run(_batch_grade_pre_evaluations())
