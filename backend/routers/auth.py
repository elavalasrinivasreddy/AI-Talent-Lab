"""
routers/auth.py – /api/v1/auth/* endpoints.
Thin HTTP layer — validates input via Pydantic, calls AuthService.
See docs/architecture/03_backend.md §5 Auth section.
"""
from fastapi import APIRouter, Depends, Request
import json

import asyncpg

from backend.dependencies import get_db, get_current_user, require_dept_admin
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
from backend.exceptions import NotFoundError, InsufficientPermissionsError

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
        "auto_approve_jds": user.get("auto_approve_jds", False),
        "notification_preferences": user.get("notification_preferences") if isinstance(user.get("notification_preferences"), dict) else (json.loads(user.get("notification_preferences", "{}")) if user.get("notification_preferences") else {}),
        "last_login_at": user.get("last_login_at"),
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


# ── POST /logout ──────────────────────────────────────────────────────────────

@router.post("/logout")
async def logout(
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Logout user by denylisting their JWT."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.removeprefix("Bearer ").strip()
    if token:
        await AuthService.logout(token)
    return {"message": "Logged out successfully"}


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
    page: int = 1,
    limit: int = 50,
    user: dict = Depends(require_dept_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """List org users. dept_admin sees only their own department; org_head sees all."""
    dept_id = user.get("dept_id") if user["role"] == "dept_admin" else None
    users = await AuthService.list_users(db, user["org_id"], department_id=dept_id, page=page, limit=limit)
    return {"users": [_user_response(u) for u in users], "page": page, "limit": limit}


# ── GET /directory ────────────────────────────────────────────────────────────

@router.get("/directory")
async def list_directory(
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """List basic info for all users in the org for @mentions. Available to all org users."""
    users = await AuthService.list_users(db, user["org_id"])
    return {
        "users": [
            {
                "id": u["id"],
                "name": u["name"],
                "department_id": u.get("department_id")
            }
            for u in users
        ]
    }


# ── POST /add-user (admin) ────────────────────────────────────────────────────

@router.post("/add-user")
async def add_user(
    request: Request,
    body: AddUserRequest,
    user: dict = Depends(require_dept_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """Add a new team member (dept admin or above)."""
    if user["role"] == "dept_admin":
        if body.role in ["org_head", "dept_admin"]:
            raise InsufficientPermissionsError("Department admins can only add HR and Team Leads")
        # Ensure they are adding to their own department
        dept_admin_dept = user.get("dept_id")
        if dept_admin_dept is None or body.department_id != dept_admin_dept:
            raise InsufficientPermissionsError("You can only add users to your own department")

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
    user: dict = Depends(require_dept_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """Update user role, department, or active status (dept admin or above)."""
    if user["role"] == "dept_admin":
        from backend.db.repositories.users import UserRepository
        target = await UserRepository.get_by_id(db, user_id, user["org_id"])
        if not target:
            raise NotFoundError("User not found")
        if target["role"] in ["org_head", "dept_admin"]:
            raise InsufficientPermissionsError("Department admins cannot modify org heads or other dept admins")
        if target["department_id"] != user.get("dept_id"):
            raise InsufficientPermissionsError("You can only modify users in your own department")
            
        if body.role and body.role in ["org_head", "dept_admin"]:
            raise InsufficientPermissionsError("Department admins cannot elevate roles to org_head or dept_admin")
        if body.department_id is not None and body.department_id != user.get("dept_id"):
            raise InsufficientPermissionsError("You can only assign users to your own department")

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
    
    if "auto_approve_jds" in fields and fields["auto_approve_jds"]:
        from backend.services.settings_service import SettingsService
        org = await SettingsService.get_org(db, user["org_id"])
        if org.get("allow_auto_approve_jds") is False:
            raise InsufficientPermissionsError("Organization policy forbids auto-approving JDs.")

    if "notification_preferences" in fields:
        fields["notification_preferences"] = json.dumps(fields["notification_preferences"])

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
