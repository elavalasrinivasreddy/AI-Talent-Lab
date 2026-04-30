"""
services/chat_service.py – Business logic for recruiter JD generation chat.
Orchestrates the LangGraph agent state and SSE stream streaming.
"""
import asyncio
import json
import logging
from typing import AsyncGenerator, Optional, Any

from backend.agents.orchestrator import run_agent
from backend.agents.state import create_initial_state
from backend.agents.streaming import StreamHandler
from backend.db.repositories.sessions import ChatSessionRepository
from backend.db.repositories.organizations import OrgRepository
from backend.db.repositories.positions import PositionRepository
from backend.db.repositories.pipeline_events import PipelineEventRepository
from backend.db.repositories.audit import AuditLogRepository
from backend.db.vector_store import embed_jd
from backend.db.connection import get_connection
from backend.adapters.llm.factory import get_embedding_model


logger = logging.getLogger(__name__)

# Greeting message per docs/12_chat_flows.md §1.1
GREETING_MESSAGE = (
    "Hi! I'm your AI hiring assistant. 👋\n\n"
    "Let's create a job description together. What role are you looking to fill?\n\n"
    "You can also upload an existing JD if you'd like me to start from that."
)


class ChatService:

    @staticmethod
    async def get_or_create_session(
        session_id: str,
        org_id: int,
        user_id: int,
        department_id: Optional[int] = None
    ) -> dict[str, Any]:
        """Fetch an existing session or start a new one and populate org context."""
        session = await ChatSessionRepository.get(session_id, org_id)

        if session:
            return session

        # Create new session
        await ChatSessionRepository.create(session_id, org_id, user_id, department_id)

        # Pull org context for Drafting and Intake
        async with get_connection() as conn:
            org_row = await OrgRepository.get_by_id(conn, org_id)

        state = create_initial_state(session_id, org_id, user_id, department_id)
        if org_row:
            state["org_about_us"] = org_row.get("about_us")
            state["org_culture_keywords"] = org_row.get("culture_keywords")
            state["org_benefits_text"] = org_row.get("benefits_text")

        # Add greeting message to state per docs/12_chat_flows.md §1.1
        state["messages"] = [
            {"role": "assistant", "content": GREETING_MESSAGE}
        ]

        # Save initial state back
        await ChatSessionRepository.update_state(session_id, org_id, "intake", state)
        # Also persist greeting to message log
        await ChatSessionRepository.add_message(session_id, "assistant", GREETING_MESSAGE)

        # Re-fetch full structured session
        return await ChatSessionRepository.get(session_id, org_id)


    @staticmethod
    async def run_chat_stream(
        session_id: str,
        org_id: int,
        user_message: Optional[str] = None,
        action: Optional[str] = None,
        action_data: Optional[dict] = None
    ) -> AsyncGenerator[str, None]:
        """
        Executes the agent graph in a stateful manner and yields SSE formatted events.
        """
        session_row = await ChatSessionRepository.get(session_id, org_id)
        if not session_row:
            yield StreamHandler.emit_error("NOT_FOUND", "Session not found.")
            return

        state = session_row.get("graph_state_parsed", {})
        if not state:
            state = create_initial_state(session_id, org_id, session_row.get("user_id"))

        # Save user message to DB message log immediately
        if user_message:
            await ChatSessionRepository.add_message(session_id, "user", user_message)

        initial_stage = state.get("stage", "intake")

        try:
            # ── Run the pipeline ──────────────────────────────────────
            new_state = await run_agent(
                state=state,
                user_message=user_message,
                action=action,
                action_data=action_data
            )

            current_stage = new_state.get("stage")

            # ── Emit stage change if it changed ───────────────────────
            if current_stage != initial_stage:
                yield StreamHandler.emit_stage_change(current_stage)

            # ── Emit errors ───────────────────────────────────────────
            if new_state.get("error_stage"):
                yield StreamHandler.emit_error(
                    new_state["error_code"],
                    new_state["error_message"]
                )

            # ── Title update (role extracted) ──────────────────────────
            old_title = session_row.get("title")
            new_role_name = new_state.get("role_name")
            if new_role_name and (not old_title or old_title == "New Hire") and new_role_name != old_title:
                await ChatSessionRepository.update_title(session_id, org_id, new_role_name)
                yield StreamHandler.emit_title_update(new_role_name)

            # ── Emit new assistant text messages ──────────────────────
            if new_state.get("messages") and user_message:
                last_msg = new_state["messages"][-1]
                if last_msg.get("role") == "assistant":
                    yield StreamHandler.emit_token(last_msg["content"])
                    await ChatSessionRepository.add_message(
                        session_id, "assistant", last_msg["content"]
                    )

            # ── Emit interactive cards based on state ─────────────────
            if new_state.get("awaiting_user_input"):
                internal_skills = new_state.get("internal_skills_found", [])
                market_skills = new_state.get("market_skills_found", [])
                jd_variants = new_state.get("jd_variants", [])

                if internal_skills and current_stage in ("internal_check", "market_research"):
                    # Internal card — stage may have already been set to market_research
                    # but we still need to show the card if awaiting
                    if not new_state.get("internal_skipped") and not new_state.get("internal_skills_accepted"):
                        yield StreamHandler.emit_card_internal(internal_skills)

                if market_skills and current_stage == "market_research":
                    if not new_state.get("market_skipped") and not new_state.get("market_skills_accepted"):
                        competitors = new_state.get("competitors_used", [])
                        yield StreamHandler.emit_card_market(
                            market_skills,
                            "Market Analysis Complete.",
                            competitors
                        )

                if jd_variants and current_stage == "jd_variants":
                    yield StreamHandler.emit_card_variants(jd_variants)

            # ── Stream final JD token by token ────────────────────────
            if current_stage in ("complete", "final_jd") and new_state.get("final_jd"):
                final_text = new_state["final_jd"]
                # Stream word-by-word for natural typing effect
                words = final_text.split(" ")
                for word in words:
                    yield StreamHandler.emit_jd_token(word + " ")
                    await asyncio.sleep(0.012)

            # ── Bias check card ───────────────────────────────────────
            if current_stage == "complete" and new_state.get("bias_issues") is not None:
                issues = new_state.get("bias_issues", [])
                yield StreamHandler.emit_card_bias(issues, len(issues) == 0)

            # ── Persist state back to DB ──────────────────────────────
            await ChatSessionRepository.update_state(
                session_id, org_id, current_stage, new_state
            )

            # ── End stream ────────────────────────────────────────────
            yield StreamHandler.emit_done()

        except Exception as e:
            logger.error(f"Error in chat stream: {e}", exc_info=True)
            yield StreamHandler.emit_error(
                "UNEXPECTED_ERROR",
                "An unexpected error occurred during processing."
            )
            yield StreamHandler.emit_done()


    @staticmethod
    async def finish_and_save_position(
        session_id: str,
        org_id: int,
        user_id: int,
        setup_data: dict
    ) -> dict[str, Any]:
        """
        Takes the final JD and variants from the session, creates a Position,
        generates the JD embedding, and triggers the Celery candidate pipeline.
        """
        session_row = await ChatSessionRepository.get(session_id, org_id)
        if not session_row:
            raise ValueError("Session not found")

        state = session_row.get("graph_state_parsed", {})

        role_name = setup_data.get("role_name") or state.get("role_name")
        department_id = setup_data.get("department_id") or session_row.get("department_id")
        if not department_id:
            raise ValueError("Department ID is required to create a position")

        final_jd = state.get("final_jd")

        async with get_connection() as conn:
            position = await PositionRepository.create(
                conn=conn,
                org_id=org_id,
                department_id=department_id,
                session_id=session_id,
                role_name=role_name,
                jd_markdown=final_jd,
                jd_variant_selected=state.get("selected_variant"),
                status="open",   # Activate immediately on save
                headcount=setup_data.get("headcount", 1),
                priority=setup_data.get("priority", "normal"),
                ats_threshold=setup_data.get("ats_threshold", 80.0),
                search_interval_hours=setup_data.get("search_interval_hours", 24),
                created_by=user_id,
                location=state.get("location"),
                work_type=state.get("work_type", "onsite"),
                employment_type=state.get("employment_type", "full_time"),
                experience_min=state.get("experience_min"),
                experience_max=state.get("experience_max")
            )

            position_id = position["id"]

            # Link session -> position
            await ChatSessionRepository.link_position(session_id, org_id, position_id)

            # Insert variants
            variants = state.get("jd_variants", [])
            if variants:
                for v in variants:
                    if v.get("type") == state.get("selected_variant"):
                        v["is_selected"] = True
                await PositionRepository.insert_variants(conn, position_id, variants)

            # Pipeline event: JD created
            await PipelineEventRepository.create(conn, {
                "org_id": org_id,
                "position_id": position_id,
                "user_id": user_id,
                "event_type": "jd_generated",
                "event_data": {"role_name": role_name, "variant": state.get("selected_variant")}
            })

            # Audit log
            await AuditLogRepository.create(conn, {
                "org_id": org_id,
                "user_id": user_id,
                "action": "position_created",
                "entity_type": "position",
                "entity_id": str(position_id),
                "details": json.dumps({"role_name": role_name, "department_id": department_id})
            })

        # ── Generate JD embedding for ATS scoring (§15) ──────────────────────
        try:
            embedding_model = get_embedding_model()
            jd_text_for_embedding = f"{role_name} {final_jd or ''}"
            embedding = await embedding_model.aembed_query(jd_text_for_embedding[:8000])
            async with get_connection() as conn:
                await PositionRepository.update_embedding(
                    conn, position_id, org_id, json.dumps(embedding)
                )
            logger.info(f"JD embedding stored for position {position_id}")
        except Exception as e:
            logger.warning(f"JD embedding (ATS) failed (non-blocking): {e}")

        # ── Embed JD in ChromaDB for internal check future sessions ──────────
        try:
            await embed_jd(
                position_id=position_id,
                org_id=org_id,
                department_id=department_id,
                role_name=role_name,
                jd_text=final_jd
            )
        except Exception as e:
            logger.warning(f"ChromaDB JD embedding failed (non-blocking): {e}")

        # ── Trigger Celery candidate pipeline ─────────────────────────────────
        try:
            from backend.tasks.candidate_pipeline import run_candidate_search
            run_candidate_search.delay(position_id, org_id, department_id, user_id)
            logger.info(f"Candidate pipeline task queued for position {position_id}")
        except Exception as e:
            logger.warning(f"Could not enqueue candidate pipeline (non-blocking): {e}")


        return position

