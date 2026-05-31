"""
routers/copilot.py – AI Copilot suggestion endpoints.
All routes require authentication.
"""
from fastapi import APIRouter, HTTPException, Depends
from backend.dependencies import get_current_user
from backend.services.copilot_service import CopilotService

router = APIRouter(prefix="/api/v1/copilot", tags=["AI Copilot"])


@router.get("/suggestions")
async def get_suggestions(user=Depends(get_current_user)):
    """Return active copilot suggestions for the current user's org."""
    suggestions = await CopilotService.get_suggestions(user["org_id"], user["user_id"])
    return {"suggestions": suggestions}


@router.patch("/suggestions/{suggestion_id}/dismiss")
async def dismiss_suggestion(suggestion_id: int, user=Depends(get_current_user)):
    """Dismiss a single suggestion."""
    dismissed = await CopilotService.dismiss(suggestion_id, user["org_id"])
    if not dismissed:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Suggestion not found"})
    return {"ok": True}


@router.patch("/suggestions/dismiss-all")
async def dismiss_all_suggestions(user=Depends(get_current_user)):
    """Dismiss all active suggestions for this user."""
    await CopilotService.dismiss_all(user["org_id"], user["user_id"])
    return {"ok": True}


@router.post("/suggestions/{suggestion_id}/execute")
async def execute_suggestion(suggestion_id: int, user=Depends(get_current_user)):
    """Mark a suggestion as dismissed after the user acts on it."""
    await CopilotService.dismiss(suggestion_id, user["org_id"])
    return {"ok": True}
