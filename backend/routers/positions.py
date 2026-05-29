"""
routers/positions.py – Position CRUD and search endpoints.
All routes under /api/v1/positions/
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from backend.dependencies import get_current_user
from backend.services.position_service import PositionService
from backend.db.connection import get_connection

router = APIRouter(prefix="/api/v1/positions", tags=["Positions"])
logger = logging.getLogger(__name__)


@router.get("/")
async def list_positions(
    department_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    current_user=Depends(get_current_user),
):
    """List all positions for the org with optional filters."""
    positions = await PositionService.list_positions(
        org_id=current_user["org_id"],
        department_id=department_id,
        status=status,
        page=page,
    )
    return {"positions": positions, "page": page}


@router.get("/{position_id}")
async def get_position(
    position_id: int,
    current_user=Depends(get_current_user),
):
    """Get full position detail with pipeline stats and JD variants."""
    pos = await PositionService.get_position(position_id, current_user["org_id"])
    if not pos:
        raise HTTPException(status_code=404, detail={
            "error": {"code": "POSITION_NOT_FOUND", "message": "Position not found", "details": None}
        })
    return pos


@router.patch("/{position_id}")
async def update_position(
    position_id: int,
    body: dict,
    current_user=Depends(get_current_user),
):
    """Update position settings (headcount, priority, deadline, etc.)."""
    user_id = current_user["user_id"]
    pos = await PositionService.update_position(
        position_id=position_id,
        org_id=current_user["org_id"],
        user_id=user_id,
        data=body,
    )
    if not pos:
        raise HTTPException(status_code=404, detail={
            "error": {"code": "POSITION_NOT_FOUND", "message": "Position not found", "details": None}
        })
    return pos


@router.patch("/{position_id}/status")
async def update_position_status(
    position_id: int,
    body: dict,
    current_user=Depends(get_current_user),
):
    """Change position status (open, on_hold, closed, archived)."""
    user_id = current_user["user_id"]
    new_status = body.get("status")
    if not new_status:
        raise HTTPException(status_code=422, detail={
            "error": {"code": "MISSING_STATUS", "message": "status field is required", "details": None}
        })
    try:
        pos = await PositionService.update_status(
            position_id=position_id,
            org_id=current_user["org_id"],
            user_id=user_id,
            new_status=new_status,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail={
            "error": {"code": "INVALID_STATUS", "message": str(e), "details": None}
        })
    if not pos:
        raise HTTPException(status_code=404, detail={
            "error": {"code": "POSITION_NOT_FOUND", "message": "Position not found", "details": None}
        })
    return pos


@router.post("/{position_id}/search-now")
async def trigger_search_now(
    position_id: int,
    current_user=Depends(get_current_user),
):
    """Trigger an immediate candidate search for this position via Celery."""
    user_id = current_user["user_id"]
    pos = await PositionService.get_position(position_id, current_user["org_id"])
    if not pos:
        raise HTTPException(status_code=404, detail={
            "error": {"code": "POSITION_NOT_FOUND", "message": "Position not found", "details": None}
        })
    result = await PositionService.trigger_search_now(
        position_id=position_id,
        org_id=current_user["org_id"],
        department_id=pos["department_id"],
        user_id=user_id,
    )
    return result


@router.get("/{position_id}/interview-kit")
async def get_interview_kit(
    position_id: int,
    current_user=Depends(get_current_user),
):
    """Get the AI-generated interview kit for this position."""
    kit = await PositionService.get_interview_kit(position_id, current_user["org_id"])
    if not kit:
        raise HTTPException(status_code=404, detail={
            "error": {
                "code": "KIT_NOT_FOUND",
                "message": "Interview kit not yet generated. Use POST /generate to create one.",
                "details": None
            }
        })
    return kit


@router.post("/{position_id}/interview-kit/generate")
async def generate_interview_kit(
    position_id: int,
    current_user=Depends(get_current_user),
):
    """Generate or regenerate the AI interview kit for this position."""
    user_id = current_user["user_id"]
    try:
        kit = await PositionService.generate_interview_kit(
            position_id=position_id,
            org_id=current_user["org_id"],
            user_id=user_id,
        )
        return kit
    except ValueError as e:
        raise HTTPException(status_code=404, detail={
            "error": {"code": "POSITION_NOT_FOUND", "message": str(e), "details": None}
        })
    except Exception as e:
        logger.error(f"Interview kit generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={
            "error": {
                "code": "GENERATION_FAILED",
                "message": "Failed to generate interview kit. Please try again.",
                "details": None
            }
        })


# ── Approval workflow ─────────────────────────────────────────────────────────

@router.post("/{position_id}/submit-for-approval")
async def submit_for_approval(position_id: int, current_user=Depends(get_current_user)):
    """
    Recruiter submits a position for hiring manager approval.
    Sets approval_status = 'pending'.
    """
    from backend.db.connection import get_connection
    async with get_connection() as conn:
        row = await conn.fetchrow(
            "SELECT id, requires_approval, approval_status FROM positions WHERE id=$1 AND org_id=$2",
            position_id, current_user["org_id"],
        )
        if not row:
            raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Position not found", "details": None}})
        if not row["requires_approval"]:
            raise HTTPException(status_code=400, detail={"error": {"code": "APPROVAL_NOT_REQUIRED", "message": "This position does not require approval", "details": None}})
        await conn.execute(
            "UPDATE positions SET approval_status='pending', updated_at=NOW() WHERE id=$1",
            position_id,
        )
        # Notify hiring managers in the org
        await conn.execute(
            """
            INSERT INTO notifications (org_id, user_id, type, title, message, action_url)
            SELECT $1, u.id, 'approval_requested',
                   'Position approval requested',
                   (SELECT role_name FROM positions WHERE id=$2) || ' is pending your approval',
                   '/positions/' || $2
            FROM users u
            WHERE u.org_id=$1 AND u.role IN ('org_head', 'team_lead', 'dept_admin')
            """,
            current_user["org_id"], position_id,
        )
    return {"ok": True, "approval_status": "pending"}


@router.post("/{position_id}/approval-decision")
async def approval_decision(
    position_id: int,
    body: dict,
    current_user=Depends(get_current_user),
):
    """
    Hiring manager approves or requests changes.
    Body: { decision: 'approved' | 'changes_requested', notes: str }
    Requires role = admin or hiring_manager.
    """
    if current_user.get("role") not in ("org_head", "team_lead", "dept_admin"):
        raise HTTPException(status_code=403, detail={"error": {"code": "FORBIDDEN", "message": "Only admins, hiring managers, and dept heads can approve positions", "details": None}})

    decision = body.get("decision")
    if decision not in ("approved", "changes_requested"):
        raise HTTPException(status_code=422, detail={"error": {"code": "INVALID_DECISION", "message": "decision must be 'approved' or 'changes_requested'", "details": None}})

    notes = body.get("notes", "") or ""
    try:
        await PositionService.record_approval_decision(
            position_id=position_id,
            org_id=current_user["org_id"],
            approver_user_id=current_user["user_id"],
            decision=decision,
            notes=notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": str(e), "details": None}})

    return {"ok": True, "approval_status": decision}


# ── Sparkline + stage counts for Pipeline Garden cards ────────────────────────

from backend.db.repositories.candidates import CandidateRepository


@router.get("/{position_id}/applicants-daily")
async def get_applicants_daily(
    position_id: int,
    days: int = 30,
    current_user=Depends(get_current_user),
):
    """Return daily applicant counts for the last N days (sparkline data)."""
    from backend.db.connection import get_connection
    async with get_connection() as conn:
        pos = await conn.fetchrow(
            "SELECT id FROM positions WHERE id = $1 AND org_id = $2",
            position_id, current_user["org_id"],
        )
        if not pos:
            raise HTTPException(status_code=404, detail="Position not found")
        rows = await conn.fetch(
            """
            SELECT DATE(created_at) AS date, COUNT(*) AS count
            FROM candidate_applications
            WHERE position_id = $1 AND org_id = $2
              AND created_at >= NOW() - ($3 || ' days')::INTERVAL
            GROUP BY DATE(created_at)
            ORDER BY date ASC
            """,
            position_id, current_user["org_id"], str(days),
        )
    return [{"date": str(r["date"]), "count": r["count"]} for r in rows]


@router.get("/{position_id}/stage-counts")
async def get_stage_counts(
    position_id: int,
    current_user=Depends(get_current_user),
):
    """Return candidate counts per pipeline stage for this position."""
    from backend.db.connection import get_connection
    async with get_connection() as conn:
        pos = await conn.fetchrow(
            "SELECT id FROM positions WHERE id = $1 AND org_id = $2",
            position_id, current_user["org_id"],
        )
        if not pos:
            raise HTTPException(status_code=404, detail="Position not found")
        counts = await CandidateRepository.count_for_position(conn, position_id, current_user["org_id"])
    return counts


@router.get("/{position_id}/pipeline-summary")
async def get_pipeline_summary(
    position_id: int,
    current_user=Depends(get_current_user),
):
    """
    Rich pipeline summary for Position Detail v3 Stage Health header.
    Returns per-stage counts + delta_today, avg time in stage, AI confidence,
    pass-through rate, and saturation.
    """
    from backend.db.connection import get_connection
    async with get_connection() as conn:
        pos = await conn.fetchrow(
            "SELECT id, headcount FROM positions WHERE id = $1 AND org_id = $2",
            position_id, current_user["org_id"],
        )
        if not pos:
            raise HTTPException(status_code=404, detail={
                "error": {"code": "POSITION_NOT_FOUND", "message": "Position not found", "details": None}
            })

        headcount = pos["headcount"] or 1

        # Count + delta_today per stage
        stage_rows = await conn.fetch(
            """
            SELECT
                status,
                COUNT(*) AS count,
                COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) AS delta_today
            FROM candidate_applications
            WHERE position_id = $1 AND org_id = $2
            GROUP BY status
            """,
            position_id, current_user["org_id"],
        )
        stage_map = {r["status"]: {"count": r["count"], "delta_today": r["delta_today"]} for r in stage_rows}

        # Avg time in stage (only for candidates currently in each stage)
        time_rows = await conn.fetch(
            """
            SELECT status,
                   EXTRACT(EPOCH FROM AVG(NOW() - updated_at)) / 86400.0 AS avg_days
            FROM candidate_applications
            WHERE position_id = $1 AND org_id = $2
            GROUP BY status
            """,
            position_id, current_user["org_id"],
        )
        time_map = {r["status"]: round(float(r["avg_days"]), 1) for r in time_rows}

        # AI confidence per stage (mean of skill_match_score / 100)
        conf_rows = await conn.fetch(
            """
            SELECT status,
                   AVG(skill_match_score) / 100.0 AS confidence
            FROM candidate_applications
            WHERE position_id = $1 AND org_id = $2 AND skill_match_score IS NOT NULL
            GROUP BY status
            """,
            position_id, current_user["org_id"],
        )
        conf_map = {r["status"]: round(float(r["confidence"]), 2) for r in conf_rows}

        # Pass-through rate: candidates moved OUT of a stage in last 30d / entered
        # We approximate via pipeline_events
        pass_rows = await conn.fetch(
            """
            SELECT event_data->>'from_status' AS from_status,
                   COUNT(*) AS moved_count
            FROM pipeline_events
            WHERE position_id = $1 AND org_id = $2
              AND event_type = 'status_changed'
              AND created_at >= NOW() - INTERVAL '30 days'
              AND event_data->>'from_status' IS NOT NULL
            GROUP BY event_data->>'from_status'
            """,
            position_id, current_user["org_id"],
        )
        pass_map = {r["from_status"]: r["moved_count"] for r in pass_rows}

        enter_rows = await conn.fetch(
            """
            SELECT event_data->>'to_status' AS to_status,
                   COUNT(*) AS entered_count
            FROM pipeline_events
            WHERE position_id = $1 AND org_id = $2
              AND event_type = 'status_changed'
              AND created_at >= NOW() - INTERVAL '30 days'
              AND event_data->>'to_status' IS NOT NULL
            GROUP BY event_data->>'to_status'
            """,
            position_id, current_user["org_id"],
        )
        enter_map = {r["to_status"]: r["entered_count"] for r in enter_rows}

        # Target times per stage (defaults)
        target_times = {
            "sourced": 3, "emailed": 5, "applied": 2, "screening": 2,
            "interview": 5, "selected": 3, "rejected": 1,
        }

        # Saturation multipliers (rough funnel)
        sat_multipliers = {
            "sourced": 10, "emailed": 8, "applied": 5, "screening": 3,
            "interview": 2, "selected": 1, "rejected": 0,
        }

        stages = {}
        all_stages = ["sourced", "emailed", "applied", "screening", "interview", "selected", "rejected"]
        for s in all_stages:
            base = stage_map.get(s, {"count": 0, "delta_today": 0})
            entered = enter_map.get(s, 0)
            passed = pass_map.get(s, 0)
            pass_rate = round(passed / entered, 2) if entered > 0 else None

            target = headcount * sat_multipliers.get(s, 1)
            saturation = round(base["count"] / target, 2) if target > 0 else 0

            stages[s] = {
                "count": base["count"],
                "delta_today": base["delta_today"],
                "avg_time_in_stage_days": time_map.get(s),
                "target_time_in_stage_days": target_times.get(s),
                "ai_confidence_mean": conf_map.get(s),
                "pass_through_30d": pass_rate,
                "saturation": min(saturation, 1.0),
            }

        return {"stages": stages}


# ── Hire Requests (legacy shims — see routers/hire_requests.py for the real impl) ───
# Kept so the existing Dashboard widgets that call /api/v1/positions/requests/*
# keep working. New clients should hit /api/v1/hire-requests/* directly.

from backend.services.hire_request_service import HireRequestService
from backend.dependencies import get_db


def _client_ip(request) -> str:
    forwarded = request.headers.get("X-Forwarded-For") if request else None
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if (request and request.client) else "unknown"


@router.post("/requests")
async def submit_hire_request(
    request: Request,
    body: dict,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Legacy: prefer POST /api/v1/hire-requests/."""
    created = await HireRequestService.create(
        db,
        org_id=current_user["org_id"],
        user_id=current_user["user_id"],
        role=current_user["role"],
        ip_address=_client_ip(request),
        role_name=(body.get("role_name") or "").strip(),
        department_id=body.get("department_id"),
        headcount=int(body.get("headcount") or 1),
        work_type=body.get("work_type") or "onsite",
        experience_min=body.get("experience_min"),
        experience_max=body.get("experience_max"),
        target_start=body.get("target_start"),
        requirements=body.get("requirements"),
        comp_min=body.get("comp_min"),
        comp_max=body.get("comp_max"),
        location=body.get("location"),
    )
    return created


@router.get("/requests")
async def list_hire_requests(
    status: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Legacy: prefer GET /api/v1/hire-requests/."""
    rows = await HireRequestService.list_for_user(
        db,
        org_id=current_user["org_id"],
        user_id=current_user["user_id"],
        role=current_user["role"],
        scope="default",
        status=status,
    )
    return {"requests": rows}


@router.patch("/requests/{request_id}/accept")
async def accept_hire_request(
    request_id: int,
    request: Request,
    body: dict = {},
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Legacy: prefer POST /api/v1/hire-requests/{id}/accept."""
    updated = await HireRequestService.accept(
        db, request_id, current_user["org_id"],
        user_id=current_user["user_id"],
        role=current_user["role"],
        chat_session_id=body.get("chat_session_id"),
        ip_address=_client_ip(request),
    )
    return {"ok": True, "status": updated["status"]}


@router.patch("/requests/{request_id}/link-session")
async def link_hire_request_to_position(
    request_id: int,
    request: Request,
    body: dict,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Legacy: prefer POST /api/v1/hire-requests/{id}/link-session."""
    session_id = body.get("session_id")
    if not session_id:
        from backend.exceptions import ValidationError
        raise ValidationError("session_id is required.")
    updated = await HireRequestService.link_session_to_position(
        db, request_id, current_user["org_id"],
        user_id=current_user["user_id"],
        session_id=session_id,
        ip_address=_client_ip(request),
    )
    return {"ok": True, "position_id": updated.get("position_id")}


@router.patch("/requests/{request_id}/cancel")
async def cancel_hire_request(
    request_id: int,
    request: Request,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Legacy: prefer POST /api/v1/hire-requests/{id}/cancel."""
    updated = await HireRequestService.cancel(
        db, request_id, current_user["org_id"],
        user_id=current_user["user_id"],
        role=current_user["role"],
        ip_address=_client_ip(request),
    )
    return {"ok": True, "status": updated["status"]}
