"""
services/quota_service.py — plan quota + LLM budget enforcement.

Soft-warn → hard-block model (decision 2026-06-13):
  • below WARN_THRESHOLD (80%)  → allowed, no warning
  • 80%–100%                    → allowed, ``warn=True`` (UI nudges to upgrade)
  • at/over 100%                → blocked (``enforce_*`` raises 402)

All counts are read live from the DB so there is no separate counter to keep in
sync. Methods are pure (take a connection) so they're trivially unit-testable:
seed rows, call ``enforce_*``, assert it raises.

Resources gated:
  • active_positions      — open/in-flight roles (excludes terminal + draft)
  • candidates_per_month  — applications created this calendar month
  • seats                 — org users
  • llm_monthly_budget    — SUM(cost_usd) from llm_usage_log this calendar month
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, asdict
from typing import Optional

import asyncpg

from backend.exceptions import QuotaExceededError, BudgetExceededError
from backend.services import plans

logger = logging.getLogger(__name__)

# Statuses that do NOT consume an "active position" slot.
_NON_ACTIVE_POSITION_STATUSES = (
    "draft", "closed", "cancelled", "archived", "filled", "rejected",
)


@dataclass
class QuotaStatus:
    resource: str
    plan: str
    used: float
    limit: Optional[float]      # None == unlimited
    warn: bool                  # True once usage ≥ WARN_THRESHOLD of limit
    exceeded: bool              # True once usage ≥ limit
    remaining: Optional[float]  # None == unlimited
    message: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


def _evaluate(resource: str, plan: str, used: float, limit: Optional[float]) -> QuotaStatus:
    """Turn a raw (used, limit) pair into a QuotaStatus under the warn→block model."""
    if limit is None:
        return QuotaStatus(resource, plan, used, None, False, False, None)

    exceeded = used >= limit
    warn = used >= limit * plans.WARN_THRESHOLD
    remaining = max(limit - used, 0)
    message = None
    if exceeded:
        message = f"{resource.replace('_', ' ')} limit reached for the {plan} plan ({used}/{limit})."
    elif warn:
        message = f"Approaching your {resource.replace('_', ' ')} limit ({used}/{limit})."
    return QuotaStatus(resource, plan, used, limit, warn, exceeded, remaining, message)


class QuotaService:
    """Live plan-limit + LLM-budget checks for an org."""

    # ── plan lookup ───────────────────────────────────────────────────────────
    @staticmethod
    async def get_org_plan(conn: asyncpg.Connection, org_id: int) -> str:
        row = await conn.fetchrow("SELECT plan FROM organizations WHERE id = $1", org_id)
        # .get() so a row without the column (e.g. a mocked conn) falls back to default.
        return plans.normalize_plan(row.get("plan") if row else None)

    @staticmethod
    async def _llm_budget_for(conn: asyncpg.Connection, org_id: int, plan: str) -> float:
        """Per-org LLM budget: an explicit override on the org, else the plan default."""
        row = await conn.fetchrow(
            "SELECT llm_monthly_budget_usd FROM organizations WHERE id = $1", org_id
        )
        override = row.get("llm_monthly_budget_usd") if row else None
        if override is not None:
            return float(override)
        return float(plans.limit_for(plan, "llm_monthly_budget_usd"))

    # ── raw counters ──────────────────────────────────────────────────────────
    @staticmethod
    async def count_active_positions(conn: asyncpg.Connection, org_id: int) -> int:
        return int(await conn.fetchval(
            """
            SELECT COUNT(*) FROM positions
            WHERE org_id = $1
              AND COALESCE(status, 'draft') != ALL($2::text[])
            """,
            org_id, list(_NON_ACTIVE_POSITION_STATUSES),
        ) or 0)

    @staticmethod
    async def count_candidates_this_month(conn: asyncpg.Connection, org_id: int) -> int:
        return int(await conn.fetchval(
            """
            SELECT COUNT(*) FROM candidate_applications
            WHERE org_id = $1
              AND created_at >= date_trunc('month', NOW())
            """,
            org_id,
        ) or 0)

    @staticmethod
    async def count_seats(conn: asyncpg.Connection, org_id: int) -> int:
        return int(await conn.fetchval(
            "SELECT COUNT(*) FROM users WHERE org_id = $1", org_id,
        ) or 0)

    @staticmethod
    async def llm_spend_this_month(conn: asyncpg.Connection, org_id: int) -> float:
        return float(await conn.fetchval(
            """
            SELECT COALESCE(SUM(cost_usd), 0) FROM llm_usage_log
            WHERE org_id = $1
              AND created_at >= date_trunc('month', NOW())
            """,
            org_id,
        ) or 0.0)

    # ── status checks (non-raising) ───────────────────────────────────────────
    @staticmethod
    async def check_positions(conn, org_id, plan: Optional[str] = None) -> QuotaStatus:
        plan = plan or await QuotaService.get_org_plan(conn, org_id)
        used = await QuotaService.count_active_positions(conn, org_id)
        return _evaluate("active_positions", plan, used, plans.limit_for(plan, "active_positions"))

    @staticmethod
    async def check_candidates(conn, org_id, plan: Optional[str] = None) -> QuotaStatus:
        plan = plan or await QuotaService.get_org_plan(conn, org_id)
        used = await QuotaService.count_candidates_this_month(conn, org_id)
        return _evaluate("candidates_per_month", plan, used, plans.limit_for(plan, "candidates_per_month"))

    @staticmethod
    async def check_seats(conn, org_id, plan: Optional[str] = None) -> QuotaStatus:
        plan = plan or await QuotaService.get_org_plan(conn, org_id)
        used = await QuotaService.count_seats(conn, org_id)
        return _evaluate("seats", plan, used, plans.limit_for(plan, "seats"))

    @staticmethod
    async def check_llm_budget(conn, org_id, plan: Optional[str] = None) -> QuotaStatus:
        plan = plan or await QuotaService.get_org_plan(conn, org_id)
        used = round(await QuotaService.llm_spend_this_month(conn, org_id), 6)
        budget = await QuotaService._llm_budget_for(conn, org_id, plan)
        return _evaluate("llm_monthly_budget", plan, used, budget)

    # ── enforcement (raising) ─────────────────────────────────────────────────
    @staticmethod
    def _raise_quota(status: QuotaStatus):
        raise QuotaExceededError(
            status.message or f"{status.resource} limit reached",
            details={
                "resource": status.resource,
                "used": status.used,
                "limit": status.limit,
                "plan": status.plan,
            },
        )

    @staticmethod
    async def enforce_positions(conn, org_id, plan: Optional[str] = None) -> QuotaStatus:
        status = await QuotaService.check_positions(conn, org_id, plan)
        if status.exceeded:
            QuotaService._raise_quota(status)
        return status

    @staticmethod
    async def enforce_candidates(conn, org_id, plan: Optional[str] = None) -> QuotaStatus:
        status = await QuotaService.check_candidates(conn, org_id, plan)
        if status.exceeded:
            QuotaService._raise_quota(status)
        return status

    @staticmethod
    async def enforce_seats(conn, org_id, plan: Optional[str] = None) -> QuotaStatus:
        status = await QuotaService.check_seats(conn, org_id, plan)
        if status.exceeded:
            QuotaService._raise_quota(status)
        return status

    @staticmethod
    async def enforce_llm_budget(conn, org_id, plan: Optional[str] = None) -> QuotaStatus:
        status = await QuotaService.check_llm_budget(conn, org_id, plan)
        if status.exceeded:
            raise BudgetExceededError(
                status.message or "Monthly AI usage budget reached",
                details={
                    "resource": status.resource,
                    "used": status.used,
                    "limit": status.limit,
                    "plan": status.plan,
                },
            )
        return status

    # ── aggregate (for /billing/usage) ────────────────────────────────────────
    @staticmethod
    async def usage_summary(conn: asyncpg.Connection, org_id: int) -> dict:
        plan = await QuotaService.get_org_plan(conn, org_id)
        positions = await QuotaService.check_positions(conn, org_id, plan)
        candidates = await QuotaService.check_candidates(conn, org_id, plan)
        seats = await QuotaService.check_seats(conn, org_id, plan)
        llm = await QuotaService.check_llm_budget(conn, org_id, plan)
        return {
            "plan": plan,
            "plan_label": plans.limits_for(plan)["label"],
            "warn_threshold": plans.WARN_THRESHOLD,
            "quotas": {
                "active_positions": positions.to_dict(),
                "candidates_per_month": candidates.to_dict(),
                "seats": seats.to_dict(),
                "llm_monthly_budget": llm.to_dict(),
            },
            "any_warn": any(s.warn for s in (positions, candidates, seats, llm)),
            "any_exceeded": any(s.exceeded for s in (positions, candidates, seats, llm)),
        }
