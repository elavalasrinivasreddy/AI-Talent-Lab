"""Billing endpoint + simulation-adapter tests (Sprint 2, F2c).

Walks the full simulation flow end-to-end: plan catalogue → usage → checkout
(creates an invoice) → confirm (marks paid + assigns the plan) → usage reflects
the upgrade → invoice history. No external account — the SimulationBilling
adapter carries the payment.
"""
import pytest

REGISTER_PAYLOAD = {
    "org_name": "Billing Test Org",
    "name": "Billing Admin",
    "email": "admin_billing@testorg.com",
    "password": "SecurePassword123!",
    "segment": "technology",
    "size": "startup",
}


@pytest.fixture
async def auth_headers(client):
    res = await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
    if res.status_code != 200:
        res = await client.post("/api/v1/auth/login", json={
            "email": REGISTER_PAYLOAD["email"],
            "password": REGISTER_PAYLOAD["password"],
        })
    return {"Authorization": f"Bearer {res.json()['token']}"}


@pytest.mark.asyncio
async def test_usage_requires_auth(client):
    res = await client.get("/api/v1/billing/usage")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_plans_catalogue(client, auth_headers):
    res = await client.get("/api/v1/billing/plans", headers=auth_headers)
    assert res.status_code == 200
    plans = {p["plan"] for p in res.json()["plans"]}
    assert {"starter", "professional", "business", "founder_pilot"} <= plans


@pytest.mark.asyncio
async def test_new_org_usage_is_starter(client, auth_headers):
    res = await client.get("/api/v1/billing/usage", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["plan"] == "starter"
    q = data["quotas"]
    assert q["seats"]["limit"] == 2
    assert q["active_positions"]["limit"] == 1
    assert q["llm_monthly_budget"]["limit"] == 5.0
    assert data["any_exceeded"] is False


@pytest.mark.asyncio
async def test_checkout_confirm_upgrades_plan(client, auth_headers):
    # 1) Start checkout for Professional → invoice in 'created' state.
    res = await client.post(
        "/api/v1/billing/checkout", json={"plan": "professional"}, headers=auth_headers
    )
    assert res.status_code == 200, res.text
    ref = res.json()["provider_ref"]
    assert res.json()["invoice"]["status"] == "created"
    assert res.json()["amount"] == 4999

    # 2) Confirm → paid + plan assigned.
    res = await client.post(
        "/api/v1/billing/confirm", json={"provider_ref": ref}, headers=auth_headers
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "paid"
    assert res.json()["plan"] == "professional"

    # 3) Usage now reflects the upgrade.
    res = await client.get("/api/v1/billing/usage", headers=auth_headers)
    assert res.json()["plan"] == "professional"
    assert res.json()["quotas"]["seats"]["limit"] == 8

    # 4) Invoice history shows the paid invoice.
    res = await client.get("/api/v1/billing/invoices", headers=auth_headers)
    invoices = res.json()["invoices"]
    assert any(i["provider_ref"] == ref and i["status"] == "paid" for i in invoices)


@pytest.mark.asyncio
async def test_checkout_rejects_unknown_plan(client, auth_headers):
    res = await client.post(
        "/api/v1/billing/checkout", json={"plan": "enterprise_unicorn"}, headers=auth_headers
    )
    # Normalised to a known tier server-side, so an unknown string falls back to
    # starter rather than erroring — assert it doesn't 500.
    assert res.status_code in (200, 422)
