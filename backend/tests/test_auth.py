import pytest
from httpx import AsyncClient

# Test data
REGISTER_PAYLOAD = {
    "org_name": "Acme Corp",
    "name": "Jane Doe",
    "email": "jane.doe@acmecorp.com",
    "password": "SecurePassword123!",
    "segment": "technology",
    "size": "startup"
}

LOGIN_PAYLOAD = {
    "email": "jane.doe@acmecorp.com",
    "password": "SecurePassword123!"
}

@pytest.mark.asyncio
async def test_register_creates_org_and_user(client, db_conn):
    """Test that registration creates an org and user, and returns a valid JWT."""
    # Since client is synchronous from TestClient, we use it directly
    response = await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
    
    assert response.status_code == 200, response.text
    data = response.json()
    
    # Assert token exists
    assert "token" in data
    
    # Assert user data
    assert data["user"]["email"] == REGISTER_PAYLOAD["email"]
    assert data["user"]["name"] == REGISTER_PAYLOAD["name"]
    assert data["user"]["role"] == "org_head"
    
    # Assert org data
    assert data["org"]["name"] == REGISTER_PAYLOAD["org_name"]
    assert data["org"]["segment"] == REGISTER_PAYLOAD["segment"]
    
    # Verify in real database via db_conn fixture
    user_row = await db_conn.fetchrow("SELECT * FROM users WHERE email = $1", REGISTER_PAYLOAD["email"])
    assert user_row is not None
    assert user_row["org_id"] == data["org"]["id"]

@pytest.mark.asyncio
async def test_login_returns_token(client):
    """Test that a registered user can log in with correct credentials."""
    # First ensure user exists (tests might run in random order, but usually isolated db or dependencies)
    # Actually, we should create it first or rely on the previous test. Let's make it robust by registering first.
    await client.post("/api/v1/auth/register", json={
        "org_name": "Test Org 2",
        "name": "Login Test User",
        "email": "login.test@acmecorp.com",
        "password": "SecurePassword123!",
        "segment": "technology",
        "size": "startup"
    })
    
    # Attempt login
    response = await client.post("/api/v1/auth/login", json={
        "email": "login.test@acmecorp.com",
        "password": "SecurePassword123!"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert data["user"]["email"] == "login.test@acmecorp.com"

@pytest.mark.asyncio
async def test_login_fails_with_wrong_password(client):
    """Test that login fails with incorrect password."""
    response = await client.post("/api/v1/auth/login", json={
        "email": "jane.doe@acmecorp.com", # registered in first test
        "password": "WrongPassword!"
    })
    
    assert response.status_code == 401
    assert "Invalid email or password" in response.text
