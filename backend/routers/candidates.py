"""
routers/candidates.py – Candidate management endpoints.
All routes under /api/v1/candidates/
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.dependencies import get_current_user
from backend.services.candidate_service import CandidateService

router = APIRouter(prefix="/api/v1/candidates", tags=["Candidates"])
logger = logging.getLogger(__name__)


@router.get("/position/{position_id}")
async def list_candidates_for_position(
    position_id: int,
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    current_user=Depends(get_current_user),
):
    """List all candidates for a position. Supports status filter and pagination."""
    candidates = await CandidateService.list_for_position(
        position_id=position_id,
        org_id=current_user["org_id"],
        status=status,
        page=page,
    )
    return {"candidates": candidates, "page": page}


@router.get("/{candidate_id}")
async def get_candidate(
    candidate_id: int,
    position_id: Optional[int] = Query(None),
    current_user=Depends(get_current_user),
):
    """Get full candidate detail. Optionally include application data for a position."""
    candidate = await CandidateService.get_candidate_detail(
        candidate_id=candidate_id,
        position_id=position_id,
        org_id=current_user["org_id"],
    )
    if not candidate:
        raise HTTPException(status_code=404, detail={
            "error": {"code": "CANDIDATE_NOT_FOUND", "message": "Candidate not found", "details": None}
        })
    return candidate


@router.get("/{candidate_id}/timeline")
async def get_candidate_timeline(
    candidate_id: int,
    position_id: Optional[int] = Query(None),
    current_user=Depends(get_current_user),
):
    """Full pipeline event timeline for a candidate."""
    timeline = await CandidateService.get_timeline(
        candidate_id=candidate_id,
        org_id=current_user["org_id"],
        position_id=position_id,
    )
    return {"events": timeline}


@router.patch("/{candidate_id}/status")
async def update_candidate_status(
    candidate_id: int,
    body: dict,
    current_user=Depends(get_current_user),
):
    """Update a candidate's pipeline status for a specific position."""
    new_status = body.get("status")
    application_id = body.get("application_id")
    position_id = body.get("position_id")

    if not all([new_status, application_id, position_id]):
        raise HTTPException(status_code=422, detail={
            "error": {
                "code": "MISSING_FIELDS",
                "message": "status, application_id, and position_id are required",
                "details": None
            }
        })

    try:
        app = await CandidateService.update_status(
            application_id=application_id,
            org_id=current_user["org_id"],
            new_status=new_status,
            user_id=current_user["id"],
            candidate_id=candidate_id,
            position_id=position_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail={
            "error": {"code": "INVALID_STATUS", "message": str(e), "details": None}
        })
    return app


@router.post("/{candidate_id}/mark-selected")
async def mark_candidate_selected(
    candidate_id: int,
    body: dict,
    current_user=Depends(get_current_user),
):
    """Mark candidate as selected (final HR action)."""
    application_id = body.get("application_id")
    position_id = body.get("position_id")
    if not application_id or not position_id:
        raise HTTPException(status_code=422, detail={
            "error": {"code": "MISSING_FIELDS",
                      "message": "application_id and position_id are required", "details": None}
        })
    result = await CandidateService.mark_selected(
        candidate_id=candidate_id,
        application_id=application_id,
        position_id=position_id,
        org_id=current_user["org_id"],
        user_id=current_user["id"],
    )
    return result


@router.get("/{candidate_id}/tags")
async def get_tags(
    candidate_id: int,
    current_user=Depends(get_current_user),
):
    """List all tags for a candidate."""
    from backend.db.connection import get_connection
    from backend.db.repositories.candidates import CandidateRepository
    async with get_connection() as conn:
        tags = await CandidateRepository.get_tags(conn, candidate_id, current_user["org_id"])
    return {"tags": tags}


@router.post("/{candidate_id}/tags")
async def add_tag(
    candidate_id: int,
    body: dict,
    current_user=Depends(get_current_user),
):
    """Add a tag to a candidate."""
    tag = body.get("tag", "").strip()
    if not tag:
        raise HTTPException(status_code=422, detail={
            "error": {"code": "MISSING_TAG", "message": "tag field is required", "details": None}
        })
    tags = await CandidateService.add_tag(
        candidate_id=candidate_id,
        org_id=current_user["org_id"],
        tag=tag,
        user_id=current_user["id"],
    )
    return {"tags": tags}


@router.delete("/{candidate_id}/tags/{tag}")
async def remove_tag(
    candidate_id: int,
    tag: str,
    current_user=Depends(get_current_user),
):
    """Remove a tag from a candidate."""
    tags = await CandidateService.remove_tag(
        candidate_id=candidate_id,
        org_id=current_user["org_id"],
        tag=tag,
    )
    return {"tags": tags}


@router.post("/send-outreach")
async def send_outreach(
    body: dict,
    current_user=Depends(get_current_user),
):
    """Send outreach emails with magic links to a list of application IDs."""
    application_ids = body.get("application_ids", [])
    if not application_ids:
        raise HTTPException(status_code=422, detail={
            "error": {"code": "NO_APPLICATIONS",
                      "message": "application_ids cannot be empty", "details": None}
        })
    try:
        from backend.tasks.email_outreach import send_outreach_batch
        task = send_outreach_batch.delay(application_ids, current_user["org_id"])
        return {"queued": True, "task_id": task.id, "count": len(application_ids)}
    except Exception as e:
        logger.error(f"Outreach task failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={
            "error": {"code": "OUTREACH_FAILED",
                      "message": "Failed to queue outreach. Please try again.", "details": None}
        })


@router.post("/{candidate_id}/generate-apply-link")
async def generate_apply_link(
    candidate_id: int,
    body: dict,
    current_user=Depends(get_current_user),
):
    """
    Generate a magic apply link for a specific candidate application.
    Body: { position_id: int }
    Returns: { token, apply_url }
    """
    position_id = body.get("position_id")
    if not position_id:
        raise HTTPException(status_code=422, detail={
            "error": {"code": "MISSING_POSITION", "message": "position_id required", "details": None}
        })

    from backend.db.connection import get_connection
    from backend.db.repositories.candidates import CandidateRepository
    from backend.services.apply_service import generate_apply_token
    from backend.config import settings

    async with get_connection() as conn:
        app = await CandidateRepository.get_application_by_candidate_position(
            conn, candidate_id, position_id
        )
        if not app or app.get("org_id") != current_user["org_id"]:
            raise HTTPException(status_code=404, detail={
                "error": {"code": "NOT_FOUND", "message": "Application not found", "details": None}
            })

        token = generate_apply_token(app["id"], candidate_id, current_user["org_id"])

        # Store token on application
        await conn.execute(
            "UPDATE candidate_applications SET magic_link_token=$1, magic_link_sent_at=NOW() WHERE id=$2",
            token, app["id"]
        )

    apply_url = f"{settings.FRONTEND_URL}/apply/{token}"
    return {"token": token, "apply_url": apply_url, "expires_in_hours": 72}

