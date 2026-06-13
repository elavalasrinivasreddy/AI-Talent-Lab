import pytest

REGISTER_PAYLOAD = {
    "org_name": "Test Org Candidates",
    "name": "Admin User",
    "email": "admin_candidates@testorg.com",
    "password": "SecurePassword123!",
    "segment": "technology",
    "size": "startup"
}

@pytest.fixture
async def auth_token(client):
    response = await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
    if response.status_code != 200:
        response = await client.post("/api/v1/auth/login", json={
            "email": REGISTER_PAYLOAD["email"],
            "password": REGISTER_PAYLOAD["password"]
        })
    data = response.json()
    return data["token"], data["user"]

@pytest.mark.asyncio
async def test_candidate_magic_link_flow(client):
    """Test candidate magic link without requiring auth token."""
    # First candidate requests magic link
    email = "candidate@example.com"
    response = await client.post("/api/v1/auth/magic-link", json={"email": email})
    assert response.status_code == 200
    
    # In a real environment, we'd extract the token from the email.
    # Here, we test the endpoint's response format
    data = response.json()
    assert "Check your inbox" in data["message"]

@pytest.mark.asyncio
async def test_get_candidates_requires_auth(client):
    """Test getting candidates requires authentication."""
    response = await client.get("/api/v1/candidates/position/999")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_get_candidates(client, auth_token):
    """Test getting candidates returns a list."""
    token, user = auth_token
    headers = {"Authorization": f"Bearer {token}"}
    
    response = await client.get("/api/v1/candidates/position/999", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "candidates" in data
    assert isinstance(data["candidates"], list)
