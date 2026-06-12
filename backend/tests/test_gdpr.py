"""
test_gdpr.py – Integration tests for the GDPR deletion flow.

Surfaces covered:
  POST /api/v1/gdpr/delete-my-data          — public deletion request
  POST /api/v1/gdpr/verify-deletion/{token} — verify deletion via token
  POST /api/v1/gdpr/process-deletion/{id}   — admin: execute anonymization
       GDPRService.process_deletion()        — direct service call

Tests:
  1. delete-my-data creates a deletion request for a known email
  2. delete-my-data returns neutral message even for unknown email
  3. verify-deletion with valid token marks request verified
  4. verify-deletion with bad token returns 400
  5. process-deletion anonymizes candidate data in DB
  6. process-deletion scoped to org — wrong org returns error (not found)
  7. process-deletion on wrong-status request returns error
"""
import json
import uuid
from unittest.mock import patch, AsyncMock

import asyncpg
import pytest
import pytest_asyncio

from backend.config import settings
from backend.services.gdpr_service import GDPRService
from backend.utils.security import create_access_token


# ── Fixture: seed org → candidate ─────────────────────────────────────────────

@pytest_asyncio.fixture
async def seeded(db_pool):
    sfx = uuid.uuid4().hex[:8]
    email = f"gdpr-{sfx}@example.com"
    conn = await asyncpg.connect(settings.DATABASE_URL)
    try:
        org = await conn.fetchval(
            "INSERT INTO organizations (name,slug,segment,size) "
            "VALUES ($1,$2,'tech','small') RETURNING id",
            f"GDPR Org {sfx}", f"gdpr-org-{sfx}",
        )
        dept = await conn.fetchval(
            "INSERT INTO departments (org_id,name) VALUES ($1,'HR') RETURNING id",
            org,
        )
        cand = await conn.fetchval(
            "INSERT INTO candidates (org_id,name,email) VALUES ($1,'GDPR Subject',$2) RETURNING id",
            org, email,
        )
        # Seed a user so we can create an org_head JWT
        pw_hash = "$2b$12$fakehashfortest000000000000000000000000000000000000000"
        user_id = await conn.fetchval(
            "INSERT INTO users (org_id,department_id,email,password_hash,role,name) "
            "VALUES ($1,$2,$3,$4,'org_head','Admin User') RETURNING id",
            org, dept, f"admin-{sfx}@example.com", pw_hash,
        )
        yield {
            "org": org, "dept": dept, "candidate": cand,
            "email": email, "user_id": user_id,
        }
    finally:
        for tbl, col in [
            ("data_deletion_requests", "org_id"),
            ("consent_records", "org_id"),
            ("candidates", "org_id"),
            ("users", "org_id"),
            ("departments", "org_id"),
            ("organizations", "id"),
        ]:
            try:
                await conn.execute(f"DELETE FROM {tbl} WHERE {col}=$1", org)
            except Exception:
                pass
        await conn.close()


def _org_head_token(user_id: int, org_id: int) -> str:
    return create_access_token(user_id=user_id, org_id=org_id, role="org_head")


# ── Tests ──────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_request_creates_pending_request(seeded, client):
    """POST /delete-my-data for a known email creates a pending deletion request
    and returns a verification token (dev mode behaviour)."""
    r = await client.post(
        "/api/v1/gdpr/delete-my-data",
        json={"email": seeded["email"]},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "message" in body
    # Dev mode returns verification_token; prod just emails it
    assert body.get("verification_token") is not None, \
        "Expected verification_token in response (dev mode)"


@pytest.mark.asyncio
async def test_delete_request_unknown_email_returns_neutral(client):
    """POST /delete-my-data for an email not in the DB returns a neutral message
    (privacy — do not reveal whether email exists)."""
    r = await client.post(
        "/api/v1/gdpr/delete-my-data",
        json={"email": "nobody-xyz@nowhere-example.com"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "message" in body
    # No verification_token for unknown email
    assert body.get("verification_token") is None


@pytest.mark.asyncio
async def test_verify_deletion_marks_request_verified(seeded, client, db_pool):
    """POST /verify-deletion/{token} with the correct token marks the request verified."""
    # Step 1: create the deletion request
    r = await client.post(
        "/api/v1/gdpr/delete-my-data",
        json={"email": seeded["email"]},
    )
    assert r.status_code == 200
    verification_token = r.json()["verification_token"]

    # Step 2: verify it
    r2 = await client.post(f"/api/v1/gdpr/verify-deletion/{verification_token}")
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body.get("verified") is True

    # Check DB status
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT status FROM data_deletion_requests WHERE request_token=$1",
            verification_token,
        )
    assert row["status"] == "verified"


@pytest.mark.asyncio
async def test_verify_deletion_bad_token_returns_400(client):
    """POST /verify-deletion/{token} with a bogus token returns 400."""
    r = await client.post("/api/v1/gdpr/verify-deletion/not-a-real-token-xyz")
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_process_deletion_anonymizes_candidate(seeded, db_pool):
    """GDPRService.process_deletion() anonymizes the candidate's PII in DB."""
    conn = await asyncpg.connect(settings.DATABASE_URL)
    try:
        # Create a deletion request in 'verified' status directly
        token = str(uuid.uuid4())
        req_id = await conn.fetchval(
            "INSERT INTO data_deletion_requests "
            "(org_id,candidate_id,request_email,request_token,status) "
            "VALUES ($1,$2,$3,$4,'verified') RETURNING id",
            seeded["org"], seeded["candidate"], seeded["email"], token,
        )
    finally:
        await conn.close()

    # Call service directly (no Celery needed)
    result = await GDPRService.process_deletion(req_id, seeded["org"])
    assert result.get("completed") is True
    assert "deleted_summary" in result

    # Verify candidate PII is anonymized
    async with db_pool.acquire() as conn:
        cand = await conn.fetchrow(
            "SELECT name, email, data_anonymized_at FROM candidates WHERE id=$1",
            seeded["candidate"],
        )
    assert cand["email"] is None, "Email should be nulled after anonymization"
    assert "Anonymized" in cand["name"]
    assert cand["data_anonymized_at"] is not None


@pytest.mark.asyncio
async def test_process_deletion_wrong_org_returns_error(seeded, db_pool):
    """process_deletion with a different org_id cannot process another org's request.
    The service scopes the lookup by org_id — wrong org gets 'not found' error."""
    conn = await asyncpg.connect(settings.DATABASE_URL)
    try:
        token = str(uuid.uuid4())
        req_id = await conn.fetchval(
            "INSERT INTO data_deletion_requests "
            "(org_id,candidate_id,request_email,request_token,status) "
            "VALUES ($1,$2,$3,$4,'verified') RETURNING id",
            seeded["org"], seeded["candidate"], seeded["email"], token,
        )
    finally:
        await conn.close()

    # Use a different org_id (org + 9999) — should not find the request
    wrong_org = seeded["org"] + 9999
    result = await GDPRService.process_deletion(req_id, wrong_org)
    assert result.get("error") is not None, \
        "Expected an error when processing with wrong org_id"
    assert "not found" in result["error"].lower()


@pytest.mark.asyncio
async def test_process_deletion_pending_status_returns_error(seeded, db_pool):
    """process_deletion on a request in 'pending' (not verified) status returns an error."""
    conn = await asyncpg.connect(settings.DATABASE_URL)
    try:
        token = str(uuid.uuid4())
        req_id = await conn.fetchval(
            "INSERT INTO data_deletion_requests "
            "(org_id,candidate_id,request_email,request_token,status) "
            "VALUES ($1,$2,$3,$4,'pending') RETURNING id",
            seeded["org"], seeded["candidate"], seeded["email"], token,
        )
    finally:
        await conn.close()

    result = await GDPRService.process_deletion(req_id, seeded["org"])
    assert result.get("error") is not None, \
        "Expected error when processing a pending (unverified) request"
    # Error message should mention the status
    assert "pending" in result["error"].lower()


@pytest.mark.asyncio
async def test_process_deletion_via_api_requires_org_head(seeded, client):
    """POST /process-deletion/{id} without auth returns 401/403."""
    r = await client.post(f"/api/v1/gdpr/process-deletion/1")
    assert r.status_code in (401, 403, 422)


@pytest.mark.asyncio
async def test_process_deletion_via_api_org_scoped(seeded, client, db_pool):
    """POST /process-deletion/{id} with org_head JWT processes the deletion."""
    conn = await asyncpg.connect(settings.DATABASE_URL)
    try:
        token = str(uuid.uuid4())
        req_id = await conn.fetchval(
            "INSERT INTO data_deletion_requests "
            "(org_id,candidate_id,request_email,request_token,status) "
            "VALUES ($1,$2,$3,$4,'verified') RETURNING id",
            seeded["org"], seeded["candidate"], seeded["email"], token,
        )
    finally:
        await conn.close()

    jwt_token = _org_head_token(seeded["user_id"], seeded["org"])
    r = await client.post(
        f"/api/v1/gdpr/process-deletion/{req_id}",
        headers={"Authorization": f"Bearer {jwt_token}"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("completed") is True
