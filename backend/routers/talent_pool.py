"""
routers/talent_pool.py – Talent pool endpoints.
All routes under /api/v1/talent-pool/
Requires JWT auth.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel

from backend.dependencies import get_current_user
from backend.services.talent_pool_service import TalentPoolService

router = APIRouter(prefix="/api/v1/talent-pool", tags=["Talent Pool"])
logger = logging.getLogger(__name__)


# ── List pool ─────────────────────────────────────────────────────────────────

@router.get("/")
async def list_talent_pool(
    q: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    reason: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    current_user=Depends(get_current_user),
):
    return await TalentPoolService.get_pool(
        org_id=current_user["org_id"],
        search=q,
        location=location,
        source=source,
        reason=reason,
        page=page,
    )


# ── Bulk upload ───────────────────────────────────────────────────────────────

@router.post("/bulk-upload")
async def bulk_upload_resumes(
    files: list[UploadFile] = File(...),
    current_user=Depends(get_current_user),
):
    """
    Upload up to 50 resume files (PDF/DOCX). Extracts text, deduplicates,
    adds new candidates to the talent pool. Returns detailed results.
    """
    if len(files) > 50:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "TOO_MANY_FILES", "message": "Max 50 files per upload", "details": None}}
        )

    file_data = []
    for f in files:
        content = await f.read()
        if len(content) > 5 * 1024 * 1024:  # 5MB
            continue  # silently skip oversized
        file_data.append((f.filename or "resume", content))

    try:
        result = await TalentPoolService.bulk_upload(
            org_id=current_user["org_id"],
            user_id=current_user["id"],
            files=file_data,
        )
        return result
    except Exception as e:
        logger.error(f"Bulk upload failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={"error": {"code": "UPLOAD_FAILED", "message": "Upload processing failed", "details": None}}
        )


# ── AI Suggest ────────────────────────────────────────────────────────────────

@router.post("/suggest/{position_id}")
async def ai_suggest(
    position_id: int,
    current_user=Depends(get_current_user),
):
    """Find talent pool candidates matching a specific position by embedding similarity."""
    result = await TalentPoolService.ai_suggest(
        org_id=current_user["org_id"],
        position_id=position_id,
    )
    return result


# ── Add to pipeline ───────────────────────────────────────────────────────────

class AddToPipelineRequest(BaseModel):
    position_id: int


@router.post("/{candidate_id}/add-to-position")
async def add_to_pipeline(
    candidate_id: int,
    body: AddToPipelineRequest,
    current_user=Depends(get_current_user),
):
    """Move a pool candidate into a specific position's pipeline at 'sourced' stage."""
    try:
        result = await TalentPoolService.add_to_pipeline(
            org_id=current_user["org_id"],
            candidate_id=candidate_id,
            position_id=body.position_id,
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": str(e), "details": None}}
        )


# ── Manually add to pool ──────────────────────────────────────────────────────

@router.post("/{candidate_id}/add")
async def add_to_pool(
    candidate_id: int,
    current_user=Depends(get_current_user),
):
    """Manually add a candidate to the talent pool."""
    return await TalentPoolService.add_to_pool(
        org_id=current_user["org_id"],
        candidate_id=candidate_id,
        reason="manual",
    )


# ── Remove from pool ──────────────────────────────────────────────────────────

@router.delete("/{candidate_id}/remove")
async def remove_from_pool(
    candidate_id: int,
    current_user=Depends(get_current_user),
):
    """Remove a candidate from the talent pool."""
    return await TalentPoolService.remove_from_pool(
        org_id=current_user["org_id"],
        candidate_id=candidate_id,
    )
