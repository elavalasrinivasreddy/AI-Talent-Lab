"""
models/auth.py – Pydantic schemas for auth request/response validation.
"""
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime


# ── Request Models ─────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    org_name: str
    segment: str
    size: str
    website: Optional[str] = None
    name: str
    email: str
    password: str

    @field_validator("org_name")
    @classmethod
    def org_name_length(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2 or len(v) > 100:
            raise ValueError("Organization name must be 2–100 characters")
        return v

    @field_validator("name")
    @classmethod
    def name_length(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2 or len(v) > 50:
            raise ValueError("Name must be 2–50 characters")
        return v

    @field_validator("size")
    @classmethod
    def valid_size(cls, v: str) -> str:
        if v not in ("startup", "smb", "enterprise"):
            raise ValueError("Size must be startup, smb, or enterprise")
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    timezone: Optional[str] = None


class AddUserRequest(BaseModel):
    email: str
    name: str
    role: str = "recruiter"
    department_id: Optional[int] = None
    password: str

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: str) -> str:
        if v not in ("admin", "recruiter", "hiring_manager"):
            raise ValueError("Role must be admin, recruiter, or hiring_manager")
        return v


class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    department_id: Optional[int] = None
    is_active: Optional[bool] = None

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("admin", "recruiter", "hiring_manager"):
            raise ValueError("Role must be admin, recruiter, or hiring_manager")
        return v


# ── Response Models ────────────────────────────────────────────────────────────

class OrgResponse(BaseModel):
    id: int
    name: str
    slug: str
    segment: str
    size: str
    website: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    org_id: int
    email: str
    name: str
    role: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    timezone: str
    is_active: bool
    department_id: Optional[int] = None
    created_at: Optional[datetime] = None


class TokenResponse(BaseModel):
    token: str
    user: UserResponse


class MeResponse(BaseModel):
    user: UserResponse
    org: OrgResponse
