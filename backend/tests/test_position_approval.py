"""
Unit tests for the team_lead JD approval gate.

All DB and Celery calls are monkeypatched — no real DB or broker needed.

Covers:
  1. finish_and_save_position → auto-submits for approval, does NOT fire sourcing.
  2. record_approval_decision('approved') → fires Celery sourcing.
  3. record_approval_decision('changes_requested') → does NOT fire sourcing.
"""
import asyncio
import json
import pytest

from backend.services import chat_service as _chat_service_module
from backend.services import position_service as _pos_service_module
from backend.services.chat_service import ChatService
from backend.services.position_service import PositionService
from backend.services.email_service import EmailService


# ── Async helper ──────────────────────────────────────────────────────────────

async def _async_return(value):
    return value


async def _async_none(*args, **kwargs):
    return None


# ── Fake asyncpg connection ───────────────────────────────────────────────────

class _FakeConn:
    """Minimal asyncpg Connection stand-in. Records execute / fetchrow calls."""

    def __init__(self, *, fetchrow_map=None):
        # fetchrow_map: dict[str_fragment -> dict] to return for specific queries
        self._fetchrow_map = fetchrow_map or {}
        self.executed = []

    async def execute(self, query, *args):
        self.executed.append((query.strip()[:60], args))

    async def fetchrow(self, query, *args):
        for fragment, result in self._fetchrow_map.items():
            if fragment.lower() in query.lower():
                return result
        return None

    async def fetch(self, query, *args):
        return []


class _FakeConnCtx:
    """Context manager that yields a _FakeConn."""

    def __init__(self, conn):
        self._conn = conn

    async def __aenter__(self):
        return self._conn

    async def __aexit__(self, *args):
        pass


# ── Fake position dict ────────────────────────────────────────────────────────

def _make_position(position_id: int = 7):
    return {
        "id": position_id,
        "org_id": 1,
        "department_id": 3,
        "role_name": "Senior Engineer",
        "status": "draft",
        "approval_status": "pending",
        "created_by": 10,
    }


def _make_session_row(position_id=None):
    return {
        "session_id": "sess-abc",
        "org_id": 1,
        "user_id": 10,
        "department_id": 3,
        "graph_state_parsed": {
            "role_name": "Senior Engineer",
            "final_jd": "## Job Description\n...",
            "jd_variants": [],
            "selected_variant": "standard",
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
# Test 1 — finish_and_save_position: submits for approval, NO immediate sourcing
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_finish_and_save_does_not_fire_sourcing(monkeypatch):
    """
    ChatService.finish_and_save_position must:
      - Create the position with status='draft'.
      - Call PositionService.submit_for_approval once.
      - NOT call run_candidate_search.delay at all.
    """
    submit_calls = []
    celery_delay_calls = []

    # Patch ChatSessionRepository
    from backend.db.repositories import sessions as sess_repo_mod

    async def _fake_get(session_id, org_id):
        return _make_session_row()

    async def _fake_link(session_id, org_id, position_id):
        pass

    monkeypatch.setattr(sess_repo_mod.ChatSessionRepository, "get", staticmethod(_fake_get))
    monkeypatch.setattr(sess_repo_mod.ChatSessionRepository, "link_position", staticmethod(_fake_link))

    # Patch PositionRepository.create and variants
    from backend.db.repositories import positions as pos_repo_mod

    async def _fake_create(conn, **kwargs):
        assert kwargs.get("status") == "draft", "Position must be created with status=draft"
        return _make_position()

    async def _fake_insert_variants(conn, position_id, variants):
        pass

    async def _fake_update_embedding(conn, position_id, org_id, embedding):
        pass

    monkeypatch.setattr(pos_repo_mod.PositionRepository, "create", staticmethod(_fake_create))
    monkeypatch.setattr(pos_repo_mod.PositionRepository, "insert_variants", staticmethod(_fake_insert_variants))
    monkeypatch.setattr(pos_repo_mod.PositionRepository, "update_embedding", staticmethod(_fake_update_embedding))

    # Patch PipelineEventRepository and AuditLogRepository
    from backend.db.repositories import pipeline_events as pe_repo_mod, audit as audit_repo_mod

    async def _noop_create(conn, data):
        pass

    monkeypatch.setattr(pe_repo_mod.PipelineEventRepository, "create", staticmethod(_noop_create))
    monkeypatch.setattr(audit_repo_mod.AuditLogRepository, "create", staticmethod(_noop_create))

    # Patch get_connection so no real DB is touched
    fake_conn = _FakeConn()
    monkeypatch.setattr(
        _chat_service_module, "get_connection",
        lambda: _FakeConnCtx(fake_conn),
    )

    # Patch PositionService.submit_for_approval
    async def _fake_submit(position_id, org_id, submitted_by_user_id):
        submit_calls.append({"position_id": position_id, "org_id": org_id, "user_id": submitted_by_user_id})

    monkeypatch.setattr(PositionService, "submit_for_approval", staticmethod(_fake_submit))

    # Patch embedding helpers to be no-ops
    from backend.adapters.llm import factory as llm_factory

    class _FakeEmbedder:
        async def aembed_query(self, text):
            return [0.0] * 10

    monkeypatch.setattr(llm_factory, "get_embedding_model", lambda: _FakeEmbedder())

    from backend.db import vector_store as vs_mod

    async def _fake_embed_jd(**kwargs):
        pass

    monkeypatch.setattr(vs_mod, "embed_jd", _fake_embed_jd)

    # Patch Celery task — should NOT be called
    class _FakeTask:
        def delay(self, *args):
            celery_delay_calls.append(args)

    try:
        import backend.tasks.candidate_pipeline as cp_mod
        monkeypatch.setattr(cp_mod, "run_candidate_search", _FakeTask())
    except Exception:
        pass  # Module may not be importable in test env; that's fine — delay won't be called

    # ── Run ───────────────────────────────────────────────────────────────────
    result = await ChatService.finish_and_save_position(
        session_id="sess-abc",
        org_id=1,
        user_id=10,
        setup_data={"department_id": 3, "headcount": 2, "priority": "high"},
    )

    assert result["id"] == 7, "Should return the created position"

    assert len(submit_calls) == 1, (
        f"submit_for_approval must be called exactly once; got {len(submit_calls)}"
    )
    assert submit_calls[0]["position_id"] == 7
    assert submit_calls[0]["org_id"] == 1
    assert submit_calls[0]["user_id"] == 10

    assert len(celery_delay_calls) == 0, (
        "run_candidate_search.delay must NOT be called immediately — sourcing is gated by approval"
    )


# ══════════════════════════════════════════════════════════════════════════════
# Test 2 — record_approval_decision('approved') fires sourcing
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_approval_decision_approved_fires_sourcing(monkeypatch):
    """
    PositionService.record_approval_decision with decision='approved' must
    call run_candidate_search.delay exactly once.
    """
    celery_delay_calls = []

    # Build a fake conn that returns position row and user rows on fetchrow
    fetchrow_map = {
        "from positions": {
            "role_name": "Senior Engineer",
            "created_by": 10,
            "department_id": 3,
        },
        "from users": {
            "name": "Alice Smith",
            "email": "alice@example.com",
        },
    }
    fake_conn = _FakeConn(fetchrow_map=fetchrow_map)

    # Patch get_connection in position_service
    monkeypatch.setattr(
        _pos_service_module, "get_connection",
        lambda: _FakeConnCtx(fake_conn),
    )

    # Patch AuditLogRepository
    from backend.db.repositories import audit as audit_repo_mod

    async def _noop_audit(conn, data):
        pass

    monkeypatch.setattr(audit_repo_mod.AuditLogRepository, "create", staticmethod(_noop_audit))

    # Patch email helpers
    async def _noop_email(**kwargs):
        return True

    monkeypatch.setattr(EmailService, "send_jd_approved", staticmethod(_noop_email))

    # Patch Celery
    class _FakeTask:
        def delay(self, *args):
            celery_delay_calls.append(args)

    try:
        import backend.tasks.candidate_pipeline as cp_mod
        monkeypatch.setattr(cp_mod, "run_candidate_search", _FakeTask())
    except Exception:
        pass

    # Also patch the import inside record_approval_decision
    import importlib
    import sys

    class _FakeCP:
        run_candidate_search = _FakeTask()

    sys.modules.setdefault("backend.tasks.candidate_pipeline", _FakeCP())

    await PositionService.record_approval_decision(
        position_id=7,
        org_id=1,
        approver_user_id=20,
        decision="approved",
        notes="",
    )

    assert len(celery_delay_calls) == 1, (
        f"run_candidate_search.delay must be called once on approval; got {len(celery_delay_calls)}"
    )
    task_args = celery_delay_calls[0]
    assert task_args[0] == 7   # position_id
    assert task_args[1] == 1   # org_id


# ══════════════════════════════════════════════════════════════════════════════
# Test 3 — record_approval_decision('changes_requested') does NOT fire sourcing
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_approval_decision_changes_requested_no_sourcing(monkeypatch):
    """
    PositionService.record_approval_decision with decision='changes_requested'
    must NOT call run_candidate_search.delay.
    """
    celery_delay_calls = []

    fetchrow_map = {
        "from positions": {
            "role_name": "Senior Engineer",
            "created_by": 10,
            "department_id": 3,
        },
        "from users": {
            "name": "Alice Smith",
            "email": "alice@example.com",
        },
    }
    fake_conn = _FakeConn(fetchrow_map=fetchrow_map)

    monkeypatch.setattr(
        _pos_service_module, "get_connection",
        lambda: _FakeConnCtx(fake_conn),
    )

    from backend.db.repositories import audit as audit_repo_mod

    async def _noop_audit(conn, data):
        pass

    monkeypatch.setattr(audit_repo_mod.AuditLogRepository, "create", staticmethod(_noop_audit))

    async def _noop_email(**kwargs):
        return True

    monkeypatch.setattr(EmailService, "send_jd_changes_requested", staticmethod(_noop_email))

    class _FakeTask:
        def delay(self, *args):
            celery_delay_calls.append(args)

    import sys

    class _FakeCP:
        run_candidate_search = _FakeTask()

    sys.modules["backend.tasks.candidate_pipeline"] = _FakeCP()

    await PositionService.record_approval_decision(
        position_id=7,
        org_id=1,
        approver_user_id=20,
        decision="changes_requested",
        notes="Please soften the tone in the requirements section.",
    )

    assert len(celery_delay_calls) == 0, (
        "run_candidate_search.delay must NOT be called when changes are requested"
    )


# ══════════════════════════════════════════════════════════════════════════════
# Test 4 — resolve_reviewer reads ai_behavior_settings, NOT a "settings" column
# Regression: the old query `SELECT settings FROM organizations` threw
# 'column "settings" does not exist', which aborted submit_for_approval so the
# team lead was never notified and the stage stayed at "JD generation".
# ══════════════════════════════════════════════════════════════════════════════


class _ReviewerFakeConn:
    """Fake conn that raises if the non-existent `settings` column is queried,
    mirroring Postgres UndefinedColumnError. Returns proper rows otherwise."""

    async def fetchrow(self, query, *args):
        q = query.lower()
        # The bug: querying a plain `settings` column that doesn't exist.
        if "settings from organizations" in q and "ai_behavior_settings" not in q:
            raise Exception('column "settings" does not exist')
        if "from users where id" in q:
            return {"id": 36, "role": "hr", "name": "HR Person", "department_id": 3}
        if "ai_behavior_settings" in q:
            # JSONB returned as a str (asyncpg default) — get_ai_behavior decodes it.
            return {"ai_behavior_settings": "{}"}
        if "from hire_requests" in q:
            return {"id": 99, "name": "Team Lead"}
        return None

    async def fetch(self, query, *args):
        return []

    async def execute(self, query, *args):
        return None


@pytest.mark.asyncio
async def test_resolve_reviewer_uses_ai_behavior_settings_column(monkeypatch):
    """resolve_reviewer must not query a non-existent `settings` column.

    Before the fix it issued `SELECT settings FROM organizations`, which raised
    and bubbled up to abort submit_for_approval (no team-lead notification,
    stage stuck at JD generation). After the fix it reads ai_behavior_settings,
    so an HR-created position with a linked hire request resolves to the team
    lead as reviewer.
    """
    fake_conn = _ReviewerFakeConn()
    monkeypatch.setattr(
        _pos_service_module, "get_connection",
        lambda: _FakeConnCtx(fake_conn),
    )

    from backend.db.repositories import positions as pos_repo_mod

    async def _fake_get(conn, position_id, org_id):
        return _make_position(position_id)

    monkeypatch.setattr(pos_repo_mod.PositionRepository, "get", staticmethod(_fake_get))

    # Must not raise, and must resolve the team lead (id=99) as the reviewer.
    result = await PositionService.resolve_reviewer(
        position_id=7, org_id=1, user_id=36,
    )

    assert result.get("reviewer_id") == 99, (
        f"Expected team lead (99) as reviewer; got {result}"
    )
    assert not result.get("is_bypass"), "HR submission should require review, not bypass"
