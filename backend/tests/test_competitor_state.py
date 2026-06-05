"""
Regression test for Bug #123 — org competitors loaded into JD generation state.

The market_intelligence node reads state["competitors_used"]; when empty it falls
back to industry defaults (Google/Microsoft/Stripe). get_or_create_session must
populate competitors_used from the org's configured competitors so the
market-research stage benchmarks against the real list.
"""
import pytest

from backend.services import chat_service as chat_service_mod
from backend.services.chat_service import ChatService


class _FakeConnCtx:
    """Async context manager standing in for get_connection() — the conn object
    is unused because the repositories are patched at the class level."""

    async def __aenter__(self):
        return object()

    async def __aexit__(self, *args):
        return False


@pytest.mark.asyncio
async def test_get_or_create_session_loads_org_competitors(monkeypatch):
    captured = {}

    from backend.db.repositories import sessions as sessions_mod
    from backend.db.repositories import organizations as orgs_mod
    from backend.db.repositories import competitors as comp_mod

    get_calls = []

    async def _fake_get(session_id, org_id):
        get_calls.append(1)
        # First call → None (take the create branch). Final re-fetch → a session.
        if len(get_calls) == 1:
            return None
        return {"id": session_id, "graph_state_parsed": {}}

    async def _fake_create(session_id, org_id, user_id, department_id):
        return None

    async def _fake_update_state(session_id, org_id, stage, state):
        captured["state"] = state

    async def _fake_add_message(session_id, role, content):
        return None

    async def _fake_org(conn, org_id):
        return {"about_us": "x", "culture_keywords": "y", "benefits_text": "z"}

    async def _fake_competitors(conn, org_id, department_id=None, active_only=True):
        return [{"name": "Acme"}, {"name": "Globex"}]

    monkeypatch.setattr(sessions_mod.ChatSessionRepository, "get", staticmethod(_fake_get))
    monkeypatch.setattr(sessions_mod.ChatSessionRepository, "create", staticmethod(_fake_create))
    monkeypatch.setattr(sessions_mod.ChatSessionRepository, "update_state", staticmethod(_fake_update_state))
    monkeypatch.setattr(sessions_mod.ChatSessionRepository, "add_message", staticmethod(_fake_add_message))
    monkeypatch.setattr(orgs_mod.OrgRepository, "get_by_id", staticmethod(_fake_org))
    monkeypatch.setattr(comp_mod.CompetitorRepository, "list_by_org", staticmethod(_fake_competitors))
    monkeypatch.setattr(chat_service_mod, "get_connection", lambda: _FakeConnCtx())

    await ChatService.get_or_create_session("sess-1", org_id=1, user_id=2, department_id=3)

    competitors_used = captured.get("state", {}).get("competitors_used")
    assert competitors_used == ["Acme", "Globex"], (
        f"Expected org competitors loaded into state; got {competitors_used}"
    )
