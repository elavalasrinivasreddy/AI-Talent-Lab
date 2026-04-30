"""
services/apply_service.py – Business logic for candidate magic-link apply chat.
Handles token verification, session management, message processing, resume upload, completion.
"""
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt

from backend.config import settings
from backend.db.connection import get_connection
from backend.db.repositories.candidates import CandidateRepository
from backend.db.repositories.pipeline_events import PipelineEventRepository
from backend.db.repositories.notifications import NotificationRepository
from backend.agents.candidate_chat import CandidateChatController

logger = logging.getLogger(__name__)

APPLY_TOKEN_TYPE = "apply"
APPLY_TOKEN_EXPIRY_HOURS = 72


# ── Magic Link Token ─────────────────────────────────────────────────────────

def generate_apply_token(application_id: int, candidate_id: int, org_id: int) -> str:
    """Create a signed JWT magic link token for a candidate application."""
    payload = {
        "type": APPLY_TOKEN_TYPE,
        "application_id": application_id,
        "candidate_id": candidate_id,
        "org_id": org_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=APPLY_TOKEN_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),  # unique per link — prevents reuse logs
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def verify_apply_token(token: str) -> dict:
    """
    Decode and validate apply JWT.
    Returns payload dict or raises ValueError.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != APPLY_TOKEN_TYPE:
            raise ValueError("Invalid token type")
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Token expired")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Invalid token: {e}")


# ── Apply Service ─────────────────────────────────────────────────────────────

class ApplyService:

    @staticmethod
    async def verify_and_load(token: str) -> dict:
        """
        Verify the magic link token and return full context for the apply page.
        Returns dict with: valid, already_completed, candidate, position, org, screening_questions
        """
        try:
            payload = verify_apply_token(token)
        except ValueError as e:
            return {"valid": False, "expired": "expired" in str(e), "error": str(e)}

        application_id = payload["application_id"]
        candidate_id = payload["candidate_id"]
        org_id = payload["org_id"]

        async with get_connection() as conn:
            # Load application + candidate + position + org together
            row = await conn.fetchrow(
                """
                SELECT
                    ca.id AS application_id,
                    ca.status,
                    ca.magic_link_clicked_at,
                    ca.position_id,
                    c.id AS candidate_id,
                    c.name AS candidate_name,
                    c.email,
                    c.current_title,
                    c.current_company,
                    c.experience_years,
                    p.role_name,
                    p.location,
                    p.work_type,
                    p.employment_type,
                    p.department_id,
                    p.jd_markdown,
                    p.org_id,
                    o.name AS org_name,
                    o.logo_url,
                    o.about_us,
                    o.hiring_contact_email
                FROM candidate_applications ca
                JOIN candidates c ON c.id = ca.candidate_id
                JOIN positions p ON p.id = ca.position_id
                JOIN organizations o ON o.id = p.org_id
                WHERE ca.id = $1 AND ca.org_id = $2
                """,
                application_id, org_id
            )

            if not row:
                return {"valid": False, "error": "Application not found"}

            data = dict(row)

            # Mark link as clicked if first time
            if not data.get("magic_link_clicked_at"):
                await conn.execute(
                    "UPDATE candidate_applications SET magic_link_clicked_at=NOW() WHERE id=$1",
                    application_id
                )

            # Check if already completed
            already_completed = data["status"] == "applied"

            # Load screening questions for this org/department
            sq_rows = await conn.fetch(
                """
                SELECT field_key, label, field_type, options, is_required
                FROM screening_questions
                WHERE org_id=$1 AND (department_id=$2 OR department_id IS NULL)
                  AND is_active=TRUE
                ORDER BY order_index
                """,
                org_id, data.get("department_id")
            )
            screening_questions = [dict(r) for r in sq_rows]

            # Load existing candidate session if any
            session = await conn.fetchrow(
                "SELECT * FROM candidate_sessions WHERE application_id=$1",
                application_id
            )

        session_state = {}
        messages = []

        if session:
            raw_state = session.get("session_state") or "{}"
            session_state = json.loads(raw_state) if isinstance(raw_state, str) else raw_state

            msg_raw = session.get("messages") or "[]"
            messages = json.loads(msg_raw) if isinstance(msg_raw, str) else msg_raw

        return {
            "valid": True,
            "already_completed": already_completed,
            "application_id": application_id,
            "candidate": {
                "id": data["candidate_id"],
                "name": data["candidate_name"],
                "email": data["email"],
                "current_title": data["current_title"],
                "current_company": data["current_company"],
                "experience_years": data["experience_years"],
            },
            "position": {
                "role_name": data["role_name"],
                "location": data["location"],
                "work_type": data["work_type"],
                "employment_type": data["employment_type"],
            },
            "org": {
                "name": data["org_name"],
                "logo_url": data["logo_url"],
                "about_us": data["about_us"],
                "hiring_contact_email": data.get("hiring_contact_email"),
            },
            "jd_markdown": data.get("jd_markdown"),
            "screening_questions": screening_questions,
            "session_state": session_state,
            "messages": messages,
        }

    @staticmethod
    async def send_message(token: str, user_message: str) -> dict:
        """
        Process a candidate chat message. Returns AI response + updated state.
        """
        payload = verify_apply_token(token)
        application_id = payload["application_id"]
        candidate_id = payload["candidate_id"]
        org_id = payload["org_id"]

        context = await ApplyService._load_context(application_id, org_id)
        if not context:
            raise ValueError("Application context not found")

        # Load or create session
        session_state, session_id = await ApplyService._get_or_create_session(
            application_id, candidate_id, org_id
        )

        # Process message through the chat controller
        controller = CandidateChatController(session_state, context)

        if not session_state.get("step") or session_state.get("step") == "greeting":
            # First message — run greeting first, then process the user's message
            greeting, session_state = await controller.process_message(None)
            # Save greeting
            await ApplyService._append_message(session_id, "assistant", greeting, session_state)
            ai_response = greeting
        else:
            ai_response, session_state = await controller.process_message(user_message)

        # Save user message and AI response
        await ApplyService._append_message(session_id, "user", user_message, None)
        await ApplyService._append_message(session_id, "assistant", ai_response, session_state)

        # Check for not_interested → don't advance to applied
        step = session_state.get("step")

        return {
            "response": ai_response,
            "step": step,
            "session_state": session_state,
            "completed": step == "completion",
            "not_interested": step == "declined",
        }

    @staticmethod
    async def handle_resume_upload(
        token: str, resume_text: str, filename: str
    ) -> dict:
        """
        Process a resume upload: store text, generate embedding, advance step.
        """
        from backend.services.candidate_service import generate_resume_embedding
        import json as _json

        payload = verify_apply_token(token)
        application_id = payload["application_id"]
        candidate_id = payload["candidate_id"]
        org_id = payload["org_id"]

        # Generate embedding
        embedding = []
        try:
            embedding = await generate_resume_embedding(resume_text)
        except Exception as e:
            logger.warning(f"Resume embedding failed: {e}")

        async with get_connection() as conn:
            # Store resume text in candidate record
            await conn.execute(
                """
                UPDATE candidates
                SET resume_text=$1, resume_embedding=$2, updated_at=NOW()
                WHERE id=$3 AND org_id=$4
                """,
                resume_text,
                _json.dumps(embedding) if embedding else None,
                candidate_id, org_id
            )

        # Advance session to screening_questions
        session_state, session_id = await ApplyService._get_or_create_session(
            application_id, candidate_id, org_id
        )
        session_state["step"] = "screening_questions"
        session_state["resume_uploaded"] = True
        session_state["screening_index"] = 0

        # Load screening questions to decide next step
        context = await ApplyService._load_context(application_id, org_id)
        questions = context.get("screening_questions", [])

        if questions:
            first_q = questions[0]
            ai_response = f"✅ Resume received! Thank you.\n\nOne more question — {first_q.get('label', '')}"
            session_state["screening_index"] = 1
        else:
            # No screening questions → completion
            controller = CandidateChatController(session_state, context)
            ai_response, session_state = await controller._step_complete()

        await ApplyService._append_message(session_id, "assistant", ai_response, session_state)
        await ApplyService._save_session(session_id, session_state)

        return {
            "response": ai_response,
            "step": session_state.get("step"),
        }

    @staticmethod
    async def complete_application(token: str) -> dict:
        """
        Mark the application as complete. Creates pipeline event, sends notification.
        Called automatically after the final completion message.
        """
        payload = verify_apply_token(token)
        application_id = payload["application_id"]
        candidate_id = payload["candidate_id"]
        org_id = payload["org_id"]

        async with get_connection() as conn:
            # Get session state for screening_responses
            session = await conn.fetchrow(
                "SELECT * FROM candidate_sessions WHERE application_id=$1",
                application_id
            )
            session_state = {}
            if session:
                raw = session.get("session_state") or "{}"
                session_state = json.loads(raw) if isinstance(raw, str) else raw

            screening_responses = {
                "compensation_current": session_state.get("compensation_current"),
                "compensation_expected": session_state.get("compensation_expected"),
                "compensation_declined": session_state.get("compensation_declined", False),
                "notice_period": session_state.get("notice_period"),
                "experience_total": session_state.get("experience_years"),
                "experience_relevant": session_state.get("relevant_experience_years"),
                **session_state.get("screening_responses", {}),
            }

            # Update application status
            await conn.execute(
                """
                UPDATE candidate_applications
                SET status='applied', applied_at=NOW(),
                    screening_responses=$1, updated_at=NOW()
                WHERE id=$2 AND org_id=$3
                """,
                json.dumps(screening_responses),
                application_id, org_id
            )

            # Update candidate if role changed
            if session_state.get("current_title"):
                await conn.execute(
                    "UPDATE candidates SET current_title=$1, current_company=$2, updated_at=NOW() WHERE id=$3",
                    session_state.get("current_title"),
                    session_state.get("current_company"),
                    candidate_id
                )

            # Mark session as completed
            await conn.execute(
                "UPDATE candidate_sessions SET status='completed', completed_at=NOW() WHERE application_id=$1",
                application_id
            )

            # Pipeline event
            await PipelineEventRepository.create(conn, {
                "org_id": org_id,
                "candidate_id": candidate_id,
                "application_id": application_id,
                "event_type": "applied",
                "event_data": {"source": "magic_link_chat"},
            })

            # Notify recruiter — find who created the position
            app_row = await conn.fetchrow(
                """
                SELECT p.created_by, c.name AS candidate_name, p.role_name
                FROM candidate_applications ca
                JOIN positions p ON p.id = ca.position_id
                JOIN candidates c ON c.id = ca.candidate_id
                WHERE ca.id=$1
                """,
                application_id
            )
            if app_row and app_row["created_by"]:
                await NotificationRepository.create(conn, {
                    "org_id": org_id,
                    "user_id": app_row["created_by"],
                    "type": "application_received",
                    "title": f"New Application — {app_row['role_name']}",
                    "message": f"{app_row['candidate_name']} has submitted their application via chat.",
                    "action_url": f"/positions/{payload.get('position_id')}?tab=candidates",
                })

        return {"completed": True}

    # ── Helpers ────────────────────────────────────────────────────────────────

    @staticmethod
    async def _load_context(application_id: int, org_id: int) -> Optional[dict]:
        async with get_connection() as conn:
            row = await conn.fetchrow(
                """
                SELECT
                    c.id AS candidate_id, c.name, c.email,
                    c.current_title, c.current_company, c.experience_years,
                    p.role_name, p.location, p.work_type, p.department_id,
                    p.jd_markdown,
                    o.name AS org_name, o.logo_url, o.about_us
                FROM candidate_applications ca
                JOIN candidates c ON c.id = ca.candidate_id
                JOIN positions p ON p.id = ca.position_id
                JOIN organizations o ON o.id = p.org_id
                WHERE ca.id=$1 AND ca.org_id=$2
                """,
                application_id, org_id
            )
            if not row:
                return None
            data = dict(row)

            sq_rows = await conn.fetch(
                """
                SELECT field_key, label, field_type, options, is_required
                FROM screening_questions
                WHERE org_id=$1 AND (department_id=$2 OR department_id IS NULL) AND is_active=TRUE
                ORDER BY order_index
                """,
                org_id, data.get("department_id")
            )

        return {
            "candidate": {
                "id": data["candidate_id"],
                "name": data["name"],
                "current_title": data["current_title"],
                "current_company": data["current_company"],
                "experience_years": data["experience_years"],
            },
            "position": {
                "role_name": data["role_name"],
                "location": data["location"],
                "work_type": data["work_type"],
                "jd_markdown": data.get("jd_markdown"),
            },
            "org": {
                "name": data["org_name"],
                "logo_url": data.get("logo_url"),
                "about_us": data.get("about_us"),
            },
            "screening_questions": [dict(r) for r in sq_rows],
        }

    @staticmethod
    async def _get_or_create_session(
        application_id: int, candidate_id: int, org_id: int
    ) -> tuple[dict, int]:
        async with get_connection() as conn:
            session = await conn.fetchrow(
                "SELECT * FROM candidate_sessions WHERE application_id=$1",
                application_id
            )
            if session:
                raw = session.get("session_state") or "{}"
                state = json.loads(raw) if isinstance(raw, str) else (raw or {})
                return state, session["id"]

            # Create new session
            row = await conn.fetchrow(
                """
                INSERT INTO candidate_sessions
                    (org_id, candidate_id, application_id, session_state, messages, status)
                VALUES ($1, $2, $3, $4, $5, 'active')
                RETURNING id
                """,
                org_id, candidate_id, application_id, "{}", "[]"
            )
            return {}, row["id"]

    @staticmethod
    async def _append_message(
        session_id: int, role: str, content: str, new_state: Optional[dict]
    ) -> None:
        async with get_connection() as conn:
            row = await conn.fetchrow(
                "SELECT messages, session_state FROM candidate_sessions WHERE id=$1",
                session_id
            )
            if not row:
                return

            msgs_raw = row.get("messages") or "[]"
            msgs = json.loads(msgs_raw) if isinstance(msgs_raw, str) else msgs_raw
            msgs.append({"role": role, "content": content})

            update_args = [json.dumps(msgs), session_id]
            state_clause = ""
            if new_state is not None:
                state_clause = ", session_state=$3"
                update_args = [json.dumps(msgs), session_id, json.dumps(new_state)]

            await conn.execute(
                f"UPDATE candidate_sessions SET messages=$1{state_clause} WHERE id=$2",
                *update_args
            )

    @staticmethod
    async def _save_session(session_id: int, state: dict) -> None:
        async with get_connection() as conn:
            await conn.execute(
                "UPDATE candidate_sessions SET session_state=$1 WHERE id=$2",
                json.dumps(state), session_id
            )

    @staticmethod
    def generate_career_page_token(position_id: int, org_id: int) -> str:
        """
        Generate a special apply token for career page (no existing candidate/application).
        The application + candidate records are created on the first chat message.
        """
        payload = {
            "type": "career_apply",
            "position_id": position_id,
            "org_id": org_id,
            "application_id": None,
            "candidate_id": None,
            "exp": datetime.now(timezone.utc) + timedelta(hours=APPLY_TOKEN_EXPIRY_HOURS),
            "iat": datetime.now(timezone.utc),
            "jti": str(uuid.uuid4()),
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

