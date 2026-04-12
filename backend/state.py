"""
state.py – AgentState Schema (Production)
Strict Pydantic-compatible TypedDict for LangGraph state.
"""
from typing import Optional
from typing_extensions import TypedDict


class AgentState(TypedDict, total=False):
    # Session info
    session_id: str
    role_name: str

    # Conversation messages: list of {"role": "user"|"assistant", "content": str}
    messages: list[dict]

    # Stage 1 – Interviewer output
    baseline_requirements: Optional[str]

    # Stage 2 – Internal Analyst output (structured JSON dict)
    internal_recommendations: Optional[dict]
    internal_search_done: bool

    # Stage 3 – Market Intelligence output
    competitors: Optional[list[str]]

    # Stage 4 – Peer Benchmarking output (structured JSON dict)
    market_recommendations: Optional[dict]
    market_search_done: bool

    # Stage 5 – JD Overview variants
    jd_overviews: Optional[list[dict]]

    # Stage 6 – Drafting output
    final_jd_markdown: Optional[str]

    # Workflow stage tracker
    # "intake" -> "internal_review" -> "market_review" -> "jd_variants" -> "done"
    workflow_stage: str
