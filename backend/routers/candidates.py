"""
routers/candidates.py – Candidate sourcing, scoring, and email outreach endpoints
"""
import sys
import traceback
from dataclasses import asdict
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from backend.routers.auth import get_current_user
from backend.db.database import (
    get_connection, add_candidate, get_candidates_for_position,
    update_candidate_status, get_position_by_session,
)
from backend.services.candidate_source import (
    CandidateSearchQuery, get_source_adapter,
)
from backend.services.ats_scorer import score_candidate
from backend.services.email_service import send_outreach_email
from backend.services.background_tasks import send_outreach_emails_task
from fastapi import BackgroundTasks

router = APIRouter(prefix="/api/candidates", tags=["candidates"])


# ── Models ────────────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    position_id: Optional[int] = None
    session_id: Optional[str] = None
    role_name: str
    skills: list[str]
    experience_min: int = 0
    experience_max: int = 20
    location: str = "Any"
    max_results: int = 10

class ScoreRequest(BaseModel):
    candidate_id: int
    resume_text: str
    jd_requirements: str
    required_skills: list[str] = []

class EmailRequest(BaseModel):
    candidate_ids: list[int]
    position_id: int
    role_name: str

class AsyncEmailRequest(BaseModel):
    candidate_ids: list[int]
    position_id: int
    role_name: str
    session_id: str

class StatusUpdateRequest(BaseModel):
    status: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

class SearchAsyncRequest(BaseModel):
    session_id: str

@router.post("/search-async")
async def trigger_search_async(req: SearchAsyncRequest, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    """Trigger background job to source and score candidates for a session."""
    from backend.services.background_tasks import start_candidate_pipeline
    background_tasks.add_task(start_candidate_pipeline, req.session_id, user["org_id"])
    return {"success": True, "task_started": True}

@router.post("/search")
async def search_candidates(req: SearchRequest, user: dict = Depends(get_current_user)):
    """
    Search for candidates matching position requirements.
    Uses the configured source adapter (simulation by default).
    """
    try:
        adapter = get_source_adapter()
        query = CandidateSearchQuery(
            role_name=req.role_name,
            skills=req.skills,
            experience_min=req.experience_min,
            experience_max=req.experience_max,
            location=req.location,
            max_results=req.max_results,
        )
        results = await adapter.search_candidates(query)

        # Resolve position_id
        position_id = req.position_id
        if not position_id and req.session_id:
            pos = get_position_by_session(req.session_id)
            if pos:
                position_id = pos["id"]

        # Save to database
        saved_candidates = []
        for candidate in results:
            try:
                db_id = add_candidate(
                    org_id=user["org_id"],
                    position_id=position_id or 0,
                    name=candidate.name,
                    email=candidate.email,
                    phone=candidate.phone,
                    resume_text=candidate.resume_summary,
                    source=adapter.source_name,
                    skill_match_score=candidate.match_score,
                )
                saved_candidates.append({
                    "db_id": db_id,
                    **asdict(candidate),
                })
            except Exception as e:
                print(f"⚠️ Failed to save candidate {candidate.name}: {e}", file=sys.stderr)
                saved_candidates.append(asdict(candidate))

        return {
            "source": adapter.source_name,
            "count": len(saved_candidates),
            "candidates": saved_candidates,
        }

    except Exception as e:
        print(f"❌ Candidate search error: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/position/{position_id}")
async def list_candidates(position_id: int, user: dict = Depends(get_current_user)):
    """List all candidates for a position."""
    candidates = get_candidates_for_position(position_id)
    return {"candidates": candidates}

@router.get("/session/{session_id}")
async def list_candidates_by_session(session_id: str, user: dict = Depends(get_current_user)):
    """List all candidates for a chat session."""
    position = get_position_by_session(session_id)
    if not position:
        return {"candidates": []}
    candidates = get_candidates_for_position(position["id"])
    return {"candidates": candidates}


@router.post("/score")
async def score_resume(req: ScoreRequest, user: dict = Depends(get_current_user)):
    """Score a candidate's resume against position requirements."""
    try:
        result = score_candidate(
            resume_text=req.resume_text,
            jd_requirements=req.jd_requirements,
            required_skills=req.required_skills,
        )
        # Update candidate score in DB
        with get_connection() as conn:
            conn.execute("""
                UPDATE candidates
                SET skill_match_score = ?, screening_data = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (result["match_score"], str(result), req.candidate_id))

        return result
    except Exception as e:
        print(f"❌ ATS scoring error: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send-emails-async")
async def send_emails_async(req: AsyncEmailRequest, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    """Trigger background job to send outreach emails."""
    background_tasks.add_task(
        send_outreach_emails_task,
        req.candidate_ids,
        req.position_id,
        req.role_name,
        user["org_id"],
        req.session_id
    )
    return {"success": True, "task_started": True}

@router.post("/send-emails")
async def send_emails(req: EmailRequest, user: dict = Depends(get_current_user)):
    """Send outreach emails with magic links to selected candidates."""
    results = []

    # Get org name
    with get_connection() as conn:
        org = conn.execute(
            "SELECT name FROM organizations WHERE id = ?", (user["org_id"],)
        ).fetchone()
        org_name = org["name"] if org else "Our Company"

    for candidate_id in req.candidate_ids:
        with get_connection() as conn:
            candidate = conn.execute(
                "SELECT * FROM candidates WHERE id = ?", (candidate_id,)
            ).fetchone()

        if not candidate:
            results.append({"candidate_id": candidate_id, "success": False, "message": "Not found"})
            continue

        try:
            result = await send_outreach_email(
                candidate_id=candidate_id,
                candidate_name=candidate["name"],
                candidate_email=candidate["email"],
                role_name=req.role_name,
                org_name=org_name,
                match_score=candidate["skill_match_score"] or 0,
                position_id=req.position_id,
            )
            # Update candidate status
            if result["success"]:
                update_candidate_status(candidate_id, "emailed")
            results.append({"candidate_id": candidate_id, **result})
        except Exception as e:
            results.append({"candidate_id": candidate_id, "success": False, "message": str(e)})

    return {
        "total": len(req.candidate_ids),
        "sent": sum(1 for r in results if r.get("success")),
        "results": results,
    }


@router.patch("/{candidate_id}/status")
async def update_status(candidate_id: int, req: StatusUpdateRequest, user: dict = Depends(get_current_user)):
    """Update a candidate's pipeline status."""
    valid_statuses = ['sourced', 'emailed', 'applied', 'screening', 'interview', 'selected', 'rejected', 'on_hold']
    if req.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    update_candidate_status(candidate_id, req.status)
    return {"success": True, "candidate_id": candidate_id, "status": req.status}
