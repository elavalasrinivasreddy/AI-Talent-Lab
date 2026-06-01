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

async def extract_state_updates(state: AgentState, feedback_text: str) -> dict:
    """Quick LLM call to extract structured state updates (like new skills) from user feedback."""
    try:
        llm = get_llm(temperature=0.0)
        current_skills = state.get("skills_required", [])
        prompt = f"""You are an AI extracting state updates from user feedback on a Job Description.
Current required skills: {', '.join(current_skills)}
User Feedback: {feedback_text}

Extract any new skills or core requirements explicitly requested by the user that are not in the current required skills list.
Return a JSON object with:
{{
  "new_skills": ["Skill 1", "Skill 2"]
}}
If no new skills are mentioned, return an empty array. Do not include markdown formatting, just the raw JSON or wrapped in ```json.
"""
        response = await llm.ainvoke([{"role": "user", "content": prompt}])
        
        content_raw = response.content
        if isinstance(content_raw, list):
            # Extract text blocks if the model returns a list (e.g. multimodal blocks)
            content_raw = " ".join(
                str(b.get("text", b)) if isinstance(b, dict) else b 
                for b in content_raw
            )
        content = content_raw.strip()
        
        if "```json" in content:
            json_str = content.split("```json")[-1].split("```")[0].strip()
        elif "```" in content:
            json_str = content.split("```")[-2].split("```")[-1].strip()
        else:
            json_str = content
            
        try:
            result = json.loads(json_str)
        except json.JSONDecodeError:
            result = {}
            
        if not isinstance(result, dict):
            return {"new_skills": []}
            
        new_skills = result.get("new_skills", [])
        if not isinstance(new_skills, list):
            new_skills = [new_skills] if isinstance(new_skills, str) else []
            
        return {"new_skills": new_skills}
    except Exception as e:
        logger.error(f"State extraction failed: {e}")
        return {"new_skills": []}




async def run_drafting_variants(state: AgentState) -> AgentState:
    """
    Generate 3 JD variant styles.
    HARD STOP: retries once, then stays at jd_variants stage.
    """
    try:
        llm = get_llm(temperature=0.8, max_tokens=2500)
        system_prompt = _load_prompt()

        role_name = state.get("role_name", "")
        skills_required = state.get("skills_required") or []
        internal_accepted = state.get("internal_skills_accepted") or []
        market_accepted = state.get("market_skills_accepted") or []
        
        all_skills = skills_required + internal_accepted + market_accepted
        
        about_us = state.get("org_about_us", "An innovative tech company.")
        benefits = state.get("org_benefits_text", "Competitive salary and benefits.")

        refinement = state.get("variant_refinement")
        refinement_block = (
            f"\nREFINEMENT FROM PREVIOUS ROUND: {refinement}\n"
            if refinement else ""
        )

        user_content = f"""Mode: VARIANT_GENERATION

Role: {role_name}
All Required Skills: {', '.join(all_skills)}
Experience: {state.get('experience_min')} - {state.get('experience_max')} years
Location/Work Type: {state.get('location')} / {state.get('work_type')}
About Us: {about_us}
Benefits: {benefits}
{refinement_block}
Generate the 3 JD variants now."""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        logger.info(f"Generating 3 JD variants for {role_name}")
        response = await llm.ainvoke(messages)
        
        content_raw = response.content
        if isinstance(content_raw, list):
            content_raw = " ".join(
                str(b.get("text", b)) if isinstance(b, dict) else b 
                for b in content_raw
            )
        content = content_raw.strip()

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
        state.pop("variant_refinement", None)  # one-shot
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
            state["error_stage"] = "jd_variants"
            state["error_code"] = "VARIANTS_FAILED"
            state["error_message"] = "Trouble generating JD variants. Click Retry to try again."
            state["jd_variants"] = []
            state["awaiting_user_input"] = False
        else:
            # Silently pass to allow orchestrator to retry immediately or state machine to loop
            pass

        return state


async def run_drafting_final(state: AgentState, token_queue=None) -> AgentState:
    """
    Generate final JD based on selected variant.

    If `token_queue` is provided, stream tokens via `llm.astream()` and put each
    chunk onto the queue. Otherwise fall back to `ainvoke` (used by tests and
    the JD_STREAM_LIVE=0 fallback path).
    """
    try:
        streaming = token_queue is not None
        llm = get_llm(temperature=0.6, max_tokens=3000, streaming=streaming)

        system_prompt = _load_prompt()

        role_name = state.get("role_name", "")
        selected_style = state.get("selected_variant", "hybrid")

        variants = state.get("jd_variants", [])
        chosen_variant_summary = next(
            (v.get("summary") for v in variants if v.get("type") == selected_style), ""
        )

        skills_required = state.get("skills_required") or []
        internal_accepted = state.get("internal_skills_accepted") or []
        market_accepted = state.get("market_skills_accepted") or []
        all_skills = skills_required + internal_accepted + market_accepted

        about_us = state.get("org_about_us", "An innovative tech company.")
        benefits = state.get("org_benefits_text", "Competitive salary and benefits.")

        # Refinement context — either an existing user message during final_jd
        # (legacy path) or a Phase 2 `section_rewrite` payload set by the
        # rewrite_section action handler.
        feedback = ""
        section_rewrite = state.get("section_rewrite")
        current_jd = state.get("final_jd", "")
        
        if section_rewrite and section_rewrite.get("instruction"):
            section = section_rewrite.get("section") or "the entire JD"
            if current_jd:
                feedback = (
                    f"\n\nCURRENT JD DRAFT:\n{current_jd}\n\nUSER REWRITE REQUEST for {section}:\n"
                    f"{section_rewrite['instruction']}\n\nUpdate the current JD draft to address the request, preserving other existing content."
                )
            else:
                feedback = (
                    f"\n\nUSER REWRITE REQUEST for {section}:\n"
                    f"{section_rewrite['instruction']}"
                )
        else:
            user_msgs = [m for m in state.get("messages", []) if m["role"] == "user"]
            if user_msgs and state.get("user_action") == "message" and state.get("stage") == "final_jd":
                feedback_text = user_msgs[-1]["content"]
                
                # 1. State Extraction
                extracted = await extract_state_updates(state, feedback_text)
                new_skills = extracted.get("new_skills", [])
                if new_skills:
                    state["skills_required"] = list(set(skills_required + new_skills))
                    skills_required = state["skills_required"]
                    all_skills = skills_required + internal_accepted + market_accepted
                    
                # 2. Smart Re-compiler prompt
                if current_jd:
                    feedback = f"\n\nCURRENT JD DRAFT:\n{current_jd}\n\nUSER REVISION REQUEST:\n{feedback_text}\n\nUpdate the current JD draft to address the user's request, preserving existing content where appropriate. Integrate any new requirements seamlessly."
                else:
                    feedback = f"\n\nUSER REFINEMENT REQUEST:\n{feedback_text}"

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

        if streaming:
            parts: list[str] = []
            async for chunk in llm.astream(messages):
                text = getattr(chunk, "content", "") or ""
                if text:
                    parts.append(text)
                    await token_queue.put(text)
            content = "".join(parts).strip()
        else:
            response = await llm.ainvoke(messages)
            
            content_raw = response.content
            if isinstance(content_raw, list):
                content_raw = " ".join(
                    str(b.get("text", b)) if isinstance(b, dict) else b 
                    for b in content_raw
                )
            content = content_raw.strip()

        # An empty completion (e.g. a filtered/blank model response) must be treated
        # as a failure, not stored as the JD — otherwise the orchestrator re-enters
        # this node every loop until max_iterations with no error surfaced.
        if not (content or "").strip():
            raise ValueError("Model returned an empty final JD")

        state["final_jd"] = content
        state["stage"] = "final_jd"
        state["awaiting_user_input"] = False
        state["error_stage"] = None
        state["error_code"] = None
        state["error_message"] = None
        state["retry_count"] = 0
        # Consume one-shot section rewrite payload so the next turn doesn't re-apply it
        state.pop("section_rewrite", None)

        return state

    except Exception as e:
        logger.error(f"Drafting final failed: {e}")
        state["retry_count"] = state.get("retry_count", 0) + 1

        if state["retry_count"] >= 2:
            state["error_stage"] = "final_jd"
            state["error_code"] = "FINAL_JD_FAILED"
            state["error_message"] = "Connection interrupted. Click Regenerate to continue."

        return state
