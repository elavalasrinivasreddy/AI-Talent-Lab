"""
models/settings.py – Pydantic schemas for settings request/response validation.
"""
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime


# ── Organization ───────────────────────────────────────────────────────────────

class OrgProfileUpdate(BaseModel):
    segment: Optional[str] = None
    size: Optional[str] = None
    website: Optional[str] = None
    headquarters: Optional[str] = None
    about_us: Optional[str] = None
    culture_keywords: Optional[str] = None
    benefits_text: Optional[str] = None
    linkedin_url: Optional[str] = None
    glassdoor_url: Optional[str] = None
    logo_url: Optional[str] = None

    @field_validator("size")
    @classmethod
    def valid_size(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("startup", "smb", "enterprise"):
            raise ValueError("Size must be startup, smb, or enterprise")
        return v


class OrgProfileResponse(BaseModel):
    id: int
    name: str
    slug: str
    segment: str
    size: str
    website: Optional[str] = None
    headquarters: Optional[str] = None
    about_us: Optional[str] = None
    culture_keywords: Optional[str] = None
    benefits_text: Optional[str] = None
    linkedin_url: Optional[str] = None
    glassdoor_url: Optional[str] = None
    logo_url: Optional[str] = None
    created_at: Optional[datetime] = None


# ── Departments ────────────────────────────────────────────────────────────────

class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    parent_dept_id: Optional[int] = None
    head_user_id: Optional[int] = None

    @field_validator("name")
    @classmethod
    def name_length(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2 or len(v) > 100:
            raise ValueError("Department name must be 2–100 characters")
        return v


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_dept_id: Optional[int] = None
    head_user_id: Optional[int] = None


class DepartmentResponse(BaseModel):
    id: int
    org_id: int
    name: str
    description: Optional[str] = None
    parent_dept_id: Optional[int] = None
    head_user_id: Optional[int] = None
    head_name: Optional[str] = None
    user_count: int = 0
    position_count: int = 0
    created_at: Optional[datetime] = None


# ── Competitors ────────────────────────────────────────────────────────────────

class CompetitorCreate(BaseModel):
    name: str
    website: Optional[str] = None
    industry: Optional[str] = None
    notes: Optional[str] = None


class CompetitorResponse(BaseModel):
    id: int
    org_id: int
    name: str
    website: Optional[str] = None
    industry: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True


# ── Screening Questions ───────────────────────────────────────────────────────

class ScreeningQuestionCreate(BaseModel):
    field_key: str
    label: str
    field_type: str = "text"
    options: Optional[str] = None
    is_required: bool = False
    department_id: Optional[int] = None
    sort_order: int = 0

    @field_validator("field_type")
    @classmethod
    def valid_field_type(cls, v: str) -> str:
        if v not in ("text", "number", "select", "date", "boolean"):
            raise ValueError("field_type must be text, number, select, date, or boolean")
        return v


class ScreeningQuestionUpdate(BaseModel):
    label: Optional[str] = None
    field_type: Optional[str] = None
    options: Optional[str] = None
    is_required: Optional[bool] = None
    sort_order: Optional[int] = None

    @field_validator("field_type")
    @classmethod
    def valid_field_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("text", "number", "select", "date", "boolean"):
            raise ValueError("field_type must be text, number, select, date, or boolean")
        return v


class ScreeningQuestionResponse(BaseModel):
    id: int
    org_id: int
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    field_key: str
    label: str
    field_type: str
    options: Optional[str] = None
    is_required: bool = False
    sort_order: int = 0
    is_active: bool = True
    created_at: Optional[datetime] = None


class ReorderRequest(BaseModel):
    order: List[dict]  # List of {id: int, sort_order: int}


# ── Message Templates ─────────────────────────────────────────────────────────

class MessageTemplateCreate(BaseModel):
    name: str
    category: str
    subject: Optional[str] = None
    body: str

    @field_validator("category")
    @classmethod
    def valid_category(cls, v: str) -> str:
        valid = ("outreach", "interview_process_overview", "rejection",
                 "interview_invite", "follow_up", "custom")
        if v not in valid:
            raise ValueError(f"category must be one of: {', '.join(valid)}")
        return v


class MessageTemplateUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None


class MessageTemplateResponse(BaseModel):
    id: int
    org_id: int
    name: str
    category: str
    subject: Optional[str] = None
    body: str
    is_default: bool = False
    is_active: bool = True
    created_at: Optional[datetime] = None


# ── Scorecard Templates ───────────────────────────────────────────────────────

class ScorecardTemplateCreate(BaseModel):
    name: str
    dimensions: str  # JSON string: [{"name": "...", "weight": 40, "description": "..."}]
    is_default: bool = False


class ScorecardTemplateResponse(BaseModel):
    id: int
    org_id: int
    name: str
    dimensions: str
    is_default: bool = False
    created_at: Optional[datetime] = None
