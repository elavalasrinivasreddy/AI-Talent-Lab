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
    async def list_competitors(conn: asyncpg.Connection, org_id: int) -> List[dict]:
        return await CompetitorRepository.list_by_org(conn, org_id)

    @staticmethod
    async def create_competitor(
        conn: asyncpg.Connection,
        org_id: int,
        user_id: int,
        name: str,
        website: Optional[str] = None,
        industry: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> dict:
        comp = await CompetitorRepository.create(conn, org_id, name, website, industry, notes)
        await AuditLogRepository.create(
            conn, org_id=org_id, user_id=user_id,
            action="competitor_created", entity_type="competitor",
            entity_id=str(comp["id"]),
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

    # ── Default Seeding ────────────────────────────────────────────────────────

    @staticmethod
    async def seed_defaults(conn: asyncpg.Connection, org_id: int) -> None:
        """
        Seed default data for a new org. Called during registration.
        - 1 default department ("General")
        - 5 default screening questions
        - 5 default message templates
        - 1 default scorecard template
        """
        logger.info(f"Seeding defaults for org {org_id}...")

        # 1. Default department
        await DeptRepository.create(conn, org_id, "General", "Default department")

        # 2. Default screening questions
        default_questions = [
            {"field_key": "notice_period", "label": "Notice Period", "field_type": "select",
             "options": "Immediate,15 days,30 days,60 days,90+ days", "is_required": True, "sort_order": 1},
            {"field_key": "current_ctc", "label": "Current Salary (LPA)", "field_type": "number",
             "is_required": True, "sort_order": 2},
            {"field_key": "expected_ctc", "label": "Expected Salary (LPA)", "field_type": "number",
             "is_required": True, "sort_order": 3},
            {"field_key": "total_experience", "label": "Total Experience (Years)", "field_type": "number",
             "is_required": True, "sort_order": 4},
            {"field_key": "office_availability", "label": "Office Availability", "field_type": "select",
             "options": "Yes (3 days/week),Yes (5 days/week),No (Remote only)", "is_required": True, "sort_order": 5},
        ]
        for q in default_questions:
            await ScreeningQuestionRepository.create(conn, org_id, **q)

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
            await MessageTemplateRepository.create(conn, org_id, **t)

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
