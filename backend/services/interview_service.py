"""
services/interview_service.py – Business logic for interview scheduling, panel magic links,
scorecard aggregation, debrief generation, and rejection drafting.
"""
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt

from backend.config import settings
from backend.db.connection import get_connection
from backend.db.repositories.interviews import InterviewRepository, PanelRepository, ScorecardRepository
from backend.db.repositories.pipeline_events import PipelineEventRepository
from backend.db.repositories.notifications import NotificationRepository

logger = logging.getLogger(__name__)

PANEL_TOKEN_TYPE = "panel_feedback"
PANEL_TOKEN_EXPIRY_DAYS = 7

# Score weights per spec
SCORE_WEIGHTS = {
    "technical_skills": 0.40,
    "problem_solving": 0.30,
    "communication": 0.15,
    "culture_fit": 0.15,
}


# ── Token helpers ─────────────────────────────────────────────────────────────

def generate_panel_token(panel_member_id: int, interview_id: int, org_id: int) -> str:
    """Create a signed JWT for panel feedback magic link. Expires in 7 days."""
    payload = {
        "type": PANEL_TOKEN_TYPE,
        "panel_member_id": panel_member_id,
        "interview_id": interview_id,
        "org_id": org_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=PANEL_TOKEN_EXPIRY_DAYS),
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def verify_panel_token(token: str) -> dict:
    """Decode and validate panel feedback JWT. Returns payload or raises ValueError."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != PANEL_TOKEN_TYPE:
            raise ValueError("Invalid token type")
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Token expired")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Invalid token: {e}")


def compute_overall_score(ratings: list[dict]) -> float:
    """Compute weighted overall score from 4-dimension ratings list."""
    total = 0.0
    for r in ratings:
        dim = r.get("dimension", "")
        score = float(r.get("score", 0))
        weight = SCORE_WEIGHTS.get(dim, 0.25)
        total += score * weight
    return round(total, 2)


# ── Interview Service ─────────────────────────────────────────────────────────

class InterviewService:

    @staticmethod
    async def create_interview(org_id: int, user_id: int, data: dict) -> dict:
        """
        Create an interview round + add panel members + generate panel magic links.
        data: { position_id, candidate_id, application_id, round_number, round_name,
                round_type, scheduled_at, duration_minutes, meeting_link, notes,
                panel_members: [{ name, email, user_id? }] }
        """
        async with get_connection() as conn:
            # Fetch department_id from position
            dept_row = await conn.fetchrow(
                "SELECT department_id, created_by FROM positions WHERE id=$1 AND org_id=$2",
                data["position_id"], org_id
            )
            if not dept_row:
                raise ValueError("Position not found")

            dept_id = dept_row["department_id"]

            interview = await InterviewRepository.create(conn, {
                **data,
                "org_id": org_id,
                "department_id": dept_id,
                "status": "scheduled",
            })
            interview_id = interview["id"]

            # Add panel members + generate magic links
            panel_members = data.get("panel_members", [])
            generated_links = []

            for pm in panel_members:
                # Placeholder token — will regenerate after ID is known
                temp_token = str(uuid.uuid4())
                expires_at = datetime.now(timezone.utc) + timedelta(days=PANEL_TOKEN_EXPIRY_DAYS)

                member = await PanelRepository.add_panel_member(conn, {
                    "interview_id": interview_id,
                    "user_id": pm.get("user_id"),
                    "panelist_name": pm["name"],
                    "panelist_email": pm["email"],
                    "magic_link_token": temp_token,
                    "magic_link_expires_at": expires_at,
                })

                # Generate real signed token with known panel_member_id
                real_token = generate_panel_token(member["id"], interview_id, org_id)
                await conn.execute(
                    "UPDATE interview_panel SET magic_link_token=$1 WHERE id=$2",
                    real_token, member["id"]
                )

                panel_url = f"{settings.FRONTEND_URL}/panel/{real_token}"
                generated_links.append({
                    "panel_member_id": member["id"],
                    "name": pm["name"],
                    "email": pm["email"],
                    "panel_url": panel_url,
                })

            # Create pipeline event + notification
            await PipelineEventRepository.create(conn, {
                "org_id": org_id,
                "candidate_id": data["candidate_id"],
                "application_id": data.get("application_id"),
                "event_type": "interview_scheduled",
                "event_data": {
                    "round": data.get("round_name"),
                    "scheduled_at": str(data.get("scheduled_at")),
                    "panel_count": len(panel_members),
                },
            })

            # Notify recruiter who owns the position
            if dept_row["created_by"] and dept_row["created_by"] != user_id:
                await NotificationRepository.create(conn, {
                    "org_id": org_id,
                    "user_id": dept_row["created_by"],
                    "type": "interview_scheduled",
                    "title": "Interview Scheduled",
                    "message": f"Round {data.get('round_number', 1)} scheduled for position #{data['position_id']}",
                    "action_url": f"/positions/{data['position_id']}?tab=pipeline",
                })

        return {**interview, "panel_links": generated_links}

    @staticmethod
    async def get_interview_with_scorecards(
        interview_id: int, org_id: int
    ) -> Optional[dict]:
        async with get_connection() as conn:
            interview = await InterviewRepository.get(conn, interview_id, org_id)
            if not interview:
                return None
            panel = await PanelRepository.get_panel(conn, interview_id)
            scorecards = await ScorecardRepository.list_for_interview(conn, interview_id)

            # Parse ratings JSON
            for sc in scorecards:
                if sc.get("ratings") and isinstance(sc["ratings"], str):
                    try:
                        sc["ratings"] = json.loads(sc["ratings"])
                    except Exception:
                        sc["ratings"] = []

        return {**interview, "panel": panel, "scorecards": scorecards}

    @staticmethod
    async def list_for_candidate(candidate_id: int, org_id: int) -> list[dict]:
        async with get_connection() as conn:
            interviews = await InterviewRepository.list_for_candidate(conn, candidate_id, org_id)
            for i in interviews:
                i["panel"] = await PanelRepository.get_panel(conn, i["id"])
                i["scorecards"] = await ScorecardRepository.list_for_interview(conn, i["id"])
                for sc in i["scorecards"]:
                    if sc.get("ratings") and isinstance(sc["ratings"], str):
                        try:
                            sc["ratings"] = json.loads(sc["ratings"])
                        except Exception:
                            sc["ratings"] = []
        return interviews

    @staticmethod
    async def list_for_position(position_id: int, org_id: int) -> list[dict]:
        async with get_connection() as conn:
            return await InterviewRepository.list_for_position(conn, position_id, org_id)

    @staticmethod
    async def update_interview(
        interview_id: int, org_id: int, user_id: int, data: dict
    ) -> Optional[dict]:
        async with get_connection() as conn:
            updated = await InterviewRepository.update(conn, interview_id, org_id, data)
            if updated and data.get("overall_result") == "rejected":
                # Auto-draft rejection email in background
                from backend.tasks.rejection_task import draft_rejection_async
                draft_rejection_async.delay(interview_id, org_id, user_id)
        return updated

    @staticmethod
    async def send_invites(interview_id: int, org_id: int) -> dict:
        """Mark invites as sent (email simulation). Returns panel with links."""
        async with get_connection() as conn:
            interview = await InterviewRepository.get(conn, interview_id, org_id)
            if not interview:
                raise ValueError("Interview not found")

            panel = await PanelRepository.get_panel(conn, interview_id)

            await conn.execute(
                "UPDATE interviews SET invite_sent_at=NOW() WHERE id=$1 AND org_id=$2",
                interview_id, org_id
            )

        return {
            "sent": True,
            "interview_id": interview_id,
            "panel_links": [
                {
                    "name": p["panelist_name"],
                    "email": p["panelist_email"],
                    "panel_url": f"{settings.FRONTEND_URL}/panel/{p['magic_link_token']}",
                }
                for p in panel
            ],
        }

    @staticmethod
    async def generate_debrief(interview_id: int, org_id: int) -> dict:
        """Run AI debrief generation on all submitted scorecards."""
        from backend.agents.interview_agents import generate_debrief

        async with get_connection() as conn:
            interview = await InterviewRepository.get(conn, interview_id, org_id)
            if not interview:
                raise ValueError("Interview not found")

            scorecards = await ScorecardRepository.list_for_interview(conn, interview_id)
            for sc in scorecards:
                if sc.get("ratings") and isinstance(sc["ratings"], str):
                    try:
                        sc["ratings"] = json.loads(sc["ratings"])
                    except Exception:
                        sc["ratings"] = []

            # Get candidate name and role
            row = await conn.fetchrow(
                """
                SELECT c.name AS candidate_name, p.role_name
                FROM interviews i
                JOIN candidates c ON c.id = i.candidate_id
                JOIN positions p ON p.id = i.position_id
                WHERE i.id=$1
                """,
                interview_id
            )

        debrief_md = await generate_debrief(
            candidate_name=row["candidate_name"] if row else "Candidate",
            role_name=row["role_name"] if row else "Role",
            scorecards=scorecards,
            interview_rounds=[interview],
        )

        # Store debrief in DB (update notes field for now)
        async with get_connection() as conn:
            await conn.execute(
                "UPDATE interviews SET notes=$1, status='completed' WHERE id=$2 AND org_id=$3",
                debrief_md, interview_id, org_id
            )

            # Notify recruiter
            created_by = await conn.fetchval(
                "SELECT created_by FROM positions WHERE id=$1", interview["position_id"]
            )
            if created_by:
                await NotificationRepository.create(conn, {
                    "org_id": org_id,
                    "user_id": created_by,
                    "type": "debrief_ready",
                    "title": "Interview Debrief Ready",
                    "message": f"AI debrief for round {interview.get('round_number', 1)} is ready to review.",
                    "action_url": f"/candidates/{interview['candidate_id']}?tab=interviews",
                })

        return {"debrief": debrief_md, "interview_id": interview_id}


# ── Panel Feedback Service ─────────────────────────────────────────────────────

class PanelFeedbackService:

    @staticmethod
    async def verify_and_load(token: str) -> dict:
        """Verify panel magic link token and return full context."""
        try:
            payload = verify_panel_token(token)
        except ValueError as e:
            return {"valid": False, "expired": "expired" in str(e), "error": str(e)}

        async with get_connection() as conn:
            panel_data = await PanelRepository.get_by_token(conn, token)

        if not panel_data:
            return {"valid": False, "error": "Panel link not found"}

        already_submitted = panel_data.get("feedback_submitted", False)

        return {
            "valid": True,
            "already_submitted": already_submitted,
            "not_attended": panel_data.get("not_attended", False),
            "panel_member_id": panel_data["id"],
            "panelist_name": panel_data["panelist_name"],
            "interview_id": panel_data["interview_id"],
            "org_id": panel_data["org_id"],
            "candidate_name": panel_data["candidate_name"],
            "resume_text": panel_data.get("resume_text"),
            "role_name": panel_data["role_name"],
            "jd_markdown": panel_data.get("jd_markdown"),
            "round_name": panel_data.get("round_name"),
            "round_number": panel_data.get("round_number"),
            "scheduled_at": panel_data.get("scheduled_at"),
            "interview_notes": panel_data.get("interview_notes"),
            "org_name": panel_data.get("org_name"),
            "org_logo": panel_data.get("logo_url"),
        }

    @staticmethod
    async def enrich_notes(token: str, strengths_raw: str, concerns_raw: str) -> dict:
        """Run AI enrichment on rough panel notes."""
        from backend.agents.interview_agents import enrich_feedback

        payload = verify_panel_token(token)

        async with get_connection() as conn:
            panel_data = await PanelRepository.get_by_token(conn, token)

        if not panel_data:
            raise ValueError("Panel link not found")

        return await enrich_feedback(
            strengths_raw=strengths_raw,
            concerns_raw=concerns_raw,
            candidate_name=panel_data.get("candidate_name", "the candidate"),
            role_name=panel_data.get("role_name", "this role"),
            round_name=panel_data.get("round_name", "the interview"),
        )

    @staticmethod
    async def submit_feedback(token: str, data: dict) -> dict:
        """Submit or save-draft panel feedback. Single-use on final submit."""
        payload = verify_panel_token(token)
        panel_member_id = payload["panel_member_id"]
        interview_id = payload["interview_id"]
        org_id = payload["org_id"]

        async with get_connection() as conn:
            panel_data = await PanelRepository.get_by_token(conn, token)
            if not panel_data:
                raise ValueError("Panel link not found")

            # Mark not attended
            if not data.get("attended", True):
                await PanelRepository.mark_not_attended(conn, panel_member_id)
                return {"saved": True, "not_attended": True}

            # Block re-submission
            if panel_data.get("feedback_submitted") and not data.get("is_draft"):
                raise ValueError("Feedback already submitted")

            ratings = data.get("ratings", [])
            overall_score = compute_overall_score(ratings)

            sc = await ScorecardRepository.upsert(conn, {
                "interview_id": interview_id,
                "panel_member_id": panel_member_id,
                "candidate_id": panel_data["candidate_id"],
                "position_id": panel_data["position_id"],
                "org_id": org_id,
                "is_draft": data.get("is_draft", False),
                "ratings": json.dumps(ratings),
                "overall_score": overall_score,
                "recommendation": data.get("recommendation"),
                "strengths": data.get("strengths"),
                "concerns": data.get("concerns"),
                "additional_comments": data.get("additional_comments"),
                "raw_notes_strengths": data.get("raw_notes_strengths"),
                "raw_notes_concerns": data.get("raw_notes_concerns"),
            })

            if not data.get("is_draft"):
                await PanelRepository.mark_submitted(conn, panel_member_id)

                # Pipeline event
                await PipelineEventRepository.create(conn, {
                    "org_id": org_id,
                    "candidate_id": panel_data["candidate_id"],
                    "application_id": None,
                    "event_type": "feedback_submitted",
                    "event_data": {
                        "panel_member": panel_data["panelist_name"],
                        "interview_id": interview_id,
                        "overall_score": overall_score,
                    },
                })

                # Check if all panel submitted
                submitted_count = await conn.fetchval(
                    "SELECT COUNT(*) FROM interview_panel WHERE interview_id=$1 AND feedback_submitted=TRUE",
                    interview_id
                )
                total_panel = await conn.fetchval(
                    "SELECT COUNT(*) FROM interview_panel WHERE interview_id=$1",
                    interview_id
                )

                # Notify recruiter
                created_by = await conn.fetchval(
                    "SELECT p.created_by FROM interviews i JOIN positions p ON p.id=i.position_id WHERE i.id=$1",
                    interview_id
                )
                if created_by:
                    if submitted_count >= total_panel:
                        title = "All Feedback Received 🎉"
                        msg = f"All panelists have submitted feedback. Review debriefs now."
                    else:
                        title = "Panel Feedback Submitted"
                        msg = f"{panel_data['panelist_name']} submitted feedback ({submitted_count}/{total_panel})."
                    await NotificationRepository.create(conn, {
                        "org_id": org_id,
                        "user_id": created_by,
                        "type": "feedback_submitted",
                        "title": title,
                        "message": msg,
                        "action_url": f"/candidates/{panel_data['candidate_id']}?tab=interviews",
                    })

        return {
            "saved": True,
            "is_draft": data.get("is_draft", False),
            "overall_score": overall_score,
            "scorecard_id": sc["id"],
        }
