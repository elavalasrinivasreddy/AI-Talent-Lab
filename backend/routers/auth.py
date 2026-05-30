"""
routers/auth.py – /api/v1/auth/* endpoints.
Thin HTTP layer — validates input via Pydantic, calls AuthService.
See docs/architecture/03_backend.md §5 Auth section.
"""
from fastapi import APIRouter, Depends, Request

import asyncpg

from backend.dependencies import get_db, get_current_user, require_org_head
from backend.services.auth_service import AuthService
from backend.models.auth import (
    LoginRequest,
    RegisterRequest,
    MagicLinkRequest,
    MagicLinkVerifyRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    UpdateProfileRequest,
    AddUserRequest,
    UpdateUserRequest,
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


def _org_response(org: dict | None) -> dict | None:
    """Convert DB org dict to response-safe format (subset of columns)."""
    if not org:
        return None
    return {
        "id": org["id"],
        "name": org["name"],
        "slug": org["slug"],
        "segment": org.get("segment"),
        "size": org.get("size"),
        "website": org.get("website"),
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
        "org": _org_response(result["org"]),
    }


# ── POST /login ───────────────────────────────────────────────────────────────

@router.post("/login")
@limiter.limit("10/minute")
async def login(
    request: Request,
    body: LoginRequest,
    db: asyncpg.Connection = Depends(get_db),
):
    """Authenticate user and return JWT + org."""
    result = await AuthService.login(
        conn=db,
        email=body.email,
        password=body.password,
        ip_address=_get_ip(request),
    )
    return {
        "token": result["token"],
        "user": _user_response(result["user"]),
        "org": _org_response(result["org"]),
    }


# ── POST /magic-link ─────────────────────────────────────────────────────────

@router.post("/magic-link")
@limiter.limit("5/minute")
async def request_magic_link(
    request: Request,
    body: MagicLinkRequest,
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Request a magic-link sign-in email.
    Always returns a generic success message — never leaks account existence.
    """
    await AuthService.request_magic_link(
        conn=db, email=body.email, ip_address=_get_ip(request)
    )
    return {
        "message": (
            "If that email matches an account, we've sent a sign-in link. "
            "Check your inbox — the link expires in 15 minutes."
        )
    }


# ── POST /magic-link/verify ──────────────────────────────────────────────────

@router.post("/magic-link/verify")
@limiter.limit("20/minute")
async def verify_magic_link(
    request: Request,
    body: MagicLinkVerifyRequest,
    db: asyncpg.Connection = Depends(get_db),
):
    """Exchange a magic-link token for a session JWT. Single-use."""
    result = await AuthService.verify_magic_link(
        conn=db, token=body.token, ip_address=_get_ip(request)
    )
    return {
        "token": result["token"],
        "user": _user_response(result["user"]),
        "org": _org_response(result["org"]),
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
        "org": _org_response(result["org"]),
    }


# ── GET /users (admin) ────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    user: dict = Depends(require_org_head),
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
    user: dict = Depends(require_org_head),
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
    user: dict = Depends(require_org_head),
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
    """Reset password using single-use magic-link token."""
    await AuthService.reset_password(db, body.token, body.new_password)
    return {"message": "Password reset successfully. You can now sign in with your new password."}
