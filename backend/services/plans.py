"""
services/plans.py — Plan tiers + per-plan limits (the "SaaS layer" config).

Single source of truth for what each subscription tier is allowed to do. The
tiers mirror the pricing page (docs/product/03_roadmap.md):

    Starter        ₹0       — try-it / single open role
    Professional   ₹4,999   — small recruiting team
    Business       ₹14,999  — multi-department hiring
    Founder pilot  custom   — design-partner orgs (generous, capped only on COGS)

A limit of ``None`` means "unlimited" for that resource. ``llm_monthly_budget_usd``
is the org's hard cost ceiling for LLM spend per calendar month (the COGS guard
from the market-validation brief §5); ``None`` would mean uncapped, which we
deliberately never use — even pilots get a high-but-finite safety ceiling.

Enforcement lives in services/quota_service.py; this module is pure data so it
can be imported anywhere (config, tests, billing) without side effects.
"""
from __future__ import annotations

# Fraction of a limit at which we start warning the user (soft-warn → block).
WARN_THRESHOLD = 0.8

STARTER = "starter"
PROFESSIONAL = "professional"
BUSINESS = "business"
FOUNDER_PILOT = "founder_pilot"

DEFAULT_PLAN = STARTER
VALID_PLANS = (STARTER, PROFESSIONAL, BUSINESS, FOUNDER_PILOT)

# Human-facing pricing (INR/month) — kept here so the billing adapter and the
# /billing/plans endpoint stay consistent with the marketing pricing page.
PLAN_PRICING_INR = {
    STARTER: 0,
    PROFESSIONAL: 4999,
    BUSINESS: 14999,
    FOUNDER_PILOT: 0,  # custom / design-partner — invoiced out of band
}

# Per-plan resource caps. None == unlimited (never used for the LLM budget).
PLAN_LIMITS = {
    STARTER: {
        "label": "Starter",
        "active_positions": 1,
        "candidates_per_month": 50,
        "seats": 2,
        "llm_monthly_budget_usd": 5.0,
    },
    PROFESSIONAL: {
        "label": "Professional",
        "active_positions": 5,
        "candidates_per_month": 300,
        "seats": 8,
        "llm_monthly_budget_usd": 40.0,
    },
    BUSINESS: {
        "label": "Business",
        "active_positions": 25,
        "candidates_per_month": 2000,
        "seats": 30,
        "llm_monthly_budget_usd": 200.0,
    },
    FOUNDER_PILOT: {
        "label": "Founder pilot",
        "active_positions": None,
        "candidates_per_month": None,
        "seats": None,
        # Pilots are generous on features but still capped on raw LLM cost so a
        # runaway loop can't burn an unbounded bill.
        "llm_monthly_budget_usd": 250.0,
    },
}


def normalize_plan(plan: str | None) -> str:
    """Coerce an arbitrary/legacy plan string to a known tier (defaults to Starter)."""
    if not plan:
        return DEFAULT_PLAN
    p = str(plan).strip().lower()
    return p if p in VALID_PLANS else DEFAULT_PLAN


def limits_for(plan: str | None) -> dict:
    """Return the limits dict for a plan (Starter limits if unknown)."""
    return PLAN_LIMITS[normalize_plan(plan)]


def limit_for(plan: str | None, resource: str):
    """Return a single resource limit (None == unlimited)."""
    return limits_for(plan).get(resource)
