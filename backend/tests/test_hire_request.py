import pytest

# Test data
REGISTER_PAYLOAD = {
    "org_name": "Test Org",
    "name": "Admin User",
    "email": "admin@testorg.com",
    "password": "SecurePassword123!",
    "segment": "technology",
    "size": "startup"
}

@pytest.fixture
async def auth_token(client):
    """Fixture to register and return a valid auth token and user."""
    # Register org_head
    response = await client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
    if response.status_code != 200:
        # If already registered, login
        response = await client.post("/api/v1/auth/login", json={
            "email": REGISTER_PAYLOAD["email"],
            "password": REGISTER_PAYLOAD["password"]
        })
    data = response.json()
    return data["token"], data["user"]

@pytest.mark.asyncio
async def test_create_hire_request(client, auth_token):
    """Test creating a hire request requires authentication and correct permissions."""
    token, user = auth_token
    headers = {"Authorization": f"Bearer {token}"}
    
    # payload to create hire request
    payload = {
        "role_name": "Senior Software Engineer",
        "department_id": None, # Will need to create department or pass None if allowed
        "location": "Remote",
        "employment_type": "full-time",
        "priority": "high",
        "description": "We need a great engineer."
    }
    
    # Currently we might not have a department, let's create one first
    dept_res = await client.post("/api/v1/settings/departments", json={
        "name": "Engineering"
    }, headers=headers)
    
    # If the endpoint doesn't exist or fails, we try without dept. Assuming it succeeds:
    dept_id = dept_res.json().get("department", {}).get("id")
    if dept_id:
        payload["department_id"] = dept_id

    response = await client.post("/api/v1/hire-requests/", json=payload, headers=headers)
    
    assert response.status_code in [200, 201], response.text
    data = response.json()
    assert "request" in data
    hr = data["request"]
    assert hr["role_name"] == payload["role_name"]
    assert hr["status"] == "pending"

@pytest.mark.asyncio
async def test_get_hire_requests(client, auth_token):
    token, user = auth_token
    headers = {"Authorization": f"Bearer {token}"}
    
    
    # Create a request first so the list is not empty
    payload = {
        "role_name": "Senior Software Engineer",
        "location": "Remote",
        "employment_type": "full-time",
        "priority": "high",
        "description": "We need a great engineer."
    }
    await client.post("/api/v1/hire-requests/", json=payload, headers=headers)

    response = await client.get("/api/v1/hire-requests/?scope=all", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "requests" in data
    assert len(data["requests"]) >= 1

@pytest.mark.asyncio
async def test_unauthorized_hire_request_creation(client):
    payload = {
        "role_name": "Senior Software Engineer",
        "location": "Remote",
        "employment_type": "full-time",
        "priority": "high",
        "description": "We need a great engineer."
    }
    # No auth header
    response = await client.post("/api/v1/hire-requests/", json=payload)
    assert response.status_code == 401
