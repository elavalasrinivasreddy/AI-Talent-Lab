"""
tests/test_tavily_sourcing.py

Unit tests for TavilyAdapter.
All external I/O (Tavily API, LLM) is monkeypatched — no real credits burned.
"""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

POSITION = {
    "role_name": "Senior Python Developer",
    "location": "Bangalore",
    "skills_required": ["Python", "FastAPI", "PostgreSQL", "Docker", "Redis"],
    "experience_min": 3,
    "experience_max": 8,
    "jd_markdown": "We need a Senior Python Developer with FastAPI experience.",
}

ORG = {"name": "Acme Corp", "industry": "SaaS"}

# Canned Tavily results
CANNED_TAVILY_RESULTS = [
    {
        "title": "Jane Doe – Senior Python Developer at Razorpay",
        "url": "https://linkedin.com/in/janedoe-py",
        "content": (
            "Jane Doe is a Senior Python Developer at Razorpay with 5 years of experience. "
            "She specialises in FastAPI, PostgreSQL, and Docker. Based in Bangalore."
        ),
        "score": 0.95,
    },
    {
        "title": "John Smith – Full Stack Engineer",
        "url": "https://github.com/johnsmith",
        "content": (
            "John Smith is a full-stack engineer based in Hyderabad. "
            "Open-source contributor. Skills: Python, Django, Redis, Kubernetes."
        ),
        "score": 0.88,
    },
    {
        "title": "Senior Python Developer Jobs – Naukri.com",
        "url": "https://naukri.com/senior-python-developer-jobs",
        "content": "Find 1000+ Senior Python Developer jobs on Naukri.com.",
        "score": 0.72,
    },
]

# Canned LLM responses (parallel to CANNED_TAVILY_RESULTS order)
CANNED_LLM_RESPONSES = [
    json.dumps({
        "name": "Jane Doe",
        "headline": "Senior Python Developer at Razorpay",
        "current_company": "Razorpay",
        "location": "Bangalore",
        "summary": (
            "Jane is a Senior Python Developer with 5 years specialising in "
            "FastAPI, PostgreSQL, and Docker at Razorpay."
        ),
        "source_url": "https://linkedin.com/in/janedoe-py",
        "skill_tags": ["Python", "FastAPI", "PostgreSQL", "Docker"],
    }),
    json.dumps({
        "name": "John Smith",
        "headline": "Full Stack Engineer",
        "current_company": None,
        "location": "Hyderabad",
        "summary": "John is a full-stack engineer and open-source contributor skilled in Python, Django, and Redis.",
        "source_url": "https://github.com/johnsmith",
        "skill_tags": ["Python", "Django", "Redis", "Kubernetes"],
    }),
    "null",  # Job listing — LLM correctly skips it
]


def _make_llm_response(content: str):
    """Wrap a string as a LangChain-style message mock."""
    msg = MagicMock()
    msg.content = content
    return msg


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_tavily_adapter_returns_normalised_candidates():
    """
    Happy-path: Tavily returns 3 results; LLM extracts 2 person dossiers
    (the job-listing result is correctly skipped). Assert the returned list
    matches the CandidateSourceAdapter contract.
    """
    from backend.adapters.candidate_sources.tavily import TavilyAdapter

    llm_responses = [_make_llm_response(r) for r in CANNED_LLM_RESPONSES]
    mock_llm = AsyncMock()
    mock_llm.ainvoke = AsyncMock(side_effect=llm_responses)

    with (
        patch(
            "backend.adapters.candidate_sources.tavily.tavily_search",
            new=AsyncMock(return_value=CANNED_TAVILY_RESULTS),
        ),
        patch(
            "backend.adapters.candidate_sources.tavily.get_llm",
            return_value=mock_llm,
        ),
    ):
        adapter = TavilyAdapter()
        candidates = await adapter.search(POSITION, ORG, limit=10)

    # Should get exactly 2 candidates (job listing dropped)
    assert len(candidates) == 2

    # ── Contract fields must all be present ──────────────────────────────
    required_keys = {
        "name", "email", "phone", "current_title", "current_company",
        "experience_years", "location", "source", "source_profile_url",
        "resume_text",
    }
    for c in candidates:
        missing = required_keys - c.keys()
        assert not missing, f"Candidate missing keys: {missing}"

    # ── Check first candidate ────────────────────────────────────────────
    jane = candidates[0]
    assert jane["name"] == "Jane Doe"
    assert jane["source"] == "tavily_web"
    assert jane["source_profile_url"] == "https://linkedin.com/in/janedoe-py"
    assert jane["current_title"] == "Senior Python Developer at Razorpay"
    assert jane["current_company"] == "Razorpay"
    assert jane["location"] == "Bangalore"
    assert "FastAPI" in jane["skill_tags"]
    # email is None — web results don't expose email
    assert jane["email"] is None
    assert jane["phone"] is None
    assert jane["experience_years"] is None

    # ── Check second candidate ───────────────────────────────────────────
    john = candidates[1]
    assert john["name"] == "John Smith"
    assert john["source"] == "tavily_web"
    assert john["source_profile_url"] == "https://github.com/johnsmith"
    assert john["email"] is None


@pytest.mark.asyncio
async def test_tavily_adapter_respects_limit():
    """Adapter should honour the `limit` argument and return at most `limit` candidates."""
    from backend.adapters.candidate_sources.tavily import TavilyAdapter

    # Six canned results — all genuine people
    many_results = [
        {
            "title": f"Dev {i}",
            "url": f"https://github.com/dev{i}",
            "content": f"Developer {i} is a Python engineer.",
            "score": 0.9,
        }
        for i in range(6)
    ]
    llm_response_json = json.dumps({
        "name": "Dev X",
        "headline": "Python Engineer",
        "current_company": None,
        "location": "Bangalore",
        "summary": "A Python developer.",
        "source_url": "https://github.com/devX",
        "skill_tags": ["Python"],
    })

    call_count = 0

    async def side_effect_llm(messages):
        nonlocal call_count
        # Return a unique name each time to avoid dedup filtering
        idx = call_count
        call_count += 1
        data = json.loads(llm_response_json)
        data["name"] = f"Dev {idx}"
        data["source_url"] = f"https://github.com/dev{idx}"
        msg = MagicMock()
        msg.content = json.dumps(data)
        return msg

    mock_llm = AsyncMock()
    mock_llm.ainvoke = AsyncMock(side_effect=side_effect_llm)

    with (
        patch(
            "backend.adapters.candidate_sources.tavily.tavily_search",
            new=AsyncMock(return_value=many_results),
        ),
        patch(
            "backend.adapters.candidate_sources.tavily.get_llm",
            return_value=mock_llm,
        ),
    ):
        adapter = TavilyAdapter()
        candidates = await adapter.search(POSITION, ORG, limit=3)

    assert len(candidates) <= 3


@pytest.mark.asyncio
async def test_tavily_adapter_deduplicates_same_name_and_url():
    """Two identical results should yield only one candidate."""
    from backend.adapters.candidate_sources.tavily import TavilyAdapter

    dup_result = CANNED_TAVILY_RESULTS[0]
    dup_tavily = [dup_result, dup_result]  # exact same result twice

    dossier = json.dumps({
        "name": "Jane Doe",
        "headline": "Senior Python Developer",
        "current_company": "Razorpay",
        "location": "Bangalore",
        "summary": "Jane is a Senior Python Developer.",
        "source_url": "https://linkedin.com/in/janedoe-py",
        "skill_tags": ["Python", "FastAPI"],
    })

    mock_llm = AsyncMock()
    mock_llm.ainvoke = AsyncMock(side_effect=[
        _make_llm_response(dossier),
        _make_llm_response(dossier),
    ])

    with (
        patch(
            "backend.adapters.candidate_sources.tavily.tavily_search",
            new=AsyncMock(return_value=dup_tavily),
        ),
        patch(
            "backend.adapters.candidate_sources.tavily.get_llm",
            return_value=mock_llm,
        ),
    ):
        adapter = TavilyAdapter()
        candidates = await adapter.search(POSITION, ORG, limit=10)

    assert len(candidates) == 1


@pytest.mark.asyncio
async def test_tavily_adapter_returns_empty_on_search_error():
    """If Tavily raises SearchError, adapter returns an empty list (no crash)."""
    from backend.adapters.candidate_sources.tavily import TavilyAdapter
    from backend.agents.tools.search import SearchError

    with patch(
        "backend.adapters.candidate_sources.tavily.tavily_search",
        new=AsyncMock(side_effect=SearchError("API key missing")),
    ):
        adapter = TavilyAdapter()
        candidates = await adapter.search(POSITION, ORG, limit=10)

    assert candidates == []


@pytest.mark.asyncio
async def test_factory_returns_tavily_adapter_for_tavily_setting():
    """Factory dispatches to TavilyAdapter when CANDIDATE_SOURCE_ADAPTER='tavily'."""
    from backend.adapters.candidate_sources.tavily import TavilyAdapter
    from backend.config import settings
    from backend.adapters.candidate_sources import get_candidate_source_adapter

    with patch.object(settings, "DEFAULT_SOURCE_ADAPTER", None, create=True), \
         patch.object(settings, "CANDIDATE_SOURCE_ADAPTER", "tavily"):
        adapter = get_candidate_source_adapter()

    assert isinstance(adapter, TavilyAdapter)
