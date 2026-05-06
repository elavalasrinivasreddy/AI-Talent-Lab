"""
routers/dev_admin.py – Developer tools for local testing.
ONLY ENABLED WHEN settings.DEV_MODE is True.
Provides DB seeding, data reset, and diagnostics for developers.
Route: /api/v1/dev/*
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.config import settings
from backend.dependencies import get_current_user
from backend.db.connection import get_connection

router = APIRouter(prefix="/api/v1/dev", tags=["Dev Tools"])
logger = logging.getLogger(__name__)


def _require_dev_mode():
    """Guard: raises 404 in production so this endpoint is invisible."""
    if not getattr(settings, 'DEV_MODE', True):
        raise HTTPException(status_code=404, detail="Not found")


# ── DB Info ───────────────────────────────────────────────────────────────────

@router.get("/db-stats")
async def db_stats(user=Depends(get_current_user)):
    """Row counts for all main tables in this org."""
    _require_dev_mode()
    org_id = user["org_id"]
    async with get_connection() as conn:
        tables = {
            "chat_sessions": "SELECT COUNT(*) FROM chat_sessions WHERE org_id = $1",
            "positions": "SELECT COUNT(*) FROM positions WHERE org_id = $1",
            "candidates": "SELECT COUNT(*) FROM candidates WHERE org_id = $1",
            "candidate_applications": "SELECT COUNT(*) FROM candidate_applications WHERE org_id = $1",
            "pipeline_events": "SELECT COUNT(*) FROM pipeline_events WHERE org_id = $1",
            "notifications": "SELECT COUNT(*) FROM notifications WHERE org_id = $1",
            "departments": "SELECT COUNT(*) FROM departments WHERE org_id = $1",
            "users": "SELECT COUNT(*) FROM users WHERE org_id = $1",
        }
        counts = {}
        for table, sql in tables.items():
            try:
                counts[table] = await conn.fetchval(sql, org_id)
            except Exception as e:
                counts[table] = f"error: {str(e)}"
    return {"org_id": org_id, "table_counts": counts}


@router.get("/chat-sessions")
async def list_all_chat_sessions(user=Depends(get_current_user)):
    """List ALL chat sessions for this org (including deleted)."""
    _require_dev_mode()
    async with get_connection() as conn:
        rows = await conn.fetch(
            """SELECT id, title, workflow_stage, status, created_at, updated_at
               FROM chat_sessions WHERE org_id = $1 ORDER BY created_at DESC""",
            user["org_id"]
        )
    return {"sessions": [dict(r) for r in rows]}


@router.get("/users")
async def list_org_users(user=Depends(get_current_user)):
    """List all users in this org for testing."""
    _require_dev_mode()
    async with get_connection() as conn:
        rows = await conn.fetch(
            """SELECT id, name, email, role, department_id, is_active, created_at
               FROM users WHERE org_id = $1 ORDER BY created_at DESC""",
            user["org_id"]
        )
    return {"users": [dict(r) for r in rows]}


# ── Reset Operations ──────────────────────────────────────────────────────────

@router.delete("/reset/chat-sessions")
async def reset_chat_sessions(user=Depends(get_current_user)):
    """
    Hard-delete ALL chat sessions + messages for this org.
    Use during testing to start fresh.
    """
    _require_dev_mode()
    async with get_connection() as conn:
        # Cascade deletes messages too (FK ON DELETE CASCADE)
        result = await conn.execute(
            "DELETE FROM chat_sessions WHERE org_id = $1", user["org_id"]
        )
    rows_deleted = int(result.split()[-1]) if result else 0
    logger.warning(f"[DEV] Reset chat_sessions for org {user['org_id']} — {rows_deleted} deleted")
    return {"ok": True, "deleted": rows_deleted}


@router.delete("/reset/positions")
async def reset_positions(user=Depends(get_current_user)):
    """Hard-delete ALL positions (and cascade: applications, pipeline events) for this org."""
    _require_dev_mode()
    async with get_connection() as conn:
        await conn.execute(
            "DELETE FROM candidate_applications WHERE org_id = $1", user["org_id"]
        )
        await conn.execute(
            "DELETE FROM pipeline_events WHERE org_id = $1", user["org_id"]
        )
        result = await conn.execute(
            "DELETE FROM positions WHERE org_id = $1", user["org_id"]
        )
    logger.warning(f"[DEV] Reset positions for org {user['org_id']}")
    return {"ok": True}


@router.delete("/reset/notifications")
async def reset_notifications(user=Depends(get_current_user)):
    """Clear all notifications for this org."""
    _require_dev_mode()
    async with get_connection() as conn:
        result = await conn.execute(
            "DELETE FROM notifications WHERE org_id = $1", user["org_id"]
        )
    return {"ok": True}


@router.delete("/reset/all")
async def reset_all_org_data(user=Depends(get_current_user)):
    """
    Nuclear option: delete ALL business data for this org.
    Keeps: org, users, departments. Deletes: positions, candidates, sessions, notifications.
    """
    _require_dev_mode()
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    async with get_connection() as conn:
        # Order matters for FK constraints
        await conn.execute("DELETE FROM notifications WHERE org_id = $1", user["org_id"])
        await conn.execute("DELETE FROM pipeline_events WHERE org_id = $1", user["org_id"])
        await conn.execute("DELETE FROM candidate_applications WHERE org_id = $1", user["org_id"])
        await conn.execute("DELETE FROM candidates WHERE org_id = $1", user["org_id"])
        await conn.execute("DELETE FROM positions WHERE org_id = $1", user["org_id"])
        await conn.execute("DELETE FROM chat_sessions WHERE org_id = $1", user["org_id"])
    logger.warning(f"[DEV] Full reset for org {user['org_id']} by user {user['user_id']}")
    return {"ok": True, "message": "All org data cleared. Org, users, and departments preserved."}


# ── Restore Deleted Sessions ──────────────────────────────────────────────────

@router.patch("/chat-sessions/{session_id}/restore")
async def restore_deleted_session(session_id: str, user=Depends(get_current_user)):
    """Restore a soft-deleted session (set status back to 'active')."""
    _require_dev_mode()
    async with get_connection() as conn:
        result = await conn.execute(
            """UPDATE chat_sessions SET status = 'active', updated_at = NOW()
               WHERE id = $1 AND org_id = $2""",
            session_id, user["org_id"]
        )
    return {"ok": result == "UPDATE 1"}
