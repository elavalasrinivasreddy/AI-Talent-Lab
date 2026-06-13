"""
Unit tests for save-as-draft path in ChatService.finish_and_save_position.

All DB calls are monkeypatched — no real DB or broker needed.

Covers:
  1. finish_and_save_position(as_draft=True) → status='draft', submit_for_approval NOT called.
  2. finish_and_save_position(as_draft=False) → submit_for_approval IS called (default path unchanged).
"""
import pytest

from backend.services import chat_service as _chat_service_module
from backend.services.chat_service import ChatService


# ── Async helpers ─────────────────────────────────────────────────────────────

async def _async_none(*args, **kwargs):
    return None


# ── Fake asyncpg connection ───────────────────────────────────────────────────

class _FakeConn:
    async def execute(self, query, *args):
        pass

    async def fetchrow(self, query, *args):
        return None

    async def fetchval(self, query, *args):
        # Quota counters (active positions, etc.) read via fetchval — a fresh
        # mocked org has zero usage, so nothing is gated.
        return 0

    async def fetch(self, query, *args):
        return []


class _FakeConnCtx:
    def __init__(self, conn):
        self._conn = conn

    async def __aenter__(self):
        return self._conn

    async def __aexit__(self, *args):
        pass


# ── Shared fixtures ───────────────────────────────────────────────────────────

def _make_position(status="draft"):
    return {
        "id": 42,
        "org_id": 1,
        "department_id": 3,
        "role_name": "Senior Engineer",
        "status": status,
        "session_id": "sess-abc",
    }


def _make_session_row():
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


def _apply_common_patches(monkeypatch):
    """Patch all DB/external calls shared between tests. Returns submit_calls list."""
    submit_calls = []

    # ChatSessionRepository
    from backend.db.repositories import sessions as sess_repo_mod
    monkeypatch.setattr(sess_repo_mod.ChatSessionRepository, "get", staticmethod(lambda *a, **k: _async_return(_make_session_row())))
    monkeypatch.setattr(sess_repo_mod.ChatSessionRepository, "link_position", staticmethod(_async_none))

    # PositionRepository
    from backend.db.repositories import positions as pos_repo_mod
    monkeypatch.setattr(pos_repo_mod.PositionRepository, "create", staticmethod(lambda conn, **kw: _async_return(_make_position(kw.get("status", "draft")))))
    monkeypatch.setattr(pos_repo_mod.PositionRepository, "insert_variants", staticmethod(_async_none))
    monkeypatch.setattr(pos_repo_mod.PositionRepository, "update_embedding", staticmethod(_async_none))

    # PipelineEventRepository + AuditLogRepository
    from backend.db.repositories import pipeline_events as pe_mod, audit as audit_mod
    monkeypatch.setattr(pe_mod.PipelineEventRepository, "create", staticmethod(_async_none))
    monkeypatch.setattr(audit_mod.AuditLogRepository, "create", staticmethod(_async_none))

    # get_connection
    monkeypatch.setattr(_chat_service_module, "get_connection", lambda: _FakeConnCtx(_FakeConn()))

    # Embedding + ChromaDB — non-blocking, patch to no-ops
    from backend.adapters.llm import factory as llm_factory_mod

    class _FakeEmbeddingModel:
        async def aembed_query(self, text):
            return [0.0] * 8

    monkeypatch.setattr(llm_factory_mod, "get_embedding_model", lambda: _FakeEmbeddingModel())

    from backend.db import vector_store as vs_mod
    monkeypatch.setattr(vs_mod, "embed_jd", staticmethod(_async_none))

    # PositionService.submit_for_approval — record calls
    from backend.services import position_service as pos_svc_mod

    async def _fake_submit(position_id, org_id, submitted_by_user_id):
        submit_calls.append(position_id)

    monkeypatch.setattr(pos_svc_mod.PositionService, "submit_for_approval", staticmethod(_fake_submit))

    return submit_calls


async def _async_return(value):
    return value


# ══════════════════════════════════════════════════════════════════════════════
# Test 1 — as_draft=True: status='draft', submit_for_approval NOT called
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_save_as_draft_skips_approval_submission(monkeypatch):
    """
    finish_and_save_position(as_draft=True) must:
      - Return a position dict with status='draft'.
      - NOT call PositionService.submit_for_approval.
    """
    submit_calls = _apply_common_patches(monkeypatch)

    position = await ChatService.finish_and_save_position(
        session_id="sess-abc",
        org_id=1,
        user_id=10,
        setup_data={"department_id": 3, "headcount": 1, "priority": "normal",
                    "ats_threshold": 80.0, "search_interval_hours": 24},
        as_draft=True,
    )

    assert position["status"] == "draft", (
        f"Expected status='draft', got '{position['status']}'"
    )
    assert len(submit_calls) == 0, (
        f"submit_for_approval must NOT be called for drafts, but was called {len(submit_calls)} time(s)"
    )


# ══════════════════════════════════════════════════════════════════════════════
# Test 2 — as_draft=False (default): submit_for_approval IS called
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_save_non_draft_calls_approval_submission(monkeypatch):
    """
    finish_and_save_position(as_draft=False) must still call submit_for_approval
    exactly once — the default (non-draft) path must be unaffected.
    """
    submit_calls = _apply_common_patches(monkeypatch)

    await ChatService.finish_and_save_position(
        session_id="sess-abc",
        org_id=1,
        user_id=10,
        setup_data={"department_id": 3, "headcount": 1, "priority": "normal",
                    "ats_threshold": 80.0, "search_interval_hours": 24},
        as_draft=False,
    )

    assert len(submit_calls) == 1, (
        f"submit_for_approval must be called once for non-draft, called {len(submit_calls)} time(s)"
    )
    assert submit_calls[0] == 42  # position_id from _make_position
