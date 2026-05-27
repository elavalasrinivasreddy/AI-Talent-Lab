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
