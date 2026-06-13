"""
routers/panel.py – Public panel feedback endpoints.
No auth — secured by signed JWT magic link token (7-day expiry, single-use).
All routes under /api/v1/panel/
"""
import logging

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional

from backend.services.interview_service import PanelFeedbackService
from backend.middleware.rate_limiter import limiter

async def set_panel_org_context(token: str):
    """Dependency to set tenant context for magic link routes to bypass RLS issues."""
    try:
        from backend.services.interview_service import verify_panel_token
        from backend.db.connection import set_org_context, reset_org_context
        payload = verify_panel_token(token)
        ctx = set_org_context(payload["org_id"])
        yield
        reset_org_context(ctx)
    except Exception:
        yield

router = APIRouter(prefix="/api/v1/panel", tags=["Panel Feedback"], dependencies=[Depends(set_panel_org_context)])
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
@limiter.limit("30/minute")
async def verify_panel_token(token: str, request: Request):
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
@limiter.limit("10/minute")
async def enrich_notes(token: str, body: EnrichRequest, request: Request):
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
@limiter.limit("10/minute")
async def submit_feedback(token: str, body: SubmitFeedbackRequest, request: Request):
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
