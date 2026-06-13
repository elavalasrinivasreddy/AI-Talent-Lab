"""
routers/positions.py – Position CRUD and search endpoints.
All routes under /api/v1/positions/
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

import asyncpg

from backend.dependencies import get_current_user, get_db
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
    # Enforce department scoping for roles bound to a specific department.
    role = current_user["role"]
    team_lead_id = None
    
    if role in ("hr", "dept_admin") and current_user.get("dept_id"):
        department_id = current_user["dept_id"]
        
    if role == "team_lead":
        team_lead_id = current_user["user_id"]
        # Team lead gets restricted to only what they created, reviewed, or requested via hire requests.
        department_id = None  # Ignore dept filter for team_lead, rely strictly on their involvement.

    positions = await PositionService.list_positions(
        org_id=current_user["org_id"],
        department_id=department_id,
        status=status,
        page=page,
        team_lead_id=team_lead_id,
        team_lead_dept_id=current_user.get("dept_id") if role == "team_lead" else None,
    )
    return {"positions": positions, "page": page}


@router.get("/pending-count")
async def pending_count(current_user=Depends(get_current_user)):
    """Count positions pending approval for this user."""
    org_id = current_user["org_id"]
    role = current_user.get("role")
    # JWT user dict uses key "dept_id" (not "department_id"); reading the wrong key
    # made team_lead/dept_admin always fall through to the org-wide count.
    
    async with get_connection() as conn:
        if role == "org_head":
            row = await conn.fetchrow(
                "SELECT COUNT(*) FROM positions WHERE org_id=$1 AND approval_status='pending'",
                org_id
            )
        elif role in ("team_lead", "dept_admin"):
            row = await conn.fetchrow(
                "SELECT COUNT(*) FROM positions WHERE org_id=$1 AND approval_status='pending' AND reviewer_id=$2",
                org_id, current_user["user_id"]
            )
        else:
            return {"count": 0}
            
        return {"count": row["count"] if row else 0}


# ── Item 16: Reviewer preview — must be declared before /{position_id} ────────
# FastAPI matches routes in declaration order; a static path like /resolve-reviewer
# would be captured by /{position_id} as position_id="resolve-reviewer" otherwise.

@router.get("/resolve-reviewer")
async def resolve_reviewer(
    position_id: int = Query(...),
    current_user=Depends(get_current_user),
):
    """
    Resolve who will review the JD. Called when chat reaches final_jd stage.
    Returns: { reviewer_id, reviewer_name, reviewer_role, department, is_bypass, warning }
    """
    try:
        result = await PositionService.resolve_reviewer(
            position_id=position_id,
            org_id=current_user["org_id"],
            user_id=current_user["user_id"],
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail={
            "error": {"code": "NOT_FOUND", "message": str(e), "details": None}
        })


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
async def submit_for_approval(
    position_id: int,
    body: Optional[dict] = None,
    current_user=Depends(get_current_user),
):
    """
    HR submits a position for JD approval.
    Body (optional): { ats_threshold?: float, search_interval_hours?: int }

    The service acquires a FOR UPDATE lock on the position row inside a transaction,
    so the status guard is atomic — no stale pre-check needed here.
    """
    body = body or {}
    try:
        await PositionService.submit_for_approval(
            position_id=position_id,
            org_id=current_user["org_id"],
            submitted_by_user_id=current_user["user_id"],
            ats_threshold=body.get("ats_threshold"),
            search_interval_hours=body.get("search_interval_hours"),
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail={"error": {"code": "INVALID_TRANSITION", "message": str(e), "details": None}})
    except PermissionError as e:
        raise HTTPException(status_code=403, detail={"error": {"code": "FORBIDDEN", "message": str(e), "details": None}})

    async with get_connection() as conn:
        final_status = await conn.fetchval(
            "SELECT approval_status FROM positions WHERE id=$1 AND org_id=$2",
            position_id, current_user["org_id"],
        )
    return {"ok": True, "approval_status": final_status or "pending"}


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
    if decision == "changes_requested" and not notes.strip():
        raise HTTPException(status_code=422, detail={"error": {"code": "NOTES_REQUIRED", "message": "A feedback note is required when requesting changes. Please explain what needs to be updated.", "details": None}})
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
    except PermissionError as e:
        raise HTTPException(status_code=403, detail={"error": {"code": "FORBIDDEN", "message": str(e), "details": None}})

    # State transitions are deterministic — derive from decision instead of re-fetching
    # (avoids a TOCTOU window between the commit and a second DB round-trip).
    _result = {
        "approved": {"status": "open", "approval_status": "approved"},
        "changes_requested": {"status": "draft_needs_revision", "approval_status": "changes_requested"},
    }[decision]
    return {"ok": True, **_result}


# ── Item 6: TL cancel-after-pickup ────────────────────────────────────────────

@router.post("/{position_id}/cancel-jd")
async def cancel_jd_in_progress(
    position_id: int,
    body: dict,
    current_user=Depends(get_current_user),
):
    """
    Team lead cancels a position in jd_in_progress (before HR submits).
    Body: { notes: str } — mandatory cancellation notes.
    """
    notes = body.get("notes", "")
    try:
        result = await PositionService.cancel_jd_in_progress(
            position_id=position_id,
            org_id=current_user["org_id"],
            user_id=current_user["user_id"],
            role=current_user.get("role", ""),
            notes=notes,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail={
            "error": {"code": "INVALID_TRANSITION", "message": str(e), "details": None}
        })
    except PermissionError as e:
        raise HTTPException(status_code=403, detail={
            "error": {"code": "FORBIDDEN", "message": str(e), "details": None}
        })


# ── Item 7: HR withdraw submission ───────────────────────────────────────────

@router.post("/{position_id}/withdraw-submission")
async def withdraw_submission(
    position_id: int,
    current_user=Depends(get_current_user),
):
    """
    HR withdraws a submitted JD (pending_jd_approval → jd_in_progress).
    Bias resets on withdraw. revision_cycle does NOT increment.
    """
    try:
        result = await PositionService.withdraw_submission(
            position_id=position_id,
            org_id=current_user["org_id"],
            user_id=current_user["user_id"],
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail={
            "error": {"code": "INVALID_TRANSITION", "message": str(e), "details": None}
        })


# ── Item 24: ATS config update post-open ─────────────────────────────────────

@router.patch("/{position_id}/ats-config")
async def update_ats_config(
    position_id: int,
    body: dict,
    current_user=Depends(get_current_user),
):
    """
    Update ATS config on open positions. Only org_head/dept_admin allowed.
    Body: { ats_threshold?: float, search_interval_hours?: int }
    """
    try:
        result = await PositionService.update_ats_config_post_open(
            position_id=position_id,
            org_id=current_user["org_id"],
            user_id=current_user["user_id"],
            role=current_user.get("role", ""),
            ats_threshold=body.get("ats_threshold"),
            search_interval_hours=body.get("search_interval_hours"),
        )
        return result
    except PermissionError as e:
        raise HTTPException(status_code=403, detail={
            "error": {"code": "FORBIDDEN", "message": str(e), "details": None}
        })
    except ValueError as e:
        raise HTTPException(status_code=422, detail={
            "error": {"code": "INVALID_REQUEST", "message": str(e), "details": None}
        })


# ── Item 22: Same-title duplicate check ──────────────────────────────────────

@router.get("/{position_id}/same-title-check")
async def same_title_check(
    position_id: int,
    current_user=Depends(get_current_user),
):
    """Check if a position with the same title already exists in the org."""
    from backend.db.repositories.positions import PositionRepository as PosRepo
    async with get_connection() as conn:
        pos = await PosRepo.get(conn, position_id, current_user["org_id"])
        if not pos:
            raise HTTPException(status_code=404, detail={
                "error": {"code": "NOT_FOUND", "message": "Position not found", "details": None}
            })
        matches = await PosRepo.find_same_title(
            conn, current_user["org_id"], pos["role_name"],
        )
    # Exclude the current position from results
    matches = [m for m in matches if m["id"] != position_id]
    return {"has_duplicates": len(matches) > 0, "matches": matches}

# ── Sparkline + stage counts for Pipeline Garden cards ────────────────────────

from backend.db.repositories.candidates import CandidateRepository


@router.get("/{position_id}/applicants-daily")
async def get_applicants_daily(
    position_id: int,
    days: int = 30,
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Return daily applicant counts for the last N days (sparkline data)."""
    days = min(max(days, 1), 365)
    pos = await db.fetchrow(
        "SELECT id FROM positions WHERE id = $1 AND org_id = $2",
        position_id, current_user["org_id"],
    )
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
    rows = await db.fetch(
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
    db: asyncpg.Connection = Depends(get_db),
):
    """Return candidate counts per pipeline stage for this position."""
    pos = await db.fetchrow(
        "SELECT id FROM positions WHERE id = $1 AND org_id = $2",
        position_id, current_user["org_id"],
    )
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
    counts = await CandidateRepository.count_for_position(db, position_id, current_user["org_id"])
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
            SELECT event_data::jsonb->>'from_status' AS from_status,
                   COUNT(*) AS moved_count
            FROM pipeline_events
            WHERE position_id = $1 AND org_id = $2
              AND event_type = 'status_changed'
              AND created_at >= NOW() - INTERVAL '30 days'
              AND event_data::jsonb->>'from_status' IS NOT NULL
            GROUP BY event_data::jsonb->>'from_status'
            """,
            position_id, current_user["org_id"],
        )
        pass_map = {r["from_status"]: r["moved_count"] for r in pass_rows}

        enter_rows = await conn.fetch(
            """
            SELECT event_data::jsonb->>'to_status' AS to_status,
                   COUNT(*) AS entered_count
            FROM pipeline_events
            WHERE position_id = $1 AND org_id = $2
              AND event_type = 'status_changed'
              AND created_at >= NOW() - INTERVAL '30 days'
              AND event_data::jsonb->>'to_status' IS NOT NULL
            GROUP BY event_data::jsonb->>'to_status'
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
        all_stages = ["sourced", "emailed", "applied", "screening", "interview", "selected", "rejected", "on_hold"]
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


