"""Plan quota + LLM-budget enforcement tests (Sprint 2, F2a/F2b).

Two layers:
  • pure-unit  — plans config + the warn→block evaluator (no DB)
  • DB-backed  — live counters + enforce_* against a freshly registered org

Mirrors test_dashboard.py's register→org pattern; org_id is read back from the
DB after registration so we can seed rows and assert enforcement.
"""
import pytest

from backend.services import plans
from backend.services.quota_service import QuotaService, _evaluate
from backend.exceptions import QuotaExceededError, BudgetExceededError


REGISTER_PAYLOAD = {
    "org_name": "Quota Test Org",
    "name": "Quota Admin",
    "email": "admin_quota@testorg.com",
    "password": "SecurePassword123!",
    "segment": "technology",
    "size": "startup",
}


@pytest.fixture
async def org_id(client, db_conn):
    """Register an org and return its id (defaults to the 'starter' plan)."""
    res = await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
    assert res.status_code in (200, 409)
    row = await db_conn.fetchrow(
        "SELECT id FROM organizations WHERE name = $1", REGISTER_PAYLOAD["org_name"]
    )
    return row["id"]


# ── pure-unit: config + evaluator ───────────────────────────────────────────

def test_plan_normalization_defaults_to_starter():
    assert plans.normalize_plan(None) == "starter"
    assert plans.normalize_plan("garbage") == "starter"
    assert plans.normalize_plan("BUSINESS") == "business"


def test_unlimited_limit_never_warns_or_blocks():
    s = _evaluate("active_positions", "founder_pilot", used=9999, limit=None)
    assert s.exceeded is False and s.warn is False and s.remaining is None


def test_evaluator_warn_then_block_boundaries():
    # limit=10, warn threshold 0.8 → warn at 8, block at 10
    assert _evaluate("x", "starter", 7, 10).warn is False
    assert _evaluate("x", "starter", 8, 10).warn is True
    assert _evaluate("x", "starter", 8, 10).exceeded is False
    blocked = _evaluate("x", "starter", 10, 10)
    assert blocked.exceeded is True and blocked.remaining == 0


# ── DB-backed: live counters + enforcement ──────────────────────────────────

@pytest.mark.asyncio
async def test_new_org_is_on_starter(db_conn, org_id):
    assert await QuotaService.get_org_plan(db_conn, org_id) == "starter"


@pytest.mark.asyncio
async def test_seats_block_at_starter_limit(db_conn, org_id):
    # Starter allows 2 seats; registration created 1. Add a 2nd → at the cap.
    await db_conn.execute(
        "INSERT INTO users (org_id, email, password_hash, name, role) "
        "VALUES ($1, $2, 'x', 'Second', 'hr')",
        org_id, f"second_{org_id}@testorg.com",
    )
    status = await QuotaService.check_seats(db_conn, org_id)
    assert status.used >= 2 and status.exceeded is True
    with pytest.raises(QuotaExceededError):
        await QuotaService.enforce_seats(db_conn, org_id)


@pytest.mark.asyncio
async def test_active_positions_block_at_starter_limit(db_conn, org_id):
    # Starter allows 1 active position. positions.department_id is NOT NULL, so
    # seed a department first.
    dept_id = await db_conn.fetchval(
        "INSERT INTO departments (org_id, name) VALUES ($1, 'Eng') "
        "ON CONFLICT (org_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id",
        org_id,
    )
    await db_conn.execute(
        "INSERT INTO positions (org_id, department_id, role_name, status) "
        "VALUES ($1, $2, 'Engineer', 'open')",
        org_id, dept_id,
    )
    with pytest.raises(QuotaExceededError):
        await QuotaService.enforce_positions(db_conn, org_id)
    # A draft does NOT consume a slot, so it shouldn't change the verdict.
    assert (await QuotaService.check_positions(db_conn, org_id)).exceeded is True


@pytest.mark.asyncio
async def test_llm_budget_warn_then_block(db_conn, org_id):
    # Starter LLM budget = $5.00. Seed $4.00 → warn (80%), not blocked.
    await db_conn.execute(
        "INSERT INTO llm_usage_log (org_id, cost_usd) VALUES ($1, 4.0)", org_id
    )
    warned = await QuotaService.check_llm_budget(db_conn, org_id)
    assert warned.warn is True and warned.exceeded is False
    await QuotaService.enforce_llm_budget(db_conn, org_id)  # must not raise

    # Push over budget → blocked.
    await db_conn.execute(
        "INSERT INTO llm_usage_log (org_id, cost_usd) VALUES ($1, 2.0)", org_id
    )
    with pytest.raises(BudgetExceededError):
        await QuotaService.enforce_llm_budget(db_conn, org_id)


@pytest.mark.asyncio
async def test_per_org_budget_override_wins(db_conn, org_id):
    # An explicit override beats the plan default.
    await db_conn.execute(
        "UPDATE organizations SET llm_monthly_budget_usd = 100 WHERE id = $1", org_id
    )
    await db_conn.execute(
        "INSERT INTO llm_usage_log (org_id, cost_usd) VALUES ($1, 10.0)", org_id
    )
    status = await QuotaService.check_llm_budget(db_conn, org_id)
    assert status.limit == 100 and status.exceeded is False
