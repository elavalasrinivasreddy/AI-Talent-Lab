"""
dependencies.py – FastAPI Depends() functions.

Role tiers (org-internal, weakest → strongest):
  team_lead  — raises hire requests for their squad
  hr         — recruiter; runs JD chat, sources candidates, schedules
  dept_admin — manages one department; approves hire requests, invites team
  org_head   — owns the org; full admin across all departments

  platform_admin lives outside org tenancy (SaaS owners only).
"""
from fastapi import Depends, Request
from typing import AsyncGenerator

import asyncpg

from backend.db.connection import get_connection
from backend.utils.security import decode_access_token, verify_magic_link_token
from backend.exceptions import (
    InvalidCredentialsError,
    InsufficientPermissionsError,
    TokenExpiredError,
)

ORG_HEAD = "org_head"
DEPT_ADMIN = "dept_admin"
HR = "hr"
TEAM_LEAD = "team_lead"
PLATFORM_ADMIN = "platform_admin"

# An org_head implicitly satisfies any dept_admin check (they're above
# dept-scoped permissions). Same idea elsewhere — encoded once here.
_PRIVILEGED_OVER_DEPT = {ORG_HEAD, DEPT_ADMIN}


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    """Yield an async database connection from the pool."""
    async with get_connection() as conn:
        yield conn


async def get_current_user(request: Request) -> dict:
    """
    Decode JWT from Authorization header, return user dict.
    Sets SET LOCAL app.current_org_id for RLS enforcement.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise InvalidCredentialsError("Missing or invalid Authorization header")

    token = auth_header.removeprefix("Bearer ").strip()
    if not token:
        raise InvalidCredentialsError("Missing token")

    payload = decode_access_token(token)
    
    jti = payload.get("jti")
    if jti:
        import redis.asyncio as redis
        from backend.config import settings
        r = redis.from_url(settings.REDIS_URL)
        try:
            is_blacklisted = await r.get(f"denylist:{jti}")
            if is_blacklisted:
                raise InvalidCredentialsError("Token has been revoked")
        finally:
            await r.aclose()

    return {
        "id": int(payload["sub"]),
        "user_id": int(payload["sub"]),
        "org_id": payload["org_id"],
        "role": payload["role"],
        "dept_id": payload.get("dept_id"),
    }


async def require_org_head(user: dict = Depends(get_current_user)) -> dict:
    """Require the current user to be the org_head (organization owner)."""
    if user["role"] != ORG_HEAD:
        raise InsufficientPermissionsError("This action requires org_head privileges")
    return user


async def require_dept_admin(user: dict = Depends(get_current_user)) -> dict:
    """
    Require dept_admin or org_head. org_head can act on any department;
    dept_admin can act on their own department (route handler enforces
    the dept_id match where relevant).
    """
    if user["role"] not in _PRIVILEGED_OVER_DEPT:
        raise InsufficientPermissionsError(
            "This action requires dept_admin or org_head privileges"
        )
    return user


async def require_hr(user: dict = Depends(get_current_user)) -> dict:
    """
    Require hr, dept_admin, or org_head. Recruiter actions are open to
    anyone above the team_lead tier within the dept.
    """
    if user["role"] not in {ORG_HEAD, DEPT_ADMIN, HR}:
        raise InsufficientPermissionsError(
            "This action requires hr, dept_admin, or org_head privileges"
        )
    return user


async def require_team_lead(user: dict = Depends(get_current_user)) -> dict:
    """
    Require team_lead or above. Anyone with an org role can raise / view
    hire requests in their scope; this guard exists for actions that
    should not be available to outside tooling.
    """
    if user["role"] not in {ORG_HEAD, DEPT_ADMIN, HR, TEAM_LEAD}:
        raise InsufficientPermissionsError("This action requires an org user role")
    return user


async def require_platform_admin(request: Request) -> dict:
    """
    Require platform_admin role. These users are SaaS owners — no org isolation.
    Returns user dict without org_id restriction.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise InvalidCredentialsError("Missing or invalid Authorization header")

    token = auth_header.removeprefix("Bearer ").strip()
    payload = decode_access_token(token)
    
    jti = payload.get("jti")
    if jti:
        import redis.asyncio as redis
        from backend.config import settings
        r = redis.from_url(settings.REDIS_URL)
        try:
            is_blacklisted = await r.get(f"denylist:{jti}")
            if is_blacklisted:
                raise InvalidCredentialsError("Token has been revoked")
        finally:
            await r.aclose()

    if payload.get("role") != PLATFORM_ADMIN:
        raise InsufficientPermissionsError("Platform admin access required")

    return {
        "id": int(payload["sub"]),
        "user_id": int(payload["sub"]),
        "org_id": payload.get("org_id", 0),
        "role": PLATFORM_ADMIN,
    }


async def verify_apply_token(token: str) -> dict:
    """Validate an apply magic link JWT. Returns decoded payload."""
    return verify_magic_link_token(token, "apply")


async def verify_panel_token(token: str) -> dict:
    """Validate a panel feedback magic link JWT. Returns decoded payload."""
    return verify_magic_link_token(token, "panel_feedback")
