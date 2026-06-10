from fastapi import APIRouter, Depends, HTTPException
import asyncpg
from pydantic import BaseModel
from typing import List, Optional

from backend.db.connection import get_connection as get_db
from backend.db.repositories.pre_evaluations import PreEvaluationRepository
from backend.tasks.candidate_pipeline import grade_pre_evaluation

router = APIRouter()

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
    
    if eval_record["status"] != "pending":
        raise HTTPException(status_code=400, detail="Evaluation already submitted or expired.")
        
    # Save answers
    answers_data = [a.model_dump() for a in body.answers]
    updated_eval = await PreEvaluationRepository.submit_answers(db, eval_record["id"], answers_data)
    
    # Trigger background grading
    grade_pre_evaluation.delay(eval_record["id"], eval_record["org_id"])
    
    return {"status": "success", "message": "Evaluation submitted successfully"}
