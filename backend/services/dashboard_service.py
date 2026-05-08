"""
services/dashboard_service.py – Business logic for dashboard stats and activity feed.
"""
import json
import logging
from typing import Optional

from backend.db.connection import get_connection
from backend.db.repositories.pipeline_events import PipelineEventRepository

logger = logging.getLogger(__name__)


class DashboardService:

    @staticmethod
    async def get_stats(org_id: int, user_id: int, role: str, department_id: Optional[int] = None, period: str = "week") -> dict:
        """Stats cards with role-based filtering."""
        period_filter = {
            "today": "NOW() - INTERVAL '1 day'",
            "week": "NOW() - INTERVAL '7 days'",
            "month": "NOW() - INTERVAL '30 days'",
        }.get(period, "NOW() - INTERVAL '7 days'")

        # Base filters
        pos_filter = "org_id=$1"
        app_filter = "org_id=$1"
        params = [org_id]

        if role == "hiring_manager" and department_id:
            pos_filter += " AND department_id=$2"
            app_filter += " AND position_id IN (SELECT id FROM positions WHERE department_id=$2)"
            params.append(department_id)
        elif role == "recruiter":
            pos_filter += " AND assigned_to=$2"
            app_filter += " AND position_id IN (SELECT id FROM positions WHERE assigned_to=$2)"
            params.append(user_id)

        async with get_connection() as conn:
            open_positions = await conn.fetchval(
                f"SELECT COUNT(*) FROM positions WHERE {pos_filter} AND status='open'", *params
            )
            total_sourced = await conn.fetchval(
                f"SELECT COUNT(*) FROM candidate_applications WHERE {app_filter}", *params
            )
            total_applied = await conn.fetchval(
                f"SELECT COUNT(*) FROM candidate_applications WHERE {app_filter} AND status='applied'", *params
            )
            total_interview = await conn.fetchval(
                f"SELECT COUNT(*) FROM candidate_applications WHERE {app_filter} AND status='interview'", *params
            )
            total_selected = await conn.fetchval(
                f"SELECT COUNT(*) FROM candidate_applications WHERE {app_filter} AND status='selected'", *params
            )
            
            # Trend calculation (comparing current period to previous period)
            prev_period_filter = {
                "today": "NOW() - INTERVAL '2 days' AND created_at < NOW() - INTERVAL '1 day'",
                "week": "NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days'",
                "month": "NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days'",
            }.get(period)

            # For trends, we just compare total sourced for now as an example
            current_sourced = await conn.fetchval(
                f"SELECT COUNT(*) FROM candidates WHERE org_id=$1 AND created_at >= {period_filter}", org_id
            )
            prev_sourced = await conn.fetchval(
                f"SELECT COUNT(*) FROM candidates WHERE org_id=$1 AND created_at >= {prev_period_filter}", org_id
            )

        return {
            "active_positions": open_positions or 0,
            "total_candidates": total_sourced or 0,
            "applied_this_period": total_applied or 0,
            "interviews_this_period": total_interview or 0,
            "offers_this_period": total_selected or 0,
            "trends": {
                "candidates": {"value": current_sourced, "diff": current_sourced - (prev_sourced or 0), "trend": "up" if current_sourced >= (prev_sourced or 0) else "down"}
            },
            "period": period,
        }

    @staticmethod
    async def get_positions_summary(org_id: int, user_id: int, role: str, department_id: Optional[int] = None) -> dict:
        """Dashboard positions table with role-based filtering."""
        pos_filter = "p.org_id = $1"
        params = [org_id]

        if role == "hiring_manager" and department_id:
            pos_filter += " AND p.department_id=$2"
            params.append(department_id)
        elif role == "recruiter":
            pos_filter += " AND p.assigned_to=$2"
            params.append(user_id)

        async with get_connection() as conn:
            rows = await conn.fetch(
                f"""
                SELECT
                    p.id, p.role_name, p.status, p.priority, p.deadline,
                    p.created_at, p.headcount,
                    d.name AS department_name,
                    u.name AS assigned_to_name,
                    COUNT(a.id) AS total_candidates,
                    COUNT(a.id) FILTER (WHERE a.status='sourced') AS sourced,
                    COUNT(a.id) FILTER (WHERE a.status='emailed') AS emailed,
                    COUNT(a.id) FILTER (WHERE a.status='applied') AS applied,
                    COUNT(a.id) FILTER (WHERE a.status='interview') AS interview,
                    COUNT(a.id) FILTER (WHERE a.status='selected') AS selected
                FROM positions p
                LEFT JOIN departments d ON d.id = p.department_id
                LEFT JOIN users u ON u.id = p.assigned_to
                LEFT JOIN candidate_applications a ON a.position_id = p.id
                WHERE {pos_filter} AND p.status != 'archived'
                GROUP BY p.id, d.name, u.name
                ORDER BY p.created_at DESC
                LIMIT 50
                """,
                *params
            )
        return {"positions": [dict(r) for r in rows]}

    @staticmethod
    async def get_funnel(org_id: int) -> dict:
        """Hiring funnel aggregation across all open positions."""
        async with get_connection() as conn:
            rows = await conn.fetch(
                """
                SELECT status, COUNT(*) AS count
                FROM candidate_applications
                WHERE org_id=$1
                GROUP BY status
                ORDER BY count DESC
                """,
                org_id
            )
        counts = {r["status"]: r["count"] for r in rows}
        # Return flat dict — FunnelChart reads keys directly
        return {
            "sourced": counts.get("sourced", 0),
            "emailed": counts.get("emailed", 0),
            "applied": counts.get("applied", 0),
            "screening": counts.get("screening", 0),
            "interview": counts.get("interview", 0),
            "selected": counts.get("selected", 0),
            "rejected": counts.get("rejected", 0),
        }

    @staticmethod
    async def get_activity(
        org_id: int,
        position_id: Optional[int] = None,
        limit: int = 30
    ) -> dict:
        """Recent pipeline events for activity feed."""
        async with get_connection() as conn:
            if position_id:
                events = await PipelineEventRepository.list_for_position(
                    conn, position_id, org_id, limit
                )
            else:
                events = await PipelineEventRepository.list_recent(conn, org_id, limit)

        for evt in events:
            if evt.get("event_data") and isinstance(evt["event_data"], str):
                try:
                    evt["event_data"] = json.loads(evt["event_data"])
                except Exception:
                    pass

        return {"events": events}
