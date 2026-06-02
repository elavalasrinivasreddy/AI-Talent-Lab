"""
routers/hire_requests.py – /api/v1/hire-requests/* endpoints.

Thin HTTP layer: validates input via Pydantic, calls HireRequestService.
The OLD endpoints under /api/v1/positions/requests/* still exist as thin
shims so the existing Dashboard widgets keep working — see routers/positions.py.
"""
import logging
from typing import Optional

from pydantic import BaseModel, field_validator

from fastapi import APIRouter, Depends, Query, Request

import asyncpg

from backend.dependencies import get_db, get_current_user
from backend.middleware.rate_limiter import limiter
from backend.services.hire_request_service import HireRequestService
from backend.db.repositories.hire_requests import HireRequestRepository
from backend.models.hire_request import (
    HireRequestCreate,
    HireRequestUpdate,
    HireRequestAccept,
    HireRequestLinkSession,
    HireRequestReject,
)

router = APIRouter(prefix="/api/v1/hire-requests", tags=["HireRequests"])
logger = logging.getLogger(__name__)


def _get_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("/")
async def list_hire_requests(
    scope: str = Query("default", pattern="^(default|mine|all)$"),
    status: Optional[str] = Query(None),
    department_id: Optional[int] = Query(None),
    cursor_created_at: Optional[str] = Query(None),
    cursor_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Role-aware list. Use `scope=mine` for the requester's own list,
    `scope=all` for admins/recruiters to see every request.

    Supports cursor/seek pagination: pass `cursor_created_at` and `cursor_id`
    from the previous response's `next_cursor` to fetch the next page.
    """
    rows, next_cursor = await HireRequestService.list_for_user(
        db,
        org_id=current_user["org_id"],
        user_id=current_user["user_id"],
        role=current_user["role"],
        scope=scope,
        status=status,
        department_id=department_id,
        cursor_created_at=cursor_created_at,
        cursor_id=cursor_id,
        limit=limit,
    )
    return {"requests": rows, "next_cursor": next_cursor}


# ── Sidebar badge — pending count ────────────────────────────────────────────

@router.get("/pending-count")
async def pending_count(
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Count pending requests for this user's role/department — for sidebar badge."""
    count = await HireRequestService.get_pending_count_for_user(
        db, 
        org_id=current_user["org_id"], 
        user_id=current_user["user_id"], 
        role=current_user["role"]
    )
    return {"count": count}


# ── Detail ────────────────────────────────────────────────────────────────────

@router.get("/{request_id}")
async def get_hire_request(
    request_id: int,
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await HireRequestService.get(db, request_id, current_user["org_id"])
    return {"request": row}


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("/")
@limiter.limit("30/minute")
async def create_hire_request(
    request: Request,
    body: HireRequestCreate,
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    created = await HireRequestService.create(
        db,
        org_id=current_user["org_id"],
        user_id=current_user["user_id"],
        role=current_user["role"],
        ip_address=_get_ip(request),
        **body.model_dump(),
    )
    return {"request": created}


# ── Update ────────────────────────────────────────────────────────────────────

@router.patch("/{request_id}")
@limiter.limit("60/minute")
async def update_hire_request(
    request_id: int,
    request: Request,
    body: HireRequestUpdate,
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    fields = body.model_dump(exclude_none=True)
    updated = await HireRequestService.update(
        db, request_id, current_user["org_id"],
        user_id=current_user["user_id"],
        role=current_user["role"],
        ip_address=_get_ip(request),
        **fields,
    )
    return {"request": updated}


# ── Approve (dept_admin / org_head) ─────────────────────────────────────────

@router.post("/{request_id}/approve")
async def approve_hire_request(
    request_id: int,
    request: Request,
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Approve a pending hire request. Requires dept_admin or org_head role."""
    updated = await HireRequestService.approve_request(
        db, request_id, current_user["org_id"],
        user_id=current_user["user_id"],
        role=current_user["role"],
        dept_id=current_user.get("dept_id"),
        ip_address=_get_ip(request),
    )
    return {"request": updated}


# ── Reject (dept_admin / org_head) ───────────────────────────────────────────

@router.post("/{request_id}/reject")
async def reject_hire_request(
    request_id: int,
    request: Request,
    body: HireRequestReject,
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Reject a pending hire request with a mandatory reason."""
    updated = await HireRequestService.reject_request(
        db, request_id, current_user["org_id"],
        user_id=current_user["user_id"],
        role=current_user["role"],
        dept_id=current_user.get("dept_id"),
        reason=body.reason,
        ip_address=_get_ip(request),
    )
    return {"request": updated}


# ── Accept (recruiter pickup) ────────────────────────────────────────────────

@router.post("/{request_id}/accept")
async def accept_hire_request(
    request_id: int,
    request: Request,
    body: HireRequestAccept,
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    updated = await HireRequestService.accept(
        db, request_id, current_user["org_id"],
        user_id=current_user["user_id"],
        role=current_user["role"],
        chat_session_id=body.chat_session_id,
        ip_address=_get_ip(request),
    )
    return {"request": updated}


# ── Cancel ────────────────────────────────────────────────────────────────────

@router.post("/{request_id}/cancel")
async def cancel_hire_request(
    request_id: int,
    request: Request,
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    updated = await HireRequestService.cancel(
        db, request_id, current_user["org_id"],
        user_id=current_user["user_id"],
        role=current_user["role"],
        ip_address=_get_ip(request),
    )
    return {"request": updated}


# ── Link chat session → position (after JD generation persists position) ─────

@router.post("/{request_id}/link-session")
async def link_session(
    request_id: int,
    request: Request,
    body: HireRequestLinkSession,
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    updated = await HireRequestService.link_session_to_position(
        db, request_id, current_user["org_id"],
        user_id=current_user["user_id"],
        session_id=body.session_id,
        ip_address=_get_ip(request),
    )
    return {"request": updated}


# ── Admin Reviewing Flow (Design Rev 4) ──────────────────────────────────────

@router.post("/{request_id}/begin-review")
async def begin_review(
    request_id: int,
    request: Request,
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Atomic CAS: submitted → admin_reviewing with lock.

    If another admin holds a stale lock (>10 min), automatically takes over.
    """
    updated = await HireRequestService.begin_review(
        db, request_id, current_user["org_id"],
        user_id=current_user["user_id"],
        role=current_user["role"],
        ip_address=_get_ip(request),
    )
    return {"request": updated}


@router.post("/{request_id}/release-review")
async def release_review(
    request_id: int,
    request: Request,
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Release admin_reviewing lock → submitted (close without action)."""
    updated = await HireRequestService.release_review(
        db, request_id, current_user["org_id"],
        user_id=current_user["user_id"],
        ip_address=_get_ip(request),
    )
    return {"request": updated}


class HireRequestApproveModified(BaseModel):
    """Payload for approve-with-modifications."""
    notes: str
    modification_diff: dict = {}

    @field_validator("notes")
    @classmethod
    def notes_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Notes are required when approving with modifications")
        return v


@router.post("/{request_id}/approve-modified")
async def approve_modified(
    request_id: int,
    request: Request,
    body: HireRequestApproveModified,
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Approve a hire request with modifications (JSONB diff stored)."""
    updated = await HireRequestService.approve_modified(
        db, request_id, current_user["org_id"],
        user_id=current_user["user_id"],
        role=current_user["role"],
        dept_id=current_user.get("dept_id"),
        notes=body.notes,
        modification_diff=body.modification_diff,
        ip_address=_get_ip(request),
    )
    return {"request": updated}


@router.post("/{request_id}/withdraw")
async def withdraw_hire_request(
    request_id: int,
    request: Request,
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Withdraw an approved request (before HR pickup). Only the raiser or admin.

    This is an alias for cancel that checks the request hasn't been accepted yet.
    """
    updated = await HireRequestService.cancel(
        db, request_id, current_user["org_id"],
        user_id=current_user["user_id"],
        role=current_user["role"],
        ip_address=_get_ip(request),
    )
    return {"request": updated}
