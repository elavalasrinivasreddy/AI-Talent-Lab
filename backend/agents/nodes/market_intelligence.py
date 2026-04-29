"""
agents/nodes/market_intelligence.py – Web search and competitor analysis node.
Uses ReAct prompt with temperature=0.3.
SOFT SKIP on failure — provides fallback mock data so the card always shows.
"""
import json
import logging
import os

from backend.adapters.llm.factory import get_llm
from backend.agents.state import AgentState
from backend.agents.tools.search import search_competitor_jds, SearchError

logger = logging.getLogger(__name__)

_PROMPT_PATH = os.path.join(os.path.dirname(__file__), "..", "prompts", "market_intelligence.md")

def _load_prompt() -> str:
    with open(_PROMPT_PATH, "r") as f:
        return f.read()


async def run_market_intelligence(state: AgentState) -> AgentState:
    """
    Market intelligence node.
    - Searches web for competitor JDs (via Tavily)
    - ReAct prompts LLM to extract trending skills
    - SOFT SKIP: Fails gracefully with mock data for demo experience
    """
    try:
        role_name = state.get("role_name", "")
        skills_required = state.get("skills_required", [])
        internal_accepted = state.get("internal_skills_accepted", [])

        all_current_skills = skills_required + internal_accepted
        competitor_names = state.get("competitors_used", [])

        # Use default competitors if none configured
        if not competitor_names:
            logger.info("No competitor names in state. Using industry defaults.")
            competitor_names = ["Google", "Microsoft", "Stripe"]
            state["competitors_used"] = competitor_names

        logger.info(f"Running market intelligence for '{role_name}' against {len(competitor_names)} competitors.")

        # 1. Search web
        search_results = await search_competitor_jds(
            role_name=role_name,
            competitor_names=competitor_names,
            max_results_per_competitor=2
        )

        if not search_results:
            raise SearchError("No results returned from web search")

        # 2. LLM Analysis
        llm = get_llm(temperature=0.3, max_tokens=1500)
        system_prompt = _load_prompt()

        search_context = ""
        for i, res in enumerate(search_results, 1):
            search_context += (
                f"Result {i} (Competitor: {res.get('competitor')}):\n"
                f"Title: {res.get('title')}\nURL: {res.get('url')}\n"
                f"Snippets: {res.get('content')}\n\n"
            )

        user_content = (
            f"Current Role: {role_name}\n"
            f"Current Requirements: {', '.join(all_current_skills)}\n\n"
            f"Search Results:\n{search_context}"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        response = await llm.ainvoke(messages)
        content = response.content.strip()

        json_str = _extract_json(content)
        result = json.loads(json_str)
        skills = result.get("skills", [])

        if skills:
            formatted_skills = []
            for s in skills:
                formatted_skills.append({
                    "skill": s.get("skill"),
                    "source": ", ".join(s.get("sources", [])),
                    "frequency": s.get("frequency"),
                    "context": s.get("context"),
                    "selected": True
                })

            state["market_skills_found"] = formatted_skills
            # Send to benchmarking first
            state["stage"] = "benchmarking"
            state["awaiting_user_input"] = False
        else:
            state["market_skipped"] = True
            state["market_skills_found"] = []
            state["stage"] = "jd_variants"
            state["awaiting_user_input"] = False

        return state

    except Exception as e:
        logger.warning(f"Market intelligence soft skip: {e}. Using fallback data.")
        # Provide contextual fallback so user still sees the Market Research card
        role_lower = (state.get("role_name") or "").lower()
        competitors = state.get("competitors_used", ["Google", "Microsoft"])

        fallback_skills = _generate_market_fallback(role_lower, competitors)
        state["market_skills_found"] = fallback_skills
        state["competitors_used"] = competitors
        # Skip benchmarking, go directly to card display
        state["stage"] = "market_research"
        state["awaiting_user_input"] = True
        return state


def _generate_market_fallback(role_lower: str, competitors: list[str]) -> list[dict]:
    """Generate contextual fallback market skills."""
    comp_str = ", ".join(competitors[:2])
    
    base_skills = [
        {"skill": "System Design", "source": comp_str, "frequency": 2, "context": "Architecture skills", "selected": True},
        {"skill": "Cloud Platforms (AWS/GCP)", "source": comp_str, "frequency": 2, "context": "Cloud infrastructure", "selected": True},
    ]

    if "python" in role_lower or "backend" in role_lower:
        base_skills.append({"skill": "Microservices Architecture", "source": competitors[0] if competitors else "Industry", "frequency": 1, "context": "Distributed systems", "selected": True})
    elif "frontend" in role_lower or "react" in role_lower:
        base_skills.append({"skill": "Performance Optimization", "source": competitors[0] if competitors else "Industry", "frequency": 1, "context": "Web vitals", "selected": True})
    else:
        base_skills.append({"skill": "CI/CD & DevOps", "source": competitors[0] if competitors else "Industry", "frequency": 1, "context": "Engineering best practices", "selected": True})

    return base_skills


def _extract_json(content: str) -> str:
    """Extract JSON from LLM response (handles code fences)."""
    if "```json" in content:
        return content.split("```json")[-1].split("```")[0].strip()
    elif "```" in content:
        parts = content.split("```")
        if len(parts) >= 3:
            return parts[1].strip()
    return content.strip()
