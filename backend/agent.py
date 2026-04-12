"""
agent.py – LangGraph-powered Hiring Agent (Production)

Sequential human-in-the-loop flow:
  "intake"          → Interviewer is gathering requirements
  "internal_review" → Internal check done, user selecting skills
  "market_review"   → Market check done, user selecting skills
  "jd_variants"     → 3 JD overviews shown, user picks one
  "done"            → Final JD generated
"""
import sys
import json
import traceback
from backend import session_store
from backend.tools import extract_role_name_from_message
from backend.state import AgentState
from backend.nodes import (
    interviewer_node,
    internal_analyst_node,
    market_intelligence_node,
    benchmarking_node,
    drafting_node,
)
from backend.config import get_llm
from langchain_core.messages import SystemMessage, HumanMessage


class HiringAgent:
    """Stage-aware hiring agent with human-in-the-loop pauses."""

    # ── Non-streaming run (legacy, kept for backward compatibility) ────────
    def run(self, session_id: str | None, user_message: str) -> dict:
        is_new = session_id is None or not session_store.session_exists(session_id)

        if is_new:
            session_id = session_store.create_session()

        # ── Title extraction ───────────────────────────────────────────────
        title_updated = False
        current_state = session_store.get_graph_state(session_id)
        is_first_message = not current_state.get("messages")

        if is_first_message:
            try:
                role_name = extract_role_name_from_message(user_message)
                session_store.update_title(session_id, role_name)
                current_state["role_name"] = role_name
                current_state["session_id"] = session_id
                title_updated = True
            except Exception as e:
                print(f"⚠️ Role extraction failed: {e}", file=sys.stderr)

        # Ensure required state fields
        current_state.setdefault("messages", [])
        current_state.setdefault("session_id", session_id)
        current_state.setdefault("workflow_stage", "intake")
        current_state.setdefault("role_name", "New Hire")

        # Append user message
        current_state["messages"].append({"role": "user", "content": user_message})

        # ── Route to the correct stage handler ────────────────────────────
        try:
            updated_state = self._handle_stage(current_state, user_message)
        except Exception as e:
            print(f"❌ Agent error: {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            raise

        # Persist
        session_store.update_graph_state(session_id, updated_state)

        # Extract last assistant reply
        msgs = updated_state.get("messages", [])
        reply = next(
            (m["content"] for m in reversed(msgs) if m.get("role") == "assistant"),
            "Processing your request…"
        )

        stage = updated_state.get("workflow_stage", "intake")

        return {
            "session_id": session_id,
            "title": updated_state.get("role_name", "New Hire"),
            "title_updated": title_updated,
            "reply": reply,
            "ready_to_generate": bool(updated_state.get("final_jd_markdown")),
            "requests_upload": False,
            "workflow_stage": stage,
            "internal_recommendations": updated_state.get("internal_recommendations") if stage == "internal_review" else None,
            "market_recommendations": updated_state.get("market_recommendations") if stage == "market_review" else None,
            "competitors": updated_state.get("competitors") if stage == "market_review" else None,
            "baseline_requirements": updated_state.get("baseline_requirements"),
            "final_jd_markdown": updated_state.get("final_jd_markdown") if stage == "done" else None,
            "jd_overviews": updated_state.get("jd_overviews") if stage == "jd_variants" else None,
        }

    # ── Streaming run (SSE) ────────────────────────────────────────────────
    def run_stream(self, session_id: str | None, user_message: str, user: dict = None):
        """
        Generator that yields SSE events as dicts:
          {"event": "metadata", "data": {...}}   – session info, workflow data
          {"event": "token",    "data": "..."}   – streamed text chunk
          {"event": "done",     "data": {...}}   – final state
        """
        print(f"\n{'='*60}", file=sys.stderr)
        print(f"🔵 run_stream called | session={session_id} | user={user}", file=sys.stderr)
        is_new = session_id is None or not session_store.session_exists(session_id)
        if is_new:
            session_id = session_store.create_session()

        # ── Title extraction ───────────────────────────────────────────────
        title_updated = False
        current_state = session_store.get_graph_state(session_id)

        current_state.setdefault("messages", [])
        current_state.setdefault("session_id", session_id)
        current_state.setdefault("workflow_stage", "intake")
        current_state.setdefault("role_name", "New Hire")
        # Store org_id from authenticated user for position saving
        if user and "org_id" in user:
            current_state["org_id"] = user["org_id"]
            print(f"✅ org_id set from user JWT: {user['org_id']}", file=sys.stderr)
        else:
            print(f"⚠️ No org_id from user. user={user}", file=sys.stderr)

        # Extract title if role_name is still the default (handles PDF pre-injection)
        if current_state.get("role_name") == "New Hire":
            try:
                role_name = extract_role_name_from_message(user_message)
                session_store.update_title(session_id, role_name)
                current_state["role_name"] = role_name
                current_state["session_id"] = session_id
                title_updated = True
            except Exception as e:
                print(f"⚠️ Role extraction failed: {e}", file=sys.stderr)

        current_state["messages"].append({"role": "user", "content": user_message})

        # Send initial metadata (session info)
        yield {
            "event": "metadata",
            "data": {
                "session_id": session_id,
                "title": current_state.get("role_name", "New Hire"),
                "title_updated": title_updated,
            }
        }

        # ── Route to correct stage (streaming-aware) ──────────────────────
        stage = current_state.get("workflow_stage", "intake")

        try:
            if stage == "intake":
                yield from self._stream_intake(current_state)
            elif stage == "internal_review":
                yield from self._stream_market_analysis(current_state)
            elif stage == "market_review":
                yield from self._stream_jd_overviews(current_state, user_message)
            elif stage == "jd_variants":
                yield from self._stream_drafting(current_state)
            elif stage == "done":
                current_state["messages"].append({
                    "role": "assistant",
                    "content": "Your JD has already been generated. You can edit it in the editor below or download it as PDF/Markdown."
                })
                yield {"event": "token", "data": "Your JD has already been generated. You can edit it in the editor below or download it as PDF/Markdown."}
            else:
                yield from self._stream_intake(current_state)
        except Exception as e:
            print(f"❌ Agent stream error: {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            yield {"event": "error", "data": str(e)}
            return

        # Persist state
        session_store.update_graph_state(session_id, current_state)

        # Final done event with full state snapshot
        final_stage = current_state.get("workflow_stage", "intake")
        yield {
            "event": "done",
            "data": {
                "session_id": session_id,
                "title": current_state.get("role_name", "New Hire"),
                "title_updated": title_updated,
                "workflow_stage": final_stage,
                "internal_recommendations": current_state.get("internal_recommendations") if final_stage == "internal_review" else None,
                "market_recommendations": current_state.get("market_recommendations") if final_stage == "market_review" else None,
                "competitors": current_state.get("competitors") if final_stage == "market_review" else None,
                "baseline_requirements": current_state.get("baseline_requirements"),
                "final_jd_markdown": current_state.get("final_jd_markdown") if final_stage == "done" else None,
                "jd_overviews": current_state.get("jd_overviews") if final_stage == "jd_variants" else None,
            }
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Streaming stage handlers
    # ─────────────────────────────────────────────────────────────────────────

    def _stream_intake(self, state: dict):
        """Stream the interviewer's response token-by-token."""
        from backend.nodes import _load_prompt, _INTAKE_COMPLETE_RE
        from langchain_core.messages import AIMessage

        llm = get_llm(streaming=True)
        sys_prompt = _load_prompt("interviewer_agent.md")

        lc_messages = [SystemMessage(content=sys_prompt)]
        for msg in state.get("messages", []):
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "user":
                lc_messages.append(HumanMessage(content=content))
            elif role == "assistant":
                lc_messages.append(AIMessage(content=content))

        # Stream tokens from LLM, buffering to strip [INTAKE_COMPLETE] marker
        MARKER = "[INTAKE_COMPLETE]"
        MARKER_LEN = len(MARKER)
        full_text = ""
        buffer = ""

        for chunk in llm.stream(lc_messages):
            token = chunk.content
            if token:
                full_text += token
                buffer += token

                # Only flush buffer content that can't be part of the marker
                while len(buffer) > MARKER_LEN:
                    # Check if marker starts anywhere in the buffer
                    marker_pos = buffer.find(MARKER)
                    if marker_pos >= 0:
                        # Found marker — flush everything before it, skip the marker
                        if marker_pos > 0:
                            yield {"event": "token", "data": buffer[:marker_pos]}
                        buffer = buffer[marker_pos + MARKER_LEN:]
                    else:
                        # Safe to flush one char at a time up to the safe boundary
                        safe_len = len(buffer) - MARKER_LEN
                        if safe_len > 0:
                            yield {"event": "token", "data": buffer[:safe_len]}
                            buffer = buffer[safe_len:]
                        break

        # Flush remaining buffer (strip any marker)
        if buffer:
            remaining = buffer.replace(MARKER, "")
            if remaining:
                yield {"event": "token", "data": remaining}

        # Post-process: check intake completion
        is_complete = bool(_INTAKE_COMPLETE_RE.search(full_text))
        clean_reply = _INTAKE_COMPLETE_RE.sub("", full_text).strip()
        lines = [l.rstrip() for l in clean_reply.splitlines()]
        while lines and not lines[-1]:
            lines.pop()
        clean_reply = "\n".join(lines)

        state["messages"].append({"role": "assistant", "content": clean_reply})

        if is_complete:
            conversation_text = "\n".join(
                f"{m['role'].upper()}: {m['content']}" for m in state["messages"]
            )
            state["baseline_requirements"] = conversation_text

            from backend.db.database import save_position
            org_id = state.get("org_id")
            print(f"📝 save_position (intake) | session={state.get('session_id')} | role={state.get('role_name')} | org_id={org_id}", file=sys.stderr)
            save_position(session_id=state.get("session_id", "unknown"),
                         role_name=state.get("role_name", "Unknown Role"),
                         org_id=org_id)

            # Run internal analyst (non-streaming, returns JSON)
            internal_result = internal_analyst_node(state)
            state.update(internal_result)

            internal_data = state.get("internal_recommendations", {})
            skills = internal_data.get("skills", []) if isinstance(internal_data, dict) else []
            summary = internal_data.get("summary", "") if isinstance(internal_data, dict) else ""

            if skills:
                msg = (
                    f"\n\n✅ **Requirements captured!** I've checked our internal hiring history.\n\n"
                    f"{summary}\n\n"
                    f"I found **{len(skills)} additional skills** from past hires for similar roles. "
                    f"Select the ones you'd like to include, then click **Accept Selected** or **Skip All**."
                )
            else:
                msg = (
                    "\n\n✅ **Requirements captured!** I checked our internal history — "
                    "no closely matching past JDs were found for this role. "
                    "Moving on to market benchmarking..."
                )

            # Emit card intro as card_text (creates a NEW bubble, not appended to LLM bubble)
            yield {"event": "card_text", "data": msg.strip()}

            state["messages"].append({"role": "assistant", "content": msg.strip()})
            state["workflow_stage"] = "internal_review"

            # Emit metadata with the recommendations
            yield {
                "event": "metadata",
                "data": {
                    "workflow_stage": "internal_review",
                    "internal_recommendations": state.get("internal_recommendations"),
                }
            }
        else:
            state["workflow_stage"] = "intake"

    def _stream_market_analysis(self, state: dict):
        """Run market intelligence + benchmarking. Emit metadata with results."""
        # Parse accepted internal skills from the user's last message
        last_user_msg = ""
        for m in reversed(state.get("messages", [])):
            if m.get("role") == "user":
                last_user_msg = m.get("content", "")
                break

        if "internal skills accepted:" in last_user_msg.lower():
            # Extract skill names from "Internal skills accepted: Redis, AWS, Machine learning, ..."
            try:
                skills_part = last_user_msg.split(":", 1)[1].split(".")[0].strip()
                accepted_names = [s.strip() for s in skills_part.split(",") if s.strip()]
                state["accepted_internal_skills"] = accepted_names
            except Exception:
                state["accepted_internal_skills"] = []
        elif "skipped" in last_user_msg.lower():
            state["accepted_internal_skills"] = []

        market_result = market_intelligence_node(state)
        state.update(market_result)

        bench_result = benchmarking_node(state)
        state.update(bench_result)

        market_data = state.get("market_recommendations", {})
        missing = market_data.get("missing_skills", []) if isinstance(market_data, dict) else []
        diff = market_data.get("differential_skills", []) if isinstance(market_data, dict) else []
        total = len(missing) + len(diff)
        summary = market_data.get("summary", "") if isinstance(market_data, dict) else ""

        msg = (
            f"🌐 **Market Benchmarking Complete**\n\n"
            f"{summary}\n\n"
            f"Found **{total} skills** from competitor JDs. "
            f"Select the ones to include, then click **Accept Selected** or **Skip All**."
        )

        # Emit card intro as card_text (creates a NEW bubble)
        yield {"event": "card_text", "data": msg}

        state["messages"].append({"role": "assistant", "content": msg})
        state["workflow_stage"] = "market_review"

        yield {
            "event": "metadata",
            "data": {
                "workflow_stage": "market_review",
                "market_recommendations": state.get("market_recommendations"),
                "competitors": state.get("competitors"),
            }
        }

    def _stream_jd_overviews(self, state: dict, user_message: str):
        """Generate 3 JD overviews (non-streaming JSON), then stream the UI message."""
        # Parse accepted market skills from user's message
        if "market skills accepted:" in user_message.lower():
            try:
                skills_part = user_message.split(":", 1)[1].split(".")[0].strip()
                accepted_names = [s.strip() for s in skills_part.split(",") if s.strip()]
                state["accepted_market_skills"] = accepted_names
            except Exception:
                state["accepted_market_skills"] = []
        elif "skipped" in user_message.lower():
            state["accepted_market_skills"] = []

        role_name = state.get("role_name", "Unknown Role")
        baseline = state.get("baseline_requirements", "")

        llm = get_llm()
        prompt = f"""You are an expert recruiter. Based on the following requirements, generate 3 different JD overview styles for the role: {role_name}

Requirements:
{baseline}

User's accepted additional skills:
{user_message}

Generate exactly 3 JD overview variations. Each should be a detailed 4-6 sentence paragraph describing how the JD would read in that style: what it would emphasize, what sections would be highlighted, what tone it would use, and what kind of candidate it would attract.

You MUST respond with ONLY a valid JSON array:
[
  {{"variant": "Skill-Focused", "description": "A brief overview emphasizing technical skills..."}},
  {{"variant": "Outcome-Focused", "description": "A brief overview emphasizing business outcomes..."}},
  {{"variant": "Hybrid", "description": "A balanced overview combining skills and outcomes..."}}
]

Output ONLY the JSON array. No markdown, no extra text.
"""
        response = llm.invoke([
            SystemMessage(content="You are a JD writing expert. Output only valid JSON."),
            HumanMessage(content=prompt),
        ])

        try:
            text = response.content.strip()
            if text.startswith("["):
                overviews = json.loads(text)
            else:
                import re
                match = re.search(r"\[.*\]", text, re.DOTALL)
                if match:
                    overviews = json.loads(match.group(0))
                else:
                    overviews = [
                        {"variant": "Skill-Focused", "description": text[:200]},
                        {"variant": "Outcome-Focused", "description": text[200:400] if len(text) > 200 else text},
                        {"variant": "Hybrid", "description": text[400:] if len(text) > 400 else text},
                    ]
        except Exception:
            overviews = [
                {"variant": "Skill-Focused", "description": "Technical skills-focused JD overview"},
                {"variant": "Outcome-Focused", "description": "Business outcomes-focused JD overview"},
                {"variant": "Hybrid", "description": "Balanced technical and outcomes JD overview"},
            ]

        state["jd_overviews"] = overviews

        msg = (
            "📝 **Choose a JD Style** — I've prepared 3 variations. "
            "Select the one that best fits your needs, edit if you'd like, then click **Generate Job Description**."
        )
        # Emit card intro as card_text (creates a NEW bubble)
        yield {"event": "card_text", "data": msg}

        state["messages"].append({"role": "assistant", "content": msg})
        state["workflow_stage"] = "jd_variants"

        yield {
            "event": "metadata",
            "data": {
                "workflow_stage": "jd_variants",
                "jd_overviews": overviews,
            }
        }

    def _stream_drafting(self, state: dict):
        """Stream the final JD token-by-token from the LLM."""
        from backend.db.vector_store import store_jd
        import uuid

        role_name = state.get("role_name", "Unknown Role")
        baseline = state.get("baseline_requirements", "")
        messages = state.get("messages", [])
        session_id = state.get("session_id", str(uuid.uuid4()))
        user_selections = messages[-1]["content"] if messages else ""

        # First stream a short intro message using "token" event (goes to chat bubble)
        intro = "✅ Your Job Description is ready! Review, edit, and download it below."
        for char in intro:
            yield {"event": "token", "data": char}

        # Signal that JD streaming is starting (frontend will show JD card)
        yield {"event": "metadata", "data": {"jd_streaming_start": True}}

        # Now stream the actual JD from LLM using "jd_token" event (goes to JD card, NOT chat bubble)
        org_id = state.get("org_id")
        about_us_text = ""
        if org_id:
            try:
                from backend.db.database import get_connection
                with get_connection() as conn:
                    row = conn.execute("SELECT about_us, name FROM organizations WHERE id = ?", (org_id,)).fetchone()
                    if row and row["about_us"]:
                        about_us_text = f"\n\nAbout {row['name']}:\n{row['about_us']}\n\n"
            except Exception as e:
                print(f"⚠️ Failed to fetch about_us for org {org_id}: {e}", file=sys.stderr)

        from backend.nodes import _load_prompt
        llm = get_llm(streaming=True)
        sys_prompt = _load_prompt("drafting_agent.md")
        user_prompt = (
            f"Role Title: {role_name}\n\n"
            f"{about_us_text}"
            f"Baseline Requirements (from user interview):\n{baseline}\n\n"
            f"User-Accepted Additional Requirements:\n{user_selections}\n\n"
            "Instructions:\n"
            "- Structure the JD with: About the Role, What You'll Do, What You'll Bring, "
            "Nice to Have, Work Setup, Why Join Us.\n"
            "- Write in a professional but engaging tone.\n"
            "- Output ONLY clean Markdown. No preamble or explanation outside the JD."
        )

        # (jd_streaming_start already emitted above on line 457)

        jd_markdown = ""
        for chunk in llm.stream([
            SystemMessage(content=sys_prompt),
            HumanMessage(content=user_prompt),
        ]):
            token = chunk.content
            if token:
                jd_markdown += token
                yield {"event": "jd_token", "data": token}

        # Store JD in vector store
        jd_id = f"jd-{session_id}"
        store_jd(jd_id=jd_id, role_name=role_name, markdown_text=jd_markdown, session_id=session_id)

        # Auto-create/update position in relational DB
        try:
            from backend.db.database import save_position
            org_id = state.get("org_id")
            save_position(
                session_id=session_id,
                role_name=role_name,
                org_id=org_id,
                jd_markdown=jd_markdown,
            )
        except Exception as e:
            print(f"⚠️ Position auto-creation failed: {e}", file=sys.stderr)

        state["final_jd_markdown"] = jd_markdown
        state["messages"].append({"role": "assistant", "content": intro.strip()})
        state["workflow_stage"] = "done"

        yield {
            "event": "metadata",
            "data": {
                "workflow_stage": "done",
                "final_jd_markdown": jd_markdown,
            }
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Non-streaming stage handlers (kept for legacy /message endpoint)
    # ─────────────────────────────────────────────────────────────────────────

    def _handle_stage(self, state: dict, user_message: str) -> dict:
        stage = state.get("workflow_stage", "intake")

        if stage == "intake":
            return self._run_intake(state)
        elif stage == "internal_review":
            return self._run_market_analysis(state)
        elif stage == "market_review":
            return self._run_jd_overviews(state, user_message)
        elif stage == "jd_variants":
            return self._run_drafting(state)
        elif stage == "done":
            state["messages"].append({
                "role": "assistant",
                "content": (
                    "Your JD has already been generated. "
                    "You can edit it in the editor below or download it as PDF/Markdown."
                )
            })
            return state
        else:
            return self._run_intake(state)

    def _run_intake(self, state: dict) -> dict:
        """Run interviewer. If intake completes, run internal analyst only."""
        iv_result = interviewer_node(state)
        state.update(iv_result)

        if state.get("baseline_requirements"):
            internal_result = internal_analyst_node(state)
            state.update(internal_result)

            internal_data = state.get("internal_recommendations", {})
            skills = internal_data.get("skills", []) if isinstance(internal_data, dict) else []
            summary = internal_data.get("summary", "") if isinstance(internal_data, dict) else ""

            if skills:
                state["messages"].append({
                    "role": "assistant",
                    "content": (
                        f"✅ **Requirements captured!** I've checked our internal hiring history.\n\n"
                        f"{summary}\n\n"
                        f"I found **{len(skills)} additional skills** from past hires for similar roles. "
                        f"Select the ones you'd like to include, then click **Accept Selected** or **Skip All**."
                    )
                })
            else:
                state["messages"].append({
                    "role": "assistant",
                    "content": (
                        "✅ **Requirements captured!** I checked our internal history — "
                        "no closely matching past JDs were found for this role. "
                        "Moving on to market benchmarking..."
                    )
                })

            state["workflow_stage"] = "internal_review"
        else:
            state["workflow_stage"] = "intake"

        return state

    def _run_market_analysis(self, state: dict) -> dict:
        """Run market intelligence + benchmarking after user completes internal review."""
        market_result = market_intelligence_node(state)
        state.update(market_result)

        bench_result = benchmarking_node(state)
        state.update(bench_result)

        market_data = state.get("market_recommendations", {})
        missing = market_data.get("missing_skills", []) if isinstance(market_data, dict) else []
        diff = market_data.get("differential_skills", []) if isinstance(market_data, dict) else []
        total = len(missing) + len(diff)
        summary = market_data.get("summary", "") if isinstance(market_data, dict) else ""

        state["messages"].append({
            "role": "assistant",
            "content": (
                f"🌐 **Market Benchmarking Complete**\n\n"
                f"{summary}\n\n"
                f"Found **{total} skills** from competitor JDs. "
                f"Select the ones to include, then click **Accept Selected** or **Skip All**."
            )
        })
        state["workflow_stage"] = "market_review"
        return state

    def _run_jd_overviews(self, state: dict, user_message: str) -> dict:
        """Generate 3 JD style variations for the user to choose from."""
        role_name = state.get("role_name", "Unknown Role")
        baseline = state.get("baseline_requirements", "")

        llm = get_llm()
        prompt = f"""You are an expert recruiter. Based on the following requirements, generate 3 different JD overview styles for the role: {role_name}

Requirements:
{baseline}

User's accepted additional skills:
{user_message}

Generate exactly 3 JD overview variations. Each should be a brief 3-5 sentence summary of how the JD would read in that style.

You MUST respond with ONLY a valid JSON array:
[
  {{"variant": "Skill-Focused", "description": "A brief overview emphasizing technical skills..."}},
  {{"variant": "Outcome-Focused", "description": "A brief overview emphasizing business outcomes..."}},
  {{"variant": "Hybrid", "description": "A balanced overview combining skills and outcomes..."}}
]

Output ONLY the JSON array. No markdown, no extra text.
"""
        response = llm.invoke([
            SystemMessage(content="You are a JD writing expert. Output only valid JSON."),
            HumanMessage(content=prompt),
        ])

        try:
            text = response.content.strip()
            if text.startswith("["):
                overviews = json.loads(text)
            else:
                import re
                match = re.search(r"\[.*\]", text, re.DOTALL)
                if match:
                    overviews = json.loads(match.group(0))
                else:
                    overviews = [
                        {"variant": "Skill-Focused", "description": text[:200]},
                        {"variant": "Outcome-Focused", "description": text[200:400] if len(text) > 200 else text},
                        {"variant": "Hybrid", "description": text[400:] if len(text) > 400 else text},
                    ]
        except Exception:
            overviews = [
                {"variant": "Skill-Focused", "description": "Technical skills-focused JD overview"},
                {"variant": "Outcome-Focused", "description": "Business outcomes-focused JD overview"},
                {"variant": "Hybrid", "description": "Balanced technical and outcomes JD overview"},
            ]

        state["jd_overviews"] = overviews
        state["messages"].append({
            "role": "assistant",
            "content": (
                "📝 **Choose a JD Style** — I've prepared 3 variations. "
                "Select the one that best fits your needs, edit if you'd like, then click **Generate Job Description**."
            )
        })
        state["workflow_stage"] = "jd_variants"
        return state

    def _run_drafting(self, state: dict) -> dict:
        """Run the drafting node to produce the final JD."""
        draft_result = drafting_node(state)
        state.update(draft_result)
        state["workflow_stage"] = "done"
        return state
