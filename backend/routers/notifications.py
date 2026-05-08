"""
routers/notifications.py – In-app notification endpoints.
All routes under /api/v1/notifications/
"""
import logging

from fastapi import APIRouter, Depends

from backend.dependencies import get_current_user
from backend.db.connection import get_connection
from backend.db.repositories.notifications import NotificationRepository

router = APIRouter(prefix="/api/v1/notifications", tags=["Notifications"])
logger = logging.getLogger(__name__)


@router.get("/")
async def list_notifications(
    current_user=Depends(get_current_user),
):
    """Get recent notifications for the current user (unread first, limit 20)."""
    user_id = current_user["user_id"]   # fixed: was current_user["id"]
    org_id = current_user["org_id"]
    async with get_connection() as conn:
        notifications = await NotificationRepository.list_for_user(
            conn, user_id, org_id
        )
        unread_count = await NotificationRepository.get_unread_count(
            conn, user_id, org_id
        )
    return {"notifications": notifications, "unread_count": unread_count}


@router.patch("/{notification_id}/read")
async def mark_read(
    notification_id: int,
    current_user=Depends(get_current_user),
):
    """Mark a single notification as read."""
    user_id = current_user["user_id"]   # fixed: was current_user["id"]
    org_id = current_user["org_id"]
    async with get_connection() as conn:
        await NotificationRepository.mark_read(
            conn, notification_id, user_id, org_id
        )
    return {"ok": True}


@router.patch("/read-all")
async def mark_all_read(
    current_user=Depends(get_current_user),
):
    """Mark all notifications as read for the current user."""
    user_id = current_user["user_id"]   # fixed: was current_user["id"]
    org_id = current_user["org_id"]
    async with get_connection() as conn:
        await NotificationRepository.mark_all_read(
            conn, user_id, org_id
        )
    return {"ok": True}
