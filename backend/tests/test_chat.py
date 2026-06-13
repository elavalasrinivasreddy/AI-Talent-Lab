import pytest

REGISTER_PAYLOAD = {
    "org_name": "Test Org Chat",
    "name": "Chat User",
    "email": "chatuser@testorg.com",
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
async def test_chat_history_requires_auth(client):
    """Test accessing chat history requires authentication."""
    response = await client.get("/api/v1/chat/sessions")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_chat_history_empty_initially(client, auth_token):
    token, user = auth_token
    headers = {"Authorization": f"Bearer {token}"}
    
    response = await client.get("/api/v1/chat/sessions", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "sessions" in data
    assert isinstance(data["sessions"], list)

@pytest.mark.asyncio
async def test_send_chat_message_validation(client, auth_token):
    """Test validation errors for empty messages in chat."""
    token, user = auth_token
    headers = {"Authorization": f"Bearer {token}"}
    
    # Send empty message
    response = await client.post("/api/v1/chat/stream", json={"message": "", "thread_id": "123"}, headers=headers)
    assert response.status_code == 422 # Unprocessable Entity
