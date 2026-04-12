"""
routers/notifications.py – Notifications API for Bell icon and session updates
"""
from fastapi import APIRouter, Depends, HTTPException
from backend.routers.auth import get_current_user
from backend.db.database import (
    get_unread_notifications, mark_notification_read, mark_session_notifications_read
)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
async def get_notifications(user: dict = Depends(get_current_user)):
    """Get all unread notifications for the user's organization."""
    # We can fetch all org notifications, or filter by user_id if we want personal notifications
    notifications = get_unread_notifications(org_id=user["org_id"])
    return {"notifications": notifications, "count": len(notifications)}


@router.patch("/{notification_id}/read")
async def mark_as_read(notification_id: int, user: dict = Depends(get_current_user)):
    """Mark a specific notification as read."""
    success = mark_notification_read(notification_id, org_id=user["org_id"])
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}


@router.patch("/session/{session_id}/read")
async def mark_session_read(session_id: str, user: dict = Depends(get_current_user)):
    """Mark all notifications for a specific chat session as read."""
    count = mark_session_notifications_read(session_id, org_id=user["org_id"])
    return {"success": True, "marked_count": count}
