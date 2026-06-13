"""Position endpoint tests.

Covers the read paths a fresh org hits first: auth enforcement, the list
endpoint shape/filtering, the pending-approval counter, and 404 on a missing
position. Mirrors the register→token pattern in test_candidates.py.
"""
import pytest

REGISTER_PAYLOAD = {
    "org_name": "Test Org Positions",
    "name": "Admin User",
    "email": "admin_positions@testorg.com",
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
async def test_list_positions_requires_auth(client):
    res = await client.get("/api/v1/positions/")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_list_positions_empty_for_new_org(client, auth_headers):
    res = await client.get("/api/v1/positions/", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["page"] == 1
    assert isinstance(data["positions"], list)
    assert data["positions"] == []


@pytest.mark.asyncio
async def test_list_positions_accepts_status_filter(client, auth_headers):
    res = await client.get("/api/v1/positions/?status=open&page=1", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json()["positions"], list)


@pytest.mark.asyncio
async def test_pending_count_zero_for_new_org(client, auth_headers):
    res = await client.get("/api/v1/positions/pending-count", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["count"] == 0


@pytest.mark.asyncio
async def test_get_missing_position_returns_404(client, auth_headers):
    res = await client.get("/api/v1/positions/999999", headers=auth_headers)
    assert res.status_code == 404
    assert res.json()["detail"]["error"]["code"] == "POSITION_NOT_FOUND"
