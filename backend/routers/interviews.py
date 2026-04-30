"""
routers/interviews.py – Protected interview scheduling endpoints.
All routes under /api/v1/interviews/
Requires JWT auth — recruiters only.
"""
import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from backend.dependencies import get_current_user
from backend.services.interview_service import InterviewService

router = APIRouter(prefix="/api/v1/interviews", tags=["Interviews"])
logger = logging.getLogger(__name__)


class PanelMemberIn(BaseModel):
    name: str
    email: str
    user_id: Optional[int] = None


class CreateInterviewRequest(BaseModel):
    position_id: int
    candidate_id: int
    application_id: int
    round_number: int = 1
    round_name: Optional[str] = None
    round_type: str = "technical"
    scheduled_at: Optional[datetime] = None
    duration_minutes: int = 60
    meeting_link: Optional[str] = None
    notes: Optional[str] = None
    panel_members: list[PanelMemberIn] = []


class UpdateInterviewRequest(BaseModel):
    round_name: Optional[str] = None
    round_type: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    meeting_link: Optional[str] = None
    status: Optional[str] = None
    overall_result: Optional[str] = None
    notes: Optional[str] = None


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("/")
async def create_interview(
    body: CreateInterviewRequest,
    current_user=Depends(get_current_user),
):
    """Create a new interview round with panel members and magic links."""
    try:
        result = await InterviewService.create_interview(
            org_id=current_user["org_id"],
            user_id=current_user["id"],
            data=body.model_dump(),
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"error": {"code": "VALIDATION_ERROR", "message": str(e), "details": None}})
    except Exception as e:
        logger.error(f"Create interview failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={"error": {"code": "SERVER_ERROR", "message": "Failed to create interview", "details": None}})


# ── List for candidate ────────────────────────────────────────────────────────

@router.get("/candidate/{candidate_id}")
async def list_interviews_for_candidate(
    candidate_id: int,
    current_user=Depends(get_current_user),
):
    """All interview rounds for a candidate (org-scoped)."""
    interviews = await InterviewService.list_for_candidate(
        candidate_id=candidate_id,
        org_id=current_user["org_id"],
    )
    return {"interviews": interviews}


# ── List for position ─────────────────────────────────────────────────────────

@router.get("/position/{position_id}")
async def list_interviews_for_position(
    position_id: int,
    current_user=Depends(get_current_user),
):
    """All interview rounds for a position (org-scoped)."""
    interviews = await InterviewService.list_for_position(
        position_id=position_id,
        org_id=current_user["org_id"],
    )
    return {"interviews": interviews}


# ── Get detail ────────────────────────────────────────────────────────────────

@router.get("/{interview_id}")
async def get_interview(
    interview_id: int,
    current_user=Depends(get_current_user),
):
    """Get full interview detail including panel and scorecards."""
    data = await InterviewService.get_interview_with_scorecards(
        interview_id=interview_id,
        org_id=current_user["org_id"],
    )
    if not data:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Interview not found", "details": None}})
    return data


# ── Update ────────────────────────────────────────────────────────────────────

@router.patch("/{interview_id}")
async def update_interview(
    interview_id: int,
    body: UpdateInterviewRequest,
    current_user=Depends(get_current_user),
):
    """Update interview details (reschedule, set result, etc.)."""
    try:
        updated = await InterviewService.update_interview(
            interview_id=interview_id,
            org_id=current_user["org_id"],
            user_id=current_user["id"],
            data=body.model_dump(exclude_none=True),
        )
        if not updated:
            raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Interview not found", "details": None}})
        return updated
    except Exception as e:
        logger.error(f"Update interview failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={"error": {"code": "SERVER_ERROR", "message": "Update failed", "details": None}})


# ── Send invites ──────────────────────────────────────────────────────────────

@router.post("/{interview_id}/send-invites")
async def send_invites(
    interview_id: int,
    current_user=Depends(get_current_user),
):
    """Mark interview invites as sent to candidate and panel members."""
    try:
        result = await InterviewService.send_invites(
            interview_id=interview_id,
            org_id=current_user["org_id"],
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": str(e), "details": None}})


# ── Generate debrief ──────────────────────────────────────────────────────────

@router.post("/{interview_id}/generate-debrief")
async def generate_debrief(
    interview_id: int,
    current_user=Depends(get_current_user),
):
    """Generate AI hiring debrief from all submitted scorecards."""
    try:
        result = await InterviewService.generate_debrief(
            interview_id=interview_id,
            org_id=current_user["org_id"],
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"error": {"code": "VALIDATION_ERROR", "message": str(e), "details": None}})
    except Exception as e:
        logger.error(f"Debrief generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={"error": {"code": "SERVER_ERROR", "message": "Debrief generation failed", "details": None}})
