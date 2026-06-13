"""Talent pool endpoint tests.

Auth enforcement and the paginated list contract (candidates/total/page/
per_page/pages) for a fresh org with an empty pool, including search + page
query handling. Mirrors the register→token pattern in test_candidates.py.
"""
import pytest

REGISTER_PAYLOAD = {
    "org_name": "Test Org Talent Pool",
    "name": "Admin User",
    "email": "admin_talentpool@testorg.com",
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
async def test_talent_pool_requires_auth(client):
    res = await client.get("/api/v1/talent-pool/")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_talent_pool_empty_for_new_org(client, auth_headers):
    res = await client.get("/api/v1/talent-pool/", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["candidates"] == []
    assert data["total"] == 0
    assert data["page"] == 1
    assert data["pages"] == 0
    assert "per_page" in data


@pytest.mark.asyncio
async def test_talent_pool_search_and_pagination(client, auth_headers):
    res = await client.get("/api/v1/talent-pool/?q=engineer&page=2", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["page"] == 2
    assert isinstance(data["candidates"], list)
