"""
routers/interviews.py – Protected interview scheduling endpoints.
All routes under /api/v1/interviews/
Requires JWT auth — recruiters only.
"""
import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.dependencies import get_current_user
from backend.services.interview_service import InterviewService
from backend.services.calendar_service import CalendarService

router = APIRouter(prefix="/api/v1/interviews", tags=["Interviews"])
logger = logging.getLogger(__name__)


class PanelMemberIn(BaseModel):
    name: str
    email: str
    user_id: Optional[int] = None


class CreateInterviewRequest(BaseModel):
    position_id: int
    candidate_id: int
    application_id: int
    round_number: int = 1
    round_name: Optional[str] = None
    round_type: str = "technical"
    scheduled_at: Optional[datetime] = None
    duration_minutes: int = 60
    meeting_link: Optional[str] = None
    notes: Optional[str] = None
    panel_members: list[PanelMemberIn] = []


class UpdateInterviewRequest(BaseModel):
    round_name: Optional[str] = None
    round_type: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    meeting_link: Optional[str] = None
    status: Optional[str] = None
    overall_result: Optional[str] = None
    notes: Optional[str] = None


# ── List all ──────────────────────────────────────────────────────────────────

@router.get("/")
async def list_interviews(
    filter: str = "all",
    current_user=Depends(get_current_user),
):
    """
    List all interviews for the organization.
    filter: upcoming | today | past | all
    """
    from backend.db.connection import get_connection
    from datetime import datetime as dt, timedelta

    org_id = current_user["org_id"]
    where = "i.org_id=$1"
    params = [org_id]

    now = dt.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    if filter == "upcoming":
        where += " AND i.scheduled_at > $2 AND i.status NOT IN ('completed','cancelled')"
        params.append(now)
    elif filter == "today":
        where += " AND i.scheduled_at >= $2 AND i.scheduled_at < $3"
        params.extend([today_start, today_end])
    elif filter == "past":
        where += " AND (i.scheduled_at < $2 OR i.status IN ('completed','cancelled'))"
        params.append(now)

    async with get_connection() as conn:
        rows = await conn.fetch(
            f"""
            SELECT i.id, i.round_number, i.round_name, i.round_type,
                   i.scheduled_at, i.duration_minutes, i.status,
                   i.overall_result, i.meeting_link,
                   i.position_id, i.candidate_id,
                   c.name AS candidate_name,
                   p.role_name,
                   (SELECT COUNT(*) FROM interview_panel ip WHERE ip.interview_id=i.id) AS panel_count,
                   (SELECT COUNT(*) FROM interview_panel ip WHERE ip.interview_id=i.id AND ip.feedback_submitted=TRUE) AS feedback_count
            FROM interviews i
            JOIN candidates c ON c.id = i.candidate_id
            JOIN positions p ON p.id = i.position_id
            WHERE {where}
            ORDER BY COALESCE(i.scheduled_at, i.created_at) DESC
            LIMIT 100
            """,
            *params,
        )
    return {"interviews": [dict(r) for r in rows]}


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("/")
async def create_interview(
    body: CreateInterviewRequest,
    current_user=Depends(get_current_user),
):
    """Create a new interview round with panel members and magic links."""
    try:
        result = await InterviewService.create_interview(
            org_id=current_user["org_id"],
            user_id=current_user["id"],
            data=body.model_dump(),
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"error": {"code": "VALIDATION_ERROR", "message": str(e), "details": None}})
    except Exception as e:
        logger.error(f"Create interview failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={"error": {"code": "SERVER_ERROR", "message": "Failed to create interview", "details": None}})


# ── List for candidate ────────────────────────────────────────────────────────

@router.get("/candidate/{candidate_id}")
async def list_interviews_for_candidate(
    candidate_id: int,
    current_user=Depends(get_current_user),
):
    """All interview rounds for a candidate (org-scoped)."""
    interviews = await InterviewService.list_for_candidate(
        candidate_id=candidate_id,
        org_id=current_user["org_id"],
    )
    return {"interviews": interviews}


# ── List for position ─────────────────────────────────────────────────────────

@router.get("/position/{position_id}")
async def list_interviews_for_position(
    position_id: int,
    current_user=Depends(get_current_user),
):
    """All interview rounds for a position (org-scoped)."""
    interviews = await InterviewService.list_for_position(
        position_id=position_id,
        org_id=current_user["org_id"],
    )
    return {"interviews": interviews}


# ── Get detail ────────────────────────────────────────────────────────────────

@router.get("/{interview_id}")
async def get_interview(
    interview_id: int,
    current_user=Depends(get_current_user),
):
    """Get full interview detail including panel and scorecards."""
    data = await InterviewService.get_interview_with_scorecards(
        interview_id=interview_id,
        org_id=current_user["org_id"],
    )
    if not data:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Interview not found", "details": None}})
    return data


# ── Update ────────────────────────────────────────────────────────────────────

@router.patch("/{interview_id}")
async def update_interview(
    interview_id: int,
    body: UpdateInterviewRequest,
    current_user=Depends(get_current_user),
):
    """Update interview details (reschedule, set result, etc.)."""
    try:
        updated = await InterviewService.update_interview(
            interview_id=interview_id,
            org_id=current_user["org_id"],
            user_id=current_user["id"],
            data=body.model_dump(exclude_none=True),
        )
        if not updated:
            raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Interview not found", "details": None}})
        return updated
    except Exception as e:
        logger.error(f"Update interview failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={"error": {"code": "SERVER_ERROR", "message": "Update failed", "details": None}})


# ── Send invites ──────────────────────────────────────────────────────────────

@router.post("/{interview_id}/send-invites")
async def send_invites(
    interview_id: int,
    current_user=Depends(get_current_user),
):
    """Mark interview invites as sent to candidate and panel members."""
    try:
        result = await InterviewService.send_invites(
            interview_id=interview_id,
            org_id=current_user["org_id"],
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": str(e), "details": None}})


# ── Generate debrief ──────────────────────────────────────────────────────────

@router.post("/{interview_id}/generate-debrief")
async def generate_debrief(
    interview_id: int,
    current_user=Depends(get_current_user),
):
    """Generate AI hiring debrief from all submitted scorecards."""
    try:
        result = await InterviewService.generate_debrief(
            interview_id=interview_id,
            org_id=current_user["org_id"],
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"error": {"code": "VALIDATION_ERROR", "message": str(e), "details": None}})
    except Exception as e:
        logger.error(f"Debrief generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={"error": {"code": "SERVER_ERROR", "message": "Debrief generation failed", "details": None}})


# ── Calendar integration ──────────────────────────────────────────────────────

class CalendarAvailabilityRequest(BaseModel):
    panelist_emails: list[str]
    duration_minutes: int = 60
    days_ahead: int = 5


class ScheduleWithCalendarRequest(BaseModel):
    interview_id: int
    scheduled_at: datetime
    duration_minutes: int = 60
    panelist_emails: list[str]
    create_calendar_event: bool = True


@router.post("/calendar/availability")
async def get_calendar_availability(
    body: CalendarAvailabilityRequest,
    _=Depends(get_current_user),
):
    """
    Fetch free/busy slots for a list of panelist emails.
    Uses MockCalendarAdapter by default; switches to Google when CALENDAR_PROVIDER=google.
    """
    slots = await CalendarService.get_availability(
        panelist_emails=body.panelist_emails,
        duration_minutes=body.duration_minutes,
        days_ahead=body.days_ahead,
    )
    return {"slots": slots}


@router.post("/calendar/schedule")
async def schedule_with_calendar(
    body: ScheduleWithCalendarRequest,
    current_user=Depends(get_current_user),
):
    """
    Schedule an interview and optionally create a calendar event + Meet link.
    Updates the interview row with calendar_event_id and meeting_link.
    """
    from backend.db.connection import get_connection

    async with get_connection() as conn:
        iv = await conn.fetchrow(
            """
            SELECT i.id, i.round_name, i.round_type,
                   p.role_name, c.name AS candidate_name
            FROM interviews i
            JOIN positions p ON p.id = i.position_id
            JOIN candidates c ON c.id = i.candidate_id
            WHERE i.id=$1 AND i.org_id=$2
            """,
            body.interview_id, current_user["org_id"],
        )
    if not iv:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Interview not found", "details": None}})

    meeting_link = None
    calendar_event_id = None
    calendar_provider = None

    if body.create_calendar_event and body.panelist_emails:
        try:
            event = await CalendarService.create_interview_event(
                position_name=iv["role_name"],
                candidate_name=iv["candidate_name"],
                round_name=iv["round_name"] or iv["round_type"],
                start=body.scheduled_at,
                duration_minutes=body.duration_minutes,
                panelist_emails=body.panelist_emails,
            )
            meeting_link = event.get("meeting_link")
            calendar_event_id = event.get("event_id")
            calendar_provider = event.get("calendar_provider")
        except Exception as e:
            logger.warning(f"Calendar event creation failed (non-fatal): {e}")

    async with get_connection() as conn:
        await conn.execute(
            """
            UPDATE interviews
            SET scheduled_at=$1, duration_minutes=$2,
                meeting_link=COALESCE($3, meeting_link),
                calendar_event_id=COALESCE($4, calendar_event_id),
                calendar_provider=COALESCE($5, calendar_provider),
                status='scheduled', updated_at=NOW()
            WHERE id=$6
            """,
            body.scheduled_at, body.duration_minutes,
            meeting_link, calendar_event_id, calendar_provider,
            body.interview_id,
        )

    return {
        "ok": True,
        "scheduled_at": body.scheduled_at.isoformat(),
        "meeting_link": meeting_link,
        "calendar_event_id": calendar_event_id,
        "calendar_provider": calendar_provider or "none",
    }
