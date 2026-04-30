"""
routers/positions.py – Position CRUD and search endpoints.
All routes under /api/v1/positions/
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.dependencies import get_current_user
from backend.services.position_service import PositionService

router = APIRouter(prefix="/api/v1/positions", tags=["Positions"])
logger = logging.getLogger(__name__)


@router.get("/")
async def list_positions(
    department_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    current_user=Depends(get_current_user),
):
    """List all positions for the org with optional filters."""
    positions = await PositionService.list_positions(
        org_id=current_user["org_id"],
        department_id=department_id,
        status=status,
        page=page,
    )
    return {"positions": positions, "page": page}


@router.get("/{position_id}")
async def get_position(
    position_id: int,
    current_user=Depends(get_current_user),
):
    """Get full position detail with pipeline stats and JD variants."""
    pos = await PositionService.get_position(position_id, current_user["org_id"])
    if not pos:
        raise HTTPException(status_code=404, detail={
            "error": {"code": "POSITION_NOT_FOUND", "message": "Position not found", "details": None}
        })
    return pos


@router.patch("/{position_id}")
async def update_position(
    position_id: int,
    body: dict,
    current_user=Depends(get_current_user),
):
    """Update position settings (headcount, priority, deadline, etc.)."""
    pos = await PositionService.update_position(
        position_id=position_id,
        org_id=current_user["org_id"],
        user_id=current_user["id"],
        data=body,
    )
    if not pos:
        raise HTTPException(status_code=404, detail={
            "error": {"code": "POSITION_NOT_FOUND", "message": "Position not found", "details": None}
        })
    return pos


@router.patch("/{position_id}/status")
async def update_position_status(
    position_id: int,
    body: dict,
    current_user=Depends(get_current_user),
):
    """Change position status (open, on_hold, closed, archived)."""
    new_status = body.get("status")
    if not new_status:
        raise HTTPException(status_code=422, detail={
            "error": {"code": "MISSING_STATUS", "message": "status field is required", "details": None}
        })
    try:
        pos = await PositionService.update_status(
            position_id=position_id,
            org_id=current_user["org_id"],
            user_id=current_user["id"],
            new_status=new_status,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail={
            "error": {"code": "INVALID_STATUS", "message": str(e), "details": None}
        })
    if not pos:
        raise HTTPException(status_code=404, detail={
            "error": {"code": "POSITION_NOT_FOUND", "message": "Position not found", "details": None}
        })
    return pos


@router.post("/{position_id}/search-now")
async def trigger_search_now(
    position_id: int,
    current_user=Depends(get_current_user),
):
    """Trigger an immediate candidate search for this position via Celery."""
    pos = await PositionService.get_position(position_id, current_user["org_id"])
    if not pos:
        raise HTTPException(status_code=404, detail={
            "error": {"code": "POSITION_NOT_FOUND", "message": "Position not found", "details": None}
        })
    result = await PositionService.trigger_search_now(
        position_id=position_id,
        org_id=current_user["org_id"],
        department_id=pos["department_id"],
        user_id=current_user["id"],
    )
    return result


@router.get("/{position_id}/interview-kit")
async def get_interview_kit(
    position_id: int,
    current_user=Depends(get_current_user),
):
    """Get the AI-generated interview kit for this position."""
    kit = await PositionService.get_interview_kit(position_id, current_user["org_id"])
    if not kit:
        raise HTTPException(status_code=404, detail={
            "error": {
                "code": "KIT_NOT_FOUND",
                "message": "Interview kit not yet generated. Use POST /generate to create one.",
                "details": None
            }
        })
    return kit


@router.post("/{position_id}/interview-kit/generate")
async def generate_interview_kit(
    position_id: int,
    current_user=Depends(get_current_user),
):
    """Generate or regenerate the AI interview kit for this position."""
    try:
        kit = await PositionService.generate_interview_kit(
            position_id=position_id,
            org_id=current_user["org_id"],
            user_id=current_user["id"],
        )
        return kit
    except ValueError as e:
        raise HTTPException(status_code=404, detail={
            "error": {"code": "POSITION_NOT_FOUND", "message": str(e), "details": None}
        })
    except Exception as e:
        logger.error(f"Interview kit generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={
            "error": {
                "code": "GENERATION_FAILED",
                "message": "Failed to generate interview kit. Please try again.",
                "details": None
            }
        })
