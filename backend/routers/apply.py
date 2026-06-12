"""
routers/apply.py – Public candidate apply chat endpoints.
No auth — secured by signed JWT magic link token.
All routes under /api/v1/apply/
"""
import logging

from fastapi import APIRouter, HTTPException, UploadFile, File, Request
from pydantic import BaseModel
from typing import Optional

from backend.services.apply_service import ApplyService
from backend.services.resume_service import extract_resume_text, validate_resume_file
from backend.services.gdpr_service import GDPRService
from backend.middleware.rate_limiter import limiter

router = APIRouter(prefix="/api/v1/apply", tags=["Apply"])
logger = logging.getLogger(__name__)


class SendMessageRequest(BaseModel):
    message: str


class ConsentRequest(BaseModel):
    consented: bool


# ── GDPR consent (before chat starts) ────────────────────────────────────────

@router.post("/{token}/consent")
@limiter.limit("20/minute")
async def record_apply_consent(token: str, body: ConsentRequest, request: Request):
    """
    Record candidate consent before the apply chat begins.
    Called when candidate clicks "I Agree & Continue" on the consent screen.
    No auth required — secured by the magic link token.
    """
    context = await ApplyService.verify_and_load(token)
    if not context.get("valid"):
        raise HTTPException(status_code=400, detail={"code": "TOKEN_INVALID", "message": "Invalid link"})

    if not body.consented:
        return {"ok": True, "consented": False}

    candidate_id = context.get("candidate", {}).get("id")
    application_id = context.get("application_id")
    org_id = context.get("org", {}).get("id")

    if not candidate_id or not org_id:
        raise HTTPException(status_code=400, detail={"code": "CONTEXT_ERROR", "message": "Could not identify application"})

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    await GDPRService.record_bulk_consent(
        org_id=org_id,
        candidate_id=candidate_id,
        application_id=application_id,
        consent_types=["data_processing", "ai_analysis", "communication"],
        ip_address=ip,
        user_agent=ua,
    )

    # Stamp consent timestamp on the application
    from backend.db.connection import get_connection
    from backend.db.repositories.applications import ApplicationRepository
    async with get_connection() as conn:
        await ApplicationRepository.record_consent(conn, application_id, org_id)

    return {"ok": True, "consented": True}


# ── Verify token & load context ───────────────────────────────────────────────

@router.get("/{token}")
@limiter.limit("30/minute")
async def verify_token(token: str, request: Request):
    """
    Verify the magic link token and return full apply page context.
    Called when candidate opens the magic link URL.
    """
    context = await ApplyService.verify_and_load(token)
    if not context.get("valid"):
        expired = context.get("expired", False)
        raise HTTPException(
            status_code=410 if expired else 400,
            detail={"code": "TOKEN_EXPIRED" if expired else "TOKEN_INVALID",
                    "message": context.get("error", "Invalid link")}
        )
    return context


# ── Send candidate message ────────────────────────────────────────────────────

@router.post("/{token}/message")
@limiter.limit("20/minute")
async def send_message(token: str, body: SendMessageRequest, request: Request):
    """
    Process a candidate chat message. Returns AI response and updated state.
    """
    try:
        result = await ApplyService.send_message(token, body.message)
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"code": "INVALID_TOKEN", "message": str(e)})
    except Exception as e:
        logger.error(f"Apply message error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={"code": "SERVER_ERROR",
            "message": "Something went wrong. Please refresh and try again."})

    # Auto-complete application when step reaches completion
    if result.get("completed") and not result.get("not_interested"):
        try:
            await ApplyService.complete_application(token)
        except Exception as e:
            logger.warning(f"Auto-complete failed: {e}")

    return result


# ── Upload resume ─────────────────────────────────────────────────────────────

@router.post("/{token}/upload-resume")
async def upload_resume(token: str, file: UploadFile = File(...)):
    """
    Handle resume upload. Extracts text, stores in DB, discards file bytes.
    Per project rule: Never persist resume files to disk.
    """
    # Read file bytes
    content = await file.read()
    filename = file.filename or "resume"

    # Validate
    error = validate_resume_file(filename, len(content))
    if error:
        raise HTTPException(status_code=400, detail={"code": "INVALID_FILE", "message": error})

    # Extract text
    extraction = await extract_resume_text(content, filename)
    if not extraction or not extraction["text"].strip():
        raise HTTPException(
            status_code=422,
            detail={"code": "EXTRACTION_FAILED",
                    "message": "Could not extract text from your resume. Please try a different file."}
        )

    resume_text = extraction["text"]
    resume_links = extraction["links"]

    # Validate token and store
    try:
        result = await ApplyService.handle_resume_upload(token, resume_text, filename, resume_links)
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"code": "INVALID_TOKEN", "message": str(e)})

    return result


# ── Upload video introduction (optional) ─────────────────────────────────────

@router.post("/{token}/upload-video")
async def upload_video_intro(token: str, file: UploadFile = File(...)):
    """
    Accept an optional 60-second video intro from the candidate.
    Stores metadata only (no disk persistence) — URL stored after upload to object storage.
    For now: stores the filename + duration estimate; actual S3/R2 upload happens via
    a separate background task once object storage is configured.
    """
    context = await ApplyService.verify_and_load(token)
    if not context.get("valid"):
        raise HTTPException(status_code=400, detail={"code": "TOKEN_INVALID", "message": "Invalid link"})

    filename = file.filename or "video_intro"
    content_type = file.content_type or ""
    if not content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail={
            "code": "INVALID_FILE_TYPE",
            "message": "Please upload a video file (MP4, MOV, WebM).",
        })

    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > 100:
        raise HTTPException(status_code=400, detail={
            "code": "FILE_TOO_LARGE",
            "message": "Video must be under 100 MB.",
        })

    import os
    import time
    app_id = context.get("application_id")
    
    # Save locally to uploads/videos/
    upload_dir = os.path.join(os.getcwd(), "uploads", "videos", str(app_id))
    os.makedirs(upload_dir, exist_ok=True)
    
    safe_filename = f"{int(time.time())}_{filename.replace(' ', '_')}"
    file_path = os.path.join(upload_dir, safe_filename)
    
    with open(file_path, "wb") as f:
        f.write(content)

    video_url = f"/uploads/videos/{app_id}/{safe_filename}"

    from backend.db.connection import get_connection
    from backend.db.repositories.applications import ApplicationRepository
    async with get_connection() as conn:
        await ApplicationRepository.record_video_intro(conn, app_id, video_url)

    return {
        "ok": True,
        "response": "Thanks for sharing your intro! The hiring team will review it alongside your application.",
        "step": "completion",
    }


# ── Complete application (manual) ─────────────────────────────────────────────

@router.post("/{token}/complete")
async def complete_application(token: str):
    """
    Manually mark an application as complete.
    Called if the auto-complete didn't fire or for retries.
    """
    try:
        result = await ApplyService.complete_application(token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"code": "INVALID_TOKEN", "message": str(e)})
    return result


# ── Application status (candidate portal) ────────────────────────────────────

@router.get("/{token}/status")
async def get_application_status(token: str):
    """
    Return candidate-safe application status.
    Used by the candidate status portal page.
    Does NOT expose internal scoring, notes, or recruiter data.
    """
    context = await ApplyService.verify_and_load(token)
    if not context.get("valid"):
        expired = context.get("expired", False)
        raise HTTPException(
            status_code=410 if expired else 400,
            detail={"code": "TOKEN_EXPIRED" if expired else "TOKEN_INVALID",
                    "message": context.get("error", "Invalid link")}
        )

    from backend.db.connection import get_connection
    from backend.db.repositories.applications import ApplicationRepository
    import json as _json

    app_id = context.get("application_id")
    org_id = context.get("candidate", {}).get("id")

    async with get_connection() as conn:
        app_row = await ApplicationRepository.get_application(conn, app_id)
        if not app_row:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Application not found"})

        # Get interview schedule if any (without internal details)
        interviews = await conn.fetch(
            """
            SELECT round_name, round_type, scheduled_at, status, duration_minutes
            FROM interviews
            WHERE application_id=$1
            ORDER BY round_number
            """,
            app_id,
        )

    # Map internal statuses to candidate-friendly labels
    status_map = {
        'sourced': 'Under Review',
        'magic_link_sent': 'Under Review',
        'applied': 'Application Received',
        'screening': 'Under Review',
        'interview': 'Interview Stage',
        'offer': 'Offer Stage',
        'hired': 'Hired',
        'rejected': 'Not Selected',
    }

    return {
        "position": {
            "role_name": app_row["role_name"],
            "location": app_row["location"],
            "work_type": app_row["work_type"],
        },
        "org_name": app_row["org_name"],
        "status": status_map.get(app_row["status"], "Under Review"),
        "internal_status": app_row["status"],
        "applied_at": app_row["applied_at"].isoformat() if app_row["applied_at"] else None,
        "interviews": [
            {
                "round": i["round_name"] or f"Round {idx+1}",
                "type": i["round_type"],
                "scheduled_at": i["scheduled_at"].isoformat() if i["scheduled_at"] else None,
                "status": i["status"],
                "duration_minutes": i["duration_minutes"],
            }
            for idx, i in enumerate(interviews)
        ],
    }

