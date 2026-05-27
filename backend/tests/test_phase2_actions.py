"""Phase 2 — Pure-logic tests for orchestrator action handlers + streaming."""
import asyncio
import pytest

from backend.agents.nodes import drafting


class _FakeChunk:
    def __init__(self, content: str):
        self.content = content


class _FakeStreamingLLM:
    """Mimics LangChain's BaseChatModel.astream() — yields chunks."""

    def __init__(self, chunks: list[str]):
        self._chunks = chunks
        self.ainvoke_called = False

    async def astream(self, messages):
        for c in self._chunks:
            yield _FakeChunk(c)

    async def ainvoke(self, messages):
        self.ainvoke_called = True

        class _R:
            content = "".join(self._chunks_self)

        _R._chunks_self = self._chunks
        return _R


@pytest.mark.asyncio
async def test_drafting_final_streams_chunks_to_queue(monkeypatch):
    chunks = ["# Senior ML\n", "## About\n", "TechCorp builds…"]
    fake = _FakeStreamingLLM(chunks)
    monkeypatch.setattr(drafting, "get_llm", lambda **kw: fake)

    state = {
        "role_name": "Senior ML Eng",
        "skills_required": ["Python"],
        "internal_skills_accepted": [],
        "market_skills_accepted": [],
        "experience_min": 5,
        "experience_max": 8,
        "location": "Bangalore",
        "work_type": "hybrid",
        "selected_variant": "hybrid",
        "jd_variants": [{"type": "hybrid", "summary": "balanced"}],
        "messages": [],
        "org_about_us": "TC",
        "org_benefits_text": "Y",
    }

    queue: asyncio.Queue = asyncio.Queue()
    new_state = await drafting.run_drafting_final(state, token_queue=queue)

    received = []
    while not queue.empty():
        received.append(queue.get_nowait())

    assert received == chunks
    assert new_state["final_jd"] == "".join(chunks).strip()
    assert new_state["stage"] == "final_jd"
    assert not fake.ainvoke_called  # streaming path, not ainvoke


from backend.agents.orchestrator import run_agent


@pytest.mark.asyncio
async def test_apply_bias_fix_patches_jd_and_drops_issue():
    state = {
        "stage": "bias_check",
        "final_jd": "We want a rockstar engineer to join our team.",
        "bias_issues": [
            {"phrase": "rockstar", "suggestion": "high-performing", "reason": "gendered"},
            {"phrase": "join our team", "suggestion": "collaborate with us", "reason": "vague"},
        ],
        "awaiting_user_input": True,
        "messages": [],
    }

    new_state = await run_agent(
        state=state,
        action="apply_bias_fix",
        action_data={"phrase": "rockstar", "suggestion": "high-performing"},
    )

    assert "high-performing" in new_state["final_jd"]
    assert "rockstar" not in new_state["final_jd"]
    assert len(new_state["bias_issues"]) == 1
    assert new_state["bias_issues"][0]["phrase"] == "join our team"
    assert new_state["stage"] == "bias_check"
    assert new_state["awaiting_user_input"] is True


@pytest.mark.asyncio
async def test_edit_variant_overwrites_named_variant():
    state = {
        "stage": "jd_variants",
        "jd_variants": [
            {"type": "skill_focused", "summary": "old skill"},
            {"type": "outcome_focused", "summary": "old outcome"},
            {"type": "hybrid", "summary": "old hybrid"},
        ],
        "awaiting_user_input": True,
        "messages": [],
    }

    new_state = await run_agent(
        state=state,
        action="edit_variant",
        action_data={"variant_type": "hybrid", "summary": "new hybrid blurb"},
    )

    hybrid = next(v for v in new_state["jd_variants"] if v["type"] == "hybrid")
    assert hybrid["summary"] == "new hybrid blurb"
    assert new_state["stage"] == "jd_variants"
