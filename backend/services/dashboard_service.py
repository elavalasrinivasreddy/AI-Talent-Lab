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

        if role == "team_lead" and department_id:
            pos_filter += " AND department_id=$2"
            app_filter += " AND position_id IN (SELECT id FROM positions WHERE department_id=$2)"
            params.append(department_id)
        elif role == "hr":
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

        if role == "team_lead" and department_id:
            pos_filter += " AND p.department_id=$2"
            params.append(department_id)
        elif role == "hr":
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

    @staticmethod
    async def get_analytics(org_id: int, period: str = "month") -> dict:
        """
        Full hiring analytics for the analytics dashboard.
        Returns pipeline velocity, source breakdown, time-to-hire, and conversion rates.
        """
        period_interval = {
            "week": "7 days",
            "month": "30 days",
            "quarter": "90 days",
            "year": "365 days",
        }.get(period, "30 days")

        async with get_connection() as conn:
            # Pipeline conversion rates
            funnel = await conn.fetch(
                """
                SELECT status, COUNT(*) AS count
                FROM candidate_applications
                WHERE org_id=$1 AND created_at >= NOW() - $2::interval
                GROUP BY status
                """,
                org_id, period_interval,
            )
            funnel_dict = {r["status"]: r["count"] for r in funnel}

            # Time to hire (avg days from sourced to selected)
            avg_time_to_hire = await conn.fetchval(
                """
                SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)
                FROM candidate_applications
                WHERE org_id=$1 AND status IN ('selected', 'hired')
                  AND created_at >= NOW() - $2::interval
                """,
                org_id, period_interval,
            )

            # Source breakdown
            sources = await conn.fetch(
                """
                SELECT c.source, COUNT(*) AS count
                FROM candidate_applications ca
                JOIN candidates c ON c.id = ca.candidate_id
                WHERE ca.org_id=$1 AND ca.created_at >= NOW() - $2::interval
                GROUP BY c.source
                ORDER BY count DESC
                """,
                org_id, period_interval,
            )

            # Weekly velocity (last 8 weeks)
            velocity = await conn.fetch(
                """
                SELECT
                    DATE_TRUNC('week', created_at) AS week,
                    COUNT(*) FILTER (WHERE status='sourced') AS sourced,
                    COUNT(*) FILTER (WHERE status='applied') AS applied,
                    COUNT(*) FILTER (WHERE status='interview') AS interview,
                    COUNT(*) FILTER (WHERE status IN ('selected','hired')) AS hired
                FROM candidate_applications
                WHERE org_id=$1 AND created_at >= NOW() - INTERVAL '56 days'
                GROUP BY week
                ORDER BY week
                """,
                org_id,
            )

            # Top performing positions (by conversion rate)
            top_positions = await conn.fetch(
                """
                SELECT p.role_name, p.id,
                       COUNT(ca.id) AS total,
                       COUNT(ca.id) FILTER (WHERE ca.status='applied') AS applied,
                       COUNT(ca.id) FILTER (WHERE ca.status='interview') AS interview,
                       CASE WHEN COUNT(ca.id) > 0
                            THEN ROUND(100.0 * COUNT(ca.id) FILTER (WHERE ca.status IN ('selected','hired')) / COUNT(ca.id), 1)
                            ELSE 0 END AS conversion_rate
                FROM positions p
                LEFT JOIN candidate_applications ca ON ca.position_id = p.id
                WHERE p.org_id=$1 AND p.status='open'
                GROUP BY p.id, p.role_name
                ORDER BY conversion_rate DESC
                LIMIT 10
                """,
                org_id,
            )

            # Department breakdown
            dept_stats = await conn.fetch(
                """
                SELECT d.name AS department, COUNT(DISTINCT p.id) AS positions,
                       COUNT(ca.id) AS candidates
                FROM departments d
                LEFT JOIN positions p ON p.department_id = d.id AND p.status='open'
                LEFT JOIN candidate_applications ca ON ca.position_id = p.id
                WHERE d.org_id=$1
                GROUP BY d.name
                ORDER BY candidates DESC
                """,
                org_id,
            )

        total_candidates = sum(funnel_dict.values())
        total_applied = funnel_dict.get("applied", 0) + funnel_dict.get("interview", 0) + funnel_dict.get("selected", 0)

        return {
            "period": period,
            "funnel": funnel_dict,
            "conversion_rates": {
                "source_to_apply": round(100 * total_applied / max(total_candidates, 1), 1),
                "apply_to_interview": round(100 * funnel_dict.get("interview", 0) / max(total_applied, 1), 1),
                "interview_to_hire": round(100 * funnel_dict.get("selected", 0) / max(funnel_dict.get("interview", 0), 1), 1),
            },
            "avg_time_to_hire_days": round(float(avg_time_to_hire or 0), 1),
            "source_breakdown": [{"source": r["source"] or "unknown", "count": r["count"]} for r in sources],
            "weekly_velocity": [
                {
                    "week": r["week"].isoformat() if r["week"] else None,
                    "sourced": r["sourced"],
                    "applied": r["applied"],
                    "interview": r["interview"],
                    "hired": r["hired"],
                }
                for r in velocity
            ],
            "top_positions": [dict(r) for r in top_positions],
            "department_breakdown": [dict(r) for r in dept_stats],
        }
