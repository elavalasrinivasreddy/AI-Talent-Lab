"""
services/ops_service.py — Operational intelligence queries.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from backend.db.connection import get_connection

logger = logging.getLogger(__name__)


class OpsService:

    @staticmethod
    async def get_celery_stats(org_id: int, period: str = "quarter") -> dict:
        """Celery task health: success/fail counts, yield, success rate."""
        _now = datetime.now(timezone.utc).replace(tzinfo=None)
        period_days = {"week": 7, "month": 30, "quarter": 90, "year": 365}.get(period, 90)
        cutoff = _now - timedelta(days=period_days)

        async with get_connection() as conn:
            rows = await conn.fetch(
                """
                SELECT
                    task_type,
                    COUNT(*) FILTER (WHERE status = 'success') AS successes,
                    COUNT(*) FILTER (WHERE status = 'failed')  AS failures,
                    COUNT(*)                                    AS total,
                    ROUND(AVG(candidates_found) FILTER (WHERE status='success' AND candidates_found IS NOT NULL), 1)
                        AS avg_candidates,
                    ROUND(AVG(duration_ms) FILTER (WHERE status='success'), 0)
                        AS avg_duration_ms
                FROM task_run_log
                WHERE org_id = $1 AND created_at >= $2
                GROUP BY task_type
                ORDER BY total DESC
                """,
                org_id, cutoff,
            )

        result = []
        for r in rows:
            total = r["total"] or 1
            result.append({
                "task_type": r["task_type"],
                "successes": r["successes"] or 0,
                "failures": r["failures"] or 0,
                "total": r["total"] or 0,
                "success_rate": round(100 * (r["successes"] or 0) / total, 1),
                "avg_candidates": float(r["avg_candidates"] or 0),
                "avg_duration_ms": int(r["avg_duration_ms"] or 0),
            })

        return {"tasks": result, "period": period}

    @staticmethod
    async def get_llm_stats(org_id: int, period: str = "quarter") -> dict:
        """LLM usage: tokens, cost, per-operation breakdown, and 6-month monthly trend."""
        _now = datetime.now(timezone.utc).replace(tzinfo=None)
        period_days = {"week": 7, "month": 30, "quarter": 90, "year": 365}.get(period, 90)
        cutoff = _now - timedelta(days=period_days)

        async with get_connection() as conn:
            totals = await conn.fetchrow(
                """
                SELECT
                    SUM(input_tokens)   AS total_input,
                    SUM(output_tokens)  AS total_output,
                    SUM(cost_usd)       AS total_cost,
                    COUNT(*)            AS total_calls,
                    COUNT(*) FILTER (WHERE NOT success) AS failed_calls,
                    ROUND(AVG(duration_ms) FILTER (WHERE success), 0) AS avg_duration_ms
                FROM llm_usage_log
                WHERE org_id = $1 AND created_at >= $2
                """,
                org_id, cutoff,
            )
            by_op = await conn.fetch(
                """
                SELECT
                    operation,
                    COUNT(*) AS calls,
                    SUM(input_tokens)  AS input_tokens,
                    SUM(output_tokens) AS output_tokens,
                    ROUND(SUM(cost_usd), 4) AS cost_usd,
                    ROUND(AVG(duration_ms) FILTER (WHERE success), 0) AS avg_ms
                FROM llm_usage_log
                WHERE org_id = $1 AND created_at >= $2
                GROUP BY operation
                ORDER BY cost_usd DESC
                """,
                org_id, cutoff,
            )
            monthly_cost = await conn.fetch(
                """
                SELECT
                    DATE_TRUNC('month', created_at) AS month,
                    ROUND(SUM(cost_usd), 4)         AS cost_usd,
                    SUM(input_tokens + output_tokens) AS total_tokens,
                    COUNT(*)                          AS calls
                FROM llm_usage_log
                WHERE org_id = $1
                  AND created_at >= NOW() - INTERVAL '6 months'
                GROUP BY month
                ORDER BY month
                """,
                org_id,
            )

        return {
            "period": period,
            "total_input_tokens":  int(totals["total_input"]  or 0),
            "total_output_tokens": int(totals["total_output"] or 0),
            "total_cost_usd":      round(float(totals["total_cost"] or 0), 4),
            "total_calls":         int(totals["total_calls"]  or 0),
            "failed_calls":        int(totals["failed_calls"] or 0),
            "avg_duration_ms":     int(totals["avg_duration_ms"] or 0),
            "by_operation": [
                {
                    "operation":     r["operation"],
                    "calls":         r["calls"],
                    "input_tokens":  int(r["input_tokens"]  or 0),
                    "output_tokens": int(r["output_tokens"] or 0),
                    "cost_usd":      float(r["cost_usd"]    or 0),
                    "avg_ms":        int(r["avg_ms"]         or 0),
                }
                for r in by_op
            ],
            "monthly_cost_trend": [
                {
                    "month":        r["month"].isoformat() if r["month"] else None,
                    "cost_usd":     float(r["cost_usd"] or 0),
                    "total_tokens": int(r["total_tokens"] or 0),
                    "calls":        int(r["calls"] or 0),
                }
                for r in monthly_cost
            ],
        }

    @staticmethod
    async def get_jd_stats(org_id: int, period: str = "quarter") -> dict:
        """JD lifecycle: generation stats and position status distribution by month."""
        _now = datetime.now(timezone.utc).replace(tzinfo=None)
        period_days = {"week": 7, "month": 30, "quarter": 90, "year": 365}.get(period, 90)
        cutoff = _now - timedelta(days=period_days)

        async with get_connection() as conn:
            jd_gen = await conn.fetchrow(
                """
                SELECT
                    COUNT(*)                              AS total_generations,
                    COUNT(*) FILTER (WHERE success)       AS successful,
                    COUNT(*) FILTER (WHERE NOT success)   AS failed,
                    ROUND(AVG(duration_ms) FILTER (WHERE success), 0)      AS avg_duration_ms,
                    ROUND(AVG(cost_usd)    FILTER (WHERE success), 6)      AS avg_cost_usd,
                    ROUND(SUM(cost_usd), 4)                                 AS total_cost_usd
                FROM llm_usage_log
                WHERE org_id = $1
                  AND operation = 'jd_generation'
                  AND created_at >= $2
                """,
                org_id, cutoff,
            )

            status_dist = await conn.fetch(
                """
                SELECT status, COUNT(*) AS count
                FROM positions
                WHERE org_id = $1 AND created_at >= $2
                GROUP BY status
                """,
                org_id, cutoff,
            )

            monthly_trend = await conn.fetch(
                """
                SELECT
                    DATE_TRUNC('month', created_at) AS month,
                    COUNT(*) AS opened,
                    COUNT(*) FILTER (WHERE status = 'closed')    AS closed,
                    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
                    COUNT(*) FILTER (WHERE status = 'on_hold')   AS on_hold
                FROM positions
                WHERE org_id = $1
                  AND created_at >= NOW() - INTERVAL '6 months'
                GROUP BY month
                ORDER BY month
                """,
                org_id,
            )

            jd_status_dist = await conn.fetch(
                """
                SELECT jd_status, COUNT(*) AS count
                FROM positions
                WHERE org_id = $1 AND created_at >= $2
                GROUP BY jd_status
                """,
                org_id, cutoff,
            )

        total_gen = jd_gen["total_generations"] or 0
        return {
            "period": period,
            "jd_generation": {
                "total":           total_gen,
                "successful":      int(jd_gen["successful"]      or 0),
                "failed":          int(jd_gen["failed"]          or 0),
                "success_rate":    round(100 * (jd_gen["successful"] or 0) / max(total_gen, 1), 1),
                "avg_duration_ms": int(jd_gen["avg_duration_ms"] or 0),
                "avg_cost_usd":    float(jd_gen["avg_cost_usd"]  or 0),
                "total_cost_usd":  float(jd_gen["total_cost_usd"] or 0),
            },
            "status_distribution":    {r["status"]: r["count"] for r in status_dist},
            "jd_status_distribution": {r["jd_status"]: r["count"] for r in jd_status_dist},
            "monthly_trend": [
                {
                    "month":     r["month"].isoformat() if r["month"] else None,
                    "opened":    r["opened"],
                    "closed":    r["closed"],
                    "cancelled": r["cancelled"],
                    "on_hold":   r["on_hold"],
                }
                for r in monthly_trend
            ],
        }
