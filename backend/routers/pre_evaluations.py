from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
import asyncpg
from pydantic import BaseModel
from typing import List

from backend.dependencies import get_db
from backend.db.repositories.pre_evaluations import PreEvaluationRepository

router = APIRouter(prefix="/api/v1/pre-evaluations", tags=["Pre-Evaluations"])

class AnswerItem(BaseModel):
    question_id: str
    answer: str

class SubmitEvaluationBody(BaseModel):
    token: str
    answers: List[AnswerItem]

@router.get("/{token}")
async def get_evaluation_by_token(token: str, db: asyncpg.Connection = Depends(get_db)):
    eval_record = await PreEvaluationRepository.get_by_token(db, token)
    if not eval_record:
        raise HTTPException(status_code=404, detail="Evaluation not found or token invalid.")

    if eval_record.get("expires_at") and eval_record["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This evaluation link has expired.")

    if eval_record["status"] != "pending":
        raise HTTPException(status_code=400, detail="Evaluation already submitted or expired.")

    import json
    return {
        "status": "success",
        "evaluation": {
            "id": eval_record["id"],
            "questions": json.loads(eval_record["questions"]) if isinstance(eval_record["questions"], str) else eval_record["questions"],
            "status": eval_record["status"]
        }
    }

@router.post("/submit")
async def submit_evaluation(body: SubmitEvaluationBody, db: asyncpg.Connection = Depends(get_db)):
    eval_record = await PreEvaluationRepository.get_by_token(db, body.token)
    if not eval_record:
        raise HTTPException(status_code=404, detail="Evaluation not found or token invalid.")

    if eval_record.get("expires_at") and eval_record["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This evaluation link has expired.")

    if eval_record["status"] != "pending":
        raise HTTPException(status_code=400, detail="Evaluation already submitted or expired.")

    # Save answers (status → 'submitted'; graded later by the nightly batch task)
    answers_data = [a.model_dump() for a in body.answers]
    await PreEvaluationRepository.submit_answers(db, eval_record["id"], answers_data)

    return {"status": "success", "message": "Evaluation submitted. You will be notified once it is reviewed."}
