"""
services/settings_service.py – Settings business logic.
Org profile, departments, competitors, screening questions,
message templates, scorecard templates. No HTTP, no SQL — uses repositories.
"""
import json
import logging
from typing import Optional, List

import asyncpg

from backend.db.repositories.organizations import OrgRepository
from backend.db.repositories.departments import DeptRepository
from backend.db.repositories.competitors import CompetitorRepository
from backend.db.repositories.screening_questions import ScreeningQuestionRepository
from backend.db.repositories.message_templates import MessageTemplateRepository
from backend.db.repositories.scorecard_templates import ScorecardTemplateRepository
from backend.db.repositories.audit import AuditLogRepository
from backend.exceptions import NotFoundError, ValidationError

logger = logging.getLogger(__name__)


class SettingsService:
    """Settings business logic."""

    # ── Org Profile ────────────────────────────────────────────────────────────

    @staticmethod
    async def get_org(conn: asyncpg.Connection, org_id: int) -> dict:
        org = await OrgRepository.get_by_id(conn, org_id)
        if not org:
            raise NotFoundError("Organization not found")
        return org

    @staticmethod
    async def update_org(
        conn: asyncpg.Connection,
        org_id: int,
        user_id: int,
        **fields,
    ) -> dict:
        org = await OrgRepository.update(conn, org_id, **fields)
        if not org:
            raise NotFoundError("Organization not found")

        await AuditLogRepository.create(
            conn,
            org_id=org_id,
            user_id=user_id,
            action="org_updated",
            entity_type="organization",
            entity_id=str(org_id),
            details=fields,
        )
        return org

    # ── Departments ────────────────────────────────────────────────────────────

    @staticmethod
    async def list_departments(conn: asyncpg.Connection, org_id: int) -> List[dict]:
        return await DeptRepository.list_by_org(conn, org_id)

    @staticmethod
    async def create_department(
        conn: asyncpg.Connection,
        org_id: int,
        user_id: int,
        name: str,
        description: Optional[str] = None,
        parent_dept_id: Optional[int] = None,
        head_user_id: Optional[int] = None,
    ) -> dict:
        dept = await DeptRepository.create(
            conn, org_id, name, description, parent_dept_id, head_user_id,
        )
        await AuditLogRepository.create(
            conn, org_id=org_id, user_id=user_id,
            action="department_created", entity_type="department",
            entity_id=str(dept["id"]),
        )
        return dept

    @staticmethod
    async def update_department(
        conn: asyncpg.Connection,
        dept_id: int,
        org_id: int,
        user_id: int,
        **fields,
    ) -> dict:
        dept = await DeptRepository.update(conn, dept_id, org_id, **fields)
        if not dept:
            raise NotFoundError("Department not found")
        await AuditLogRepository.create(
            conn, org_id=org_id, user_id=user_id,
            action="department_updated", entity_type="department",
            entity_id=str(dept_id), details=fields,
        )
        return dept

    @staticmethod
    async def delete_department(
        conn: asyncpg.Connection,
        dept_id: int,
        org_id: int,
        user_id: int,
    ) -> None:
        dept = await DeptRepository.get_by_id(conn, dept_id, org_id)
        if not dept:
            raise NotFoundError("Department not found")

        deps = await DeptRepository.has_dependencies(conn, dept_id, org_id)
        if deps["has_dependencies"]:
            parts = []
            if deps["user_count"]:
                parts.append(f"{deps['user_count']} user(s)")
            if deps["position_count"]:
                parts.append(f"{deps['position_count']} position(s)")
            if deps["child_count"]:
                parts.append(f"{deps['child_count']} sub-department(s)")
            raise ValidationError(
                f"Cannot delete — department has {', '.join(parts)}"
            )

        await DeptRepository.delete(conn, dept_id, org_id)
        await AuditLogRepository.create(
            conn, org_id=org_id, user_id=user_id,
            action="department_deleted", entity_type="department",
            entity_id=str(dept_id),
        )

    # ── Competitors ────────────────────────────────────────────────────────────

    @staticmethod
    async def list_competitors(conn: asyncpg.Connection, org_id: int, department_id: Optional[int] = None) -> List[dict]:
        return await CompetitorRepository.list_by_org(conn, org_id, department_id)

    @staticmethod
    async def create_competitor(
        conn: asyncpg.Connection,
        org_id: int,
        user_id: int,
        department_id: int,
        name: str,
        website: Optional[str] = None,
        industry: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> dict:
        # Check limit
        comps = await CompetitorRepository.list_by_org(conn, org_id, department_id)
        if len(comps) >= 3:
            raise ValidationError("A maximum of 3 competitors is allowed per department.")
            
        comp = await CompetitorRepository.create(conn, org_id, name, department_id, website, industry, notes)
        
        # Audit log
        await AuditLogRepository.create(
            conn, org_id=org_id, user_id=user_id,
            action="competitor_created", entity_type="competitor",
            entity_id=str(comp["id"]),
        )
        
        # Notifications
        from backend.db.repositories.users import UserRepository
        from backend.db.repositories.notifications import NotificationRepository
        from backend.db.repositories.departments import DeptRepository
        
        creator = await UserRepository.get_by_id(conn, user_id, org_id)
        dept = await DeptRepository.get_by_id(conn, department_id, org_id)
        dept_name = dept["name"] if dept else "Unknown Dept"
        
        if creator and creator["role"] == "dept_admin":
            # Notify org heads
            org_heads = await conn.fetch("SELECT id FROM users WHERE org_id=$1 AND role='org_head'", org_id)
            for head in org_heads:
                await NotificationRepository.create(
                    conn,
                    {
                        "org_id": org_id,
                        "user_id": head["id"],
                        "type": "competitor_added",
                        "title": f"New Competitor for {dept_name}",
                        "message": f"{creator['name']} added {name} to {dept_name} competitors.",
                        "action_url": "/settings?tab=competitors"
                    }
                )
        elif creator and creator["role"] == "org_head":
            # Notify dept admins
            dept_admins = await conn.fetch("SELECT id FROM users WHERE org_id=$1 AND role='dept_admin' AND department_id=$2", org_id, department_id)
            for admin in dept_admins:
                await NotificationRepository.create(
                    conn,
                    {
                        "org_id": org_id,
                        "user_id": admin["id"],
                        "type": "competitor_added",
                        "title": f"New Competitor for {dept_name}",
                        "message": f"{creator['name']} added {name} to your department's competitors.",
                        "action_url": "/settings?tab=competitors"
                    }
                )
                
        return comp

    @staticmethod
    async def update_competitor(
        conn: asyncpg.Connection,
        competitor_id: int,
        org_id: int,
        user_id: int,
        **fields,
    ) -> dict:
        comp = await CompetitorRepository.update(conn, competitor_id, org_id, **fields)
        if not comp:
            raise NotFoundError("Competitor not found")
        await AuditLogRepository.create(
            conn, org_id=org_id, user_id=user_id,
            action="competitor_updated", entity_type="competitor",
            entity_id=str(competitor_id), details=fields,
        )
        return comp
    @staticmethod
    async def delete_competitor(
        conn: asyncpg.Connection,
        competitor_id: int,
        org_id: int,
        user_id: int,
    ) -> None:
        comp = await CompetitorRepository.get_by_id(conn, competitor_id, org_id)
        if not comp:
            raise NotFoundError("Competitor not found")
        await CompetitorRepository.delete(conn, competitor_id, org_id)
        await AuditLogRepository.create(
            conn, org_id=org_id, user_id=user_id,
            action="competitor_deleted", entity_type="competitor",
            entity_id=str(competitor_id),
        )
        
        department_id = comp.get("department_id")
        if department_id:
            from backend.db.repositories.users import UserRepository
            from backend.db.repositories.notifications import NotificationRepository
            from backend.db.repositories.departments import DeptRepository
            
            creator = await UserRepository.get_by_id(conn, user_id, org_id)
            dept = await DeptRepository.get_by_id(conn, department_id, org_id)
            dept_name = dept["name"] if dept else "Unknown Dept"
            creator_name = creator["name"] if creator else "System"
            
            if creator and creator.get("role") == "dept_admin":
                org_heads = await conn.fetch("SELECT id FROM users WHERE org_id=$1 AND role='org_head'", org_id)
                for head in org_heads:
                    await NotificationRepository.create(
                        conn,
                        {
                            "org_id": org_id,
                            "user_id": head["id"],
                            "type": "competitor_removed",
                            "title": f"Competitor Removed for {dept_name}",
                            "message": f"{creator_name} removed {comp['name']} from {dept_name} competitors.",
                            "action_url": "/settings?tab=competitors"
                        }
                    )
            elif creator and creator.get("role") == "org_head":
                dept_admins = await conn.fetch("SELECT id FROM users WHERE org_id=$1 AND role='dept_admin' AND department_id=$2", org_id, department_id)
                for admin in dept_admins:
                    await NotificationRepository.create(
                        conn,
                        {
                            "org_id": org_id,
                            "user_id": admin["id"],
                            "type": "competitor_removed",
                            "title": f"Competitor Removed for {dept_name}",
                            "message": f"{creator_name} removed {comp['name']} from your department's competitors.",
                            "action_url": "/settings?tab=competitors"
                        }
                    )

    # ── Screening Questions ────────────────────────────────────────────────────

    @staticmethod
    async def list_screening_questions(
        conn: asyncpg.Connection,
        org_id: int,
        department_id: Optional[int] = None,
    ) -> List[dict]:
        return await ScreeningQuestionRepository.list_all_by_org(conn, org_id)

    @staticmethod
    async def create_screening_question(
        conn: asyncpg.Connection,
        org_id: int,
        user_id: int,
        field_key: str,
        label: str,
        field_type: str = "text",
        options: Optional[str] = None,
        is_required: bool = False,
        department_id: Optional[int] = None,
        sort_order: int = 0,
    ) -> dict:
        q = await ScreeningQuestionRepository.create(
            conn, org_id, field_key, label, field_type,
            options, is_required, department_id, sort_order,
        )
        await AuditLogRepository.create(
            conn, org_id=org_id, user_id=user_id,
            action="screening_question_created", entity_type="screening_question",
            entity_id=str(q["id"]),
        )
        return q

    @staticmethod
    async def update_screening_question(
        conn: asyncpg.Connection,
        question_id: int,
        org_id: int,
        user_id: int,
        **fields,
    ) -> dict:
        q = await ScreeningQuestionRepository.update(conn, question_id, org_id, **fields)
        if not q:
            raise NotFoundError("Screening question not found")
        return q

    @staticmethod
    async def delete_screening_question(
        conn: asyncpg.Connection,
        question_id: int,
        org_id: int,
        user_id: int,
    ) -> None:
        q = await ScreeningQuestionRepository.get_by_id(conn, question_id, org_id)
        if not q:
            raise NotFoundError("Screening question not found")
        await ScreeningQuestionRepository.delete(conn, question_id, org_id)

    @staticmethod
    async def reorder_screening_questions(
        conn: asyncpg.Connection,
        org_id: int,
        order: List[dict],
    ) -> None:
        await ScreeningQuestionRepository.reorder(conn, org_id, order)

    # ── Message Templates ──────────────────────────────────────────────────────

    @staticmethod
    async def list_message_templates(
        conn: asyncpg.Connection,
        org_id: int,
        category: Optional[str] = None,
    ) -> List[dict]:
        return await MessageTemplateRepository.list_by_org(conn, org_id, category)

    @staticmethod
    async def create_message_template(
        conn: asyncpg.Connection,
        org_id: int,
        user_id: int,
        name: str,
        category: str,
        body: str,
        subject: Optional[str] = None,
    ) -> dict:
        t = await MessageTemplateRepository.create(conn, org_id, name, category, body, subject)
        await AuditLogRepository.create(
            conn, org_id=org_id, user_id=user_id,
            action="message_template_created", entity_type="message_template",
            entity_id=str(t["id"]),
        )
        
        # Notifications
        from backend.db.repositories.users import UserRepository
        from backend.db.repositories.notifications import NotificationRepository
        
        creator = await UserRepository.get_by_id(conn, user_id, org_id)
        creator_name = creator["name"] if creator else "System"
        
        users_to_notify = await conn.fetch(
            "SELECT id FROM users WHERE org_id=$1 AND role IN ('hr', 'org_head', 'dept_admin') AND id != $2",
            org_id, user_id
        )
        
        for u in users_to_notify:
            await NotificationRepository.create(
                conn,
                {
                    "org_id": org_id,
                    "user_id": u["id"],
                    "type": "template_added",
                    "title": "New Message Template",
                    "message": f"{creator_name} created a new message template: {name}",
                    "action_url": "/settings/templates"
                }
            )
            
        return t

    @staticmethod
    async def update_message_template(
        conn: asyncpg.Connection,
        template_id: int,
        org_id: int,
        user_id: int,
        **fields,
    ) -> dict:
        t = await MessageTemplateRepository.update(conn, template_id, org_id, **fields)
        if not t:
            raise NotFoundError("Message template not found")
            
        # Notifications
        from backend.db.repositories.users import UserRepository
        from backend.db.repositories.notifications import NotificationRepository
        
        creator = await UserRepository.get_by_id(conn, user_id, org_id)
        creator_name = creator["name"] if creator else "System"
        
        users_to_notify = await conn.fetch(
            "SELECT id FROM users WHERE org_id=$1 AND role IN ('hr', 'org_head', 'dept_admin') AND id != $2",
            org_id, user_id
        )
        
        for u in users_to_notify:
            await NotificationRepository.create(
                conn,
                {
                    "org_id": org_id,
                    "user_id": u["id"],
                    "type": "template_updated",
                    "title": "Message Template Updated",
                    "message": f"{creator_name} updated the message template: {t['name']}",
                    "action_url": "/settings/templates"
                }
            )
            
        return t

    @staticmethod
    async def delete_message_template(
        conn: asyncpg.Connection,
        template_id: int,
        org_id: int,
        user_id: int,
    ) -> None:
        t = await MessageTemplateRepository.get_by_id(conn, template_id, org_id)
        if not t:
            raise NotFoundError("Message template not found")
        await MessageTemplateRepository.delete(conn, template_id, org_id)

    # ── Scorecard Templates ────────────────────────────────────────────────────

    @staticmethod
    async def list_scorecard_templates(conn: asyncpg.Connection, org_id: int) -> List[dict]:
        return await ScorecardTemplateRepository.list_by_org(conn, org_id)

    @staticmethod
    async def create_scorecard_template(
        conn: asyncpg.Connection,
        org_id: int,
        user_id: int,
        name: str,
        dimensions: str,
        is_default: bool = False,
    ) -> dict:
        t = await ScorecardTemplateRepository.create(conn, org_id, name, dimensions, is_default)
        await AuditLogRepository.create(
            conn, org_id=org_id, user_id=user_id,
            action="scorecard_template_created", entity_type="scorecard_template",
            entity_id=str(t["id"]),
        )
        return t

    @staticmethod
    async def update_scorecard_template(
        conn: asyncpg.Connection,
        template_id: int,
        org_id: int,
        user_id: int,
        **fields,
    ) -> dict:
        t = await ScorecardTemplateRepository.update(conn, template_id, org_id, **fields)
        if not t:
            raise NotFoundError("Scorecard template not found")
        return t

    @staticmethod
    async def delete_scorecard_template(
        conn: asyncpg.Connection,
        template_id: int,
        org_id: int,
        user_id: int,
    ) -> None:
        t = await ScorecardTemplateRepository.get_by_id(conn, template_id, org_id)
        if not t:
            raise NotFoundError("Scorecard template not found")
        await ScorecardTemplateRepository.delete(conn, template_id, org_id)

    @staticmethod
    async def set_default_scorecard_template(
        conn: asyncpg.Connection,
        template_id: int,
        org_id: int,
        user_id: int,
    ) -> dict:
        t = await ScorecardTemplateRepository.get_by_id(conn, template_id, org_id)
        if not t:
            raise NotFoundError("Scorecard template not found")
        
        # Unset default on all other templates
        await conn.execute(
            "UPDATE scorecard_templates SET is_default = FALSE WHERE org_id = $1",
            org_id
        )
        
        # Set default on the target template
        t = await ScorecardTemplateRepository.update(conn, template_id, org_id, is_default=True)
        if not t:
            raise NotFoundError("Scorecard template not found during update")
        return t

    # ── AI Behavior Settings ───────────────────────────────────────────────────

    @staticmethod
    async def get_ai_behavior(conn: asyncpg.Connection, org_id: int) -> dict:
        """Return the org's ai_behavior_settings JSONB column as a plain dict."""
        row = await conn.fetchrow(
            "SELECT ai_behavior_settings FROM organizations WHERE id=$1",
            org_id,
        )
        if row and row["ai_behavior_settings"]:
            val = row["ai_behavior_settings"]
            if isinstance(val, str):
                import json
                try:
                    val = json.loads(val)
                except Exception:
                    val = {}
            if isinstance(val, dict):
                return val
            try:
                return dict(val)
            except (TypeError, ValueError):
                return {}
        return {}

    @staticmethod
    async def update_ai_behavior(
        conn: asyncpg.Connection,
        org_id: int,
        user_id: int,
        settings: dict,
    ) -> dict:
        """Persist ai_behavior_settings and write an audit entry."""
        row = await conn.fetchrow(
            """UPDATE organizations
               SET ai_behavior_settings = $1
               WHERE id = $2
               RETURNING ai_behavior_settings""",
            json.dumps(settings),
            org_id,
        )
        await AuditLogRepository.create(
            conn,
            org_id=org_id,
            user_id=user_id,
            action="update_ai_behavior",
            entity_type="organization",
            entity_id=str(org_id),
            details=settings,
        )
        if row and row["ai_behavior_settings"]:
            val = row["ai_behavior_settings"]
            return dict(val) if not isinstance(val, dict) else val
        return {}

    # ── Sourcing Config ────────────────────────────────────────────────────────

    @staticmethod
    async def get_sourcing_config(conn: asyncpg.Connection, org_id: int) -> dict:
        """Return the org's sourcing_config JSONB column as a plain dict."""
        row = await conn.fetchrow(
            "SELECT sourcing_config FROM organizations WHERE id=$1",
            org_id,
        )
        if row and row["sourcing_config"]:
            val = row["sourcing_config"]
            if isinstance(val, str):
                import json
                try:
                    val = json.loads(val)
                except Exception:
                    val = {}
            if isinstance(val, dict):
                return val
            try:
                return dict(val)
            except (TypeError, ValueError):
                return {}
        return {}

    @staticmethod
    async def update_sourcing_config(
        conn: asyncpg.Connection,
        org_id: int,
        user_id: int,
        settings: dict,
    ) -> dict:
        """Persist sourcing_config and write an audit entry."""
        row = await conn.fetchrow(
            """UPDATE organizations
               SET sourcing_config = $1
               WHERE id = $2
               RETURNING sourcing_config""",
            json.dumps(settings),
            org_id,
        )
        await AuditLogRepository.create(
            conn,
            org_id=org_id,
            user_id=user_id,
            action="update_sourcing_config",
            entity_type="organization",
            entity_id=str(org_id),
            details=settings,
        )
        if row and row["sourcing_config"]:
            val = row["sourcing_config"]
            return dict(val) if not isinstance(val, dict) else val
        return {}

    # ── Default Seeding ────────────────────────────────────────────────────────

    @staticmethod
    async def seed_defaults(conn: asyncpg.Connection, org_id: int) -> None:
        """
        Seed default data for a new org. Called during registration.
        - 5 default screening questions
        - 5 default message templates
        - 1 default scorecard template
        """
        logger.info(f"Seeding defaults for org {org_id}...")

        # 1. Default department (removed per request)
        # No default department created

        # 2. Default screening questions
        default_questions = [
            {"field_key": "office_availability", "label": "Office Availability", "field_type": "select",
             "options": "Yes (3 days/week),Yes (5 days/week),No (Remote only)", "is_required": True, "sort_order": 1},
        ]
        for q in default_questions:
            await ScreeningQuestionRepository.create(
                conn, 
                org_id, 
                field_key=str(q["field_key"]), 
                label=str(q["label"]), 
                field_type=str(q.get("field_type", "text")),
                options=str(q["options"]) if "options" in q else None,
                is_required=bool(q.get("is_required", False)),
                sort_order=int(q.get("sort_order", 0))
            )

        # 3. Default message templates
        default_templates = [
            {
                "name": "Initial Outreach",
                "category": "outreach",
                "subject": "Exciting opportunity at {{org_name}}",
                "body": "Hi {{candidate_name}},\n\nWe came across your profile and think you'd be a great fit for the {{role_name}} role at {{org_name}}.\n\nClick below to learn more and apply:\n{{magic_link}}\n\nBest regards,\n{{org_name}} Hiring Team",
                "is_default": True,
            },
            {
                "name": "Interview Process Overview",
                "category": "interview_process_overview",
                "subject": "Your application for {{role_name}} at {{org_name}}",
                "body": "Hi {{candidate_name}},\n\nThank you for applying for {{role_name}} at {{org_name}}! Here's what to expect:\n\n1. Our team will review your application\n2. If shortlisted, we'll schedule an interview\n3. You'll receive feedback within 5 business days\n\nWe appreciate your interest!\n\nBest,\n{{org_name}} Hiring Team",
                "is_default": True,
            },
            {
                "name": "Rejection",
                "category": "rejection",
                "subject": "Update on your application — {{role_name}} at {{org_name}}",
                "body": "Hi {{candidate_name}},\n\nThank you for your interest in the {{role_name}} position at {{org_name}}. After careful consideration, we've decided to move forward with other candidates.\n\nWe encourage you to apply for future openings. We'll keep your profile in our talent pool.\n\nBest wishes,\n{{org_name}} Hiring Team",
                "is_default": True,
            },
            {
                "name": "Interview Invite",
                "category": "interview_invite",
                "subject": "Interview scheduled — {{role_name}} at {{org_name}}",
                "body": "Hi {{candidate_name}},\n\nWe'd like to invite you for a {{round_name}} interview for the {{role_name}} position.\n\nDate: {{interview_date}}\nTime: {{interview_time}}\n\nPlease confirm your availability.\n\nBest,\n{{org_name}} Hiring Team",
                "is_default": True,
            },
            {
                "name": "Follow-up",
                "category": "follow_up",
                "subject": "Following up — {{role_name}} at {{org_name}}",
                "body": "Hi {{candidate_name}},\n\nJust checking back on your interest in the {{role_name}} role at {{org_name}}.\n\nIf you're still interested, click below to complete your application:\n{{magic_link}}\n\nBest,\n{{org_name}} Hiring Team",
                "is_default": True,
            },
        ]
        for t in default_templates:
            await MessageTemplateRepository.create(
                conn, 
                org_id, 
                name=str(t["name"]), 
                category=str(t["category"]), 
                body=str(t["body"]), 
                subject=str(t["subject"]) if "subject" in t else None,
                is_default=bool(t.get("is_default", False))
            )

        # 4. Default scorecard template
        default_dimensions = json.dumps([
            {"name": "Technical Skills", "weight": 40, "description": "Assess technical depth and breadth relevant to the role"},
            {"name": "Problem Solving", "weight": 30, "description": "Ability to break down complex problems and propose solutions"},
            {"name": "Communication", "weight": 15, "description": "Clarity, listening skills, and ability to articulate ideas"},
            {"name": "Culture Fit", "weight": 15, "description": "Alignment with company values and team dynamics"},
        ])
        await ScorecardTemplateRepository.create(
            conn, org_id, "Default Technical", default_dimensions, is_default=True,
        )

        logger.info(f"Defaults seeded for org {org_id}")


    @staticmethod
    def get_providers() -> dict:
        """Read providers configuration from current environment settings."""
        from backend.config import settings
        
        def mask_key(k: str) -> str | None:
            if not k:
                return None
            return f"sk-...{k[-4:]}" if len(k) > 4 else "sk-...****"

        return {
            "llm_provider": settings.LLM_PROVIDER,
            "llm_model": settings.LLM_MODEL,
            "groq_api_key_masked": mask_key(settings.GROQ_API_KEY),
            "openai_api_key_masked": mask_key(settings.OPENAI_API_KEY),
            "gemini_api_key_masked": mask_key(settings.GEMINI_API_KEY),
            "embedding_provider": settings.EMBEDDING_PROVIDER,
            "embedding_model": settings.EMBEDDING_MODEL,
            "embedding_api_key_masked": mask_key(settings.EMBEDDING_API_KEY),
            "web_search_provider": settings.WEB_SEARCH_PROVIDER,
            "tavily_api_key_masked": mask_key(settings.TAVILY_API_KEY),
            "brave_api_key_masked": mask_key(settings.BRAVE_API_KEY),
            "serpapi_api_key_masked": mask_key(settings.SERPAPI_API_KEY),
            "exa_api_key_masked": mask_key(settings.EXA_API_KEY),
            "enrichment_provider": settings.ENRICHMENT_PROVIDER,
            "proxycurl_api_key_masked": mask_key(settings.PROXYCURL_API_KEY),
            "apollo_api_key_masked": mask_key(settings.APOLLO_API_KEY),
            "hunter_api_key_masked": mask_key(settings.HUNTER_API_KEY),
            "email_provider": settings.EMAIL_PROVIDER,
            "resend_api_key_masked": mask_key(settings.RESEND_API_KEY),
            "smtp_host": settings.SMTP_HOST,
            "smtp_port": settings.SMTP_PORT,
            "smtp_user": settings.SMTP_USER,
            "smtp_password_masked": mask_key(settings.SMTP_PASSWORD),
            "from_email": settings.FROM_EMAIL,
            "from_name": settings.FROM_NAME,
        }

    @staticmethod
    def update_providers(updates: dict) -> dict:
        """Update .env file and current settings with new provider configs."""
        from backend.config import settings
        from dotenv import set_key
        import os

        env_path = ".env"
        if not os.path.exists(env_path):
            open(env_path, "a").close()

        for key, value in updates.items():
            if value is not None:
                env_key = key.upper()
                # Update the running settings instance
                setattr(settings, env_key, value)
                # Persist to .env
                set_key(env_path, env_key, str(value))
        
        return SettingsService.get_providers()
