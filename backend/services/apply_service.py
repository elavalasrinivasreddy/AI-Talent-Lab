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
from backend.db.connection import get_connection, get_admin_connection
from backend.db.repositories.pipeline_events import PipelineEventRepository
from backend.db.repositories.notifications import NotificationRepository
from backend.agents.candidate_chat import CandidateChatController
from backend.utils.crypto import encrypt_field

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
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def verify_apply_token(token: str) -> dict:
    """
    Decode and validate apply JWT.
    Returns payload dict or raises ValueError.
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != APPLY_TOKEN_TYPE:
            raise ValueError("Invalid token type")
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Token expired")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Invalid token: {e}")


# ── Screening field detection ─────────────────────────────────────────────────
# Screening questions are configured by the hiring head with a free-text field_key
# (the "name"). There are no longer built-in profiling questions, so we detect a
# few well-known fields by keyword to keep feeding the structured features that
# depend on them: encrypted compensation and experience-based ATS scoring.
# Detection is best-effort — an unmatched question is just stored as a plain
# screening response. "compensation" deliberately omits the bare "comp" token so a
# "company" field_key is not misread as compensation.
_SCREENING_FIELD_PATTERNS = {
    "compensation": ("ctc", "compensation", "salary", "remuneration", "package", "wage"),
    "experience": ("experience", "yoe", "years of"),
    "notice_period": ("notice", "availability", "available", "joining"),
    "current_role": ("company", "organization", "organisation", "employer",
                     "current role", "current title", "designation"),
}


def classify_screening_field(field_key: str, label: str = "") -> Optional[str]:
    """Return the structured slot a screening question maps to, or None.
    Matches keywords against field_key + label (case-insensitive)."""
    hay = f"{field_key or ''} {label or ''}".lower()
    for slot, keywords in _SCREENING_FIELD_PATTERNS.items():
        if any(kw in hay for kw in keywords):
            return slot
    return None


def _extract_int(text: str) -> Optional[int]:
    """Pull the first integer out of free text (e.g. '7 years' → 7)."""
    import re
    m = re.search(r"\d+", text or "")
    return int(m.group()) if m else None


def map_screening_to_structured(screening_responses: dict, label_by_key: dict) -> dict:
    """Map configured screening answers (keyed by field_key) into the structured
    fields used by encryption + ATS. Returns a dict with optional keys:
    compensation_current, compensation_expected, experience_total,
    experience_years_int, notice_period, current_title, current_company."""
    out: dict = {}
    for fkey, answer in (screening_responses or {}).items():
        if answer in (None, ""):
            continue
        label = label_by_key.get(fkey, "")
        slot = classify_screening_field(fkey, label)
        hay = f"{fkey} {label}".lower()
        if slot == "compensation":
            if "expect" in hay:
                out["compensation_expected"] = answer
            else:
                out.setdefault("compensation_current", answer)
        elif slot == "experience":
            out.setdefault("experience_total", answer)
            n = _extract_int(str(answer))
            if n is not None:
                out.setdefault("experience_years_int", n)
        elif slot == "notice_period":
            out.setdefault("notice_period", answer)
        elif slot == "current_role":
            a = str(answer)
            if " at " in a.lower():
                title, _, company = a.partition(" at ")
                out.setdefault("current_title", title.strip())
                out.setdefault("current_company", company.strip())
            else:
                out.setdefault("current_title", a)
    return out


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
        _candidate_id = payload["candidate_id"]  # noqa: F841 — validated but unused; data comes from DB join
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
                ORDER BY sort_order
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
                "id": org_id,
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

        is_greeting = not session_state.get("step") or session_state.get("step") == "greeting"
        if is_greeting:
            # First message — produce the greeting. The frontend sends a '__init__'
            # sentinel here, not a real user turn, so it must NOT be persisted.
            ai_response, session_state = await controller.process_message(None)
        else:
            ai_response, session_state = await controller.process_message(user_message)

        # Save user message and AI response — non-fatal: warn candidate if DB write fails
        session_warning = None
        try:
            if is_greeting:
                # Only persist the greeting once; skip the '__init__' user turn so
                # restored sessions don't show a duplicate greeting + '__init__' bubble.
                await ApplyService._append_message(session_id, "assistant", ai_response, session_state)
            else:
                await ApplyService._append_message(session_id, "user", user_message, None)
                await ApplyService._append_message(session_id, "assistant", ai_response, session_state)
        except Exception as e:
            logger.warning(f"Session persistence failed for session {session_id}: {e}")
            session_warning = (
                "Progress could not be saved — your answers are still visible "
                "but may be lost on refresh."
            )

        # Check for not_interested → don't advance to applied
        step = session_state.get("step")

        result = {
            "response": ai_response,
            "step": step,
            "session_state": session_state,
            "completed": step == "completion",
            "not_interested": step == "declined",
        }
        if session_warning:
            result["session_warning"] = session_warning
        return result

    @staticmethod
    async def handle_resume_upload(
        token: str, resume_text: str, filename: str, resume_links: Optional[dict] = None
    ) -> dict:
        """
        Process a resume upload, then SUBMIT the application.

        Resume is the last required input (screening questions are asked before it),
        so the application is submitted here. The optional video intro that follows
        is a post-submission add-on. Submitting at this point means a tab close at
        the video step can never lose a resume-complete application.
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
            # Store resume text and links in candidate record
            await conn.execute(
                """
                UPDATE candidates
                SET resume_text=$1, resume_parsed=$2, resume_embedding=$3, updated_at=NOW()
                WHERE id=$4 AND org_id=$5
                """,
                resume_text,
                _json.dumps(resume_links) if resume_links else None,
                _json.dumps(embedding) if embedding else None,
                candidate_id, org_id
            )

        # Advance session to the optional video step and mark resume uploaded.
        session_state, session_id = await ApplyService._get_or_create_session(
            application_id, candidate_id, org_id
        )
        session_state["step"] = "video_intro"
        session_state["resume_uploaded"] = True

        # Submit the application now (resume + screening answers are all captured).
        submitted = True
        try:
            await ApplyService.complete_application(token)
        except Exception as e:
            logger.error(f"Application submission after resume upload failed "
                         f"(application {application_id}): {e}", exc_info=True)
            submitted = False

        context = await ApplyService._load_context(application_id, org_id)
        role_name = (context or {}).get("position", {}).get("role_name", "this role")
        org_name = (context or {}).get("org", {}).get("name", "the company")

        if submitted:
            ai_response = (
                f"✅ Your application for **{role_name}** at **{org_name}** has been "
                f"submitted — thank you!\n\n"
                f"📹 **Optional:** want to stand out? Add a short 30–60s video intro "
                f"with the button below, or you're all done. Good luck! 🍀"
            )
        else:
            ai_response = (
                "✅ Resume received! We hit a snag finalizing your submission, but "
                "your answers are saved — please refresh and we'll complete it."
            )

        session_warning = None
        try:
            await ApplyService._append_message(session_id, "assistant", ai_response, session_state)
            await ApplyService._save_session(session_id, session_state)
        except Exception as e:
            logger.warning(f"Session persistence failed after resume upload (session {session_id}): {e}")
            session_warning = (
                "Progress could not be saved — your answers are still visible "
                "but may be lost on refresh."
            )

        result = {
            "response": ai_response,
            "step": session_state.get("step"),
            "submitted": submitted,
        }
        if session_warning:
            result["session_warning"] = session_warning
        return result

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

        # Load screening question labels for field detection (own connection).
        context = await ApplyService._load_context(application_id, org_id)
        label_by_key = {
            q.get("field_key"): (q.get("label") or "")
            for q in (context or {}).get("screening_questions", [])
        }

        async with get_connection() as conn:
            # Idempotency: if already submitted, do NOT re-run ATS / email / notifications.
            existing = await conn.fetchrow(
                "SELECT status FROM candidate_applications WHERE id=$1 AND org_id=$2",
                application_id, org_id,
            )
            if existing and existing.get("status") == "applied":
                return {"completed": True, "already_submitted": True}

            # Get session state for screening_responses
            session = await conn.fetchrow(
                "SELECT * FROM candidate_sessions WHERE application_id=$1",
                application_id
            )
            session_state = {}
            if session:
                raw = session.get("session_state") or "{}"
                session_state = json.loads(raw) if isinstance(raw, str) else raw

            # Raw configured answers, keyed by field_key. Promote well-known fields
            # (compensation / experience / notice / role) into structured slots.
            raw_responses = session_state.get("screening_responses", {}) or {}
            mapped = map_screening_to_structured(raw_responses, label_by_key)

            screening_responses = {
                "notice_period": mapped.get("notice_period"),
                "experience_total": mapped.get("experience_total"),
                **raw_responses,
            }

            # Build encrypted CTC blob from detected compensation answers.
            compensation_payload = json.dumps({
                "current": mapped.get("compensation_current"),
                "expected": mapped.get("compensation_expected"),
                "declined": False,
            })
            compensation_enc = encrypt_field(compensation_payload, settings.ENCRYPTION_KEY)

            # Update application status
            await conn.execute(
                """
                UPDATE candidate_applications
                SET status='applied', applied_at=NOW(),
                    screening_responses=$1, compensation_enc=$4, updated_at=NOW()
                WHERE id=$2 AND org_id=$3
                """,
                json.dumps(screening_responses),
                application_id, org_id,
                compensation_enc,
            )

            # Promote detected candidate fields: role/company + experience (for ATS).
            if mapped.get("current_title") or mapped.get("experience_years_int") is not None:
                await conn.execute(
                    """
                    UPDATE candidates SET
                        current_title=COALESCE($1::text, current_title),
                        current_company=COALESCE($2::text, current_company),
                        experience_years=COALESCE($3::int, experience_years),
                        updated_at=NOW()
                    WHERE id=$4
                    """,
                    mapped.get("current_title"),
                    mapped.get("current_company"),
                    mapped.get("experience_years_int"),
                    candidate_id,
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
                SELECT p.created_by, c.name AS candidate_name, c.email AS candidate_email,
                       p.role_name, ca.position_id, ca.status_token, o.name AS org_name
                FROM candidate_applications ca
                JOIN positions p ON p.id = ca.position_id
                JOIN candidates c ON c.id = ca.candidate_id
                JOIN organizations o ON o.id = ca.org_id
                WHERE ca.id=$1
                """,
                application_id
            )

            position_id = app_row["position_id"] if app_row else None

            if app_row and app_row["created_by"]:
                await NotificationRepository.create(conn, {
                    "org_id": org_id,
                    "user_id": app_row["created_by"],
                    "type": "application_received",
                    "title": f"New Application — {app_row['role_name']}",
                    "message": f"{app_row['candidate_name']} has submitted their application via chat.",
                    "action_url": f"/positions/{position_id}?tab=candidates",
                })

        # ── Candidate confirmation email (interview process overview) ─────────
        # Sent outside the connection block so a mail failure never rolls back the
        # application. Best-effort: a missing email or send failure is logged only.
        if app_row and app_row["candidate_email"]:
            try:
                from backend.services.email_service import EmailService
                from backend.config import settings as _settings
                base = _settings.MAGIC_LINK_BASE_URL or _settings.FRONTEND_URL
                status_url = f"{base}/status/{app_row['status_token']}" if app_row["status_token"] else None
                await EmailService.send_application_received(
                    to_email=app_row["candidate_email"],
                    candidate_name=app_row["candidate_name"],
                    role_name=app_row["role_name"],
                    org_name=app_row["org_name"],
                    status_url=status_url,
                )
            except Exception as e:
                logger.warning(f"Application confirmation email failed: {e}")

        # ── GDPR: Record consent + set data retention ────────────────────────
        try:
            from backend.services.gdpr_service import GDPRService
            await GDPRService.record_bulk_consent(
                org_id=org_id,
                candidate_id=candidate_id,
                application_id=application_id,
                consent_types=["data_processing", "ai_analysis"],
            )
            await GDPRService.set_retention_period(org_id, candidate_id)
        except Exception as e:
            logger.warning(f"GDPR consent recording failed: {e}")

        # ── Trigger ATS Scoring Background Task ──────────────────────────────
        try:
            from backend.tasks.candidate_pipeline import score_candidate_application
            score_candidate_application.delay(
                candidate_id,
                application_id,
                position_id,
                org_id
            )
            logger.info(f"Dispatched ATS scoring task for application {application_id}")
        except Exception as e:
            logger.error(f"Failed to dispatch ATS scoring task: {e}")

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
                ORDER BY sort_order
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
                "id": org_id,
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
        async with get_admin_connection() as conn:
            session = await conn.fetchrow(
                "SELECT * FROM candidate_sessions WHERE application_id=$1",
                application_id
            )
            if session:
                raw = session.get("session_state") or "{}"
                state = json.loads(raw) if isinstance(raw, str) else (raw or {})
                return state, session["id"]

            # Create new session
            import uuid as _uuid
            session_id = str(_uuid.uuid4())
            await conn.execute(
                """
                INSERT INTO candidate_sessions
                    (id, org_id, candidate_id, application_id, session_state, messages, status)
                VALUES ($1, $2, $3, $4, $5, $6, 'active')
                """,
                session_id, org_id, candidate_id, application_id, "{}", "[]"
            )
            return {}, session_id

    @staticmethod
    async def _append_message(
        session_id: int, role: str, content: str, new_state: Optional[dict]
    ) -> None:
        async with get_admin_connection() as conn:
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
        async with get_admin_connection() as conn:
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
        return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

