"""
agents/orchestrator.py – Core orchestrator for recruiter JD generation.
Manages sequential node execution with human-in-the-loop pause points.
Error recovery relies on retry mechanism and soft skips in nodes.

Pipeline: INTAKE → INTERNAL_CHECK → MARKET_RESEARCH → BENCHMARKING → JD_VARIANTS → FINAL_JD → BIAS_CHECK → COMPLETE
"""
import logging
from typing import Optional

from backend.agents.state import AgentState
from backend.agents.nodes.interviewer import run_interviewer
from backend.agents.nodes.internal_analyst import run_internal_analyst
from backend.agents.nodes.market_intelligence import run_market_intelligence
from backend.agents.nodes.benchmarking import run_benchmarking
from backend.agents.nodes.drafting import run_drafting_variants, run_drafting_final
from backend.agents.bias_checker import check_bias

logger = logging.getLogger(__name__)


async def run_agent(
    state: dict,
    user_message: Optional[str] = None,
    action: Optional[str] = None,
    action_data: Optional[dict] = None
) -> dict:
    """
    Stateful runner for the recruiter chat pipeline.
    Resumes from the current stage, executes nodes sequentially,
    and pauses at human-in-the-loop checkpoints.

    Args:
        state: Current AgentState dict (loaded from DB).
        user_message: User's text message (mutually exclusive with action).
        action: Card action like 'accept_internal', 'skip_market', 'select_variant'.
        action_data: Payload for the action (e.g. selected skills list).

    Returns:
        Updated state dict after node execution.
    """
    # ── 1. Apply incoming user input to state ──────────────────────────
    if user_message:
        state["messages"] = state.get("messages", []) + [
            {"role": "user", "content": user_message}
        ]
        state["user_action"] = "message"
        state["user_action_data"] = {}
        state["awaiting_user_input"] = False

    elif action:
        state["user_action"] = action
        state["user_action_data"] = action_data or {}
        state["awaiting_user_input"] = False

        # Apply action effects
        if action == "accept_internal":
            accepted = action_data.get("skills", [])
            state["internal_skills_accepted"] = accepted
            state["stage"] = "market_research"

        elif action == "skip_internal":
            state["internal_skipped"] = True
            state["internal_skills_accepted"] = []
            state["stage"] = "market_research"

        elif action == "accept_market":
            accepted = action_data.get("skills", [])
            state["market_skills_accepted"] = accepted
            state["stage"] = "jd_variants"

        elif action == "skip_market":
            state["market_skipped"] = True
            state["market_skills_accepted"] = []
            state["stage"] = "jd_variants"

        elif action == "select_variant":
            state["selected_variant"] = action_data.get("variant_type")
            state["stage"] = "final_jd"

        elif action == "trigger_bias_check":
            state["stage"] = "bias_check"

        elif action == "finalize_jd":
            state["stage"] = "complete"
            state["final_jd"] = action_data.get("content", state.get("final_jd", ""))

    # ── 2. Sequential node execution based on current stage ────────────
    current_stage = state.get("stage", "intake")
    max_iterations = 6  # safety net against infinite loops

    for _ in range(max_iterations):
        if state.get("awaiting_user_input") or state.get("error_stage"):
            break

        if current_stage == "intake":
            state = await run_interviewer(state)
            # Interviewer either waits for user (more questions) or completes (stage -> internal_check)
            if state.get("stage") == "internal_check" and not state.get("error_stage"):
                current_stage = "internal_check"
                continue
            break

        elif current_stage == "internal_check":
            state = await run_internal_analyst(state)
            if state.get("awaiting_user_input"):
                break  # Show InternalCheckCard
            # Auto-skipped, advance
            if state.get("stage") == "market_research":
                current_stage = "market_research"
                continue
            break

        elif current_stage == "market_research":
            state = await run_market_intelligence(state)
            # Market intel may transition to benchmarking
            if state.get("stage") == "benchmarking":
                state = await run_benchmarking(state)
            if state.get("awaiting_user_input"):
                break  # Show MarketResearchCard
            # Auto-skipped, advance
            if state.get("stage") == "jd_variants":
                current_stage = "jd_variants"
                continue
            break

        elif current_stage == "jd_variants":
            state = await run_drafting_variants(state)
            break  # Always pause here for user to select variant

        elif current_stage == "final_jd":
            state = await run_drafting_final(state)
            if not state.get("error_stage"):
                # No longer run bias check automatically. Wait for user to trigger or finalize.
                state["awaiting_user_input"] = True
                state["stage"] = "final_jd"
            break

        elif current_stage == "bias_check":
            # Manual trigger for bias check
            try:
                issues = await check_bias(state.get("final_jd", ""))
                state["bias_issues"] = issues
                state["bias_skipped"] = False
            except Exception as e:
                logger.warning(f"Bias check failed: {e}")
                state["bias_issues"] = []
                state["bias_skipped"] = True
            
            state["awaiting_user_input"] = True
            break

        elif current_stage == "complete":
            break

        else:
            logger.warning(f"Unknown stage: {current_stage}")
            break

    return state
