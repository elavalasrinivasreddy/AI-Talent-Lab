"""
routers/status.py – Public candidate application status portal.
Route: GET /api/v1/status/{status_token}

Uses the permanent status_token (UUID, never expires) so candidates can
bookmark this URL and check their status at any time.
"""
from fastapi import APIRouter
from backend.exceptions import NotFoundError
from backend.db.connection import get_connection

router = APIRouter(prefix="/api/v1/status", tags=["Candidate Status"])

STATUS_MAP = {
    'sourced': 'Under Review',
    'emailed': 'Under Review',
    'magic_link_sent': 'Under Review',
    'applied': 'Application Received',
    'screening': 'Under Review',
    'interview': 'Interview Stage',
    'selected': 'Offer Stage',
    'rejected': 'Not Selected',
}


@router.get("/{status_token}")
async def get_application_status(status_token: str):
    """
    Return candidate-safe application status via permanent status_token.
    Does NOT expose internal scoring, recruiter notes, or ATS data.
    """
    async with get_connection() as conn:
        app_row = await conn.fetchrow(
            """
            SELECT ca.id, ca.status, ca.applied_at, ca.created_at,
                   p.role_name, p.location, p.work_type,
                   o.name AS org_name, o.logo_url AS org_logo
            FROM candidate_applications ca
            JOIN positions p ON p.id = ca.position_id
            JOIN organizations o ON o.id = p.org_id
            WHERE ca.status_token = $1
            """,
            status_token,
        )

    if not app_row:
        raise NotFoundError("Application not found. The link may be invalid.")

    app_id = app_row["id"]

    # Candidate-safe labels — only these event types surface in the public timeline;
    # internal events (scoring, notes, sourcing) are intentionally omitted.
    _EVENT_LABELS = {
        "application_received": "Application received",
        "applied": "Application received",
        "status_changed": "Status updated",
        "screening_started": "Screening started",
        "interview_scheduled": "Interview scheduled",
        "interview_completed": "Interview completed",
        "selected": "Selected for offer",
        "rejected": "Application closed",
    }

    async with get_connection() as conn:
        interviews = await conn.fetch(
            """
            SELECT round_name, round_type, scheduled_at, status, duration_minutes
            FROM interviews
            WHERE application_id = $1
            ORDER BY round_number
            """,
            app_id,
        )
        events = await conn.fetch(
            """
            SELECT event_type, created_at
            FROM pipeline_events
            WHERE application_id = $1
            ORDER BY created_at
            """,
            app_id,
        )
        pre_eval = await conn.fetchrow(
            """
            SELECT token FROM pre_evaluations
            WHERE application_id = $1 AND status IN ('pending', 'submitted')
            ORDER BY created_at DESC LIMIT 1
            """,
            app_id,
        )

    timeline = [
        {
            "event": _EVENT_LABELS[ev["event_type"]],
            "date": ev["created_at"].isoformat() if ev["created_at"] else None,
        }
        for ev in events
        if ev["event_type"] in _EVENT_LABELS
    ]

    return {
        "position": {
            "role_name": app_row["role_name"],
            "location": app_row["location"],
            "work_type": app_row["work_type"],
        },
        "org_name": app_row["org_name"],
        "org_logo": app_row["org_logo"],
        "status": STATUS_MAP.get(app_row["status"], "Under Review"),
        "internal_status": app_row["status"],
        "applied_at": app_row["applied_at"].isoformat() if app_row["applied_at"] else None,
        "interviews": [
            {
                "round": iv["round_name"] or f"Round {idx + 1}",
                "type": iv["round_type"],
                "scheduled_at": iv["scheduled_at"].isoformat() if iv["scheduled_at"] else None,
                "status": iv["status"],
                "duration_minutes": iv["duration_minutes"],
            }
            for idx, iv in enumerate(interviews)
        ],
        "timeline": timeline,
        "pre_eval_token": pre_eval["token"] if pre_eval else None,
    }
