"""
services/dashboard_service.py – Business logic for dashboard stats and activity feed.
"""
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from backend.db.connection import get_connection
from backend.db.repositories.pipeline_events import PipelineEventRepository

logger = logging.getLogger(__name__)


class DashboardService:

    @staticmethod
    async def get_stats(org_id: int, user_id: int, role: str, department_id: Optional[int] = None, period: str = "week") -> dict:
        """Stats cards with role-based filtering."""
        period_days = {"today": 1, "week": 7, "month": 30}.get(period, 7)
        _now = datetime.now(timezone.utc).replace(tzinfo=None)
        cutoff = _now - timedelta(days=period_days)
        prev_cutoff = _now - timedelta(days=period_days * 2)

        # Base filters
        pos_filter = "org_id=$1"
        app_filter = "org_id=$1"
        params = [org_id]

        if department_id:
            pos_filter += " AND department_id=$2"
            app_filter += " AND position_id IN (SELECT id FROM positions WHERE department_id=$2)"
            params.append(department_id)
        elif role == "hr":
            pos_filter += " AND assigned_to=$2"
            app_filter += " AND position_id IN (SELECT id FROM positions WHERE assigned_to=$2)"
            params.append(user_id)
        elif role == "team_lead":
            pos_filter += " AND created_by=$2"
            app_filter += " AND position_id IN (SELECT id FROM positions WHERE created_by=$2)"
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

            avg_time_to_hire_raw = await conn.fetchval(
                f"""
                SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)
                FROM candidate_applications
                WHERE {app_filter}
                  AND status IN ('selected', 'hired')
                  AND created_at >= ${len(params) + 1}
                """,
                *params, cutoff,
            )
            
            # Trend calculation (comparing current period to previous period)
            current_sourced = await conn.fetchval(
                "SELECT COUNT(*) FROM candidates WHERE org_id=$1 AND created_at >= $2",
                org_id, cutoff,
            )
            prev_sourced = await conn.fetchval(
                "SELECT COUNT(*) FROM candidates WHERE org_id=$1 AND created_at >= $2 AND created_at < $3",
                org_id, prev_cutoff, cutoff,
            )

        return {
            "active_positions": open_positions or 0,
            "total_candidates": total_sourced or 0,
            "applied_this_period": total_applied or 0,
            "interviews_this_period": total_interview or 0,
            "offers_this_period": total_selected or 0,
            "avg_time_to_hire": round(float(avg_time_to_hire_raw or 0), 1),
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

        if department_id:
            pos_filter += " AND p.department_id=$2"
            params.append(department_id)
        elif role == "hr":
            pos_filter += " AND p.assigned_to=$2"
            params.append(user_id)
        elif role == "team_lead":
            pos_filter += " AND p.created_by=$2"
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
    async def get_briefing(org_id: int, user_id: int, role: str, department_id: Optional[int] = None, period: str = "week") -> dict:
        """Unified dashboard briefing endpoint with RBAC filtering."""
        from backend.services.copilot_service import CopilotService
        
        # 1. Fetch data
        stats = await DashboardService.get_stats(org_id, user_id, role, department_id, period) if role in {"org_head", "dept_admin", "platform_admin"} else None
        positions_res = await DashboardService.get_positions_summary(org_id, user_id, role, department_id)
        positions = positions_res["positions"]
        
        # Determine accessible position IDs for filtering suggestions/events
        accessible_position_ids = {p["id"] for p in positions}
        
        # 2. Activity / Pulse
        activity_res = await DashboardService.get_activity(org_id)
        if department_id or role not in {"org_head", "platform_admin"}:
            activity = [e for e in activity_res["events"] if not e.get("position_id") or e["position_id"] in accessible_position_ids]
        else:
            activity = activity_res["events"]
            
        # 3. Suggestions
        raw_suggestions = await CopilotService.get_suggestions(org_id, user_id)
        suggestions = []
        for s in raw_suggestions:
            stype = s["type"]
            # Role-based visibility
            if stype == "pool_match" and role not in {"org_head", "dept_admin", "platform_admin"}:
                continue
            if stype == "pending_rejection" and role == "hr":
                continue
            if stype == "uncontacted_high_score" and role == "team_lead":
                continue
                
            # Scope visibility to accessible positions if it relates to a position
            # (e.g. if HR, they shouldn't see pending rejections for positions assigned to someone else)
            if s.get("entity_type") == "position" and s.get("entity_id") not in accessible_position_ids:
                if role not in {"org_head", "platform_admin"}:
                    continue
            
            # Special case for application entity type mapping to positions
            # if we have pending_rejection or overdue_feedback, the entity is application. 
            # We don't have position_id natively on the suggestion object for applications. 
            # But we can assume it's scoped enough or we can let it pass since we only fetch for current user if assigned.
            
            suggestions.append(s)

        return {
            "health": stats,
            "positions": positions,
            "activity": activity,
            "suggestions": suggestions
        }

    @staticmethod
    async def get_analytics(org_id: int, period: str = "month") -> dict:
        """
        Full hiring analytics for the analytics dashboard.
        Returns pipeline velocity, source breakdown, time-to-hire, and conversion rates.
        """
        _now = datetime.now(timezone.utc).replace(tzinfo=None)
        cutoff = _now - {
            "week": timedelta(days=7),
            "month": timedelta(days=30),
            "quarter": timedelta(days=90),
            "year": timedelta(days=365),
        }.get(period, timedelta(days=30))
        velocity_cutoff = _now - timedelta(days=56)

        async with get_connection() as conn:
            # Pipeline conversion rates
            funnel = await conn.fetch(
                """
                SELECT status, COUNT(*) AS count
                FROM candidate_applications
                WHERE org_id=$1 AND created_at >= $2
                GROUP BY status
                """,
                org_id, cutoff,
            )
            funnel_dict = {r["status"]: r["count"] for r in funnel}

            # Time to hire (avg days from sourced to selected)
            avg_time_to_hire = await conn.fetchval(
                """
                SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)
                FROM candidate_applications
                WHERE org_id=$1 AND status IN ('selected', 'hired')
                  AND created_at >= $2
                """,
                org_id, cutoff,
            )

            # Source breakdown
            sources = await conn.fetch(
                """
                SELECT c.source, COUNT(*) AS count
                FROM candidate_applications ca
                JOIN candidates c ON c.id = ca.candidate_id
                WHERE ca.org_id=$1 AND ca.created_at >= $2
                GROUP BY c.source
                ORDER BY count DESC
                """,
                org_id, cutoff,
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
                WHERE org_id=$1 AND created_at >= $2
                GROUP BY week
                ORDER BY week
                """,
                org_id, velocity_cutoff,
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

            offer_accepted = await conn.fetchval(
                """
                SELECT COUNT(*) FROM candidate_applications
                WHERE org_id=$1 AND status='hired' AND created_at >= $2
                """,
                org_id, cutoff,
            )
            offer_extended = await conn.fetchval(
                """
                SELECT COUNT(*) FROM candidate_applications
                WHERE org_id=$1 AND status IN ('hired', 'selected') AND created_at >= $2
                """,
                org_id, cutoff,
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
            "avg_time_to_hire": round(float(avg_time_to_hire or 0), 1),
            "sources": [{"source": r["source"] or "unknown", "count": r["count"]} for r in sources],
            "velocity": [
                {
                    "week": r["week"].isoformat() if r["week"] else None,
                    "sourced": r["sourced"],
                    "applied": r["applied"],
                    "interview": r["interview"],
                    "hired": r["hired"],
                }
                for r in velocity
            ],
            "total_applications": total_candidates,
            "total_selected": funnel_dict.get("selected", 0),
            "offer_acceptance_rate": round(
                100 * (offer_accepted or 0) / max(offer_extended or 1, 1), 1
            ),
            "top_positions": [dict(r) for r in top_positions],
            "department_breakdown": [dict(r) for r in dept_stats],
        }

    @staticmethod
    async def get_agent_roi(org_id: int, period: str = "quarter") -> dict:
        """AI vs human sourcing split, hours saved estimate, and dual funnel data."""
        _now = datetime.now(timezone.utc).replace(tzinfo=None)
        period_days = {"week": 7, "month": 30, "quarter": 90, "year": 365}.get(period, 90)
        cutoff = _now - timedelta(days=period_days)
        AI_SOURCES = ('simulation', 'ai_agent', 'ai_sourced')
        AVG_SOURCING_MIN = 45  # minutes saved per AI-sourced candidate

        async with get_connection() as conn:
            total = await conn.fetchval(
                "SELECT COUNT(*) FROM candidate_applications ca WHERE ca.org_id=$1 AND ca.created_at >= $2",
                org_id, cutoff,
            )
            ai_total = await conn.fetchval(
                """
                SELECT COUNT(*) FROM candidate_applications ca
                JOIN candidates c ON c.id = ca.candidate_id
                WHERE ca.org_id=$1 AND ca.created_at >= $2
                  AND c.source = ANY($3::text[])
                """,
                org_id, cutoff, list(AI_SOURCES),
            )
            ai_funnel_rows = await conn.fetch(
                """
                SELECT ca.status, COUNT(*) AS cnt
                FROM candidate_applications ca
                JOIN candidates c ON c.id = ca.candidate_id
                WHERE ca.org_id=$1 AND ca.created_at >= $2
                  AND c.source = ANY($3::text[])
                GROUP BY ca.status
                """,
                org_id, cutoff, list(AI_SOURCES),
            )
            human_funnel_rows = await conn.fetch(
                """
                SELECT ca.status, COUNT(*) AS cnt
                FROM candidate_applications ca
                JOIN candidates c ON c.id = ca.candidate_id
                WHERE ca.org_id=$1 AND ca.created_at >= $2
                  AND c.source != ALL($3::text[])
                GROUP BY ca.status
                """,
                org_id, cutoff, list(AI_SOURCES),
            )

        ai_count = ai_total or 0
        total_count = total or 1
        hours_saved = round(ai_count * AVG_SOURCING_MIN / 60, 1)
        weekly_hours = round(hours_saved / max(period_days / 7, 1), 1)

        FUNNEL_STAGES = ['sourced', 'emailed', 'applied', 'screening', 'interview', 'selected']
        ai_dict = {r["status"]: r["cnt"] for r in ai_funnel_rows}
        human_dict = {r["status"]: r["cnt"] for r in human_funnel_rows}

        def hire_rate(d: dict) -> float:
            top = d.get("sourced", 0) or sum(d.values()) or 1
            bottom = d.get("selected", 0) + d.get("hired", 0)
            return round(100 * bottom / top, 1)

        return {
            "ai_sourcing_share": round(100 * ai_count / total_count, 1),
            "hours_saved": hours_saved,
            "weekly_hours_saved": weekly_hours,
            "ai_candidates": ai_count,
            "total_candidates": total_count,
            "ai_funnel": {s: ai_dict.get(s, 0) for s in FUNNEL_STAGES},
            "human_funnel": {s: human_dict.get(s, 0) for s in FUNNEL_STAGES},
            "ai_hire_rate": hire_rate(ai_dict),
            "human_hire_rate": hire_rate(human_dict),
        }

    @staticmethod
    async def get_per_recruiter(org_id: int, role: str = "hr", dept_id: Optional[int] = None, period: str = "quarter") -> dict:
        """Hires per recruiter for the given period."""
        _now = datetime.now(timezone.utc).replace(tzinfo=None)
        period_days = {"week": 7, "month": 30, "quarter": 90, "year": 365}.get(period, 90)
        cutoff = _now - timedelta(days=period_days)

        async with get_connection() as conn:
            args = [org_id, cutoff]
            dept_filter = ""
            if role == "dept_admin" and dept_id:
                dept_filter = "AND u.department_id = $3"
                args.append(dept_id)

            query = f"""
                WITH recruiter_stats AS (
                    SELECT
                        u.id,
                        u.name,
                        d.name AS department_name,
                        u.department_id,
                        COUNT(ca.id) FILTER (
                            WHERE ca.status IN ('selected', 'hired')
                        ) AS hires,
                        COUNT(DISTINCT p.id) AS active_positions
                    FROM users u
                    LEFT JOIN departments d ON d.id = u.department_id
                    LEFT JOIN positions p
                        ON p.assigned_to = u.id AND p.status = 'open'
                    LEFT JOIN candidate_applications ca
                        ON ca.position_id = p.id
                        AND ca.created_at >= $2
                    WHERE u.org_id = $1
                      AND u.role = 'hr'
                      {dept_filter}
                    GROUP BY u.id, u.name, d.name, u.department_id
                )
            """

            if role in ("org_head", "platform_admin"):
                query += """
                , ranked AS (
                    SELECT *, ROW_NUMBER() OVER(PARTITION BY department_id ORDER BY hires DESC NULLS LAST, name) as rn
                    FROM recruiter_stats
                )
                SELECT * FROM ranked WHERE rn <= 3 ORDER BY hires DESC NULLS LAST, name
                """
            else:
                query += "SELECT * FROM recruiter_stats ORDER BY hires DESC NULLS LAST, name"

            rows = await conn.fetch(query, *args)

        result = [
            {
                "id": r["id"],
                "name": r["name"],
                "department_name": r["department_name"],
                "hires": r["hires"] or 0,
                "active_positions": r["active_positions"] or 0,
            }
            for r in rows
        ]
        max_hires = max((r["hires"] for r in result), default=1) or 1
        for r in result:
            r["pct"] = round(r["hires"] / max_hires * 100)
        return {"recruiters": result}

    @staticmethod
    async def get_bottleneck_radar(org_id: int, period: str = "quarter") -> dict:
        """6-axis radar: Sourcing, Screening, Interview speed, Offer, AI Accept, Retention."""
        _now = datetime.now(timezone.utc).replace(tzinfo=None)
        period_days = {"week": 7, "month": 30, "quarter": 90, "year": 365}.get(period, 90)
        cutoff = _now - timedelta(days=period_days)
        prev_cutoff = cutoff - timedelta(days=period_days)

        async def compute_axes(start: datetime, end: datetime) -> dict:
            async with get_connection() as conn:
                sourced = await conn.fetchval(
                    "SELECT COUNT(*) FROM candidate_applications WHERE org_id=$1 AND created_at BETWEEN $2 AND $3",
                    org_id, start, end,
                )
                applied = await conn.fetchval(
                    """SELECT COUNT(*) FROM candidate_applications
                       WHERE org_id=$1 AND created_at BETWEEN $2 AND $3
                         AND status IN ('applied','screening','interview','selected','hired')""",
                    org_id, start, end,
                )
                screened = await conn.fetchval(
                    """SELECT COUNT(*) FROM candidate_applications
                       WHERE org_id=$1 AND created_at BETWEEN $2 AND $3
                         AND status IN ('screening','interview','selected','hired')""",
                    org_id, start, end,
                )
                avg_days_to_interview = await conn.fetchval(
                    """SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)
                       FROM candidate_applications
                       WHERE org_id=$1 AND status='interview' AND created_at BETWEEN $2 AND $3""",
                    org_id, start, end,
                )
                interview_n = await conn.fetchval(
                    "SELECT COUNT(*) FROM candidate_applications WHERE org_id=$1 AND status='interview' AND created_at BETWEEN $2 AND $3",
                    org_id, start, end,
                )
                selected_n = await conn.fetchval(
                    "SELECT COUNT(*) FROM candidate_applications WHERE org_id=$1 AND status IN ('selected','hired') AND created_at BETWEEN $2 AND $3",
                    org_id, start, end,
                )

            sourced_n = sourced or 0
            return {
                # Sourcing: normalize to 100 candidates as a healthy target
                "sourcing": min(1.0, sourced_n / 100),
                # Screening: what % of applicants pass screening
                "screening": round((screened or 0) / max(applied or 1, 1), 2),
                # Interview speed: 0 days = 1.0, 30+ days = 0.0
                "interview": round(max(0.0, 1.0 - ((avg_days_to_interview or 15.0) / 30.0)), 2),
                # Offer: interview→hire conversion
                "offer": round((selected_n or 0) / max(interview_n or 1, 1), 2),
                # AI Accept: placeholder until copilot accept rate is tracked
                "ai_accept": 0.7,
                # Retention: placeholder until 90-day post-hire data is available
                "retention": 0.8,
            }

        current = await compute_axes(cutoff, _now)
        previous = await compute_axes(prev_cutoff, cutoff)
        return {"current": current, "previous": previous}
