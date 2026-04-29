"""
agents/nodes/interviewer.py – Intake conversation node.
Uses CoT (Chain-of-Thought) prompting with temperature=0.7 for natural conversation.
Detects completion via structured JSON in LLM response.
HARD STOP on failure — stays at intake stage.
"""
import json
import logging
import os
from typing import Any

from backend.adapters.llm.factory import get_llm
from backend.agents.state import AgentState, ChatMessage
from backend.agents.tools.role_extractor import extract_role

logger = logging.getLogger(__name__)

# Load system prompt from markdown file
_PROMPT_PATH = os.path.join(os.path.dirname(__file__), "..", "prompts", "interviewer.md")

def _load_prompt() -> str:
    with open(_PROMPT_PATH, "r") as f:
        return f.read()


async def run_interviewer(state: AgentState) -> AgentState:
    """
    Intake conversation node. Gathers job requirements through natural conversation.

    - Processes user message and generates AI response
    - Extracts role name from first relevant message
    - Detects when all required info is gathered (completion JSON)
    - HARD STOP: On LLM failure, stays at intake, increments retry_count

    Returns updated state with new messages and possibly intake_complete data.
    """
    try:
        llm = get_llm(temperature=0.7, max_tokens=1000)
        system_prompt = _load_prompt()

        # Build conversation history for LLM
        llm_messages: list[dict[str, str]] = [
            {"role": "system", "content": system_prompt}
        ]

        # Add context about reference JD if uploaded
        if state.get("reference_jd_text"):
            llm_messages.append({
                "role": "system",
                "content": f"The user uploaded a reference JD. Here is the extracted text:\n\n{state['reference_jd_text'][:3000]}"
            })

        # Add chat history
        for msg in state.get("messages", []):
            if msg["role"] in ("user", "assistant"):
                llm_messages.append({
                    "role": msg["role"],
                    "content": msg["content"],
                })

        # Call LLM
        response = await llm.ainvoke(llm_messages)
        ai_content = response.content.strip()

        # Try to extract role name from conversation if not yet set
        if not state.get("role_name"):
            # Check recent user messages for role mentions
            user_msgs = [m for m in state.get("messages", []) if m["role"] == "user"]
            if user_msgs:
                last_user_msg = user_msgs[-1]["content"]
                extracted_role = await extract_role(last_user_msg)
                if extracted_role:
                    state["role_name"] = extracted_role

        # Check if LLM response contains completion JSON
        intake_data = _extract_completion_data(ai_content)

        if intake_data:
            # Update state with extracted requirements
            state["role_name"] = intake_data.get("role_name", state.get("role_name"))
            state["experience_min"] = intake_data.get("experience_min")
            state["experience_max"] = intake_data.get("experience_max")
            state["skills_required"] = intake_data.get("skills_required", [])
            state["location"] = intake_data.get("location")
            state["work_type"] = intake_data.get("work_type")
            state["employment_type"] = intake_data.get("employment_type", "full_time")

            # Clean the JSON from the visible message
            clean_content = _strip_completion_json(ai_content)

            # Add AI message (without JSON)
            state["messages"] = state.get("messages", []) + [
                ChatMessage(role="assistant", content=clean_content)
            ]

            # Mark stage transition
            state["stage"] = "internal_check"
            state["awaiting_user_input"] = False
            state["retry_count"] = 0

            logger.info(
                f"Intake complete for session {state.get('session_id')}: "
                f"role={state['role_name']}, skills={state['skills_required']}"
            )
        else:
            # Normal conversation turn — add response and wait for user
            state["messages"] = state.get("messages", []) + [
                ChatMessage(role="assistant", content=ai_content)
            ]
            state["awaiting_user_input"] = True

        # Clear any previous errors
        state["error_stage"] = None
        state["error_code"] = None
        state["error_message"] = None

        return state

    except Exception as e:
        logger.error(f"Interviewer node failed: {e}")
        state["retry_count"] = state.get("retry_count", 0) + 1

        if state["retry_count"] >= 3:
            state["error_stage"] = "intake"
            state["error_code"] = "INTAKE_FAILED"
            state["error_message"] = "Please start a new session."
        else:
            state["error_stage"] = "intake"
            state["error_code"] = "INTAKE_ERROR"
            state["error_message"] = "I had trouble processing that. Could you rephrase?"

            state["messages"] = state.get("messages", []) + [
                ChatMessage(
                    role="assistant",
                    content="I had trouble processing that. Could you rephrase your requirements?"
                )
            ]
            state["awaiting_user_input"] = True

        return state


def _extract_completion_data(content: str) -> dict[str, Any] | None:
    """Extract intake_complete JSON from LLM response, if present."""
    try:
        # Look for JSON block with intake_complete
        if "intake_complete" not in content:
            return None

        # Try to find JSON in code fences first
        if "```json" in content:
            json_str = content.split("```json")[-1].split("```")[0].strip()
        elif "```" in content:
            json_str = content.split("```")[-2].split("```")[-1].strip()
        else:
            # Try to find raw JSON line
            for line in content.split("\n"):
                line = line.strip()
                if line.startswith("{") and "intake_complete" in line:
                    json_str = line
                    break
            else:
                return None

        data = json.loads(json_str)
        if data.get("intake_complete"):
            return data
        return None

    except (json.JSONDecodeError, IndexError, ValueError):
        return None


def _strip_completion_json(content: str) -> str:
    """Remove the completion JSON from the visible message."""
    # Remove code-fenced JSON blocks
    if "```json" in content:
        parts = content.split("```json")
        before = parts[0]
        after = parts[-1].split("```", 1)[-1] if "```" in parts[-1] else ""
        return (before + after).strip()

    # Remove raw JSON lines
    lines = content.split("\n")
    clean_lines = [
        line for line in lines
        if not (line.strip().startswith("{") and "intake_complete" in line)
    ]
    return "\n".join(clean_lines).strip()
