"""
routers/apply.py – Public candidate apply chat endpoints.
No auth — secured by signed JWT magic link token.
All routes under /api/v1/apply/
"""
import logging

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional

from backend.services.apply_service import ApplyService
from backend.services.resume_service import extract_resume_text, validate_resume_file

router = APIRouter(prefix="/api/v1/apply", tags=["Apply"])
logger = logging.getLogger(__name__)


class SendMessageRequest(BaseModel):
    message: str


# ── Verify token & load context ───────────────────────────────────────────────

@router.get("/{token}")
async def verify_token(token: str):
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
async def send_message(token: str, body: SendMessageRequest):
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
