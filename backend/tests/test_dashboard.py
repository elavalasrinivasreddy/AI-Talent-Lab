"""Dashboard endpoint tests.

Auth enforcement and the aggregation contracts a fresh org sees as zeros:
stats cards (+ period switching), the hiring funnel stage map, the positions
summary, and the activity feed. Mirrors test_candidates.py's register→token
pattern.
"""
import pytest

REGISTER_PAYLOAD = {
    "org_name": "Test Org Dashboard",
    "name": "Admin User",
    "email": "admin_dashboard@testorg.com",
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
    token = res.json()["token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_stats_requires_auth(client):
    res = await client.get("/api/v1/dashboard/stats")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_stats_zeroed_for_new_org(client, auth_headers):
    res = await client.get("/api/v1/dashboard/stats", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["active_positions"] == 0
    assert data["total_candidates"] == 0
    assert data["period"] == "week"
    assert "trends" in data


@pytest.mark.asyncio
async def test_stats_respects_period(client, auth_headers):
    res = await client.get("/api/v1/dashboard/stats?period=month", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["period"] == "month"


@pytest.mark.asyncio
async def test_funnel_returns_all_stages_at_zero(client, auth_headers):
    res = await client.get("/api/v1/dashboard/funnel", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    for stage in ("sourced", "emailed", "applied", "screening", "interview", "selected", "rejected"):
        assert data[stage] == 0


@pytest.mark.asyncio
async def test_positions_summary_empty(client, auth_headers):
    res = await client.get("/api/v1/dashboard/positions", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["positions"] == []


@pytest.mark.asyncio
async def test_activity_feed_shape(client, auth_headers):
    res = await client.get("/api/v1/dashboard/activity", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data["events"], list)
    assert data["page"] == 1
    assert data["limit"] == 30
