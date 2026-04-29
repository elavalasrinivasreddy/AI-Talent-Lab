"""
agents/nodes/drafting.py – Drafts JD variants and the final JD.
Two modes:
1. generate_variants (temp=0.8, JSON output)
2. generate_final (temp=0.6, markdown streaming)

HARD STOP on failure — retries once before surfacing error.
"""
import json
import logging
import os

from backend.adapters.llm.factory import get_llm
from backend.agents.state import AgentState

logger = logging.getLogger(__name__)

_PROMPT_PATH = os.path.join(os.path.dirname(__file__), "..", "prompts", "drafting.md")

def _load_prompt() -> str:
    with open(_PROMPT_PATH, "r") as f:
        return f.read()


async def run_drafting_variants(state: AgentState) -> AgentState:
    """
    Generate 3 JD variant styles.
    HARD STOP: retries once, then stays at jd_variants stage.
    """
    try:
        llm = get_llm(temperature=0.8, max_tokens=2500)
        system_prompt = _load_prompt()

        role_name = state.get("role_name", "")
        skills_required = state.get("skills_required", [])
        internal_accepted = state.get("internal_skills_accepted", [])
        market_accepted = state.get("market_skills_accepted", [])
        
        all_skills = skills_required + internal_accepted + market_accepted
        
        about_us = state.get("org_about_us", "An innovative tech company.")
        benefits = state.get("org_benefits_text", "Competitive salary and benefits.")

        user_content = f"""Mode: VARIANT_GENERATION

Role: {role_name}
All Required Skills: {', '.join(all_skills)}
Experience: {state.get('experience_min')} - {state.get('experience_max')} years
Location/Work Type: {state.get('location')} / {state.get('work_type')}
About Us: {about_us}
Benefits: {benefits}

Generate the 3 JD variants now."""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        logger.info(f"Generating 3 JD variants for {role_name}")
        response = await llm.ainvoke(messages)
        content = response.content.strip()

        if "```json" in content:
            json_str = content.split("```json")[-1].split("```")[0].strip()
        elif "```" in content:
            json_str = content.split("```")[-2].split("```")[-1].strip()
        else:
            json_str = content

        result = json.loads(json_str)
        variants = result.get("variants", [])

        if len(variants) != 3:
            raise ValueError(f"Expected 3 variants, got {len(variants)}")

        state["jd_variants"] = variants
        state["stage"] = "jd_variants"
        state["awaiting_user_input"] = True
        state["error_stage"] = None
        state["error_code"] = None
        state["error_message"] = None
        state["retry_count"] = 0

        return state

    except Exception as e:
        logger.error(f"Drafting variants failed: {e}")
        state["retry_count"] = state.get("retry_count", 0) + 1

        if state["retry_count"] >= 2:
            state["error_stage"] = "variants"
            state["error_code"] = "VARIANTS_FAILED"
            state["error_message"] = "Trouble generating JD variants. Click Retry to try again."
            state["jd_variants"] = []
            state["awaiting_user_input"] = False
        else:
            # Silently pass to allow orchestrator to retry immediately or state machine to loop
            pass

        return state


async def run_drafting_final(state: AgentState) -> AgentState:
    """
    Generate final JD based on selected variant.
    (Note: Streaming is handled by the orchestrator passing callbacks. Here we just set the final text if not streaming, or this function could return just the state. For streaming we'll yield tokens from orchestrator. Here we just do the logic to get the final text directly if needed. But in LangGraph, we typically use the streaming callback handler.)
    """
    try:
        # In this architecture, final_jd generation is often streamed.
        # We will configure the LLM with streaming=False here just for state preservation,
        # but the orchestrator will likely bind a streaming LLM to this node if requested.
        # For simplicity, we just use ainvoke and rely on the callbacks passed in by LangGraph.
        llm = get_llm(temperature=0.6, max_tokens=3000)
        
        system_prompt = _load_prompt()
        
        role_name = state.get("role_name", "")
        selected_style = state.get("selected_variant", "hybrid")
        
        # Find the chosen variant to get structure clues
        variants = state.get("jd_variants", [])
        chosen_variant_summary = next((v.get("summary") for v in variants if v.get("type") == selected_style), "")

        skills_required = state.get("skills_required", [])
        internal_accepted = state.get("internal_skills_accepted", [])
        market_accepted = state.get("market_skills_accepted", [])
        all_skills = skills_required + internal_accepted + market_accepted

        about_us = state.get("org_about_us", "An innovative tech company.")
        benefits = state.get("org_benefits_text", "Competitive salary and benefits.")

        # User feedback for refinement
        feedback = ""
        user_msgs = [m for m in state.get("messages", []) if m["role"] == "user"]
        if user_msgs:
            # If the stage was already final_jd and user sent a message, it's refinement feedback
            # Check the last message if we want to augment prompt with it
            if state.get("user_action") == "message" and state.get("stage") == "final_jd":
                feedback = f"\n\nUSER REFINEMENT REQUEST:\n{user_msgs[-1]['content']}"

        user_content = f"""Mode: FINAL_GENERATION
Selected Style: {selected_style}
Style Note: {chosen_variant_summary}

Role: {role_name}
All Required Skills: {', '.join(all_skills)}
Experience: {state.get('experience_min')} - {state.get('experience_max')} years
Location/Work Type: {state.get('location')} / {state.get('work_type')}
About Us: {about_us}
Benefits: {benefits}{feedback}

Generate the final polished JD in markdown now."""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        logger.info(f"Generating final JD for {role_name} in style {selected_style}")
        # Note: If orchestrator passes callbacks in config, they apply here
        response = await llm.ainvoke(messages)
        content = response.content.strip()

        state["final_jd"] = content
        state["stage"] = "final_jd"
        state["awaiting_user_input"] = False
        state["error_stage"] = None
        state["error_code"] = None
        state["error_message"] = None
        state["retry_count"] = 0

        return state

    except Exception as e:
        logger.error(f"Drafting final failed: {e}")
        state["retry_count"] = state.get("retry_count", 0) + 1

        if state["retry_count"] >= 2:
            state["error_stage"] = "final_jd"
            state["error_code"] = "FINAL_JD_FAILED"
            state["error_message"] = "Connection interrupted. Click Regenerate to continue."
        
        return state
