"""
routers/positions.py – Position CRUD and search endpoints.
All routes under /api/v1/positions/
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

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
    pos = await PositionService.update_position(
        position_id=position_id,
        org_id=current_user["org_id"],
        user_id=current_user["id"],
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
    new_status = body.get("status")
    if not new_status:
        raise HTTPException(status_code=422, detail={
            "error": {"code": "MISSING_STATUS", "message": "status field is required", "details": None}
        })
    try:
        pos = await PositionService.update_status(
            position_id=position_id,
            org_id=current_user["org_id"],
            user_id=current_user["id"],
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
    pos = await PositionService.get_position(position_id, current_user["org_id"])
    if not pos:
        raise HTTPException(status_code=404, detail={
            "error": {"code": "POSITION_NOT_FOUND", "message": "Position not found", "details": None}
        })
    result = await PositionService.trigger_search_now(
        position_id=position_id,
        org_id=current_user["org_id"],
        department_id=pos["department_id"],
        user_id=current_user["id"],
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
    try:
        kit = await PositionService.generate_interview_kit(
            position_id=position_id,
            org_id=current_user["org_id"],
            user_id=current_user["id"],
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
            WHERE u.org_id=$1 AND u.role IN ('admin', 'hiring_manager')
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
    if current_user.get("role") not in ("admin", "hiring_manager", "dept_admin"):
        raise HTTPException(status_code=403, detail={"error": {"code": "FORBIDDEN", "message": "Only admins, hiring managers, and dept heads can approve positions", "details": None}})

    decision = body.get("decision")
    if decision not in ("approved", "changes_requested"):
        raise HTTPException(status_code=422, detail={"error": {"code": "INVALID_DECISION", "message": "decision must be 'approved' or 'changes_requested'", "details": None}})

    from backend.db.connection import get_connection
    async with get_connection() as conn:
        row = await conn.fetchrow(
            "SELECT id, created_by, role_name FROM positions WHERE id=$1 AND org_id=$2",
            position_id, current_user["org_id"],
        )
        if not row:
            raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Position not found", "details": None}})

        approved_by = current_user["id"] if decision == "approved" else None
        await conn.execute(
            f"""
            UPDATE positions
            SET approval_status=$1,
                approved_by=$2,
                approved_at={'NOW()' if decision == 'approved' else 'NULL'},
                updated_at=NOW()
            WHERE id=$3
            """,
            decision, approved_by, position_id,
        )

        # Notify the recruiter who created it
        if row["created_by"]:
            msg = (f"\"{row['role_name']}\" was approved" if decision == "approved"
                   else f"\"{row['role_name']}\" needs changes before approval")
            await conn.execute(
                """
                INSERT INTO notifications (org_id, user_id, type, title, message, action_url)
                VALUES ($1,$2,$3,$4,$5,$6)
                """,
                current_user["org_id"], row["created_by"],
                "approval_decision", "Position approval update", msg,
                f"/positions/{position_id}",
            )

    return {"ok": True, "approval_status": decision}


# ── Hire Requests ─────────────────────────────────────────────────────────────

@router.post("/requests")
async def submit_hire_request(
    body: dict,
    current_user=Depends(get_current_user),
):
    """
    Hiring manager submits a request for a new position.
    HR/recruiter will pick it up from the queue to generate the JD.
    """
    role_name = (body.get("role_name") or "").strip()
    if not role_name:
        raise HTTPException(status_code=422, detail={
            "error": {"code": "MISSING_ROLE", "message": "role_name is required", "details": None}
        })

    async with get_connection() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO hire_requests (
                org_id, department_id, requested_by, role_name,
                headcount, work_type, experience_min, experience_max,
                target_start, requirements, status
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
            RETURNING id, role_name, status, created_at
            """,
            current_user["org_id"],
            body.get("department_id"),
            current_user["id"],
            role_name,
            int(body.get("headcount") or 1),
            body.get("work_type") or "onsite",
            body.get("experience_min"),
            body.get("experience_max"),
            body.get("target_start"),
            body.get("requirements"),
        )
        # Notify recruiters/admins
        await conn.execute(
            """
            INSERT INTO notifications (org_id, user_id, type, title, message, action_url)
            SELECT $1, u.id, 'hire_request',
                   'New hire request',
                   $2 || ' requested by ' || $3,
                   '/dashboard'
            FROM users u
            WHERE u.org_id=$1 AND u.role IN ('admin', 'recruiter') AND u.is_active=TRUE
            """,
            current_user["org_id"],
            role_name,
            current_user.get("name", "Manager"),
        )
    return dict(row) if row else {}


@router.get("/requests")
async def list_hire_requests(
    status: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
):
    """
    List hire requests for this org.
    Hiring managers see only their own requests.
    Recruiters and admins see all pending requests.
    """
    async with get_connection() as conn:
        if current_user.get("role") == "hiring_manager":
            rows = await conn.fetch(
                """
                SELECT hr.*, d.name AS department_name,
                       u.name AS requested_by_name,
                       p.approval_status AS position_approval_status,
                       p.role_name AS position_role_name,
                       (SELECT COUNT(*) FROM candidate_applications ca
                        WHERE ca.position_id = hr.position_id) AS candidate_count,
                       (SELECT COUNT(*) FROM interviews i
                        WHERE i.position_id = hr.position_id) AS interview_count
                FROM hire_requests hr
                LEFT JOIN departments d ON d.id = hr.department_id
                LEFT JOIN users u ON u.id = hr.requested_by
                LEFT JOIN positions p ON p.id = hr.position_id
                WHERE hr.org_id=$1 AND hr.requested_by=$2
                ORDER BY hr.created_at DESC
                LIMIT 20
                """,
                current_user["org_id"], current_user["id"],
            )
        else:
            filter_status = status or "pending"
            rows = await conn.fetch(
                """
                SELECT hr.*, d.name AS department_name,
                       u.name AS requested_by_name
                FROM hire_requests hr
                LEFT JOIN departments d ON d.id = hr.department_id
                LEFT JOIN users u ON u.id = hr.requested_by
                WHERE hr.org_id=$1 AND hr.status=$2
                ORDER BY hr.created_at DESC
                LIMIT 50
                """,
                current_user["org_id"], filter_status,
            )
    return {"requests": [dict(r) for r in rows]}


@router.patch("/requests/{request_id}/accept")
async def accept_hire_request(
    request_id: int,
    body: dict = {},
    current_user=Depends(get_current_user),
):
    """
    Recruiter accepts the hire request and will handle JD generation.
    Optionally links to a chat_session_id when they start the chat.
    """
    if current_user.get("role") not in ("admin", "recruiter"):
        raise HTTPException(status_code=403, detail={
            "error": {"code": "FORBIDDEN", "message": "Only recruiters can accept hire requests", "details": None}
        })
    async with get_connection() as conn:
        row = await conn.fetchrow(
            "SELECT id, status, requested_by, role_name FROM hire_requests WHERE id=$1 AND org_id=$2",
            request_id, current_user["org_id"],
        )
        if not row:
            raise HTTPException(status_code=404, detail={
                "error": {"code": "NOT_FOUND", "message": "Hire request not found", "details": None}
            })
        if row["status"] != "pending":
            raise HTTPException(status_code=400, detail={
                "error": {"code": "ALREADY_ACTIONED", "message": f"Request is already {row['status']}", "details": None}
            })
        await conn.execute(
            """
            UPDATE hire_requests
            SET status='accepted', accepted_by=$1, updated_at=NOW(),
                chat_session_id=$2
            WHERE id=$3
            """,
            current_user["id"],
            body.get("chat_session_id"),
            request_id,
        )
        if row["requested_by"]:
            await conn.execute(
                """
                INSERT INTO notifications (org_id, user_id, type, title, message, action_url)
                VALUES ($1,$2,'hire_request_accepted','Your hire request was picked up',$3,'/dashboard')
                """,
                current_user["org_id"],
                row["requested_by"],
                f"{row['role_name']} is being processed by {current_user.get('name', 'HR')}",
            )
    return {"ok": True, "status": "accepted"}


@router.patch("/requests/{request_id}/link-session")
async def link_hire_request_to_position(
    request_id: int,
    body: dict,
    current_user=Depends(get_current_user),
):
    """
    Called by ChatPage when JD generation completes.
    Reads position_id from the chat session, links it to the hire request,
    auto-submits the position for hiring manager JD approval, and notifies them.
    """
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=422, detail={
            "error": {"code": "MISSING_SESSION", "message": "session_id is required", "details": None}
        })

    async with get_connection() as conn:
        session = await conn.fetchrow(
            "SELECT position_id FROM chat_sessions WHERE id=$1 AND org_id=$2",
            session_id, current_user["org_id"],
        )
        if not session or not session["position_id"]:
            raise HTTPException(status_code=404, detail={
                "error": {"code": "NO_POSITION", "message": "Session has no linked position yet", "details": None}
            })

        position_id = session["position_id"]

        req = await conn.fetchrow(
            "SELECT id, requested_by, role_name FROM hire_requests WHERE id=$1 AND org_id=$2",
            request_id, current_user["org_id"],
        )
        if not req:
            raise HTTPException(status_code=404, detail={
                "error": {"code": "NOT_FOUND", "message": "Hire request not found", "details": None}
            })

        await conn.execute(
            """UPDATE hire_requests SET position_id=$1, status='fulfilled', updated_at=NOW()
               WHERE id=$2""",
            position_id, request_id,
        )

        await conn.execute(
            """UPDATE positions
               SET requires_approval=TRUE, approval_status='pending', updated_at=NOW()
               WHERE id=$1""",
            position_id,
        )

        if req["requested_by"]:
            await conn.execute(
                """INSERT INTO notifications (org_id, user_id, type, title, message, action_url)
                   VALUES ($1,$2,'jd_ready_for_approval',
                           'JD ready for your review',
                           $3 || ' job description is ready. Please review and approve.',
                           '/dashboard')""",
                current_user["org_id"], req["requested_by"], req["role_name"],
            )

    logger.info(f"[hire_request] {request_id} linked to position {position_id} by user {current_user['id']}")
    return {"ok": True, "position_id": position_id}


@router.patch("/requests/{request_id}/cancel")
async def cancel_hire_request(
    request_id: int,
    current_user=Depends(get_current_user),
):
    """Cancel a hire request. Hiring managers cancel their own; admins can cancel any."""
    async with get_connection() as conn:
        row = await conn.fetchrow(
            "SELECT id, status, requested_by FROM hire_requests WHERE id=$1 AND org_id=$2",
            request_id, current_user["org_id"],
        )
        if not row:
            raise HTTPException(status_code=404, detail={
                "error": {"code": "NOT_FOUND", "message": "Hire request not found", "details": None}
            })
        if current_user.get("role") == "hiring_manager" and row["requested_by"] != current_user["id"]:
            raise HTTPException(status_code=403, detail={
                "error": {"code": "FORBIDDEN", "message": "You can only cancel your own requests", "details": None}
            })
        await conn.execute(
            "UPDATE hire_requests SET status='cancelled', updated_at=NOW() WHERE id=$1",
            request_id,
        )
    return {"ok": True, "status": "cancelled"}
