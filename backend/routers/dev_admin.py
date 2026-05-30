"""
routers/dev_admin.py – Developer tools for local testing.
ONLY ENABLED WHEN settings.DEV_MODE is True.
Public routes — no auth required. DEV_MODE=False makes all routes return 404.
Route: /api/v1/dev/*
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, EmailStr

from backend.config import settings
from backend.db.connection import get_connection
from backend.utils.security import hash_password, create_access_token

router = APIRouter(prefix="/api/v1/dev", tags=["Dev Tools"])
logger = logging.getLogger(__name__)


def _require_dev_mode():
    """Guard: raises 404 in production so this endpoint is invisible."""
    if not getattr(settings, 'DEV_MODE', True):
        raise HTTPException(status_code=404, detail="Not found")


# ── Orgs ──────────────────────────────────────────────────────────────────────

@router.get("/orgs")
async def list_orgs():
    """List all organizations."""
    _require_dev_mode()
    async with get_connection() as conn:
        rows = await conn.fetch(
            "SELECT id, name, slug, created_at FROM organizations ORDER BY created_at DESC"
        )
    return {"orgs": [dict(r) for r in rows]}


# ── DB Info ───────────────────────────────────────────────────────────────────

@router.get("/db-stats")
async def db_stats(org_id: Optional[int] = Query(None)):
    """Row counts for all main tables. Scoped to org_id if provided, else all orgs."""
    _require_dev_mode()
    async with get_connection() as conn:
        if org_id:
            tables = {
                "chat_sessions": ("SELECT COUNT(*) FROM chat_sessions WHERE org_id = $1", org_id),
                "positions": ("SELECT COUNT(*) FROM positions WHERE org_id = $1", org_id),
                "candidates": ("SELECT COUNT(*) FROM candidates WHERE org_id = $1", org_id),
                "candidate_applications": ("SELECT COUNT(*) FROM candidate_applications WHERE org_id = $1", org_id),
                "pipeline_events": ("SELECT COUNT(*) FROM pipeline_events WHERE org_id = $1", org_id),
                "notifications": ("SELECT COUNT(*) FROM notifications WHERE org_id = $1", org_id),
                "departments": ("SELECT COUNT(*) FROM departments WHERE org_id = $1", org_id),
                "users": ("SELECT COUNT(*) FROM users WHERE org_id = $1", org_id),
            }
            counts = {}
            for table, (sql, param) in tables.items():
                try:
                    counts[table] = await conn.fetchval(sql, param)
                except Exception as e:
                    counts[table] = f"error: {str(e)}"
        else:
            tables_global = {
                "organizations": "SELECT COUNT(*) FROM organizations",
                "users": "SELECT COUNT(*) FROM users",
                "departments": "SELECT COUNT(*) FROM departments",
                "positions": "SELECT COUNT(*) FROM positions",
                "candidates": "SELECT COUNT(*) FROM candidates",
                "candidate_applications": "SELECT COUNT(*) FROM candidate_applications",
                "chat_sessions": "SELECT COUNT(*) FROM chat_sessions",
                "interviews": "SELECT COUNT(*) FROM interviews",
                "pipeline_events": "SELECT COUNT(*) FROM pipeline_events",
                "notifications": "SELECT COUNT(*) FROM notifications",
            }
            counts = {}
            for table, sql in tables_global.items():
                try:
                    counts[table] = await conn.fetchval(sql)
                except Exception as e:
                    counts[table] = f"error: {str(e)}"
    return {"org_id": org_id, "table_counts": counts}


@router.get("/chat-sessions")
async def list_all_chat_sessions(org_id: Optional[int] = Query(None)):
    """List chat sessions, optionally filtered by org."""
    _require_dev_mode()
    async with get_connection() as conn:
        if org_id:
            rows = await conn.fetch(
                """SELECT id, title, workflow_stage, status, created_at, updated_at
                   FROM chat_sessions WHERE org_id = $1 ORDER BY created_at DESC LIMIT 100""",
                org_id
            )
        else:
            rows = await conn.fetch(
                """SELECT cs.id, cs.title, cs.workflow_stage, cs.status, cs.created_at,
                          o.name AS org_name
                   FROM chat_sessions cs
                   JOIN organizations o ON o.id = cs.org_id
                   ORDER BY cs.created_at DESC LIMIT 100"""
            )
    return {"sessions": [dict(r) for r in rows]}


@router.get("/users")
async def list_all_users(org_id: Optional[int] = Query(None)):
    """List users across all orgs or filtered by org."""
    _require_dev_mode()
    async with get_connection() as conn:
        if org_id:
            rows = await conn.fetch(
                """SELECT u.id, u.name, u.email, u.role, u.department_id, u.is_active,
                          u.created_at, o.name AS org_name, o.id AS org_id
                   FROM users u
                   JOIN organizations o ON o.id = u.org_id
                   WHERE u.org_id = $1
                   ORDER BY u.created_at DESC""",
                org_id
            )
        else:
            rows = await conn.fetch(
                """SELECT u.id, u.name, u.email, u.role, u.department_id, u.is_active,
                          u.created_at, o.name AS org_name, o.id AS org_id
                   FROM users u
                   JOIN organizations o ON o.id = u.org_id
                   ORDER BY u.created_at DESC LIMIT 200"""
            )
    return {"users": [dict(r) for r in rows]}


# ── User Creation ─────────────────────────────────────────────────────────────

class CreateUserBody(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "hr"
    org_id: Optional[int] = None
    org_name: Optional[str] = None   # create new org if org_id not given
    department_id: Optional[int] = None


@router.post("/create-user")
async def create_user(body: CreateUserBody):
    """
    Create a user for testing. Optionally creates a new org.
    Either org_id or org_name must be provided.
    """
    _require_dev_mode()
    valid_roles = ("org_head", "dept_admin", "hr", "team_lead", "platform_admin")
    if body.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"role must be one of: {', '.join(valid_roles)}")

    # platform_admin: auto-place in internal "AI Talent Lab" platform org
    is_platform_admin = body.role == "platform_admin"
    if not is_platform_admin and not body.org_id and not body.org_name:
        raise HTTPException(status_code=400, detail="Provide org_id or org_name")

    org_name: str = body.org_name or ("AI Talent Lab" if is_platform_admin else "")

    hashed = hash_password(body.password)

    async with get_connection() as conn:
        # Resolve or create org
        if body.org_id:
            org_id = body.org_id
        else:
            slug = org_name.lower().replace(" ", "-")
            existing = await conn.fetchrow("SELECT id FROM organizations WHERE slug = $1", slug)
            if existing:
                org_id = existing["id"]
            else:
                org_id = await conn.fetchval(
                    """INSERT INTO organizations (name, slug, created_at, updated_at)
                       VALUES ($1, $2, NOW(), NOW()) RETURNING id""",
                    org_name, slug
                )
                logger.info(f"[DEV] Created org '{org_name}' id={org_id}")

        # Check email uniqueness within org
        exists = await conn.fetchval(
            "SELECT id FROM users WHERE email = $1 AND org_id = $2",
            body.email, org_id
        )
        if exists:
            raise HTTPException(status_code=409, detail=f"User {body.email} already exists in this org")

        user_id = await conn.fetchval(
            """INSERT INTO users (name, email, password_hash, role, org_id, department_id,
                                  is_active, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW()) RETURNING id""",
            body.name, body.email, hashed, body.role, org_id, body.department_id
        )

    logger.info(f"[DEV] Created user id={user_id} email={body.email} role={body.role} org={org_id}")
    return {"ok": True, "user_id": user_id, "org_id": org_id}


# ── Token Generation (Login As) ───────────────────────────────────────────────

@router.post("/token/{user_id}")
async def generate_user_token(user_id: int):
    """
    Generate a valid JWT for any user. Use to test role-specific views
    without a real login flow. Paste the token or use the 'Login as' button.
    """
    _require_dev_mode()
    async with get_connection() as conn:
        user = await conn.fetchrow(
            "SELECT id, org_id, role, department_id FROM users WHERE id = $1",
            user_id
        )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    token = create_access_token(
        user_id=user["id"],
        org_id=user["org_id"],
        role=user["role"],
        department_id=user["department_id"],
    )
    return {"token": token, "user_id": user_id, "role": user["role"]}


# ── Reset Operations ──────────────────────────────────────────────────────────

@router.delete("/reset/chat-sessions")
async def reset_chat_sessions(org_id: Optional[int] = Query(None, description="Org to reset, or None for all")):
    """Hard-delete ALL chat sessions + messages for an org or globally."""
    _require_dev_mode()
    async with get_connection() as conn:
        if org_id:
            result = await conn.execute("DELETE FROM chat_sessions WHERE org_id = $1", org_id)
        else:
            result = await conn.execute("DELETE FROM chat_sessions")
    rows_deleted = int(result.split()[-1]) if result else 0
    logger.warning(f"[DEV] Reset chat_sessions (org {org_id or 'ALL'}) — {rows_deleted} deleted")
    return {"ok": True, "deleted": rows_deleted}


@router.delete("/reset/positions")
async def reset_positions(org_id: Optional[int] = Query(None)):
    """Hard-delete ALL positions (cascade: applications, pipeline events) for an org or globally."""
    _require_dev_mode()
    async with get_connection() as conn:
        if org_id:
            await conn.execute("DELETE FROM candidate_applications WHERE org_id = $1", org_id)
            await conn.execute("DELETE FROM pipeline_events WHERE org_id = $1", org_id)
            await conn.execute("DELETE FROM positions WHERE org_id = $1", org_id)
        else:
            await conn.execute("DELETE FROM candidate_applications")
            await conn.execute("DELETE FROM pipeline_events")
            await conn.execute("DELETE FROM positions")
    logger.warning(f"[DEV] Reset positions for org {org_id or 'ALL'}")
    return {"ok": True}


@router.delete("/reset/notifications")
async def reset_notifications(org_id: Optional[int] = Query(None)):
    """Clear all notifications for an org or globally."""
    _require_dev_mode()
    async with get_connection() as conn:
        if org_id:
            await conn.execute("DELETE FROM notifications WHERE org_id = $1", org_id)
        else:
            await conn.execute("DELETE FROM notifications")
    return {"ok": True}


@router.delete("/reset/all")
async def reset_all_org_data(org_id: Optional[int] = Query(None)):
    """
    Nuclear: delete ALL business data for an org or globally.
    If org_id is provided, keeps: org, users, departments.
    If org_id is absent (global), deletes EVERYTHING (orgs, users, departments).
    """
    _require_dev_mode()
    async with get_connection() as conn:
        if org_id:
            await conn.execute("DELETE FROM notifications WHERE org_id = $1", org_id)
            await conn.execute("DELETE FROM pipeline_events WHERE org_id = $1", org_id)
            await conn.execute("DELETE FROM candidate_applications WHERE org_id = $1", org_id)
            await conn.execute("DELETE FROM candidates WHERE org_id = $1", org_id)
            await conn.execute("DELETE FROM positions WHERE org_id = $1", org_id)
            await conn.execute("DELETE FROM chat_sessions WHERE org_id = $1", org_id)
            msg = "Org data cleared. Org, users, and departments preserved."
        else:
            await conn.execute("TRUNCATE TABLE organizations CASCADE")
            msg = "Global data cleared. ALL orgs, users, and departments wiped."
    logger.warning(f"[DEV] Full reset for org {org_id or 'ALL'}")
    return {"ok": True, "message": msg}


# ── Session Restore ───────────────────────────────────────────────────────────

@router.patch("/chat-sessions/{session_id}/restore")
async def restore_deleted_session(session_id: str):
    """Restore a soft-deleted session (set status back to 'active')."""
    _require_dev_mode()
    async with get_connection() as conn:
        result = await conn.execute(
            "UPDATE chat_sessions SET status = 'active', updated_at = NOW() WHERE id = $1",
            session_id
        )
    return {"ok": result == "UPDATE 1"}
