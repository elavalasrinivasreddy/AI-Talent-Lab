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
    action_data: Optional[dict] = None,
    token_queue=None,
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
            if action_data.get("content"):
                state["final_jd"] = action_data["content"]

        elif action == "finalize_jd":
            draft_status = action_data.get("status", "active")
            state["final_jd"] = action_data.get("content", state.get("final_jd", ""))
            # Clear bias issues since the content was updated with fixes
            state.pop("bias_issues", None)
            if draft_status == "draft":
                # Draft: stay at final_jd, don't mark complete
                state["jd_saved_as_draft"] = True
                state["awaiting_user_input"] = True
                state["stage"] = "final_jd"  # Reset from bias_check if applicable
            else:
                state["stage"] = "complete"

        elif action == "apply_bias_fix":
            phrase = action_data.get("phrase", "")
            suggestion = action_data.get("suggestion", "")
            jd = state.get("final_jd", "")
            if phrase and phrase in jd:
                state["final_jd"] = jd.replace(phrase, suggestion, 1)
            # Drop one matching issue (the first occurrence) from the list
            issues = state.get("bias_issues", []) or []
            for idx, issue in enumerate(issues):
                if issue.get("phrase") == phrase:
                    issues.pop(idx)
                    break
            state["bias_issues"] = issues
            # Stay on bias_check, awaiting further user action
            state["stage"] = "bias_check"
            state["awaiting_user_input"] = True

        elif action == "edit_variant":
            variant_type = action_data.get("variant_type")
            new_summary = action_data.get("summary")
            variants = state.get("jd_variants", []) or []
            for v in variants:
                if v.get("type") == variant_type:
                    if new_summary is not None:
                        v["summary"] = new_summary
                    # Allow overwriting description / tone / skills_count if provided
                    for key in ("description", "tone", "skills_count"):
                        if key in action_data:
                            v[key] = action_data[key]
                    break
            state["jd_variants"] = variants
            state["stage"] = "jd_variants"
            state["awaiting_user_input"] = True

        elif action == "regenerate_variants":
            state["jd_variants"] = []
            refinement = action_data.get("refinement")
            if refinement:
                state["variant_refinement"] = refinement
            state["stage"] = "jd_variants"
            state["awaiting_user_input"] = False  # let the for-loop run drafting_variants

        elif action == "rewrite_section":
            state["section_rewrite"] = {
                "section": action_data.get("section"),
                "instruction": action_data.get("instruction", ""),
            }
            state["stage"] = "final_jd"
            state["awaiting_user_input"] = False  # re-enter drafting_final

        elif action == "retry_stage":
            failed = state.get("error_stage")
            if failed:
                state["retry_count"] = 0
                state["error_stage"] = None
                state["error_code"] = None
                state["error_message"] = None
                state["stage"] = failed
                state["awaiting_user_input"] = False

    # ── 2. Sequential node execution based on current stage ────────────
    # `_run_meta` is a transient state field (not persisted long-term — chat_service
    # consumes it on the same turn) that lets chat_service emit one SSE
    # `stage_change` per actual transition and one `stage_skipped` per soft-skip.
    # Without this, chat_service can only compare initial vs final stage and the
    # UI loses any intermediate transitions that happened during a single run.
    state["_run_meta"] = {"transitions": [], "skipped": []}

    def _record_transition(to_stage: str) -> None:
        state["_run_meta"]["transitions"].append(to_stage)

    def _record_skip(stage_name: str, reason: str) -> None:
        state["_run_meta"]["skipped"].append({"stage": stage_name, "reason": reason})

    current_stage = state.get("stage", "intake")
    max_iterations = 6  # safety net against infinite loops

    for _ in range(max_iterations):
        if state.get("awaiting_user_input") or state.get("error_stage"):
            break

        if current_stage == "intake":
            state = await run_interviewer(state)
            # Interviewer either waits for user (more questions) or completes (stage -> internal_check)
            if state.get("stage") == "internal_check" and not state.get("error_stage"):
                _record_transition("internal_check")
                current_stage = "internal_check"
                continue
            break

        elif current_stage == "internal_check":
            state = await run_internal_analyst(state)
            if state.get("awaiting_user_input"):
                break  # Show InternalCheckCard
            # Auto-skipped, advance
            if state.get("internal_skipped"):
                _record_skip("internal_check", "no past JDs to draw from")
            if state.get("stage") == "market_research":
                _record_transition("market_research")
                current_stage = "market_research"
                continue
            break

        elif current_stage == "market_research":
            state = await run_market_intelligence(state)
            # Market intel may transition to benchmarking
            if state.get("stage") == "benchmarking":
                _record_transition("benchmarking")
                state = await run_benchmarking(state)
            if state.get("awaiting_user_input"):
                break  # Show MarketResearchCard
            # Auto-skipped, advance
            if state.get("market_skipped"):
                _record_skip("market_research", "market scan unavailable or yielded no useful signals")
            if state.get("stage") == "jd_variants":
                _record_transition("jd_variants")
                current_stage = "jd_variants"
                continue
            break

        elif current_stage == "jd_variants":
            state = await run_drafting_variants(state)
            break  # Always pause here for user to select variant

        elif current_stage == "final_jd":
            state = await run_drafting_final(state, token_queue=token_queue)
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
                _record_skip("bias_check", "bias check unavailable")

            state["awaiting_user_input"] = True
            break

        elif current_stage == "complete":
            break

        else:
            logger.warning(f"Unknown stage: {current_stage}")
            break

    return state
