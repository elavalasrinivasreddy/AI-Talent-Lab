"""
models/hire_request.py – Pydantic schemas for /api/v1/hire-requests.
"""
from typing import Optional
from pydantic import BaseModel, Field, field_validator


_WORK_TYPES = ("onsite", "remote", "hybrid")


class HireRequestCreate(BaseModel):
    role_name: str
    department_id: Optional[int] = None
    headcount: int = Field(default=1, ge=1, le=100)
    work_type: str = "onsite"
    experience_min: Optional[int] = Field(default=None, ge=0)
    experience_max: Optional[int] = Field(default=None, ge=0)
    target_start: Optional[str] = None  # ISO date string; backend stores TEXT
    requirements: Optional[str] = None
    comp_min: Optional[int] = Field(default=None, ge=0)
    comp_max: Optional[int] = Field(default=None, ge=0)
    location: Optional[str] = None

    @field_validator("role_name")
    @classmethod
    def role_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Role name is required")
        if len(v) > 200:
            raise ValueError("Role name is too long")
        return v

    @field_validator("work_type")
    @classmethod
    def work_type_valid(cls, v: str) -> str:
        if v not in _WORK_TYPES:
            raise ValueError(f"work_type must be one of {_WORK_TYPES}")
        return v


class HireRequestUpdate(BaseModel):
    role_name: Optional[str] = None
    department_id: Optional[int] = None
    headcount: Optional[int] = Field(default=None, ge=1, le=100)
    work_type: Optional[str] = None
    experience_min: Optional[int] = Field(default=None, ge=0)
    experience_max: Optional[int] = Field(default=None, ge=0)
    target_start: Optional[str] = None
    requirements: Optional[str] = None
    comp_min: Optional[int] = Field(default=None, ge=0)
    comp_max: Optional[int] = Field(default=None, ge=0)
    location: Optional[str] = None

    @field_validator("work_type")
    @classmethod
    def work_type_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _WORK_TYPES:
            raise ValueError(f"work_type must be one of {_WORK_TYPES}")
        return v


class HireRequestAccept(BaseModel):
    """Optional chat session id (set when the recruiter starts JD chat)."""
    chat_session_id: Optional[str] = None


class HireRequestReject(BaseModel):
    """Rejection payload — reason is mandatory."""
    reason: str

    @field_validator("reason")
    @classmethod
    def reason_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Rejection reason is required")
        if len(v) > 1000:
            raise ValueError("Rejection reason is too long (max 1000 chars)")
        return v


class HireRequestLinkSession(BaseModel):
    session_id: str
