"""
nodes.py – LangGraph Agent Nodes (Production)
Each node connects to real data sources: ChromaDB, SQLite, Web Search.
Returns structured JSON for skill-chip selection in the frontend.
"""
import os
import re
import json
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from backend.config import get_llm
from backend.state import AgentState
from backend.db.database import get_competitors, save_position
from backend.db.vector_store import search_similar_jds
from backend.db.search_tool import search_competitor_jds

# ── Prompt Loader ─────────────────────────────────────────────────────────────
PROMPT_DIR = os.path.join(os.path.dirname(__file__), "prompts")
_INTAKE_COMPLETE_RE = re.compile(r"\[IN[A-Z_]*TAKE[_\s]*COMPLETE\]", re.IGNORECASE)


def _load_prompt(filename: str) -> str:
    path = os.path.join(PROMPT_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _parse_json_response(text: str) -> dict:
    """Robustly extract JSON from LLM response (handles markdown fences, preamble, etc.)."""
    # Try direct parse first
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try extracting from markdown code block
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass

    # Try finding first { ... } block
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    # Fallback
    return {"summary": text, "skills": []}


# ── Node 1: Interviewer ───────────────────────────────────────────────────────
def interviewer_node(state: AgentState) -> dict:
    """
    Gathers baseline requirements via conversational interview.
    Uses regex to detect [INTAKE_COMPLETE] variants.
    """
    llm = get_llm()
    sys_prompt = _load_prompt("interviewer_agent.md")

    lc_messages = [SystemMessage(content=sys_prompt)]
    for msg in state.get("messages", []):
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "user":
            lc_messages.append(HumanMessage(content=content))
        elif role == "assistant":
            lc_messages.append(AIMessage(content=content))

    response = llm.invoke(lc_messages)
    reply = response.content

    is_complete = bool(_INTAKE_COMPLETE_RE.search(reply))
    clean_reply = _INTAKE_COMPLETE_RE.sub("", reply).strip()
    lines = [l.rstrip() for l in clean_reply.splitlines()]
    while lines and not lines[-1]:
        lines.pop()
    clean_reply = "\n".join(lines)

    new_messages = state.get("messages", []) + [{"role": "assistant", "content": clean_reply}]

    baseline = None
    if is_complete:
        conversation_text = "\n".join(
            f"{m['role'].upper()}: {m['content']}" for m in new_messages
        )
        baseline = conversation_text

        session_id = state.get("session_id", "unknown")
        role_name = state.get("role_name", "Unknown Role")
        save_position(session_id=session_id, role_name=role_name)

    return {
        "messages": new_messages,
        "baseline_requirements": baseline,
    }


# ── Node 2: Internal Analyst ──────────────────────────────────────────────────
def internal_analyst_node(state: AgentState) -> dict:
    """
    Queries ChromaDB for similar past JDs.
    Returns structured JSON: {summary, skills: [{name, reason}]}
    """
    role_name = state.get("role_name", "Unknown Role")
    baseline = state.get("baseline_requirements", "")

    query = f"{role_name} {baseline[:400]}"
    hits = search_similar_jds(query=query, n_results=3)

    if not hits:
        return {
            "internal_recommendations": {
                "summary": "No similar past JDs were found in our internal history for this role.",
                "skills": []
            },
            "internal_search_done": True,
        }

    history_context = "\n\n".join(
        f"**Past JD — Role: {h['metadata'].get('role', 'N/A')} "
        f"| Year: {h['metadata'].get('year', 'N/A')} "
        f"| Outcome: {h['metadata'].get('outcome', 'N/A')}**\n{h['text'].strip()}"
        for h in hits
    )

    llm = get_llm()
    sys_prompt = _load_prompt("internal_agent.md")
    user_prompt = (
        f"Current Role Being Hired: {role_name}\n\n"
        f"Baseline Requirements Collected:\n{baseline}\n\n"
        f"Similar Past JDs from Our Organization:\n{history_context}"
    )

    response = llm.invoke([
        SystemMessage(content=sys_prompt),
        HumanMessage(content=user_prompt),
    ])

    parsed = _parse_json_response(response.content)

    return {
        "internal_recommendations": parsed,
        "internal_search_done": True,
    }


# ── Node 3: Market Intelligence ───────────────────────────────────────────────
def market_intelligence_node(state: AgentState) -> dict:
    """Fetches top competitors from SQLite DB."""
    org_name = os.getenv("ORG_NAME", "AI Talent Lab")
    competitor_rows = get_competitors(org_name)
    if not competitor_rows:
        return {"competitors": []}
    return {"competitors": [r["competitor_name"] for r in competitor_rows]}


# ── Node 4: Peer Benchmarking ─────────────────────────────────────────────────
def benchmarking_node(state: AgentState) -> dict:
    """
    Searches the web for competitor JDs and produces structured gap analysis.
    Returns JSON: {summary, missing_skills: [{name, reason}], differential_skills: [{name, reason}]}
    """
    role_name = state.get("role_name", "Unknown Role")
    baseline = state.get("baseline_requirements", "")
    competitors = state.get("competitors", [])

    if not competitors:
        return {
            "market_recommendations": {
                "summary": "No competitor data available.",
                "missing_skills": [],
                "differential_skills": []
            },
            "market_search_done": True,
        }

    search_results = search_competitor_jds(role=role_name, competitors=competitors)

    llm = get_llm()
    sys_prompt = _load_prompt("benchmarking_agent.md")
    user_prompt = (
        f"Role Being Hired: {role_name}\n\n"
        f"Our Baseline Requirements:\n{baseline}\n\n"
        f"Competitor JD Research:\n{search_results}"
    )

    response = llm.invoke([
        SystemMessage(content=sys_prompt),
        HumanMessage(content=user_prompt),
    ])

    parsed = _parse_json_response(response.content)

    # Ensure expected structure
    if "missing_skills" not in parsed:
        parsed["missing_skills"] = parsed.get("skills", [])
    if "differential_skills" not in parsed:
        parsed["differential_skills"] = []

    return {
        "market_recommendations": parsed,
        "market_search_done": True,
    }


# ── Node 5: JD Drafting ───────────────────────────────────────────────────────
def drafting_node(state: AgentState) -> dict:
    """Synthesizes accepted skills + baseline into final JD."""
    from backend.db.vector_store import store_jd
    import uuid

    role_name = state.get("role_name", "Unknown Role")
    baseline = state.get("baseline_requirements", "")
    messages = state.get("messages", [])
    session_id = state.get("session_id", str(uuid.uuid4()))

    user_selections = messages[-1]["content"] if messages else ""

    llm = get_llm()
    sys_prompt = _load_prompt("drafting_agent.md")
    user_prompt = (
        f"Role Title: {role_name}\n\n"
        f"Baseline Requirements (from user interview):\n{baseline}\n\n"
        f"User-Accepted Additional Requirements:\n{user_selections}\n\n"
        "Instructions:\n"
        "- Structure the JD with: About the Role, What You'll Do, What You'll Bring, "
        "Nice to Have, Work Setup, Why Join Us.\n"
        "- Write in a professional but engaging tone.\n"
        "- Output ONLY clean Markdown. No preamble or explanation outside the JD."
    )

    response = llm.invoke([
        SystemMessage(content=sys_prompt),
        HumanMessage(content=user_prompt),
    ])

    jd_markdown = response.content

    jd_id = f"jd-{session_id}"
    store_jd(jd_id=jd_id, role_name=role_name, markdown_text=jd_markdown, session_id=session_id)

    new_messages = messages + [{
        "role": "assistant",
        "content": "✅ Your Job Description is ready! Review, edit, and download it below.",
    }]

    return {
        "messages": new_messages,
        "final_jd_markdown": jd_markdown,
    }
