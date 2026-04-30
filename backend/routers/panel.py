"""
routers/panel.py – Public panel feedback endpoints.
No auth — secured by signed JWT magic link token (7-day expiry, single-use).
All routes under /api/v1/panel/
"""
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from backend.services.interview_service import PanelFeedbackService

router = APIRouter(prefix="/api/v1/panel", tags=["Panel Feedback"])
logger = logging.getLogger(__name__)


class RatingIn(BaseModel):
    dimension: str
    score: int
    notes: Optional[str] = None


class SubmitFeedbackRequest(BaseModel):
    is_draft: bool = False
    attended: bool = True
    ratings: list[RatingIn] = []
    overall_score: Optional[float] = None
    recommendation: Optional[str] = None
    strengths: Optional[str] = None
    concerns: Optional[str] = None
    additional_comments: Optional[str] = None
    raw_notes_strengths: Optional[str] = None
    raw_notes_concerns: Optional[str] = None


class EnrichRequest(BaseModel):
    strengths_raw: str
    concerns_raw: str


# ── Verify token & load context ───────────────────────────────────────────────

@router.get("/{token}")
async def verify_panel_token(token: str):
    """
    Verify panel magic link token and return full feedback context.
    Called when panel member opens the magic link.
    """
    context = await PanelFeedbackService.verify_and_load(token)
    if not context.get("valid"):
        expired = context.get("expired", False)
        raise HTTPException(
            status_code=410 if expired else 400,
            detail={
                "code": "TOKEN_EXPIRED" if expired else "TOKEN_INVALID",
                "message": context.get("error", "Invalid link"),
            }
        )
    return context


# ── AI Enrich rough notes ─────────────────────────────────────────────────────

@router.post("/{token}/enrich")
async def enrich_notes(token: str, body: EnrichRequest):
    """
    AI-enriched version of rough panel notes.
    Returns: { strengths_enriched, concerns_enriched }
    """
    try:
        result = await PanelFeedbackService.enrich_notes(
            token=token,
            strengths_raw=body.strengths_raw,
            concerns_raw=body.concerns_raw,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"code": "INVALID_TOKEN", "message": str(e)})
    except Exception as e:
        logger.error(f"Enrich notes failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={"code": "SERVER_ERROR", "message": "AI enrichment failed. Please try again."})


# ── Submit or save-draft feedback ─────────────────────────────────────────────

@router.post("/{token}/submit")
async def submit_feedback(token: str, body: SubmitFeedbackRequest):
    """
    Submit final feedback or save draft.
    - is_draft=false → final submit (marks token as used, triggers recruiter notification)
    - is_draft=true → save progress without submitting
    - attended=false → mark as not attended (no feedback required)
    """
    try:
        result = await PanelFeedbackService.submit_feedback(
            token=token,
            data=body.model_dump(),
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"code": "VALIDATION_ERROR", "message": str(e)})
    except Exception as e:
        logger.error(f"Submit feedback failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={"code": "SERVER_ERROR", "message": "Failed to save feedback. Please try again."})
