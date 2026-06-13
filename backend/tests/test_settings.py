"""Settings endpoint tests.

Auth enforcement, the org-profile read, the departments + message-templates
list contracts, and one round-trip write (create a department, then see it in
the list — exercising the require_org_head path, since registration makes the
first user an org_head). Mirrors test_candidates.py's register→token pattern.
"""
import pytest

REGISTER_PAYLOAD = {
    "org_name": "Test Org Settings",
    "name": "Admin User",
    "email": "admin_settings@testorg.com",
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
async def test_get_org_requires_auth(client):
    res = await client.get("/api/v1/settings/org")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_get_org_returns_profile(client, auth_headers):
    res = await client.get("/api/v1/settings/org", headers=auth_headers)
    assert res.status_code == 200
    org = res.json()["org"]
    assert org["id"]
    assert org["name"] == REGISTER_PAYLOAD["org_name"]


@pytest.mark.asyncio
async def test_list_departments_returns_list(client, auth_headers):
    res = await client.get("/api/v1/settings/departments", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json()["departments"], list)


@pytest.mark.asyncio
async def test_list_message_templates_returns_list(client, auth_headers):
    res = await client.get("/api/v1/settings/message-templates", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json()["templates"], list)


@pytest.mark.asyncio
async def test_create_department_then_appears_in_list(client, auth_headers):
    created = await client.post(
        "/api/v1/settings/departments",
        json={"name": "Engineering"},
        headers=auth_headers,
    )
    assert created.status_code == 200
    dept = created.json()["department"]
    assert dept["name"] == "Engineering"

    listed = await client.get("/api/v1/settings/departments", headers=auth_headers)
    names = [d["name"] for d in listed.json()["departments"]]
    assert "Engineering" in names
