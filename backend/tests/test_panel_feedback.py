"""
test_panel_feedback.py – Integration tests for the panel feedback magic-link flow.

Surfaces covered:
  GET  /api/v1/panel/{token}         — verify token and load context
  POST /api/v1/panel/{token}/submit  — submit feedback (final or draft)

Tests:
  1. GET with valid token returns interview + candidate info
  2. POST submit stores scorecard; saved=True returned
  3. Second final submit on same token returns 400 (single-use)
  4. Invalid / malformed token returns 400 or 410
"""
import uuid
from datetime import datetime, timedelta, timezone

import asyncpg
import jwt
import pytest
import pytest_asyncio

from backend.config import settings
from backend.services.interview_service import generate_panel_token


# ── Fixture: seed full hierarchy + interview + panel member with valid JWT ──────

@pytest_asyncio.fixture
async def seeded(db_pool):
    sfx = uuid.uuid4().hex[:8]
    conn = await asyncpg.connect(settings.DATABASE_URL)
    try:
        org = await conn.fetchval(
            "INSERT INTO organizations (name,slug,segment,size) "
            "VALUES ($1,$2,'tech','small') RETURNING id",
            f"Panel Org {sfx}", f"panel-org-{sfx}",
        )
        dept = await conn.fetchval(
            "INSERT INTO departments (org_id,name) VALUES ($1,'Engineering') RETURNING id",
            org,
        )
        cand = await conn.fetchval(
            "INSERT INTO candidates (org_id,name,email) VALUES ($1,'Panel Candidate',$2) RETURNING id",
            org, f"panel-{sfx}@example.com",
        )
        pos = await conn.fetchval(
            "INSERT INTO positions (org_id,department_id,role_name,status) "
            "VALUES ($1,$2,'Backend Engineer','open') RETURNING id",
            org, dept,
        )
        app_id = await conn.fetchval(
            "INSERT INTO candidate_applications (candidate_id,position_id,org_id,department_id,status) "
            "VALUES ($1,$2,$3,$4,'applied') RETURNING id",
            cand, pos, org, dept,
        )
        interview_id = await conn.fetchval(
            "INSERT INTO interviews "
            "(org_id,department_id,position_id,candidate_id,application_id,"
            " round_number,round_name,round_type,status) "
            "VALUES ($1,$2,$3,$4,$5,1,'Technical Round','technical','scheduled') RETURNING id",
            org, dept, pos, cand, app_id,
        )

        # Generate a real signed JWT panel token
        # magic_link_expires_at is a plain TIMESTAMP column (no tz) — strip tz info
        expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=7)
        temp_token = str(uuid.uuid4())

        panel_id = await conn.fetchval(
            "INSERT INTO interview_panel "
            "(interview_id,panelist_name,panelist_email,magic_link_token,magic_link_expires_at) "
            "VALUES ($1,'Dr. Reviewer','reviewer@example.com',$2,$3) RETURNING id",
            interview_id, temp_token, expires_at,
        )

        # Generate the real signed JWT with the known panel_id
        real_token = generate_panel_token(panel_id, interview_id, org)
        await conn.execute(
            "UPDATE interview_panel SET magic_link_token=$1 WHERE id=$2",
            real_token, panel_id,
        )

        yield {
            "org": org, "dept": dept, "candidate": cand, "position": pos,
            "app_id": app_id, "interview_id": interview_id,
            "panel_id": panel_id, "token": real_token,
        }
    finally:
        for tbl, col in [
            ("scorecards", "org_id"),
            ("interview_panel", None),           # no org_id; delete via interview FK cascade
            ("pipeline_events", "org_id"),
            ("interviews", "org_id"),
            ("candidate_applications", "org_id"),
            ("candidates", "org_id"),
            ("positions", "org_id"),
            ("departments", "org_id"),
            ("organizations", "id"),
        ]:
            try:
                if tbl == "interview_panel":
                    await conn.execute(
                        "DELETE FROM interview_panel WHERE interview_id IN "
                        "(SELECT id FROM interviews WHERE org_id=$1)",
                        org,
                    )
                else:
                    key_col = col
                    await conn.execute(f"DELETE FROM {tbl} WHERE {key_col}=$1", org)
            except Exception:
                pass
        await conn.close()


# ── Tests ──────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_verify_panel_token_returns_context(seeded, client):
    """GET /api/v1/panel/{token} with a valid JWT returns interview + candidate context."""
    r = await client.get(f"/api/v1/panel/{seeded['token']}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["valid"] is True
    assert body["panel_member_id"] == seeded["panel_id"]
    assert body["interview_id"] == seeded["interview_id"]
    assert "candidate_name" in body
    assert "role_name" in body


@pytest.mark.asyncio
async def test_submit_feedback_stores_scorecard(seeded, client, db_pool):
    """POST /api/v1/panel/{token}/submit stores a scorecard and returns saved=True."""
    payload = {
        "is_draft": False,
        "attended": True,
        "ratings": [
            {"dimension": "technical_skills", "score": 4},
            {"dimension": "problem_solving", "score": 3},
            {"dimension": "communication", "score": 4},
            {"dimension": "culture_fit", "score": 5},
        ],
        "recommendation": "hire",
        "strengths": "Great problem solver.",
        "concerns": "Minor communication gaps.",
    }
    r = await client.post(f"/api/v1/panel/{seeded['token']}/submit", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["saved"] is True
    assert body["is_draft"] is False
    assert "scorecard_id" in body

    # Verify DB: scorecard created and panel member marked submitted
    async with db_pool.acquire() as conn:
        sc = await conn.fetchrow(
            "SELECT * FROM scorecards WHERE panel_member_id=$1",
            seeded["panel_id"],
        )
        pm = await conn.fetchrow(
            "SELECT feedback_submitted FROM interview_panel WHERE id=$1",
            seeded["panel_id"],
        )
    assert sc is not None
    assert sc["recommendation"] == "hire"
    assert pm["feedback_submitted"] is True


@pytest.mark.asyncio
async def test_second_final_submit_returns_400(seeded, client):
    """Second final submission on same token returns 400 (single-use guard)."""
    payload = {
        "is_draft": False,
        "attended": True,
        "ratings": [{"dimension": "technical_skills", "score": 3}],
        "recommendation": "hold",
    }
    r1 = await client.post(f"/api/v1/panel/{seeded['token']}/submit", json=payload)
    assert r1.status_code == 200, r1.text

    # Second submit — feedback_submitted is now True
    r2 = await client.post(f"/api/v1/panel/{seeded['token']}/submit", json=payload)
    assert r2.status_code == 400
    detail = r2.json().get("detail", {})
    assert "already submitted" in str(detail).lower() or \
           detail.get("code") == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_invalid_token_get_returns_4xx(client):
    """GET with a totally invalid token string returns 400 (not 500)."""
    r = await client.get("/api/v1/panel/this-is-not-a-jwt-at-all")
    assert r.status_code in (400, 410), r.text


@pytest.mark.asyncio
async def test_expired_token_returns_410(client):
    """GET with a token whose exp is in the past returns 410."""
    payload = {
        "type": "panel_feedback",
        "panel_member_id": 9999,
        "interview_id": 9999,
        "org_id": 9999,
        "exp": datetime.now(timezone.utc) - timedelta(days=1),
        "iat": datetime.now(timezone.utc) - timedelta(days=8),
        "jti": str(uuid.uuid4()),
    }
    expired_token = jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")
    r = await client.get(f"/api/v1/panel/{expired_token}")
    assert r.status_code == 410, r.text


@pytest.mark.asyncio
async def test_draft_submit_does_not_mark_submitted(seeded, client, db_pool):
    """Draft submission saves scorecard but does NOT mark feedback_submitted=True."""
    payload = {
        "is_draft": True,
        "attended": True,
        "ratings": [{"dimension": "technical_skills", "score": 3}],
    }
    r = await client.post(f"/api/v1/panel/{seeded['token']}/submit", json=payload)
    assert r.status_code == 200, r.text
    assert r.json()["is_draft"] is True

    async with db_pool.acquire() as conn:
        pm = await conn.fetchrow(
            "SELECT feedback_submitted FROM interview_panel WHERE id=$1",
            seeded["panel_id"],
        )
    # Draft should NOT flip the submitted flag
    assert pm["feedback_submitted"] is False
