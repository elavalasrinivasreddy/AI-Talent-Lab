"""
routers/hire_requests.py – /api/v1/hire-requests/* endpoints.

Thin HTTP layer: validates input via Pydantic, calls HireRequestService.
The OLD endpoints under /api/v1/positions/requests/* still exist as thin
shims so the existing Dashboard widgets keep working — see routers/positions.py.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

import asyncpg

from backend.dependencies import get_db, get_current_user
from backend.services.hire_request_service import HireRequestService
from backend.db.repositories.hire_requests import HireRequestRepository
from backend.models.hire_request import (
    HireRequestCreate,
    HireRequestUpdate,
    HireRequestAccept,
    HireRequestLinkSession,
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
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """
    Role-aware list. Use `scope=mine` for the requester's own list,
    `scope=all` for admins/recruiters to see every request.
    """
    rows = await HireRequestService.list_for_user(
        db,
        org_id=current_user["org_id"],
        user_id=current_user["user_id"],
        role=current_user["role"],
        scope=scope,
        status=status,
        department_id=department_id,
    )
    return {"requests": rows}


# ── Sidebar badge — pending count ────────────────────────────────────────────

@router.get("/pending-count")
async def pending_count(
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Count pending requests in this org — for sidebar badge."""
    count = await HireRequestRepository.count_pending_for_org(db, current_user["org_id"])
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
