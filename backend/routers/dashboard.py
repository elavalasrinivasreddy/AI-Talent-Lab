"""
routers/dashboard.py – Dashboard stats, positions list, pipeline Kanban, activity feed.
All routes under /api/v1/dashboard/
"""
import logging
from typing import Optional

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from backend.db.repositories.departments import DeptRepository
from backend.dependencies import get_current_user, get_db
from backend.services.dashboard_service import DashboardService

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])
logger = logging.getLogger(__name__)

_DEPT_FILTER_ROLES = {"org_head", "dept_admin", "platform_admin"}


async def _resolve_dept_id(
    requested: Optional[int],
    current_user: dict,
    db: asyncpg.Connection,
) -> Optional[int]:
    """Return the effective department_id to filter by.

    Only admin roles may override via query param; the requested dept must
    belong to the caller's org to prevent cross-org data leakage.
    Non-admin roles always get their own JWT dept (or None).
    """
    if requested is None or current_user["role"] not in _DEPT_FILTER_ROLES:
        return current_user.get("dept_id")
    dept = await DeptRepository.get_by_id(db, requested, current_user["org_id"])
    if dept is None:
        raise HTTPException(status_code=403, detail="Department not found or not in your org")
    return requested


@router.get("/briefing")
async def get_briefing(
    period: str = Query("week", pattern="^(today|week|month)$"),
    dept_id: Optional[int] = Query(None),
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Unified V3 dashboard briefing payload (stats, positions, activity, suggestions)."""
    effective_dept = await _resolve_dept_id(dept_id, current_user, db)
    return await DashboardService.get_briefing(
        org_id=current_user["org_id"],
        user_id=current_user["user_id"],
        role=current_user["role"],
        department_id=effective_dept,
        period=period
    )


@router.get("/stats")
async def get_stats(
    period: str = Query("week", pattern="^(today|week|month)$"),
    dept_id: Optional[int] = Query(None),
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Stats cards + trends for the dashboard header."""
    effective_dept = await _resolve_dept_id(dept_id, current_user, db)
    return await DashboardService.get_stats(
        org_id=current_user["org_id"],
        user_id=current_user["user_id"],
        role=current_user["role"],
        department_id=effective_dept,
        period=period
    )


@router.get("/positions")
async def get_dashboard_positions(
    dept_id: Optional[int] = Query(None),
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Positions with candidate counts for the dashboard table."""
    effective_dept = await _resolve_dept_id(dept_id, current_user, db)
    return await DashboardService.get_positions_summary(
        org_id=current_user["org_id"],
        user_id=current_user["user_id"],
        role=current_user["role"],
        department_id=effective_dept,
    )


@router.get("/pipeline/{position_id}")
async def get_pipeline_kanban(
    position_id: int,
    current_user=Depends(get_current_user),
):
    """Kanban board data — candidates grouped by pipeline stage."""
    from backend.services.position_service import PositionService
    return await PositionService.get_kanban(position_id, current_user["org_id"])


@router.get("/funnel")
async def get_funnel(
    current_user=Depends(get_current_user),
):
    """Hiring funnel aggregation across all open positions."""
    return await DashboardService.get_funnel(current_user["org_id"])


@router.get("/activity")
async def get_activity(
    position_id: Optional[int] = Query(None),
    limit: int = Query(30, le=100),
    current_user=Depends(get_current_user),
):
    """Recent pipeline events (org-wide or position-scoped activity feed)."""
    return await DashboardService.get_activity(
        org_id=current_user["org_id"],
        position_id=position_id,
        limit=limit,
    )


@router.get("/analytics")
async def get_analytics(
    period: str = Query("month", pattern="^(week|month|quarter|year)$"),
    current_user=Depends(get_current_user),
):
    """Full hiring analytics: velocity, source breakdown, conversion rates, time-to-hire."""
    return await DashboardService.get_analytics(
        org_id=current_user["org_id"],
        period=period,
    )
