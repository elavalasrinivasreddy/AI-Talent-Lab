"""
routers/dev_admin.py – Developer tools for local testing.
ONLY ENABLED WHEN settings.DEV_MODE is True.
Public routes — no auth required. DEV_MODE=False makes all routes return 404.
Route: /api/v1/dev/*
"""
import json
import logging
import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, EmailStr

from backend.config import settings
from backend.db.connection import get_admin_connection
from backend.utils.security import hash_password, create_access_token

router = APIRouter(prefix="/api/v1/dev", tags=["Dev Tools"])
logger = logging.getLogger(__name__)


def _require_dev_mode():
    """Guard: raises 404 in production so this endpoint is invisible."""
    if not getattr(settings, 'DEV_MODE', False):
        raise HTTPException(status_code=404, detail="Not found")


# ── Orgs ──────────────────────────────────────────────────────────────────────

@router.get("/orgs")
async def list_orgs():
    """List all organizations."""
    _require_dev_mode()
    async with get_admin_connection() as conn:
        rows = await conn.fetch(
            "SELECT id, name, slug, created_at FROM organizations ORDER BY created_at DESC"
        )
    return {"orgs": [dict(r) for r in rows]}


# ── DB Info ───────────────────────────────────────────────────────────────────

@router.get("/db-stats")
async def db_stats(org_id: Optional[int] = Query(None)):
    """Row counts for all main tables. Scoped to org_id if provided, else all orgs."""
    _require_dev_mode()
    async with get_admin_connection() as conn:
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
    async with get_admin_connection() as conn:
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
    async with get_admin_connection() as conn:
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

    async with get_admin_connection() as conn:
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
                    """INSERT INTO organizations (name, slug, segment, size, created_at)
                       VALUES ($1, $2, 'Technology', 'Mid-Market', NOW()) RETURNING id""",
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
                                  is_active, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, true, NOW()) RETURNING id""",
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
    async with get_admin_connection() as conn:
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
    async with get_admin_connection() as conn:
        if org_id:
            result = await conn.execute("DELETE FROM chat_sessions WHERE org_id = $1", org_id)
        else:
            result = await conn.execute("DELETE FROM chat_sessions")
    rows_deleted = int(result.split()[-1]) if result else 0
    logger.warning(f"[DEV] Reset chat_sessions (org {org_id or 'ALL'}) — {rows_deleted} deleted")
    return {"ok": True, "deleted": rows_deleted}


@router.delete("/reset/positions")
async def reset_positions(org_id: Optional[int] = Query(None)):
    """Hard-delete ALL positions and hire requests (cascade: applications, pipeline events) for an org or globally."""
    _require_dev_mode()
    async with get_admin_connection() as conn:
        if org_id:
            await conn.execute("DELETE FROM candidate_applications WHERE org_id = $1", org_id)
            await conn.execute("DELETE FROM pipeline_events WHERE org_id = $1", org_id)
            await conn.execute("DELETE FROM hire_requests WHERE org_id = $1", org_id)
            await conn.execute("DELETE FROM positions WHERE org_id = $1", org_id)
        else:
            await conn.execute("DELETE FROM candidate_applications")
            await conn.execute("DELETE FROM pipeline_events")
            await conn.execute("DELETE FROM hire_requests")
            await conn.execute("DELETE FROM positions")
    logger.warning(f"[DEV] Reset positions and hire requests for org {org_id or 'ALL'}")
    return {"ok": True}


@router.delete("/reset/notifications")
async def reset_notifications(org_id: Optional[int] = Query(None)):
    """Clear all notifications for an org or globally."""
    _require_dev_mode()
    async with get_admin_connection() as conn:
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
    async with get_admin_connection() as conn:
        if org_id is not None:
            await conn.execute("DELETE FROM notifications WHERE org_id = $1", org_id)
            await conn.execute("DELETE FROM pipeline_events WHERE org_id = $1", org_id)
            await conn.execute("DELETE FROM candidate_applications WHERE org_id = $1", org_id)
            await conn.execute("DELETE FROM candidates WHERE org_id = $1", org_id)
            await conn.execute("DELETE FROM hire_requests WHERE org_id = $1", org_id)
            await conn.execute("DELETE FROM positions WHERE org_id = $1", org_id)
            await conn.execute("DELETE FROM chat_sessions WHERE org_id = $1", org_id)
            msg = "Org data cleared. Org, users, and departments preserved."
        else:
            await conn.execute("TRUNCATE TABLE organizations CASCADE")
            msg = "Global data cleared. ALL orgs, users, and departments wiped."
    logger.warning(f"[DEV] Full reset for org {org_id or 'ALL'}")
    return {"ok": True, "message": msg}


# ── Core-Loop Seeding (E2E test fixture) ──────────────────────────────────────

class SeedCoreLoopBody(BaseModel):
    """All fields optional — sensible defaults so the E2E test can call with {}."""
    org_name: Optional[str] = None       # auto-generated unique name if absent
    hr_email: Optional[str] = None        # auto-generated unique email if absent
    hr_password: str = "TestPass123!"
    hr_name: str = "Test Recruiter"
    role_name: str = "Backend Engineer"
    candidate_name: str = "Ada Lovelace"
    candidate_email: str = "ada.candidate@example.com"
    skill_match_score: float = 82.0
    app_status: str = "screening"


@router.post("/seed-core-loop")
async def seed_core_loop(body: SeedCoreLoopBody):
    """
    Seed a full recruiter core-loop fixture in one call, for Playwright E2E:
      org → department → hr user → position(open) → candidate →
      application(status, already-scored) → pipeline event.

    Skips the LLM apply chat entirely — the application is inserted pre-scored.
    Returns every id + login creds + the public status_token so the browser
    test can walk login → pipeline → candidate detail → status portal.
    """
    _require_dev_mode()
    sfx = uuid.uuid4().hex[:8]
    org_name = body.org_name or f"E2E Loop Org {sfx}"
    hr_email = body.hr_email or f"recruiter+{sfx}@e2e.test"
    cand_email = body.candidate_email
    if "+" not in cand_email and cand_email.count("@") == 1:
        local, domain = cand_email.split("@")
        cand_email = f"{local}+{sfx}@{domain}"

    hashed = hash_password(body.hr_password)
    slug = org_name.lower().replace(" ", "-")

    # Pre-scored skill match so the candidate detail page renders a real score.
    skill_data = json.dumps({
        "summary": "Strong backend match seeded for E2E.",
        "matched_skills": ["Python", "PostgreSQL", "FastAPI"],
        "missing_skills": ["Kubernetes"],
        "extra_skills": ["Rust"],
        "career_trajectory": "steady_growth",
        "red_flags": [],
    })

    async with get_admin_connection() as conn:
        org_id = await conn.fetchval(
            """INSERT INTO organizations (name, slug, segment, size, created_at)
               VALUES ($1, $2, 'Technology', 'Mid-Market', NOW()) RETURNING id""",
            org_name, slug,
        )
        dept_id = await conn.fetchval(
            "INSERT INTO departments (org_id, name) VALUES ($1, 'Engineering') RETURNING id",
            org_id,
        )
        user_id = await conn.fetchval(
            """INSERT INTO users (name, email, password_hash, role, org_id, department_id,
                                  is_active, created_at)
               VALUES ($1, $2, $3, 'hr', $4, $5, true, NOW()) RETURNING id""",
            body.hr_name, hr_email, hashed, org_id, dept_id,
        )
        pos_id = await conn.fetchval(
            """INSERT INTO positions (org_id, department_id, role_name, status, created_at)
               VALUES ($1, $2, $3, 'open', NOW()) RETURNING id""",
            org_id, dept_id, body.role_name,
        )
        cand_id = await conn.fetchval(
            """INSERT INTO candidates (org_id, name, email, current_title, current_company,
                                       experience_years, location, source)
               VALUES ($1, $2, $3, 'Senior Backend Engineer', 'Acme Corp', 7,
                       'Bengaluru', 'manual') RETURNING id""",
            org_id, body.candidate_name, cand_email,
        )
        app_row = await conn.fetchrow(
            """INSERT INTO candidate_applications
                   (candidate_id, position_id, org_id, department_id,
                    skill_match_score, skill_match_data, status, applied_at, status_token)
               VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), gen_random_uuid()::text)
               RETURNING id, status_token""",
            cand_id, pos_id, org_id, dept_id,
            body.skill_match_score, skill_data, body.app_status,
        )
        await conn.execute(
            """INSERT INTO pipeline_events
                   (org_id, candidate_id, position_id, application_id, event_type)
               VALUES ($1, $2, $3, $4, 'application_received')""",
            org_id, cand_id, pos_id, app_row["id"],
        )

    logger.info(f"[DEV] Seeded core-loop fixture org={org_id} pos={pos_id} cand={cand_id}")
    return {
        "ok": True,
        "org_id": org_id,
        "department_id": dept_id,
        "user_id": user_id,
        "position_id": pos_id,
        "candidate_id": cand_id,
        "application_id": app_row["id"],
        "status_token": app_row["status_token"],
        "hr_email": hr_email,
        "hr_password": body.hr_password,
        "candidate_email": cand_email,
    }


@router.delete("/seed-core-loop/{org_id}")
async def teardown_core_loop(org_id: int):
    """Tear down a core-loop fixture org and all its data (E2E cleanup)."""
    _require_dev_mode()
    async with get_admin_connection() as conn:
        await conn.execute("DELETE FROM pipeline_events WHERE org_id = $1", org_id)
        await conn.execute("DELETE FROM candidate_applications WHERE org_id = $1", org_id)
        await conn.execute("DELETE FROM candidates WHERE org_id = $1", org_id)
        await conn.execute("DELETE FROM positions WHERE org_id = $1", org_id)
        await conn.execute("DELETE FROM users WHERE org_id = $1", org_id)
        await conn.execute("DELETE FROM departments WHERE org_id = $1", org_id)
        await conn.execute("DELETE FROM organizations WHERE id = $1", org_id)
    return {"ok": True, "org_id": org_id}


# ── Session Restore ───────────────────────────────────────────────────────────

@router.patch("/chat-sessions/{session_id}/restore")
async def restore_deleted_session(session_id: str):
    """Restore a soft-deleted session (set status back to 'active')."""
    _require_dev_mode()
    async with get_admin_connection() as conn:
        result = await conn.execute(
            "UPDATE chat_sessions SET status = 'active', updated_at = NOW() WHERE id = $1",
            session_id
        )
    return {"ok": result == "UPDATE 1"}
