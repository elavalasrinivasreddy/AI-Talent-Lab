"""
routers/settings.py – /api/v1/settings/* endpoints.
Org profile, departments, competitors, screening questions,
message templates, scorecard templates. Admin-only where required.
"""
from fastapi import APIRouter, Depends, Query, UploadFile, File
from typing import Optional

import asyncpg

from backend.dependencies import get_db, get_current_user, require_org_head, require_dept_admin, require_hr
from backend.services.settings_service import SettingsService
from backend.models.settings import (
    OrgProfileUpdate, AutoDraftRequest,
    DepartmentCreate, DepartmentUpdate,
    CompetitorCreate, CompetitorUpdate,
    ScreeningQuestionCreate, ScreeningQuestionUpdate, ReorderRequest,
    MessageTemplateCreate, MessageTemplateUpdate,
    ScorecardTemplateCreate,
    AiBehaviorBody,
)
from pydantic import BaseModel
from backend.exceptions import InsufficientPermissionsError
import httpx
import re
from langchain_core.messages import HumanMessage, SystemMessage
import json
from backend.adapters.llm.factory import get_llm

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
    user: dict = Depends(require_org_head),
    db: asyncpg.Connection = Depends(get_db),
):
    """Update org profile (admin only)."""
    fields = body.model_dump(exclude_none=True)
    org = await SettingsService.update_org(db, user["org_id"], user["user_id"], **fields)
    return {"org": org}


@router.post("/org/auto-draft")
async def auto_draft_org_profile(
    body: AutoDraftRequest,
    user: dict = Depends(require_org_head),
):
    """Extract company details from a given URL using LLM."""
    fallback_used = False
    try:
        # 1. Fetch HTML
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(body.url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                resp.raise_for_status()
                html = resp.text
                
            # 2. Naive HTML to text
            text = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.IGNORECASE | re.DOTALL)
            text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.IGNORECASE | re.DOTALL)
            text = re.sub(r'<[^>]+>', ' ', text)
            text = re.sub(r'\s+', ' ', text).strip()
            
            # Limit text length to avoid token limits
            text = text[:15000]
            if len(text) < 100:
                raise ValueError("Insufficient text content extracted.")
                
        except Exception as scrape_err:
            print(f"Direct scrape failed for {body.url}: {scrape_err}. Falling back to Tavily.")
            fallback_used = True
            from langchain_community.tools.tavily_search import TavilySearchResults
            tavily = TavilySearchResults(max_results=3)
            results = tavily.invoke({"query": f"What is the company culture, benefits, and about us for {body.url}?"})
            text = str(results)
        
        # 3. LLM Extraction
        llm = get_llm(temperature=0)
        sys_prompt = "You are an expert corporate researcher. Extract details from the provided website text or search results and return a valid JSON object strictly matching this schema: {\"about_us\": \"String, 1-2 paragraphs\", \"culture_keywords\": \"String, comma-separated list of 3-6 keywords\", \"benefits_text\": \"String, short description of benefits or perks mentioned\"}. If not found, make an educated guess or leave empty."
        human_prompt = f"Website URL: {body.url}\n\nContent:\n{text}"
        
        res = await llm.ainvoke([
            SystemMessage(content=sys_prompt),
            HumanMessage(content=human_prompt)
        ])
        
        # Parse JSON
        content = res.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].strip()
            
        data = json.loads(content)
        
        return {
            "about_us": data.get("about_us", ""),
            "culture_keywords": data.get("culture_keywords", ""),
            "benefits_text": data.get("benefits_text", ""),
            "fallback_used": fallback_used
        }
    except Exception as e:
        return {
            "error": str(e),
            "about_us": "Could not automatically fetch details from the provided website.",
            "culture_keywords": "Innovation, Collaboration, Excellence",
            "benefits_text": "Please manually enter your benefits.",
            "fallback_used": fallback_used
        }


@router.post("/org/upload-handbook")
async def extract_from_handbook(
    file: UploadFile = File(...),
    user: dict = Depends(require_org_head)
):
    """Extract company details from a PDF handbook using LLM."""
    if not file.filename.lower().endswith(".pdf"):
        return {"error": "Only PDF files are supported."}
        
    try:
        content = await file.read()
        import io
        import pdfplumber
        
        pdf_file = io.BytesIO(content)
        text = ""
        with pdfplumber.open(pdf_file) as pdf:
            # Only read up to 10 pages to avoid massive token consumption
            for page in pdf.pages[:10]:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
        
        if not text.strip():
            return {"error": "No extractable text found in the PDF."}
            
        text = text[:15000]
        
        # LLM Extraction
        llm = get_llm(temperature=0)
        sys_prompt = "You are an expert corporate researcher. Extract details from the provided company handbook/document and return a valid JSON object strictly matching this schema: {\"about_us\": \"String, 1-2 paragraphs\", \"culture_keywords\": \"String, comma-separated list of 3-6 keywords\", \"benefits_text\": \"String, short description of benefits or perks mentioned\"}. If not found, make an educated guess or leave empty."
        human_prompt = f"Handbook Content:\n{text}"
        
        res = await llm.ainvoke([
            SystemMessage(content=sys_prompt),
            HumanMessage(content=human_prompt)
        ])
        
        # Parse JSON
        content = res.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].strip()
            
        data = json.loads(content)
        
        return {
            "about_us": data.get("about_us", ""),
            "culture_keywords": data.get("culture_keywords", ""),
            "benefits_text": data.get("benefits_text", ""),
        }
    except Exception as e:
        return {
            "error": f"Failed to extract text from PDF: {str(e)}"
        }

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
    user: dict = Depends(require_org_head),
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
    user: dict = Depends(require_dept_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """Update a department (admin only)."""
    if user["role"] == "dept_admin" and user.get("dept_id") != dept_id:
        raise InsufficientPermissionsError("You can only modify your own department")
    fields = body.model_dump(exclude_none=True)
    dept = await SettingsService.update_department(
        db, dept_id, user["org_id"], user["user_id"], **fields,
    )
    return {"department": dept}


@router.delete("/departments/{dept_id}")
async def delete_department(
    dept_id: int,
    user: dict = Depends(require_org_head),
    db: asyncpg.Connection = Depends(get_db),
):
    """Delete a department (admin only, must be empty)."""
    await SettingsService.delete_department(db, dept_id, user["org_id"], user["user_id"])
    return {"message": "Department deleted"}


# ── Competitors ────────────────────────────────────────────────────────────────

@router.get("/competitors")
async def list_competitors(
    department_id: Optional[int] = None,
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """List competitors. If org_head, they see all (or filtered). If dept_admin, they see only theirs unless specified otherwise, but service allows filtering."""
    if user["role"] == "dept_admin":
        # Dept admin can only see their department's competitors
        department_id = user.get("dept_id")
        
    comps = await SettingsService.list_competitors(db, user["org_id"], department_id)
    return {"competitors": comps}


@router.post("/competitors")
async def create_competitor(
    body: CompetitorCreate,
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Add a competitor."""
    # Ensure Dept Admin can only add to their department
    dept_id = body.department_id
    if user["role"] == "dept_admin" and dept_id != user.get("dept_id"):
        raise InsufficientPermissionsError("Department Admin can only add competitors to their own department")
        
    comp = await SettingsService.create_competitor(
        db, user["org_id"], user["user_id"], dept_id,
        name=body.name, website=body.website,
        industry=body.industry, notes=body.notes,
    )
    return {"competitor": comp}


@router.patch("/competitors/{competitor_id}")
async def update_competitor(
    competitor_id: int,
    body: CompetitorUpdate,
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Update a competitor."""
    if user["role"] == "dept_admin":
        from backend.db.repositories.competitors import CompetitorRepository
        comp = await CompetitorRepository.get_by_id(db, competitor_id, user["org_id"])
        if comp and comp.get("department_id") != user.get("dept_id"):
            raise InsufficientPermissionsError("Department Admin can only edit competitors in their own department")
            
    fields = body.model_dump(exclude_none=True)
    comp = await SettingsService.update_competitor(
        db, competitor_id, user["org_id"], user["user_id"], **fields,
    )
    return {"competitor": comp}


@router.delete("/competitors/{competitor_id}")
async def delete_competitor(
    competitor_id: int,
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Delete a competitor."""
    if user["role"] == "dept_admin":
        from backend.db.repositories.competitors import CompetitorRepository
        comp = await CompetitorRepository.get_by_id(db, competitor_id, user["org_id"])
        if comp and comp.get("department_id") != user.get("dept_id"):
            raise InsufficientPermissionsError("Department Admin can only delete competitors in their own department")
            
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
    user: dict = Depends(require_org_head),
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


@router.patch("/screening-questions/reorder")
async def reorder_screening_questions(
    body: ReorderRequest,
    user: dict = Depends(require_org_head),
    db: asyncpg.Connection = Depends(get_db),
):
    """Reorder screening questions (admin only).

    Must be registered BEFORE /{question_id} — FastAPI matches routes in order
    and 'reorder' would otherwise be captured as a question_id parameter.
    """
    await SettingsService.reorder_screening_questions(db, user["org_id"], body.order)
    return {"message": "Questions reordered"}


@router.patch("/screening-questions/{question_id}")
async def update_screening_question(
    question_id: int,
    body: ScreeningQuestionUpdate,
    user: dict = Depends(require_org_head),
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
    user: dict = Depends(require_org_head),
    db: asyncpg.Connection = Depends(get_db),
):
    """Delete a screening question (admin only)."""
    await SettingsService.delete_screening_question(
        db, question_id, user["org_id"], user["user_id"],
    )
    return {"message": "Screening question deleted"}


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
    user: dict = Depends(require_hr),
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
    user: dict = Depends(require_hr),
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
    user: dict = Depends(require_hr),
    db: asyncpg.Connection = Depends(get_db),
):
    """Delete a message template (admin only)."""
    await SettingsService.delete_message_template(
        db, template_id, user["org_id"], user["user_id"],
    )
    return {"message": "Template deleted"}


class AutoDraftTemplateRequest(BaseModel):
    category: str
    tone: str
    scenario: str

@router.post("/message-templates/auto-draft")
async def auto_draft_message_template(
    body: AutoDraftTemplateRequest,
    user: dict = Depends(require_hr),
):
    """Generate a message template subject and body based on tone and scenario."""
    llm = get_llm(temperature=0.7)
    sys_prompt = (
        "You are an expert HR copywriter. Draft an email template based on the given category, tone, and scenario. "
        "You MUST use the following variables exactly as shown where appropriate: "
        "{{candidate_name}}, {{role_name}}, {{org_name}}, {{magic_link}}, {{interview_date}}, {{interview_time}}, {{round_name}}. "
        "IMPORTANT: Always include a professional signature block at the end of the email body (e.g., Best regards, [Sender Name] / {{org_name}}). "
        "Return a valid JSON object strictly matching this schema: {\"name\": \"String (A short title for this template)\", \"subject\": \"String\", \"body\": \"String\"}."
    )
    human_prompt = f"Category: {body.category}\nTone: {body.tone}\nScenario: {body.scenario}"
    
    try:
        res = await llm.ainvoke([
            SystemMessage(content=sys_prompt),
            HumanMessage(content=human_prompt)
        ])
        content = res.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].strip()
            
        data = json.loads(content)
        return {
            "name": data.get("name", "Generated Template"),
            "subject": data.get("subject", ""),
            "body": data.get("body", "")
        }
    except Exception as e:
        return {"error": f"Failed to draft template: {str(e)}"}


class AnalyzeToneRequest(BaseModel):
    subject: str
    body: str

@router.post("/message-templates/analyze-tone")
async def analyze_message_tone(
    body: AnalyzeToneRequest,
    user: dict = Depends(require_hr),
):
    """Analyze the tone and potential bias of a message template."""
    llm = get_llm(temperature=0.2)
    sys_prompt = (
        "You are an HR communications expert. Analyze the provided email subject and body for tone and potential bias. "
        "Return a very concise 1-2 sentence assessment. Point out if it's too cold, aggressive, or contains biased language. "
        "If it is good, say it is professional and appropriate."
    )
    human_prompt = f"Subject: {body.subject}\n\nBody:\n{body.body}"
    
    try:
        res = await llm.ainvoke([
            SystemMessage(content=sys_prompt),
            HumanMessage(content=human_prompt)
        ])
        return {"analysis": res.content.strip()}
    except Exception as e:
        return {"error": f"Analysis failed: {str(e)}"}


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
    user: dict = Depends(require_org_head),
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
    user: dict = Depends(require_org_head),
    db: asyncpg.Connection = Depends(get_db),
):
    """Update a scorecard template (admin only)."""
    fields = body.model_dump(exclude_none=True)
    t = await SettingsService.update_scorecard_template(
        db, template_id, user["org_id"], user["user_id"], **fields,
    )
    return {"template": t}

@router.delete("/scorecard-templates/{template_id}")
async def delete_scorecard_template(
    template_id: int,
    user: dict = Depends(require_org_head),
    db: asyncpg.Connection = Depends(get_db),
):
    """Delete a scorecard template (admin only)."""
    await SettingsService.delete_scorecard_template(
        db, template_id, user["org_id"], user["user_id"],
    )
    return {"message": "Template deleted"}

@router.post("/scorecard-templates/{template_id}/set-default")
async def set_default_scorecard_template(
    template_id: int,
    user: dict = Depends(require_org_head),
    db: asyncpg.Connection = Depends(get_db),
):
    """Set a scorecard template as default (admin only)."""
    t = await SettingsService.set_default_scorecard_template(
        db, template_id, user["org_id"], user["user_id"],
    )
    return {"template": t}


# ── AI Behavior Settings ──────────────────────────────────────────────────────

@router.get("/ai-behavior")
async def get_ai_behavior_settings(
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Get AI behavior settings for the org."""
    settings = await SettingsService.get_ai_behavior(db, user["org_id"])
    return {"settings": settings}


@router.patch("/ai-behavior")
async def update_ai_behavior_settings(
    body: AiBehaviorBody,
    user: dict = Depends(require_org_head),
    db: asyncpg.Connection = Depends(get_db),
):
    """Update AI behavior settings (org_head only)."""
    settings = await SettingsService.update_ai_behavior(
        db, user["org_id"], user["user_id"],
        body.model_dump(),
    )
    return {"settings": settings}


# ── Audit Logs ────────────────────────────────────────────────────────────────

@router.get("/audit-logs")
async def get_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user_id: Optional[int] = Query(None),
    action: Optional[str] = Query(None),
    user: dict = Depends(require_org_head),
):
    """List audit logs (admin only)."""
    from backend.services.audit_service import AuditService
    return await AuditService.get_logs(
        org_id=user["org_id"],
        limit=limit,
        offset=offset,
        user_id_filter=user_id,
        action_filter=action
    )

