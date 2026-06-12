"""
test_pre_eval.py – Integration tests for the pre-evaluation submit/grade flow.

Surfaces covered:
  GET  /api/v1/pre-evaluations/{token}   — fetch by token
  POST /api/v1/pre-evaluations/submit    — submit answers

Tests:
  1. Fetch by valid token returns questions + candidate info
  2. Submit answers sets status to 'submitted'
  3. Double-submit returns 400
  4. Invalid token returns 404
  5. Fetch after submit returns 400 (already-submitted guard on GET)
"""
import json
import uuid

import asyncpg
import pytest
import pytest_asyncio

from backend.config import settings


# ── Shared fixture: seed org → dept → candidate → position → application → pre_eval ──

@pytest_asyncio.fixture
async def seeded(db_pool):
    sfx = uuid.uuid4().hex[:8]
    conn = await asyncpg.connect(settings.DATABASE_URL)
    token = f"preeval-{sfx}"
    org = dept = cand = pos = app_id = eval_id = None
    try:
        org = await conn.fetchval(
            "INSERT INTO organizations (name,slug,segment,size) "
            "VALUES ($1,$2,'tech','small') RETURNING id",
            f"PreEval Org {sfx}", f"preeval-org-{sfx}",
        )
        dept = await conn.fetchval(
            "INSERT INTO departments (org_id,name) VALUES ($1,'Engineering') RETURNING id",
            org,
        )
        cand = await conn.fetchval(
            "INSERT INTO candidates (org_id,name,email) VALUES ($1,'Test Candidate',$2) RETURNING id",
            org, f"cand-{sfx}@example.com",
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
        questions = [{"question_id": "q1", "question": "Describe a hard bug you fixed."}]
        eval_id = await conn.fetchval(
            "INSERT INTO pre_evaluations "
            "(org_id,application_id,candidate_id,position_id,status,token,questions) "
            "VALUES ($1,$2,$3,$4,'pending',$5,$6) RETURNING id",
            org, app_id, cand, pos, token, json.dumps(questions),
        )
        yield {
            "org": org, "dept": dept, "candidate": cand, "position": pos,
            "app_id": app_id, "eval_id": eval_id, "token": token,
            "questions": questions,
        }
    finally:
        # Delete in FK order
        for tbl, col in [
            ("pre_evaluations", "org_id"),
            ("pipeline_events", "org_id"),
            ("candidate_applications", "org_id"),
            ("candidates", "org_id"),
            ("positions", "org_id"),
            ("departments", "org_id"),
            ("organizations", "id"),
        ]:
            try:
                key = org if col == "org_id" or tbl == "organizations" else org
                await conn.execute(f"DELETE FROM {tbl} WHERE {col}=$1", key)
            except Exception:
                pass
        await conn.close()


# ── Tests ──────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_evaluation_by_valid_token(seeded, client):
    """GET /api/v1/pre-evaluations/{token} returns questions for a pending eval."""
    r = await client.get(f"/api/v1/pre-evaluations/{seeded['token']}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "success"
    assert "evaluation" in body
    questions = body["evaluation"]["questions"]
    assert len(questions) == 1
    assert questions[0]["question_id"] == "q1"


@pytest.mark.asyncio
async def test_submit_answers_sets_status_submitted(seeded, client, db_pool):
    """POST /submit stores answers and sets DB status to 'submitted'."""
    r = await client.post(
        "/api/v1/pre-evaluations/submit",
        json={
            "token": seeded["token"],
            "answers": [{"question_id": "q1", "answer": "I used bisect debugging."}],
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "success"

    # Verify DB state
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT status, answers FROM pre_evaluations WHERE id=$1",
            seeded["eval_id"],
        )
    assert row["status"] == "submitted"
    stored = json.loads(row["answers"]) if isinstance(row["answers"], str) else row["answers"]
    assert stored[0]["question_id"] == "q1"


@pytest.mark.asyncio
async def test_double_submit_returns_400(seeded, client):
    """Second POST /submit on an already-submitted eval returns 400."""
    payload = {
        "token": seeded["token"],
        "answers": [{"question_id": "q1", "answer": "First answer."}],
    }
    r1 = await client.post("/api/v1/pre-evaluations/submit", json=payload)
    assert r1.status_code == 200, r1.text

    payload["answers"][0]["answer"] = "Second answer attempt."
    r2 = await client.post("/api/v1/pre-evaluations/submit", json=payload)
    assert r2.status_code == 400
    detail = r2.json().get("detail", {})
    code = detail.get("error", {}).get("code") if isinstance(detail, dict) else ""
    assert code == "ALREADY_SUBMITTED"


@pytest.mark.asyncio
async def test_get_invalid_token_returns_404(client):
    """GET with a non-existent token returns 404."""
    r = await client.get("/api/v1/pre-evaluations/totally-bogus-token-xyz")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_get_after_submit_returns_400(seeded, client):
    """GET on an already-submitted eval returns 400 (already_submitted guard)."""
    # Submit first
    r = await client.post(
        "/api/v1/pre-evaluations/submit",
        json={
            "token": seeded["token"],
            "answers": [{"question_id": "q1", "answer": "My answer."}],
        },
    )
    assert r.status_code == 200

    # Now GET should be blocked — status is no longer 'pending'
    r = await client.get(f"/api/v1/pre-evaluations/{seeded['token']}")
    assert r.status_code == 400
    detail = r.json().get("detail", {})
    code = detail.get("error", {}).get("code") if isinstance(detail, dict) else ""
    assert code == "ALREADY_SUBMITTED"


@pytest.mark.asyncio
async def test_submit_invalid_token_returns_404(client):
    """POST /submit with a bogus token returns 404."""
    r = await client.post(
        "/api/v1/pre-evaluations/submit",
        json={"token": "does-not-exist-999", "answers": []},
    )
    assert r.status_code == 404
