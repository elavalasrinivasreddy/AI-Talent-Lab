"""
routers/settings.py – /api/v1/settings/* endpoints.
Org profile, departments, competitors, screening questions,
message templates, scorecard templates. Admin-only where required.
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional

import asyncpg

from backend.dependencies import get_db, get_current_user, require_admin
from backend.services.settings_service import SettingsService
from backend.models.settings import (
    OrgProfileUpdate,
    DepartmentCreate, DepartmentUpdate,
    CompetitorCreate,
    ScreeningQuestionCreate, ScreeningQuestionUpdate, ReorderRequest,
    MessageTemplateCreate, MessageTemplateUpdate,
    ScorecardTemplateCreate,
)

router = APIRouter(prefix="/api/v1/settings", tags=["Settings"])


# ── Org Profile ────────────────────────────────────────────────────────────────

@router.get("/org")
async def get_org(
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Get organization profile."""
    org = await SettingsService.get_org(db, user["org_id"])
    return {"org": org}


@router.patch("/org")
async def update_org(
    body: OrgProfileUpdate,
    user: dict = Depends(require_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """Update org profile (admin only)."""
    fields = body.model_dump(exclude_none=True)
    org = await SettingsService.update_org(db, user["org_id"], user["user_id"], **fields)
    return {"org": org}


# ── Departments ────────────────────────────────────────────────────────────────

@router.get("/departments")
async def list_departments(
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """List all departments."""
    depts = await SettingsService.list_departments(db, user["org_id"])
    return {"departments": depts}


@router.post("/departments")
async def create_department(
    body: DepartmentCreate,
    user: dict = Depends(require_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """Create a department (admin only)."""
    dept = await SettingsService.create_department(
        db, user["org_id"], user["user_id"],
        name=body.name, description=body.description,
        parent_dept_id=body.parent_dept_id, head_user_id=body.head_user_id,
    )
    return {"department": dept}


@router.patch("/departments/{dept_id}")
async def update_department(
    dept_id: int,
    body: DepartmentUpdate,
    user: dict = Depends(require_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """Update a department (admin only)."""
    fields = body.model_dump(exclude_none=True)
    dept = await SettingsService.update_department(
        db, dept_id, user["org_id"], user["user_id"], **fields,
    )
    return {"department": dept}


@router.delete("/departments/{dept_id}")
async def delete_department(
    dept_id: int,
    user: dict = Depends(require_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """Delete a department (admin only, must be empty)."""
    await SettingsService.delete_department(db, dept_id, user["org_id"], user["user_id"])
    return {"message": "Department deleted"}


# ── Competitors ────────────────────────────────────────────────────────────────

@router.get("/competitors")
async def list_competitors(
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """List all competitors."""
    comps = await SettingsService.list_competitors(db, user["org_id"])
    return {"competitors": comps}


@router.post("/competitors")
async def create_competitor(
    body: CompetitorCreate,
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Add a competitor."""
    comp = await SettingsService.create_competitor(
        db, user["org_id"], user["user_id"],
        name=body.name, website=body.website,
        industry=body.industry, notes=body.notes,
    )
    return {"competitor": comp}


@router.delete("/competitors/{competitor_id}")
async def delete_competitor(
    competitor_id: int,
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Delete a competitor."""
    await SettingsService.delete_competitor(db, competitor_id, user["org_id"], user["user_id"])
    return {"message": "Competitor deleted"}


# ── Screening Questions ───────────────────────────────────────────────────────

@router.get("/screening-questions")
async def list_screening_questions(
    department_id: Optional[int] = Query(None),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """List screening questions (with dept fallback)."""
    qs = await SettingsService.list_screening_questions(db, user["org_id"], department_id)
    return {"questions": qs}


@router.post("/screening-questions")
async def create_screening_question(
    body: ScreeningQuestionCreate,
    user: dict = Depends(require_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """Create a screening question (admin only)."""
    q = await SettingsService.create_screening_question(
        db, user["org_id"], user["user_id"],
        field_key=body.field_key, label=body.label,
        field_type=body.field_type, options=body.options,
        is_required=body.is_required, department_id=body.department_id,
        sort_order=body.sort_order,
    )
    return {"question": q}


@router.patch("/screening-questions/{question_id}")
async def update_screening_question(
    question_id: int,
    body: ScreeningQuestionUpdate,
    user: dict = Depends(require_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """Update a screening question (admin only)."""
    fields = body.model_dump(exclude_none=True)
    q = await SettingsService.update_screening_question(
        db, question_id, user["org_id"], user["user_id"], **fields,
    )
    return {"question": q}


@router.delete("/screening-questions/{question_id}")
async def delete_screening_question(
    question_id: int,
    user: dict = Depends(require_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """Delete a screening question (admin only)."""
    await SettingsService.delete_screening_question(
        db, question_id, user["org_id"], user["user_id"],
    )
    return {"message": "Screening question deleted"}


@router.patch("/screening-questions/reorder")
async def reorder_screening_questions(
    body: ReorderRequest,
    user: dict = Depends(require_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """Reorder screening questions (admin only)."""
    await SettingsService.reorder_screening_questions(db, user["org_id"], body.order)
    return {"message": "Questions reordered"}


# ── Message Templates ─────────────────────────────────────────────────────────

@router.get("/message-templates")
async def list_message_templates(
    category: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """List message templates (optional category filter)."""
    templates = await SettingsService.list_message_templates(db, user["org_id"], category)
    return {"templates": templates}


@router.post("/message-templates")
async def create_message_template(
    body: MessageTemplateCreate,
    user: dict = Depends(require_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """Create a message template (admin only)."""
    t = await SettingsService.create_message_template(
        db, user["org_id"], user["user_id"],
        name=body.name, category=body.category,
        body=body.body, subject=body.subject,
    )
    return {"template": t}


@router.patch("/message-templates/{template_id}")
async def update_message_template(
    template_id: int,
    body: MessageTemplateUpdate,
    user: dict = Depends(require_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """Update a message template (admin only)."""
    fields = body.model_dump(exclude_none=True)
    t = await SettingsService.update_message_template(
        db, template_id, user["org_id"], user["user_id"], **fields,
    )
    return {"template": t}


@router.delete("/message-templates/{template_id}")
async def delete_message_template(
    template_id: int,
    user: dict = Depends(require_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """Delete a message template (admin only)."""
    await SettingsService.delete_message_template(
        db, template_id, user["org_id"], user["user_id"],
    )
    return {"message": "Template deleted"}


# ── Scorecard Templates ───────────────────────────────────────────────────────

@router.get("/scorecard-templates")
async def list_scorecard_templates(
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """List scorecard templates."""
    templates = await SettingsService.list_scorecard_templates(db, user["org_id"])
    return {"templates": templates}


@router.post("/scorecard-templates")
async def create_scorecard_template(
    body: ScorecardTemplateCreate,
    user: dict = Depends(require_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """Create a scorecard template (admin only)."""
    t = await SettingsService.create_scorecard_template(
        db, user["org_id"], user["user_id"],
        name=body.name, dimensions=body.dimensions, is_default=body.is_default,
    )
    return {"template": t}


@router.patch("/scorecard-templates/{template_id}")
async def update_scorecard_template(
    template_id: int,
    body: ScorecardTemplateCreate,
    user: dict = Depends(require_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """Update a scorecard template (admin only)."""
    fields = body.model_dump(exclude_none=True)
    t = await SettingsService.update_scorecard_template(
        db, template_id, user["org_id"], user["user_id"], **fields,
    )
    return {"template": t}
