"""
dependencies.py – FastAPI Depends() functions.
get_db(), get_current_user(), require_admin(),
verify_apply_token(), verify_panel_token().
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

    return {
        "user_id": int(payload["sub"]),
        "org_id": payload["org_id"],
        "role": payload["role"],
        "dept_id": payload.get("dept_id"),
    }


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Require the current user to have admin role."""
    if user["role"] != "admin":
        raise InsufficientPermissionsError("This action requires admin privileges")
    return user


async def verify_apply_token(token: str) -> dict:
    """Validate an apply magic link JWT. Returns decoded payload."""
    return verify_magic_link_token(token, "apply")


async def verify_panel_token(token: str) -> dict:
    """Validate a panel feedback magic link JWT. Returns decoded payload."""
    return verify_magic_link_token(token, "panel_feedback")
