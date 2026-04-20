"""
routers/auth.py – /api/v1/auth/* endpoints.
Thin HTTP layer — validates input via Pydantic, calls AuthService.
See docs/BACKEND_PLAN.md §5 Auth section.
"""
from fastapi import APIRouter, Depends, Request
from typing import List

import asyncpg

from backend.dependencies import get_db, get_current_user, require_admin
from backend.services.auth_service import AuthService
from backend.models.auth import (
    LoginRequest,
    RegisterRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    UpdateProfileRequest,
    AddUserRequest,
    UpdateUserRequest,
    TokenResponse,
    UserResponse,
    MeResponse,
)
from backend.middleware.rate_limiter import limiter

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


def _get_ip(request: Request) -> str:
    """Extract client IP from request."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _user_response(user: dict) -> dict:
    """Convert DB user dict to response-safe format (exclude password_hash)."""
    return {
        "id": user["id"],
        "org_id": user["org_id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "phone": user.get("phone"),
        "avatar_url": user.get("avatar_url"),
        "timezone": user.get("timezone", "Asia/Kolkata"),
        "is_active": user.get("is_active", True),
        "department_id": user.get("department_id"),
        "created_at": user.get("created_at"),
    }


# ── POST /register ────────────────────────────────────────────────────────────

@router.post("/register")
@limiter.limit("10/minute")
async def register(
    request: Request,
    body: RegisterRequest,
    db: asyncpg.Connection = Depends(get_db),
):
    """Register a new organization + admin user."""
    result = await AuthService.register(
        conn=db,
        org_name=body.org_name,
        segment=body.segment,
        size=body.size,
        name=body.name,
        email=body.email,
        password=body.password,
        website=body.website,
        ip_address=_get_ip(request),
    )
    return {
        "token": result["token"],
        "user": _user_response(result["user"]),
    }


# ── POST /login ───────────────────────────────────────────────────────────────

@router.post("/login")
@limiter.limit("10/minute")
async def login(
    request: Request,
    body: LoginRequest,
    db: asyncpg.Connection = Depends(get_db),
):
    """Authenticate user and return JWT."""
    result = await AuthService.login(
        conn=db,
        email=body.email,
        password=body.password,
        ip_address=_get_ip(request),
    )
    return {
        "token": result["token"],
        "user": _user_response(result["user"]),
    }


# ── GET /me ───────────────────────────────────────────────────────────────────

@router.get("/me")
async def me(
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Get current user + org data."""
    result = await AuthService.get_me(db, user["user_id"], user["org_id"])
    return {
        "user": _user_response(result["user"]),
        "org": result["org"],
    }


# ── GET /users (admin) ────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    user: dict = Depends(require_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """List all org users (admin only)."""
    users = await AuthService.list_users(db, user["org_id"])
    return {"users": [_user_response(u) for u in users]}


# ── POST /add-user (admin) ────────────────────────────────────────────────────

@router.post("/add-user")
async def add_user(
    request: Request,
    body: AddUserRequest,
    user: dict = Depends(require_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """Add a new team member (admin only)."""
    new_user = await AuthService.add_user(
        conn=db,
        org_id=user["org_id"],
        email=body.email,
        name=body.name,
        password=body.password,
        role=body.role,
        department_id=body.department_id,
        admin_user_id=user["user_id"],
        ip_address=_get_ip(request),
    )
    return {"user": _user_response(new_user)}


# ── PATCH /users/{id} (admin) ─────────────────────────────────────────────────

@router.patch("/users/{user_id}")
async def update_user(
    user_id: int,
    request: Request,
    body: UpdateUserRequest,
    user: dict = Depends(require_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """Update user role, department, or active status (admin only)."""
    fields = body.model_dump(exclude_none=True)
    updated = await AuthService.update_user(
        conn=db,
        user_id=user_id,
        org_id=user["org_id"],
        admin_user_id=user["user_id"],
        ip_address=_get_ip(request),
        **fields,
    )
    return {"user": _user_response(updated)}


# ── PATCH /profile ─────────────────────────────────────────────────────────────

@router.patch("/profile")
async def update_profile(
    body: UpdateProfileRequest,
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Update own name, phone, avatar."""
    fields = body.model_dump(exclude_none=True)
    updated = await AuthService.update_profile(
        conn=db,
        user_id=user["user_id"],
        org_id=user["org_id"],
        **fields,
    )
    return {"user": _user_response(updated)}


# ── POST /change-password ─────────────────────────────────────────────────────

@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Change own password."""
    await AuthService.change_password(
        conn=db,
        user_id=user["user_id"],
        current_password=body.current_password,
        new_password=body.new_password,
    )
    return {"message": "Password updated successfully"}


# ── POST /forgot-password ─────────────────────────────────────────────────────

@router.post("/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: asyncpg.Connection = Depends(get_db),
):
    """Send password reset email. Always returns success."""
    await AuthService.forgot_password(db, body.email)
    return {
        "message": "If that email exists, we've sent a reset link. Valid for 24 hours."
    }


# ── POST /reset-password ──────────────────────────────────────────────────────

@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    db: asyncpg.Connection = Depends(get_db),
):
    """Reset password using magic link token."""
    await AuthService.reset_password(db, body.token, body.new_password)
    return {"message": "Password reset successfully. Please login with your new password."}
