"""
agents/nodes/benchmarking.py – Filter and rank market skills.
Uses CoT prompt with temperature=0.2.
SOFT SKIP on failure — falls back to unranked market skills.
"""
import json
import logging
import os

from backend.adapters.llm.factory import get_llm
from backend.agents.state import AgentState

logger = logging.getLogger(__name__)

_PROMPT_PATH = os.path.join(os.path.dirname(__file__), "..", "prompts", "benchmarking.md")

def _load_prompt() -> str:
    with open(_PROMPT_PATH, "r") as f:
        return f.read()


async def run_benchmarking(state: AgentState) -> AgentState:
    """
    Benchmarking node.
    - Runs after market_intelligence
    - Evaluates raw market skills and filters out irrelevant ones
    - SOFT SKIP gracefully falls back to just showing raw market skills
    """
    market_skills = state.get("market_skills_found", [])
    
    if not market_skills:
        state["stage"] = "jd_variants"
        state["awaiting_user_input"] = False
        return state

    try:
        llm = get_llm(temperature=0.2, max_tokens=1000)
        system_prompt = _load_prompt()

        role_name = state.get("role_name", "")
        skills_required = state.get("skills_required", [])
        
        user_content = f"Current Role: {role_name}\nCurrent Skills: {', '.join(skills_required)}\n\nMarket Skills to evaluate:\n"
        for s in market_skills:
            user_content += f"- {s.get('skill')} (Found in: {s.get('source')}, Freq: {s.get('frequency', 1)})\n"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        response = await llm.ainvoke(messages)
        content = response.content.strip()

        if "```json" in content:
            json_str = content.split("```json")[-1].split("```")[0].strip()
        elif "```" in content:
            json_str = content.split("```")[-2].split("```")[-1].strip()
        else:
            json_str = content

        result = json.loads(json_str)
        ranked = result.get("ranked_skills", [])

        if ranked:
            formatted_skills = []
            for s in ranked:
                formatted_skills.append({
                    "skill": s.get("skill"),
                    "source": ", ".join(s.get("sources", [])) if isinstance(s.get("sources"), list) else s.get("source", "Market"),
                    "year": None,
                    "selected": True
                })
            
            # Replace raw with benchmarked
            state["market_skills_found"] = formatted_skills

        # Transition to user input for market card
        state["stage"] = "market_research"
        state["awaiting_user_input"] = True
        return state

    except Exception as e:
        logger.warning(f"Benchmarking node failed, using raw market skills: {e}")
        # Just use raw skills directly
        state["stage"] = "market_research"
        state["awaiting_user_input"] = True
        return state
