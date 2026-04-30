"""
routers/dashboard.py – Dashboard stats, positions list, pipeline Kanban, activity feed.
All routes under /api/v1/dashboard/
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_current_user
from backend.services.dashboard_service import DashboardService

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])
logger = logging.getLogger(__name__)


@router.get("/stats")
async def get_stats(
    period: str = Query("week", regex="^(today|week|month)$"),
    current_user=Depends(get_current_user),
):
    """Stats cards + trends for the dashboard header."""
    return await DashboardService.get_stats(current_user["org_id"], period)


@router.get("/positions")
async def get_dashboard_positions(
    current_user=Depends(get_current_user),
):
    """Positions with candidate counts for the dashboard table."""
    return await DashboardService.get_positions_summary(current_user["org_id"])


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
