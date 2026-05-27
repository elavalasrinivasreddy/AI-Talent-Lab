# JD Chat Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out the 9 Phase 2 items deferred from `docs/redesign/05_jd_chat.md` §13 plus the listed tech debt, in 4 sequenced sub-PRs.

**Architecture:** Real LLM token streaming flows through an `asyncio.Queue` callback (`chat_service` → `run_agent` → `run_drafting_final` uses `llm.astream()` and pushes chunks). Four new orchestrator user actions (`apply_bias_fix`, `edit_variant`, `regenerate_variants`, `rewrite_section`) + one recovery action (`retry_stage`) extend the existing pattern at `orchestrator.py:51-97`. Graph re-entry from terminal stages is added by routing `state["stage"]` back to `final_jd` / `jd_variants` inside the action handlers. Frontend layers per-issue and per-variant affordances onto existing blocks; `MessageInput` gates rewrite-vs-message routing by `workflowStage` + presence of `finalJdMarkdown`. Click-to-scroll and rail retry are pure DOM additions.

**Tech Stack:** FastAPI · async PostgreSQL · LangChain `ChatOpenAI`/`ChatGroq`/`ChatGoogleGenerativeAI` (all support `.astream`) · React + Context API + SSE.

**Spec:** `docs/superpowers/specs/2026-05-27-jd-chat-phase-2-design.md`.

---

## Test approach

The repo's `backend/tests/` directory contains only stubs (`# TODO: Implement`). There is no fixture infrastructure for DB or auth. So:

- For pure-logic changes (orchestrator action handlers), add a small inline `pytest` module under `backend/tests/test_phase2_actions.py` with NO fixtures — just `async def test_x()` calling `run_agent` with a hand-built state dict and asserting state mutation. Run with `pytest backend/tests/test_phase2_actions.py -v`.
- For streaming, add a `pytest` test that injects a fake LLM with a known `astream` sequence and asserts the queue receives the chunks in order.
- For frontend, manual browser smoke checks. The repo has no Vitest/Jest setup.

---

## Bucket A — Streaming foundation (F1, F2)

### Task A1: Add `emit_message` to `StreamHandler`; keep `emit_token` as a true-chunk emitter

**Files:**
- Modify: `backend/agents/streaming.py:63-66`

- [ ] **Step 1: Rename `emit_token` → `emit_message`, add a new `emit_token` for true chunks**

Open `backend/agents/streaming.py`. Replace the existing `emit_token` method (lines 63-66) with the following two methods (both emit the same SSE event name `token` so the frontend `case 'token':` handler at `ChatContext.jsx:292` continues to work):

```python
    @staticmethod
    def emit_message(content: str) -> str:
        """A complete assistant chat message sent as one SSE event. Used when
        the underlying LLM call is non-streaming and we want the message to
        appear in one go in the rail conversation."""
        return create_sse_event("token", {"content": content})

    @staticmethod
    def emit_token(chunk: str) -> str:
        """A single streamed chunk for the rail conversation. Same SSE event
        name as `emit_message` — the frontend appends either way."""
        return create_sse_event("token", {"content": chunk})
```

- [ ] **Step 2: Commit**

```bash
git add backend/agents/streaming.py
git commit -m "refactor(streaming): split emit_token into emit_message (full) and emit_token (chunk)"
```

---

### Task A2: Update `chat_service` to use `emit_message` for the full assistant message

**Files:**
- Modify: `backend/services/chat_service.py:150`

- [ ] **Step 1: Replace the call**

Change line 150 from:

```python
                    yield StreamHandler.emit_token(last_msg["content"])
```

to:

```python
                    yield StreamHandler.emit_message(last_msg["content"])
```

- [ ] **Step 2: Commit**

```bash
git add backend/services/chat_service.py
git commit -m "refactor(chat_service): use emit_message for full assistant turn (was misusing emit_token)"
```

---

### Task A3: Add `token_queue` param to `run_drafting_final`; implement `astream` path

**Files:**
- Modify: `backend/agents/nodes/drafting.py:104-184`
- Test: `backend/tests/test_phase2_actions.py` (create)

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_phase2_actions.py`:

```python
"""Phase 2 — Pure-logic tests for orchestrator action handlers + streaming."""
import asyncio
import pytest

from backend.agents.nodes import drafting


class _FakeChunk:
    def __init__(self, content: str):
        self.content = content


class _FakeStreamingLLM:
    """Mimics LangChain's BaseChatModel.astream() — yields chunks."""

    def __init__(self, chunks: list[str]):
        self._chunks = chunks
        self.ainvoke_called = False

    async def astream(self, messages):
        for c in self._chunks:
            yield _FakeChunk(c)

    async def ainvoke(self, messages):
        self.ainvoke_called = True

        class _R:
            content = "".join(self._chunks_self)

        _R._chunks_self = self._chunks
        return _R


@pytest.mark.asyncio
async def test_drafting_final_streams_chunks_to_queue(monkeypatch):
    chunks = ["# Senior ML\n", "## About\n", "TechCorp builds…"]
    fake = _FakeStreamingLLM(chunks)
    monkeypatch.setattr(drafting, "get_llm", lambda **kw: fake)

    state = {
        "role_name": "Senior ML Eng",
        "skills_required": ["Python"],
        "internal_skills_accepted": [],
        "market_skills_accepted": [],
        "experience_min": 5,
        "experience_max": 8,
        "location": "Bangalore",
        "work_type": "hybrid",
        "selected_variant": "hybrid",
        "jd_variants": [{"type": "hybrid", "summary": "balanced"}],
        "messages": [],
        "org_about_us": "TC",
        "org_benefits_text": "Y",
    }

    queue: asyncio.Queue = asyncio.Queue()
    new_state = await drafting.run_drafting_final(state, token_queue=queue)

    received = []
    while not queue.empty():
        received.append(queue.get_nowait())

    assert received == chunks
    assert new_state["final_jd"] == "".join(chunks).strip()
    assert new_state["stage"] == "final_jd"
    assert not fake.ainvoke_called  # streaming path, not ainvoke
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "/media/elavala-srinivas-reddy/HDD/2026/AI Talent Lab"
pytest backend/tests/test_phase2_actions.py -v
```

Expected: FAIL — `run_drafting_final()` got an unexpected keyword argument 'token_queue'.

- [ ] **Step 3: Implement**

In `backend/agents/nodes/drafting.py`, change the `run_drafting_final` signature and body. Replace the function (lines 104-184) with:

```python
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

        skills_required = state.get("skills_required", [])
        internal_accepted = state.get("internal_skills_accepted", [])
        market_accepted = state.get("market_skills_accepted", [])
        all_skills = skills_required + internal_accepted + market_accepted

        about_us = state.get("org_about_us", "An innovative tech company.")
        benefits = state.get("org_benefits_text", "Competitive salary and benefits.")

        # Refinement context — either an existing user message during final_jd
        # (legacy path) or a Phase 2 `section_rewrite` payload set by the
        # rewrite_section action handler.
        feedback = ""
        section_rewrite = state.get("section_rewrite")
        if section_rewrite and section_rewrite.get("instruction"):
            section = section_rewrite.get("section") or "the entire JD"
            feedback = (
                f"\n\nUSER REWRITE REQUEST for {section}:\n"
                f"{section_rewrite['instruction']}"
            )
        else:
            user_msgs = [m for m in state.get("messages", []) if m["role"] == "user"]
            if user_msgs and state.get("user_action") == "message" and state.get("stage") == "final_jd":
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
            content = response.content.strip()

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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest backend/tests/test_phase2_actions.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/agents/nodes/drafting.py backend/tests/test_phase2_actions.py
git commit -m "feat(drafting): stream final JD tokens via asyncio.Queue when token_queue provided"
```

---

### Task A4: Add `token_queue` param to `run_agent`; forward to `drafting_final`

**Files:**
- Modify: `backend/agents/orchestrator.py:22-27, 163-169`

- [ ] **Step 1: Add the parameter and forward it**

Change the `run_agent` signature (line 22-27) from:

```python
async def run_agent(
    state: dict,
    user_message: Optional[str] = None,
    action: Optional[str] = None,
    action_data: Optional[dict] = None
) -> dict:
```

to:

```python
async def run_agent(
    state: dict,
    user_message: Optional[str] = None,
    action: Optional[str] = None,
    action_data: Optional[dict] = None,
    token_queue=None,
) -> dict:
```

Then change the `final_jd` branch (lines 163-169) from:

```python
        elif current_stage == "final_jd":
            state = await run_drafting_final(state)
            if not state.get("error_stage"):
                # No longer run bias check automatically. Wait for user to trigger or finalize.
                state["awaiting_user_input"] = True
                state["stage"] = "final_jd"
            break
```

to:

```python
        elif current_stage == "final_jd":
            state = await run_drafting_final(state, token_queue=token_queue)
            if not state.get("error_stage"):
                # No longer run bias check automatically. Wait for user to trigger or finalize.
                state["awaiting_user_input"] = True
                state["stage"] = "final_jd"
            break
```

- [ ] **Step 2: Commit**

```bash
git add backend/agents/orchestrator.py
git commit -m "feat(orchestrator): forward token_queue to drafting_final for live JD streaming"
```

---

### Task A5: Wire `chat_service` to create the queue, run agent as task, drain queue → SSE `jd_token` events

**Files:**
- Modify: `backend/services/chat_service.py:75-210`

- [ ] **Step 1: Add the import and env helper**

At the top of `backend/services/chat_service.py`, add:

```python
import os
```

(`asyncio` is already imported at line 5.)

- [ ] **Step 2: Refactor `run_chat_stream` to fork the streaming path**

Replace the body of `run_chat_stream` (starting at line 101, the `try:` block) with the structure below. The non-streaming branches stay identical; only the agent-execution call changes shape.

Find this block (lines 101-203):

```python
        try:
            # ── Run the pipeline ──────────────────────────────────────
            new_state = await run_agent(
                state=state,
                user_message=user_message,
                action=action,
                action_data=action_data
            )

            current_stage = new_state.get("stage")
```

Replace with:

```python
        try:
            stream_live = os.environ.get("JD_STREAM_LIVE", "1") == "1"
            initial_stage = state.get("stage", "intake")

            # We only want token-level streaming when the upcoming turn is going
            # to draft the final JD. That is true when:
            #   (a) the user just selected a variant (action == "select_variant"), or
            #   (b) we're already on final_jd and getting a refinement/rewrite.
            will_stream_final = stream_live and (
                action == "select_variant"
                or action in {"rewrite_section", "regenerate_variants"}
                or (state.get("stage") == "final_jd" and user_message)
            )

            if will_stream_final:
                token_queue: asyncio.Queue = asyncio.Queue()

                async def _runner():
                    try:
                        return await run_agent(
                            state=state,
                            user_message=user_message,
                            action=action,
                            action_data=action_data,
                            token_queue=token_queue,
                        )
                    finally:
                        await token_queue.put(None)  # sentinel

                agent_task = asyncio.create_task(_runner())

                # Drain the queue → SSE jd_token events
                while True:
                    chunk = await token_queue.get()
                    if chunk is None:
                        break
                    yield StreamHandler.emit_jd_token(chunk)

                new_state = await agent_task
            else:
                new_state = await run_agent(
                    state=state,
                    user_message=user_message,
                    action=action,
                    action_data=action_data,
                )

            current_stage = new_state.get("stage")
```

- [ ] **Step 3: Gate the legacy word-split path on the flag**

Find the word-split typewriter block (lines 179-187 of the original file):

```python
            # ── Stream final JD token by token ────────────────────────
            # Only stream if this is the FIRST time final_jd appears (transitioning to final_jd stage)
            if current_stage in ("final_jd",) and initial_stage != "final_jd" and new_state.get("final_jd"):
                final_text = new_state["final_jd"]
                # Stream word-by-word for natural typing effect
                words = final_text.split(" ")
                for word in words:
                    yield StreamHandler.emit_jd_token(word + " ")
                    await asyncio.sleep(0.012)
```

Replace with:

```python
            # ── Fallback typewriter (only when live-stream flag is off) ───
            # When JD_STREAM_LIVE=1 (default), tokens already flowed during
            # the queue drain above, so we skip this. When JD_STREAM_LIVE=0,
            # the agent ran in non-streaming mode and we keep the legacy
            # word-split for compatibility.
            if (
                not stream_live
                and current_stage == "final_jd"
                and initial_stage != "final_jd"
                and new_state.get("final_jd")
            ):
                final_text = new_state["final_jd"]
                for word in final_text.split(" "):
                    yield StreamHandler.emit_jd_token(word + " ")
                    await asyncio.sleep(0.012)
```

- [ ] **Step 4: Remove the duplicate `initial_stage` assignment**

The original file sets `initial_stage = state.get("stage", "intake")` at line 99 *outside* the `try:` block. After Step 2, the same assignment is inside the try. Delete line 99 (the outer one). Search the file for `initial_stage = state.get` and confirm it appears exactly once after this edit.

- [ ] **Step 5: Commit**

```bash
git add backend/services/chat_service.py
git commit -m "feat(chat_service): real LLM token streaming via asyncio.Queue (JD_STREAM_LIVE=1 default)"
```

---

### Task A6: Manual smoke-test Bucket A

- [ ] **Step 1: Start the backend with live streaming**

```bash
cd "/media/elavala-srinivas-reddy/HDD/2026/AI Talent Lab"
JD_STREAM_LIVE=1 uvicorn backend.main:app --reload
```

In another terminal:

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173/chat`. Walk a fresh session through intake → variants → pick one. Confirm the final JD appears in the canvas token-by-token (not in a single 50-word burst). Check the Network tab: the SSE stream should show many `jd_token` events arriving over seconds, not all at once.

- [ ] **Step 2: Verify fallback flag**

Stop uvicorn, restart with `JD_STREAM_LIVE=0`. Repeat the flow. The typewriter should still work (slower paced word-by-word).

- [ ] **Step 3: Run unit tests one more time and tag the PR**

```bash
pytest backend/tests/test_phase2_actions.py -v
```

Open a PR titled `feat(jd-chat): Phase 2 Bucket A — real LLM token streaming`. Merge before starting Bucket B.

---

## Bucket B — Canvas editing (F3, F5, F7)

### Task B1: Orchestrator `apply_bias_fix` action handler

**Files:**
- Modify: `backend/agents/orchestrator.py:81-97` (insert new branch)
- Modify: `backend/services/chat_service.py:189-192` (re-emit bias card after apply)
- Test: `backend/tests/test_phase2_actions.py` (add)

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_phase2_actions.py`:

```python
from backend.agents.orchestrator import run_agent


@pytest.mark.asyncio
async def test_apply_bias_fix_patches_jd_and_drops_issue():
    state = {
        "stage": "bias_check",
        "final_jd": "We want a rockstar engineer to join our team.",
        "bias_issues": [
            {"phrase": "rockstar", "suggestion": "high-performing", "reason": "gendered"},
            {"phrase": "join our team", "suggestion": "collaborate with us", "reason": "vague"},
        ],
        "awaiting_user_input": True,
        "messages": [],
    }

    new_state = await run_agent(
        state=state,
        action="apply_bias_fix",
        action_data={"phrase": "rockstar", "suggestion": "high-performing"},
    )

    assert "high-performing" in new_state["final_jd"]
    assert "rockstar" not in new_state["final_jd"]
    assert len(new_state["bias_issues"]) == 1
    assert new_state["bias_issues"][0]["phrase"] == "join our team"
    assert new_state["stage"] == "bias_check"  # stays
    assert new_state["awaiting_user_input"] is True
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest backend/tests/test_phase2_actions.py::test_apply_bias_fix_patches_jd_and_drops_issue -v
```

Expected: FAIL — assertion or KeyError (action not handled).

- [ ] **Step 3: Implement in orchestrator**

In `backend/agents/orchestrator.py`, after the existing `elif action == "finalize_jd":` block (ending around line 97), insert:

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest backend/tests/test_phase2_actions.py::test_apply_bias_fix_patches_jd_and_drops_issue -v
```

Expected: PASS.

- [ ] **Step 5: Make `chat_service` re-emit the updated bias card and JD snapshot after an apply**

In `backend/services/chat_service.py`, find the bias-check emit block (was originally around line 190-192):

```python
            # ── Bias check card ───────────────────────────────────────
            if current_stage == "bias_check" and new_state.get("bias_issues") is not None:
                issues = new_state.get("bias_issues", [])
                yield StreamHandler.emit_card_bias(issues, len(issues) == 0)
```

Replace with:

```python
            # ── Bias check card ───────────────────────────────────────
            if current_stage == "bias_check" and new_state.get("bias_issues") is not None:
                issues = new_state.get("bias_issues", [])
                yield StreamHandler.emit_card_bias(issues, len(issues) == 0)

                # After apply_bias_fix, also re-publish the patched final JD so
                # the canvas re-renders. We emit it as a single event (full text);
                # ChatContext.jd_token appends, so we need a distinct event the
                # frontend treats as a replacement. Reuse `metadata` with a
                # final_jd key, handled by ChatContext below.
                if action == "apply_bias_fix":
                    yield StreamHandler.emit_metadata({
                        "final_jd": new_state.get("final_jd", "")
                    })
```

- [ ] **Step 6: Handle the `metadata.final_jd` event in `ChatContext`**

In `frontend/src/context/ChatContext.jsx`, find the SSE switch (line 290). Add a new case before `default:` (around line 380):

```javascript
            case 'metadata':
                if (typeof data.final_jd === 'string') {
                    setFinalJdMarkdown(data.final_jd);
                    setStreamingJdText('');
                }
                break;
```

- [ ] **Step 7: Commit**

```bash
git add backend/agents/orchestrator.py backend/services/chat_service.py backend/tests/test_phase2_actions.py frontend/src/context/ChatContext.jsx
git commit -m "feat(orchestrator): apply_bias_fix action patches final_jd in place + re-emits"
```

---

### Task B2: Orchestrator `edit_variant` action handler

**Files:**
- Modify: `backend/agents/orchestrator.py` (add elif branch after apply_bias_fix)
- Test: `backend/tests/test_phase2_actions.py` (add)

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_phase2_actions.py`:

```python
@pytest.mark.asyncio
async def test_edit_variant_overwrites_named_variant():
    state = {
        "stage": "jd_variants",
        "jd_variants": [
            {"type": "skill_focused", "summary": "old skill"},
            {"type": "outcome_focused", "summary": "old outcome"},
            {"type": "hybrid", "summary": "old hybrid"},
        ],
        "awaiting_user_input": True,
        "messages": [],
    }

    new_state = await run_agent(
        state=state,
        action="edit_variant",
        action_data={"variant_type": "hybrid", "summary": "new hybrid blurb"},
    )

    hybrid = next(v for v in new_state["jd_variants"] if v["type"] == "hybrid")
    assert hybrid["summary"] == "new hybrid blurb"
    assert new_state["stage"] == "jd_variants"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest backend/tests/test_phase2_actions.py::test_edit_variant_overwrites_named_variant -v
```

Expected: FAIL.

- [ ] **Step 3: Implement**

In `backend/agents/orchestrator.py`, after the `apply_bias_fix` branch added in Task B1, insert:

```python
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
```

- [ ] **Step 4: Run test, then commit**

```bash
pytest backend/tests/test_phase2_actions.py::test_edit_variant_overwrites_named_variant -v
git add backend/agents/orchestrator.py backend/tests/test_phase2_actions.py
git commit -m "feat(orchestrator): edit_variant action overwrites a named variant in place"
```

---

### Task B3: Orchestrator `regenerate_variants` action handler

**Files:**
- Modify: `backend/agents/orchestrator.py`
- Modify: `backend/agents/nodes/drafting.py:25-101` (consume `variant_refinement`)
- Test: `backend/tests/test_phase2_actions.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_phase2_actions.py`:

```python
@pytest.mark.asyncio
async def test_regenerate_variants_clears_and_reenters_variants_stage(monkeypatch):
    """regenerate_variants must clear jd_variants, set refinement, and route
    back to drafting_variants. We stub the drafting node to a no-op so we can
    assert routing without invoking the LLM."""
    calls = []

    async def _fake_variants(state):
        calls.append({"refinement": state.get("variant_refinement")})
        state["jd_variants"] = [
            {"type": "skill_focused", "summary": "S"},
            {"type": "outcome_focused", "summary": "O"},
            {"type": "hybrid", "summary": "H"},
        ]
        state["stage"] = "jd_variants"
        state["awaiting_user_input"] = True
        return state

    from backend.agents import orchestrator as orch
    monkeypatch.setattr(orch, "run_drafting_variants", _fake_variants)

    state = {
        "stage": "final_jd",  # came from a downstream stage
        "jd_variants": [{"type": "hybrid", "summary": "old"}],
        "messages": [],
    }

    new_state = await run_agent(
        state=state,
        action="regenerate_variants",
        action_data={"refinement": "make B more senior"},
    )

    assert calls == [{"refinement": "make B more senior"}]
    assert len(new_state["jd_variants"]) == 3
    assert new_state["stage"] == "jd_variants"
```

- [ ] **Step 2: Run test, expect FAIL**

```bash
pytest backend/tests/test_phase2_actions.py::test_regenerate_variants_clears_and_reenters_variants_stage -v
```

- [ ] **Step 3: Implement the action handler**

In `backend/agents/orchestrator.py`, after the `edit_variant` branch, insert:

```python
        elif action == "regenerate_variants":
            state["jd_variants"] = []
            refinement = action_data.get("refinement")
            if refinement:
                state["variant_refinement"] = refinement
            state["stage"] = "jd_variants"
            state["awaiting_user_input"] = False  # let the for-loop run drafting_variants
```

- [ ] **Step 4: Make `run_drafting_variants` consume `variant_refinement`**

In `backend/agents/nodes/drafting.py`, inside `run_drafting_variants` (line 25-101), find this section:

```python
        user_content = f"""Mode: VARIANT_GENERATION

Role: {role_name}
All Required Skills: {', '.join(all_skills)}
Experience: {state.get('experience_min')} - {state.get('experience_max')} years
Location/Work Type: {state.get('location')} / {state.get('work_type')}
About Us: {about_us}
Benefits: {benefits}

Generate the 3 JD variants now."""
```

Replace with:

```python
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
```

And add this line right after `state["jd_variants"] = variants` (around line 77):

```python
        state.pop("variant_refinement", None)  # one-shot
```

- [ ] **Step 5: Run test, then commit**

```bash
pytest backend/tests/test_phase2_actions.py::test_regenerate_variants_clears_and_reenters_variants_stage -v
git add backend/agents/orchestrator.py backend/agents/nodes/drafting.py backend/tests/test_phase2_actions.py
git commit -m "feat(orchestrator): regenerate_variants clears + re-enters drafting_variants with refinement"
```

---

### Task B4: Orchestrator `rewrite_section` action handler

**Files:**
- Modify: `backend/agents/orchestrator.py`
- Test: `backend/tests/test_phase2_actions.py`

(`run_drafting_final` already consumes `section_rewrite` from Task A3, so only the action handler is new.)

- [ ] **Step 1: Write the failing test**

Append:

```python
@pytest.mark.asyncio
async def test_rewrite_section_routes_into_drafting_final(monkeypatch):
    calls = []

    async def _fake_final(state, token_queue=None):
        calls.append({
            "section_rewrite": state.get("section_rewrite"),
            "had_queue": token_queue is not None,
        })
        state["final_jd"] = "REWRITTEN"
        state["stage"] = "final_jd"
        state["awaiting_user_input"] = True
        state.pop("section_rewrite", None)
        return state

    from backend.agents import orchestrator as orch
    monkeypatch.setattr(orch, "run_drafting_final", _fake_final)

    state = {
        "stage": "complete",
        "final_jd": "old text",
        "messages": [],
    }

    new_state = await run_agent(
        state=state,
        action="rewrite_section",
        action_data={"section": None, "instruction": "second person"},
    )

    assert calls and calls[0]["section_rewrite"] == {
        "section": None, "instruction": "second person",
    }
    assert new_state["final_jd"] == "REWRITTEN"
    assert new_state["stage"] == "final_jd"
```

- [ ] **Step 2: Implement**

In `backend/agents/orchestrator.py`, after the `regenerate_variants` branch, insert:

```python
        elif action == "rewrite_section":
            state["section_rewrite"] = {
                "section": action_data.get("section"),
                "instruction": action_data.get("instruction", ""),
            }
            state["stage"] = "final_jd"
            state["awaiting_user_input"] = False  # re-enter drafting_final
```

- [ ] **Step 3: Run test, then commit**

```bash
pytest backend/tests/test_phase2_actions.py::test_rewrite_section_routes_into_drafting_final -v
git add backend/agents/orchestrator.py backend/tests/test_phase2_actions.py
git commit -m "feat(orchestrator): rewrite_section action re-enters drafting_final with section payload"
```

---

### Task B5: Frontend — AgentBlockBias per-issue Apply button

**Files:**
- Modify: `frontend/src/components/Chat/blocks/AgentBlockBias.jsx:84-112`
- Modify: `frontend/src/styles/chat.css` (add `.bias-issue-actions` style)

- [ ] **Step 1: Replace the issues-list section**

In `frontend/src/components/Chat/blocks/AgentBlockBias.jsx`, find the issues-found return block (starting at line 85). Replace the inner JSX of `<ul className="bias-issue-list">` (lines 93-106) and the footer (lines 107-110) with:

```jsx
      <ul className="bias-issue-list">
        {biasIssues.map((issue, i) => (
          <li key={i} className="bias-issue">
            <div className="bias-issue-pair">
              <span className="bias-issue-from">"{issue.phrase}"</span>
              <IconArrowRight size={14} />
              <span className="bias-issue-to">"{issue.suggestion}"</span>
            </div>
            {issue.reason && (
              <p className="bias-issue-why">{issue.reason}</p>
            )}
            <div className="bias-issue-actions">
              <button
                type="button"
                className="btn btn--sm btn--primary"
                disabled={isStreaming}
                onClick={() =>
                  sendMessage({
                    action: 'apply_bias_fix',
                    action_data: {
                      phrase: issue.phrase,
                      suggestion: issue.suggestion,
                    },
                  })
                }
              >
                Apply
              </button>
            </div>
          </li>
        ))}
      </ul>
```

(The footer `<p className="bias-issue-foot">` is removed.)

- [ ] **Step 2: Add minimal CSS**

Append to `frontend/src/styles/chat.css`:

```css
.bias-issue-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Chat/blocks/AgentBlockBias.jsx frontend/src/styles/chat.css
git commit -m "feat(bias): per-issue Apply button patches JD in place via apply_bias_fix"
```

---

### Task B6: Frontend — AgentBlockVariants per-variant Edit + overall Regenerate

**Files:**
- Modify: `frontend/src/components/Chat/blocks/AgentBlockVariants.jsx`
- Modify: `frontend/src/styles/chat.css` (add variant-edit/regenerate styles)

- [ ] **Step 1: Add Edit + Regenerate UI**

Replace the body of `AgentBlockVariants.jsx` (the entire file) with:

```jsx
import React, { useState } from 'react';
import { useChat } from '../../../context/ChatContext';
import AgentBlockShell from './AgentBlockShell';
import { IconArrowRight, IconCheck } from '../icons';

const VARIANT_LABELS = {
  skill_focused:   { label: 'Skill-focused',   tagline: 'Lead with the tech and tooling you need' },
  outcome_focused: { label: 'Outcome-focused', tagline: 'Lead with what the role will achieve' },
  hybrid:          { label: 'Hybrid',          tagline: 'Skills + outcomes, balanced' },
};

export default function AgentBlockVariants() {
  const { variantsCard, sendMessage, isStreaming, graphState } = useChat();
  const [editing, setEditing] = useState(null);     // variant_type currently being edited
  const [draftSummary, setDraftSummary] = useState('');
  const [refinement, setRefinement] = useState('');

  const variants = variantsCard?.variants || [];
  const alreadySelected = graphState?.selected_variant || variantsCard?.selected || null;
  const isLocked = Boolean(alreadySelected);

  if (!variants.length) return null;

  const onSelect = (variantType) => {
    if (isStreaming || isLocked) return;
    sendMessage({
      action: 'select_variant',
      action_data: { variant_type: variantType },
    });
  };

  const onStartEdit = (v) => {
    setEditing(v.type);
    setDraftSummary(v.summary || '');
  };

  const onSaveEdit = () => {
    sendMessage({
      action: 'edit_variant',
      action_data: { variant_type: editing, summary: draftSummary },
    });
    setEditing(null);
    setDraftSummary('');
  };

  const onRegenerate = () => {
    sendMessage({
      action: 'regenerate_variants',
      action_data: refinement.trim() ? { refinement: refinement.trim() } : {},
    });
    setRefinement('');
  };

  return (
    <AgentBlockShell
      stage="jd_variants"
      number={4}
      title="JD variants"
      subtitle={
        isLocked
          ? `Selected: ${VARIANT_LABELS[alreadySelected]?.label || alreadySelected}`
          : 'Three styles. Pick the one that fits your team.'
      }
      status={isLocked ? 'done' : 'active'}
    >
      <div className="variant-grid">
        {variants.map((v) => {
          const meta = VARIANT_LABELS[v.type] || { label: v.type, tagline: v.summary };
          const isPicked = v.type === alreadySelected;
          const isEditing = editing === v.type;
          return (
            <article
              key={v.type}
              className={`variant-card ${isPicked ? 'is-picked' : ''} ${isEditing ? 'is-editing' : ''}`}
            >
              <header className="variant-card-head">
                <span className="variant-card-kicker">{meta.label}</span>
                {isPicked && (
                  <span className="variant-card-badge" title="Picked">
                    <IconCheck size={12} /> Picked
                  </span>
                )}
              </header>

              {isEditing ? (
                <>
                  <textarea
                    className="variant-card-edit"
                    rows={4}
                    value={draftSummary}
                    onChange={(e) => setDraftSummary(e.target.value)}
                    placeholder="Rewrite this variant's tagline / summary."
                  />
                  <div className="variant-card-edit-actions">
                    <button type="button" className="btn btn--sm btn--ghost"
                      onClick={() => { setEditing(null); setDraftSummary(''); }}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn--sm btn--primary"
                      disabled={isStreaming || !draftSummary.trim()}
                      onClick={onSaveEdit}>
                      Save
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="variant-card-tagline">{meta.tagline}</p>
                  {v.summary && v.summary !== meta.tagline && (
                    <p className="variant-card-summary">{v.summary}</p>
                  )}
                  <div className="variant-card-meta">
                    {typeof v.skills_count === 'number' && (
                      <span>{v.skills_count} skill{v.skills_count === 1 ? '' : 's'}</span>
                    )}
                    {v.tone && <span>{v.tone} tone</span>}
                  </div>
                  <div className="variant-card-buttons">
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost"
                      disabled={isStreaming || isLocked}
                      onClick={() => onStartEdit(v)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={`btn btn--sm btn--block ${isPicked ? 'btn--ghost' : 'btn--primary'}`}
                      disabled={isStreaming || isLocked}
                      onClick={() => onSelect(v.type)}
                    >
                      {isPicked ? 'Selected' : <>Use this <IconArrowRight size={14} /></>}
                    </button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>

      {!isLocked && (
        <div className="variant-regenerate">
          <input
            type="text"
            className="variant-regenerate-input"
            placeholder="Optional refinement (e.g. 'make Hybrid more senior-leaning')"
            value={refinement}
            onChange={(e) => setRefinement(e.target.value)}
            disabled={isStreaming}
          />
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            disabled={isStreaming}
            onClick={onRegenerate}
          >
            Regenerate variants
          </button>
        </div>
      )}
    </AgentBlockShell>
  );
}
```

- [ ] **Step 2: Add CSS for the new affordances**

Append to `frontend/src/styles/chat.css`:

```css
.variant-card-buttons {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.variant-card-edit {
  width: 100%;
  min-height: 80px;
  margin-top: 8px;
  padding: 8px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 6px;
  font: inherit;
  resize: vertical;
}
.variant-card-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 6px;
}
.variant-regenerate {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border, #e5e7eb);
}
.variant-regenerate-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 6px;
  font: inherit;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Chat/blocks/AgentBlockVariants.jsx frontend/src/styles/chat.css
git commit -m "feat(variants): inline Edit per variant + overall Regenerate with refinement input"
```

---

### Task B7: Frontend — `MessageInput` routes rewrite vs message based on stage

**Files:**
- Modify: `frontend/src/components/Chat/MessageInput.jsx:29-34`

- [ ] **Step 1: Replace `handleSend`**

Update the imports at the top of `MessageInput.jsx` to also pull `finalJdMarkdown`:

```jsx
    const { sendMessage, isStreaming, workflowStage, currentSessionId, finalJdMarkdown } = useChat();
```

Replace `handleSend` (lines 29-34) with:

```jsx
    const handleSend = () => {
        if (!input.trim() || isDisabled || isComplete) return;
        const text = input.trim();

        // Phase 2 F7: when we already have a final JD and the user sends a
        // message, treat it as a section rewrite request rather than a plain
        // chat message. The orchestrator routes this back into drafting_final.
        if (finalJdMarkdown && (workflowStage === 'final_jd' || workflowStage === 'bias_check')) {
            sendMessage({
                action: 'rewrite_section',
                action_data: { section: null, instruction: text },
            });
        } else if (workflowStage === 'jd_variants') {
            // Phase 2 F4: rail message while on variants = variant refinement
            sendMessage({
                action: 'regenerate_variants',
                action_data: { refinement: text },
            });
        } else {
            sendMessage({ message: text });
        }

        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    };
```

- [ ] **Step 2: Extend `ChatContext.sendMessage` to clear the canvas before re-streaming**

In `frontend/src/context/ChatContext.jsx`, find the block that resets streaming state on `select_variant` (around line 223-227):

```javascript
        // Reset streaming JD text if we're generating a new one
        if (payload.action === 'select_variant') {
            setStreamingJdText('');
            setFinalJdMarkdown(null);
            setIsJdStreaming(true);
        }
```

Replace with:

```javascript
        // Reset streaming JD text when we expect the JD to re-stream:
        //   - select_variant      (first draft)
        //   - rewrite_section     (whole-JD rewrite from rail)
        //   - regenerate_variants (Bucket B; doesn't touch JD but clears variants card)
        if (payload.action === 'select_variant' || payload.action === 'rewrite_section') {
            setStreamingJdText('');
            setFinalJdMarkdown(null);
            setIsJdStreaming(true);
        }
        if (payload.action === 'regenerate_variants') {
            setVariantsCard(null);
        }
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Chat/MessageInput.jsx frontend/src/context/ChatContext.jsx
git commit -m "feat(input): route rail message to rewrite_section or regenerate_variants based on stage"
```

---

### Task B8: Frontend — `RailConversation` hint banner on variants stage

**Files:**
- Modify: `frontend/src/components/Chat/RailConversation.jsx`
- Modify: `frontend/src/styles/chat.css`

- [ ] **Step 1: Add a stage-specific hint above the list**

In `RailConversation.jsx`, change the destructure (line 16) from:

```jsx
  const { messages, isStreaming } = useChat();
```

to:

```jsx
  const { messages, isStreaming, workflowStage, finalJdMarkdown } = useChat();
```

Then, right inside the `return (`, add a hint above `<ul className="rail-convo-list">`:

```jsx
  return (
    <div className="rail-convo">
      {workflowStage === 'jd_variants' && (
        <div className="rail-hint">
          Tip: ask for a refinement like "make Hybrid more senior-leaning" to regenerate variants.
        </div>
      )}
      {finalJdMarkdown && (workflowStage === 'final_jd' || workflowStage === 'bias_check') && (
        <div className="rail-hint">
          Tip: type a rewrite instruction (e.g. "rewrite responsibilities in second person") and it will re-stream the JD.
        </div>
      )}
      <ul className="rail-convo-list">
```

(Close the existing list/div structure unchanged.)

- [ ] **Step 2: Add CSS**

Append to `frontend/src/styles/chat.css`:

```css
.rail-hint {
  margin: 0 12px 8px;
  padding: 8px 10px;
  background: var(--bg-3, #f3f4f6);
  border-left: 3px solid var(--p, #0d9488);
  border-radius: 4px;
  font-size: 12px;
  color: var(--fg-2, #4b5563);
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Chat/RailConversation.jsx frontend/src/styles/chat.css
git commit -m "feat(rail): stage-aware hint banners for variant refinement and section rewrite"
```

---

### Task B9: Manual smoke-test Bucket B

- [ ] **Step 1: Run a full session and exercise each new action**

Start backend + frontend as in Task A6. New session → drive through intake → variants stage. At variants:
1. Click `Edit` on one variant, change the summary, save. Confirm the card re-renders with the new summary.
2. Type "make Hybrid more senior" in the rail. Confirm three new variants stream in (or click `Regenerate variants` with no text).

Pick a variant → wait for final JD → at `final_jd`:
3. Type "rewrite the responsibilities in second person" in the rail. Confirm the canvas re-streams the JD.

Click `Run inclusivity check`. When issues appear:
4. Click `Apply` on one. Confirm the JD canvas text updates and the issue disappears.

- [ ] **Step 2: Tag the PR**

Open a PR titled `feat(jd-chat): Phase 2 Bucket B — canvas editing (bias-fix, variants, section rewrite)`. Merge before starting Bucket C.

---

## Bucket C — Polish + recovery (F6, F8)

### Task C1: Orchestrator `retry_stage` action handler

**Files:**
- Modify: `backend/agents/orchestrator.py`
- Test: `backend/tests/test_phase2_actions.py`

- [ ] **Step 1: Write the failing test**

Append:

```python
@pytest.mark.asyncio
async def test_retry_stage_resets_error_and_reenters_failed_stage(monkeypatch):
    calls = []

    async def _fake_final(state, token_queue=None):
        calls.append("ran")
        state["final_jd"] = "DONE"
        state["stage"] = "final_jd"
        state["awaiting_user_input"] = True
        return state

    from backend.agents import orchestrator as orch
    monkeypatch.setattr(orch, "run_drafting_final", _fake_final)

    state = {
        "stage": "complete",                  # current state stuck post-error
        "error_stage": "final_jd",
        "error_code": "FINAL_JD_FAILED",
        "error_message": "boom",
        "retry_count": 2,
        "messages": [],
    }

    new_state = await run_agent(state=state, action="retry_stage")

    assert calls == ["ran"]
    assert new_state["error_stage"] is None
    assert new_state["error_code"] is None
    assert new_state["retry_count"] == 0
    assert new_state["final_jd"] == "DONE"
```

- [ ] **Step 2: Implement**

In `backend/agents/orchestrator.py`, after the `rewrite_section` branch, insert:

```python
        elif action == "retry_stage":
            failed = state.get("error_stage")
            if failed:
                state["retry_count"] = 0
                state["error_stage"] = None
                state["error_code"] = None
                state["error_message"] = None
                state["stage"] = failed
                state["awaiting_user_input"] = False
```

- [ ] **Step 3: Run test, then commit**

```bash
pytest backend/tests/test_phase2_actions.py::test_retry_stage_resets_error_and_reenters_failed_stage -v
git add backend/agents/orchestrator.py backend/tests/test_phase2_actions.py
git commit -m "feat(orchestrator): retry_stage action resets error and re-enters failed stage"
```

---

### Task C2: Frontend — click-to-scroll stepper for done pills

**Files:**
- Modify: `frontend/src/components/Chat/JDStepper.jsx`

- [ ] **Step 1: Add scroll handler**

In `frontend/src/components/Chat/JDStepper.jsx`, find the `<li>` returning each pill (lines 72-91). Replace the `<li>` with a conditionally-clickable element:

```jsx
        {STAGES.map((s, idx) => {
          const state = states[s.key] || 'pending';
          const clickable = state === 'done';
          const onClick = () => {
            if (!clickable) return;
            const el = document.querySelector(`.agent-block[data-stage="${s.key}"]`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          };
          return (
            <li
              key={s.key}
              className={`jd-stepper-item${clickable ? ' is-clickable' : ''}`}
              data-state={state}
              onClick={onClick}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={(e) => {
                if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onClick();
                }
              }}
            >
              <span className="jd-stepper-dot" aria-hidden="true">
                {state === 'done' && <IconCheck size={12} />}
                {state === 'skipped' && <IconX size={12} />}
                {state === 'current' && <IconLoader size={12} />}
                {state === 'pending' && <span className="jd-stepper-num">{idx + 1}</span>}
              </span>
              <span className="jd-stepper-label">{s.label}</span>
              <span className={`jd-stepper-retry retry-${s.retry.toLowerCase()}`}>
                {s.retry}
              </span>
            </li>
          );
        })}
```

- [ ] **Step 2: Add hover CSS**

Append to `frontend/src/styles/chat.css`:

```css
.jd-stepper-item.is-clickable {
  cursor: pointer;
}
.jd-stepper-item.is-clickable:hover {
  background: var(--bg-3, #f3f4f6);
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Chat/JDStepper.jsx frontend/src/styles/chat.css
git commit -m "feat(stepper): click a done pill to scroll the canvas to that agent block"
```

---

### Task C3: Frontend — `RailStateCard` error retry button

**Files:**
- Modify: `frontend/src/components/Chat/RailStateCard.jsx`
- Modify: `frontend/src/styles/chat.css`

- [ ] **Step 1: Surface graphState error + retry button**

Replace the entire body of `RailStateCard.jsx` with:

```jsx
import React from 'react';
import { useChat } from '../../context/ChatContext';
import { IconLoader, IconAlertCircle, IconCheck, IconRefreshCw } from './icons';

const STAGE_META = {
  intake:          { label: 'Intake',            retry: 'HARD', hint: "Tell me about the role you're hiring for." },
  internal_check:  { label: 'Internal check',    retry: 'SOFT', hint: 'Pulling skills from past TechCorp JDs.' },
  market_research: { label: 'Market research',   retry: 'SOFT', hint: 'Scanning competitor JDs for benchmark skills.' },
  benchmarking:    { label: 'Benchmarking',      retry: 'SOFT', hint: 'Filtering market signal into the JD.' },
  jd_variants:     { label: 'JD variants',       retry: 'HARD', hint: "Pick a variant on the left to keep moving." },
  final_jd:        { label: 'Final JD',          retry: 'HARD', hint: 'Drafting the full JD now.' },
  bias_check:      { label: 'Inclusivity',       retry: 'SOFT', hint: 'Scanning for biased or exclusionary phrasing.' },
  complete:        { label: 'Ready to save',     retry: 'HARD', hint: 'Save to create the position and trigger sourcing.' },
};

export default function RailStateCard() {
  const { workflowStage, isStreaming, error, graphState, sendMessage } = useChat();
  const stage = STAGE_META[workflowStage] || STAGE_META.intake;
  const showActive = isStreaming || workflowStage !== 'complete';
  const errorStage = graphState?.error_stage;

  const onRetry = () => {
    sendMessage({ action: 'retry_stage', action_data: {} });
  };

  return (
    <div className="rail-state">
      <div className="rail-state-row">
        <span className="rail-state-dot" data-active={showActive || undefined} aria-hidden="true" />
        <span className="rail-state-label">{stage.label}</span>
        <span className={`rail-state-retry retry-${stage.retry.toLowerCase()}`}>{stage.retry}</span>
      </div>
      <p className="rail-state-hint">
        {workflowStage === 'complete' ? (
          <span className="rail-state-done"><IconCheck size={14} /> {stage.hint}</span>
        ) : isStreaming ? (
          <span><IconLoader size={14} /> Working…</span>
        ) : (
          stage.hint
        )}
      </p>

      {errorStage && (
        <div className="rail-state-retry-card" role="alert">
          <div className="rail-state-retry-head">
            <IconAlertCircle size={14} />
            <span>{graphState?.error_message || `Stage ${errorStage} failed.`}</span>
          </div>
          <button
            type="button"
            className="btn btn--sm btn--primary"
            disabled={isStreaming}
            onClick={onRetry}
          >
            <IconRefreshCw size={12} /> Retry stage
          </button>
        </div>
      )}

      {error && !errorStage && (
        <div className="rail-state-error" role="alert">
          <IconAlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add `IconRefreshCw` if missing**

Run:

```bash
grep -n "IconRefreshCw" "/media/elavala-srinivas-reddy/HDD/2026/AI Talent Lab/frontend/src/components/Chat/icons.jsx"
```

If the grep returns nothing, open `frontend/src/components/Chat/icons.jsx` and add (next to the other icon exports):

```jsx
export const IconRefreshCw = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);
```

- [ ] **Step 3: Add retry-card CSS**

Append to `frontend/src/styles/chat.css`:

```css
.rail-state-retry-card {
  margin-top: 10px;
  padding: 10px;
  background: color-mix(in srgb, var(--bad, #dc2626) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--bad, #dc2626) 30%, transparent);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rail-state-retry-head {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  color: var(--bad, #dc2626);
  font-size: 12px;
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Chat/RailStateCard.jsx frontend/src/components/Chat/icons.jsx frontend/src/styles/chat.css
git commit -m "feat(rail): error stage shows retry card bound to retry_stage action"
```

---

### Task C4: Manual smoke-test Bucket C

- [ ] **Step 1: Test click-to-scroll**

Drive a session past intake. Click ① Intake pill. Confirm canvas smooth-scrolls to the intake agent block.

- [ ] **Step 2: Test retry card**

Temporarily simulate a final_jd failure: in `backend/agents/nodes/drafting.py`, inside `run_drafting_final`, add `raise RuntimeError("simulated")` as the first line of the try block. Drive a session to pick a variant. Watch the rail show the retry card with "Connection interrupted. Click Regenerate to continue." Click `Retry stage`. The handler runs but re-fails — that's fine; the goal is to confirm the action dispatches. Revert the simulated `raise` after testing. Run a real session end-to-end and confirm no regression.

- [ ] **Step 3: Tag the PR**

Open `feat(jd-chat): Phase 2 Bucket C — click-to-scroll stepper + rail retry`. Merge before Bucket D.

---

## Bucket D — Hygiene (F4, F9, tech debt)

### Task D1: F4 — verify variant refinement routing

F4 was wired in Task B7 (`MessageInput.handleSend` already routes to `regenerate_variants` when `workflowStage === 'jd_variants'`). This task only verifies and removes the standalone TODO.

- [ ] **Step 1: Read the spec line and confirm**

Open `docs/redesign/05_jd_chat.md` and search for `F4`. Strike it through or annotate as `(shipped in Bucket B Task B7)`.

```bash
grep -n "F4" "/media/elavala-srinivas-reddy/HDD/2026/AI Talent Lab/docs/redesign/05_jd_chat.md"
```

Edit the matching `| F4 | **Variant follow-up refinement** | ...` line — append `(shipped YYYY-MM-DD (substitute today's date when committing) via Bucket B Task B7)`.

- [ ] **Step 2: Commit**

```bash
git add docs/redesign/05_jd_chat.md
git commit -m "docs: mark F4 variant refinement as shipped via Bucket B"
```

---

### Task D2: F9 — centralize greeting (single source of truth in backend)

**Files:**
- Modify: `frontend/src/context/ChatContext.jsx:35-56, 148-158`

- [ ] **Step 1: Remove hardcoded greetings from `resetChat` and the 404 branch**

In `ChatContext.jsx`, find `resetChat` (line 35). Change:

```javascript
    const resetChat = useCallback(() => {
        setCurrentSessionId(null);
        setSessionTitle('New Hire');
        setMessages([{
            role: 'assistant',
            content: "Hi! I'm your AI hiring assistant. 👋\n\nLet's create a job description together. What role are you looking to fill?\n\nYou can also upload an existing JD if you'd like me to start from that.",
            isComplete: true
        }]);
```

to:

```javascript
    const resetChat = useCallback(() => {
        setCurrentSessionId(null);
        setSessionTitle('New Hire');
        // Greeting comes from backend on first session fetch — no longer hardcoded here.
        setMessages([]);
```

Then find the 404 branch in `loadSession` (around line 148-158). Change:

```javascript
            } else if (res.status === 404) {
                // Session doesn't exist yet — fresh chat
                setCurrentSessionId(sessionId);
                setMessages([{
                    role: 'assistant',
                    content: "Hi! I'm your AI hiring assistant. 👋\n\nLet's create a job description together. What role are you looking to fill?\n\nYou can also upload an existing JD if you'd like me to start from that.",
                    isComplete: true
                }]);
                setWorkflowStage('intake');
                setSessionTitle('New Hire');
            }
```

to:

```javascript
            } else if (res.status === 404) {
                // Session doesn't exist yet — fresh chat. Backend creates it
                // (with greeting) on the first POST /chat/stream call.
                setCurrentSessionId(sessionId);
                setMessages([]);
                setWorkflowStage('intake');
                setSessionTitle('New Hire');
            }
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/context/ChatContext.jsx
git commit -m "refactor(chat): drop hardcoded greeting — backend is the single source"
```

- [ ] **Step 3: Smoke-test**

Start backend + frontend. Open `/chat` (fresh, no sessionId). Confirm the canvas shows the empty state and the rail conversation is empty. Send "Senior ML engineer in Bangalore." The rail should populate the greeting + AI reply on the first round-trip (the greeting is persisted by `ChatService.get_or_create_session` at `chat_service.py:62-69` and replays via the DB messages list on subsequent reloads).

---

### Task D3: Tech debt — `current_user["id"]` → `user_id` in 3 routers

**Files:**
- Modify: `backend/routers/positions.py`
- Modify: `backend/routers/candidates.py`
- Modify: `backend/routers/talent_pool.py`

- [ ] **Step 1: Locate all occurrences**

```bash
grep -n 'current_user\["id"\]' backend/routers/positions.py backend/routers/candidates.py backend/routers/talent_pool.py
```

- [ ] **Step 2: Replace each occurrence with `user_id`**

For each file, the standard FastAPI dependency injection signature is `current_user: dict = Depends(get_current_user)`. The fix is to add a destructure at the top of each affected function:

```python
    user_id = current_user["id"]
```

And replace each subsequent `current_user["id"]` with `user_id`.

Apply this pattern to every function the grep returned. Verify with a second grep — no occurrences should remain.

- [ ] **Step 3: Smoke-test**

Hit one endpoint each (positions list, candidates list, talent pool list) via the frontend or curl with a valid JWT. Confirm 200 OK, no KeyError.

- [ ] **Step 4: Commit**

```bash
git add backend/routers/positions.py backend/routers/candidates.py backend/routers/talent_pool.py
git commit -m "refactor(routers): unpack current_user[\"id\"] to user_id (TECH_DEBT)"
```

- [ ] **Step 5: Update TECH_DEBT.md**

```bash
grep -n "current_user" docs/TECH_DEBT.md
```

If the matching row exists, mark it `~~resolved YYYY-MM-DD (substitute today's date when committing)~~`.

```bash
git add docs/TECH_DEBT.md
git commit -m "docs: mark current_user[\"id\"] cleanup as resolved"
```

---

### Task D4: Tech debt — TypedDict typing in orchestrator

**Files:**
- Modify: `backend/agents/orchestrator.py:22-27`

- [ ] **Step 1: Change `state: dict` → `state: AgentState`**

In `backend/agents/orchestrator.py`, change the `run_agent` signature `state: dict` to `state: AgentState`. Also change the return type from `-> dict` to `-> AgentState`. The import is already present at line 11.

- [ ] **Step 2: Guard against `None` action_data**

Inside `run_agent`, find the elif chain (action handlers, line 51 onward). At the top of the `elif action:` branch, immediately after `state["user_action_data"] = action_data or {}` (line 53), add:

```python
        action_data = action_data or {}  # local rebind so .get() is safe in all branches
```

- [ ] **Step 3: Commit**

```bash
git add backend/agents/orchestrator.py
git commit -m "fix(orchestrator): tighten TypedDict typing + guard None action_data"
```

---

### Task D5: Tech debt — emit `stage_skipped` for `intake` and `final_jd` when applicable

**Files:**
- Modify: `backend/agents/orchestrator.py` (record_skip calls)

For the two HARD-STOP stages (intake, final_jd), there's no genuine soft-skip — they always run or fail. So this tech debt item is best closed by **explicitly documenting that no event is emitted**, rather than adding a misleading one.

- [ ] **Step 1: Add a comment in `_record_skip`**

In `backend/agents/orchestrator.py`, find `_record_skip` (line 110-111). Replace with:

```python
    def _record_skip(stage_name: str, reason: str) -> None:
        # Only emit for soft-skippable stages (internal_check, market_research,
        # bias_check). HARD-STOP stages (intake, jd_variants, final_jd) never
        # reach this path — they either succeed or surface an error.
        state["_run_meta"]["skipped"].append({"stage": stage_name, "reason": reason})
```

- [ ] **Step 2: Update TECH_DEBT.md**

```bash
grep -n "stage_skipped" docs/TECH_DEBT.md
```

If the matching row exists, replace it with a note: "Stage skip emission for HARD stages: by-design no-op. Intake/final_jd cannot soft-skip; the orchestrator only records skips for soft-skippable stages."

- [ ] **Step 3: Commit**

```bash
git add backend/agents/orchestrator.py docs/TECH_DEBT.md
git commit -m "docs: clarify stage_skipped is by-design absent for HARD-STOP stages"
```

---

### Task D6: Remove `JD_STREAM_LIVE` flag now that Bucket A has soaked

**Files:**
- Modify: `backend/services/chat_service.py`

- [ ] **Step 1: Inline the live-streaming path**

In `backend/services/chat_service.py`, find the `stream_live = os.environ.get("JD_STREAM_LIVE", "1") == "1"` line added in Bucket A Task A5. Delete the variable and inline `True` everywhere it's used. Then delete the entire fallback `if (not stream_live and current_stage == "final_jd" ...)` block — the legacy word-split typewriter is gone.

Also remove `import os` from the top if it's no longer used elsewhere (`grep -n "^import os\| os\." backend/services/chat_service.py`).

- [ ] **Step 2: Smoke-test once more end-to-end**

Drive a full JD session. Confirm streaming still works without the flag.

- [ ] **Step 3: Commit**

```bash
git add backend/services/chat_service.py
git commit -m "refactor(chat_service): remove JD_STREAM_LIVE fallback; live streaming is the only path"
```

---

### Task D7: Open Bucket D PR + close the Phase 2 epic

- [ ] **Step 1: PR**

Open `feat(jd-chat): Phase 2 Bucket D — hygiene + tech debt closeout`. Merge.

- [ ] **Step 2: Update `docs/redesign/05_jd_chat.md` §13**

Move the entire "Phase 2 — deferred" block into a "Phase 2 — shipped" block with the matching date. Commit + push:

```bash
git add docs/redesign/05_jd_chat.md
git commit -m "docs: mark JD Chat Phase 2 as shipped"
```

---

## Spec coverage self-check

| Spec item | Task(s) |
|---|---|
| F1 — Real LLM token streaming for `final_jd` | A3, A4, A5 |
| F2 — `emit_token` rename | A1, A2 |
| F3 — In-canvas bias-fix patching | B1, B5 |
| F4 — Variant follow-up refinement | B7, D1 |
| F5 — Variant inline Edit + Regenerate | B2, B3, B6 |
| F6 — Click-to-scroll stepper | C2 |
| F7 — Whole-section rail rewrites | B4, A3 (consume `section_rewrite`), B7 |
| F8 — Stage retry card in rail | C1, C3 |
| F9 — Centralized greeting | D2 |
| Tech debt — current_user["id"] | D3 |
| Tech debt — TypedDict warnings | D4 |
| Tech debt — stage_skipped for intake/final_jd | D5 |
| Spec §2.1 (streaming arch) | A3, A4, A5 |
| Spec §2.2 (server-canonical bias-fix) | B1 |
| Spec §8 risks (JD_STREAM_LIVE soak + removal) | A5, D6 |

All 9 F-items, 3 tech-debt items, and the §2/§8 risks have a corresponding task.
