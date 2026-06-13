"""Interview endpoint tests.

Auth enforcement, the list endpoint shape + filter handling for a fresh org
(no interviews yet), and request validation on create. Mirrors the
register→token pattern in test_candidates.py.
"""
import pytest

REGISTER_PAYLOAD = {
    "org_name": "Test Org Interviews",
    "name": "Admin User",
    "email": "admin_interviews@testorg.com",
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
async def test_list_interviews_requires_auth(client):
    res = await client.get("/api/v1/interviews/")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_list_interviews_empty_for_new_org(client, auth_headers):
    res = await client.get("/api/v1/interviews/", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data["interviews"], list)
    assert data["interviews"] == []


@pytest.mark.asyncio
@pytest.mark.parametrize("flt", ["upcoming", "today", "past", "all"])
async def test_list_interviews_filters(client, auth_headers, flt):
    res = await client.get(f"/api/v1/interviews/?filter={flt}", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json()["interviews"], list)


@pytest.mark.asyncio
async def test_create_interview_rejects_empty_body(client, auth_headers):
    res = await client.post("/api/v1/interviews/", json={}, headers=auth_headers)
    assert res.status_code == 422
