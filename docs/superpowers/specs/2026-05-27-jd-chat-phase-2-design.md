# JD Chat — Phase 2 Design

**Date:** 2026-05-27
**Branch:** `task/jd_chat_redesign`
**Supersedes / extends:** `docs/redesign/05_jd_chat.md` §13 "Phase 2 deferred"
**Phase 1 reference:** shipped 2026-05-20 (see same §13)

---

## 1. Scope

Phase 2 closes out the nine items deferred from Phase 1 plus the tech debt listed in `docs/redesign/05_jd_chat.md` §13. The work ships as **four sequenced sub-PRs** rather than one big-bang merge.

| Bucket | Items | Goal |
|---|---|---|
| **A — Streaming foundation** | F1, F2 | Replace the fake `asyncio.sleep` typewriter with real LangGraph token streaming; rename `emit_token` to match its actual behavior. |
| **B — Canvas editing** | F3, F5, F7 | Make the JD canvas interactive: per-issue bias-fix Apply, per-variant Edit + overall Regenerate, whole-section rail rewrites. |
| **C — Polish + recovery** | F6, F8 | Click-to-scroll stepper pills, retry button in rail when a stage errors. |
| **D — Hygiene** | F4, F9 + tech debt | Variant follow-up refinement, centralized greeting, `stage_skipped` for intake/final_jd, `current_user["id"]` cleanup. |

Bucket A ships first because it modifies the SSE pipeline that B, C, D layer onto. B, C, D can ship in any order after A merges.

---

## 2. Key technical decisions

### 2.1 Real token streaming uses an asyncio.Queue callback

The orchestrator (`backend/agents/orchestrator.py`) is a hand-rolled async for-loop, **not** a compiled LangGraph. So LangGraph's `astream_events` doesn't apply. Streaming instead flows through a callback passed top-down:

1. `chat_service.run_chat_stream` creates an `asyncio.Queue[str]`.
2. It launches `run_agent(..., token_queue=queue)` as a background task.
3. It loops on `await queue.get()` and emits each chunk as an SSE `jd_token` event until the task completes (sentinel `None`).
4. `run_agent` forwards the queue to `run_drafting_final` only (other nodes don't stream).
5. `run_drafting_final` switches from `await llm.ainvoke(messages)` to `async for chunk in llm.astream(messages)` and puts each `chunk.content` onto the queue.
6. On completion, the node assembles `state["final_jd"]` from the accumulated chunks and the background task pushes `None` to signal end-of-stream.

This works for any LangChain chat model that supports `.astream()` (Groq, OpenAI, Gemini all do).

**Rejected alternative:** a LangChain `BaseCallbackHandler`. Equivalent power, but requires implementing the callback interface and binding it via `RunnableConfig` — more ceremony than a plain queue.

**Safety:** the first PR retains the existing word-split typewriter behind `os.environ.get("JD_STREAM_LIVE", "1") == "1"`. If `False`, the chat service falls back to `llm.ainvoke` + post-hoc typewriter exactly as today. Flag removed in Bucket D once Bucket A has soaked.

### 2.2 Bias-fix apply is server-canonical

When the user clicks `Apply` on a bias-fix pair, the frontend sends a `user_action = "apply_bias_fix"` with `action_data = {phrase, suggestion}`. The orchestrator mutates `state["final_jd"]` via a single `str.replace(phrase, suggestion, 1)` (first occurrence only; if the same phrase recurs and the checker reported it as multiple issues, each Apply click patches one more occurrence). It removes the applied row from `state["bias_check"]["issues"]`, persists state, and re-emits an updated `card_bias` plus a fresh `final_jd` snapshot event so the canvas re-renders.

**Rejected alternative:** optimistic client-side patch with eventual persistence. Faster perceptual feel, but creates client-server divergence if a save fails, and every other action in the orchestrator already round-trips through the server. Not worth the asymmetry. Optimistic UI can be added later as a pure frontend change without changing the contract.

---

## 3. Bucket A — Streaming foundation (F1, F2)

### 3.1 Backend changes

**`backend/adapters/llm/factory.py`** — already accepts `streaming: bool = False`. No change required; callers just need to pass `streaming=True` when they want chunk-level events.

**`backend/agents/nodes/drafting.py`** — `run_drafting_final` accepts a new optional `token_queue: Optional[asyncio.Queue] = None` parameter. When the queue is provided:
- Build the LLM with `streaming=True`.
- Replace `response = await llm.ainvoke(messages)` with:
  ```python
  parts: list[str] = []
  async for chunk in llm.astream(messages):
      text = getattr(chunk, "content", "") or ""
      if text:
          parts.append(text)
          await token_queue.put(text)
  content = "".join(parts).strip()
  ```
- When `token_queue is None`, keep the existing `ainvoke` path so non-streaming callers (tests, fallback flag) still work.

**`backend/agents/orchestrator.py`** — `run_agent` gains an optional `token_queue: Optional[asyncio.Queue] = None` keyword arg. It forwards the queue **only** to `run_drafting_final`. No other node touches it.

**`backend/services/chat_service.py`** — `run_chat_stream`:
- Creates `token_queue: asyncio.Queue[Optional[str]] = asyncio.Queue()` when `JD_STREAM_LIVE` is truthy and the current stage is about to enter `final_jd`.
- Launches the agent run as `agent_task = asyncio.create_task(run_agent(state, ..., token_queue=token_queue))`.
- Drains the queue concurrently:
  ```python
  while True:
      chunk = await token_queue.get()
      if chunk is None:
          break
      yield StreamHandler.emit_jd_token(chunk)
  new_state = await agent_task
  ```
- A small wrapper coroutine pushes `None` after `run_agent` completes so the drain loop terminates cleanly even on error.
- Removes the post-hoc word-split + `asyncio.sleep(0.012)` loop at `chat_service.py:182–187` when streaming-live mode is on.
- When `JD_STREAM_LIVE=0`, keep the existing word-split path verbatim.

**`backend/agents/streaming.py`** — `StreamHandler` already has both `emit_token` (line 64) and `emit_jd_token` (line 93). F2 is about the *caller* in `chat_service.py:150` shoving a complete assistant message into `emit_token` (whose contract is "tokens"). Two changes:
- Rename `StreamHandler.emit_token` → `StreamHandler.emit_message` (sends a complete chat message in one event under the `token` SSE event name, preserved for frontend compatibility — the `case 'token':` handler in `ChatContext.jsx:292` already appends, so a single-event "full message" works).
- Add a new thin `StreamHandler.emit_token(chunk)` that emits the same `token` SSE event with the chunk content — for future use when chat tokens (not JD tokens) are actually streamed. Not wired anywhere in Phase 2, but defined for clarity and to match the spec name.
- Update the one caller in `chat_service.py:150` from `emit_token` → `emit_message`.

### 3.2 Frontend changes

**`frontend/src/context/ChatContext.jsx`** — verify the existing `jd_token` SSE handler appends to `finalJdMarkdown` (Phase 1 wired this). If it currently replaces, change to append. No new state added.

### 3.3 Verification

- Manual smoke: run JD flow end-to-end with `JD_STREAM_LIVE=1`. Confirm tokens arrive in real time (not in a single 50-word burst).
- Manual smoke: set `JD_STREAM_LIVE=0` and confirm the typewriter still works.
- Backend unit: mock LLM to yield a known sequence of chunks; assert SSE generator emits matching `jd_token` events in order.

---

## 4. Bucket B — Canvas editing (F3, F5, F7)

### 4.1 New orchestrator actions

All three follow the existing pattern at `backend/agents/orchestrator.py:77` (`elif action == "select_variant":`).

| Action | `action_data` | Effect |
|---|---|---|
| `apply_bias_fix` | `{phrase: str, suggestion: str}` | `state["final_jd"] = state["final_jd"].replace(phrase, suggestion, 1)`. Remove the applied issue from `state["bias_check"]["issues"]`. Re-emit `card_bias` + updated `final_jd`. No stage change. |
| `edit_variant` | `{variant_type: "skill"\|"outcome"\|"hybrid", content: str}` | Overwrite the named variant's `description` / body in `state["jd_variants"]`. Re-emit `card_variants`. Stay on `jd_variants` stage. |
| `regenerate_variants` | `{refinement: Optional[str]}` | Reset `state["jd_variants"] = []`, set `state["variant_refinement"] = refinement`, route back into `run_drafting_variants`. `run_drafting_variants` appends refinement text to its user prompt if present. |
| `rewrite_section` | `{section: Optional[str], instruction: str}` | Set `state["section_rewrite"] = {section, instruction}`, force `state["stage"] = "final_jd"` so the graph's conditional edge routes back into `run_drafting_final`. The node's existing refinement branch at `drafting.py:139` is extended to consume `section_rewrite` instead of (or in addition to) the last user message. |

For F7 (whole-section rail rewrites): when the rail send fires and `workflowStage in {'final_jd', 'complete'}` AND `finalJdMarkdown` is non-empty, the frontend sends `rewrite_section` with `section: null` (full-JD rewrite) and `instruction: <user message>`. Below that stage gate, rail messages continue to send as plain `message` actions (Phase 1 behavior, used for intake clarification). Auto-detecting which JD section the instruction targets is Phase 3.

**Graph routing note:** today the compiled LangGraph terminates after `final_jd` or `complete`. To support re-entry on `rewrite_section` and `regenerate_variants`, `backend/agents/orchestrator.py`'s graph-build step adds conditional edges from the `complete` / `final_jd` terminal nodes back to `drafting_final` / `drafting_variants` when `state["user_action"]` is one of those two actions. This is the only graph-topology change in Phase 2.

### 4.2 Frontend changes

**`frontend/src/components/Chat/blocks/AgentBlockBias.jsx`** — each `<li class="bias-issue">` gains a trailing `<button class="btn btn--sm">Apply</button>` that calls `sendMessage({ action: 'apply_bias_fix', action_data: { phrase, suggestion } })`. The advisory footer ("Suggestions are advisory. Apply by editing…") is removed.

**`frontend/src/components/Chat/blocks/AgentBlockVariants.jsx`** — each variant card gains an `Edit` button (opens a textarea inline; on save sends `edit_variant`); the block footer gains a `Regenerate variants` button (sends `regenerate_variants` with optional refinement from a small text input).

**`frontend/src/components/Chat/RailConversation.jsx`** — when `workflowStage === 'jd_variants'`, show a one-line hint above the message input: *"Tip: ask for a refinement like 'make B more senior-leaning' to regenerate variants."* Hint disappears when the stage advances.

### 4.3 Verification

- Manual: run JD flow to `bias_check`, click `Apply` on one issue, confirm the JD canvas text updates and the issue disappears from the bias block.
- Manual: at `jd_variants`, click `Edit` on variant B, change its description, save, confirm the variants block re-renders.
- Manual: at `jd_variants`, click `Regenerate variants` with refinement "make B more senior", confirm a new set of 3 variants streams in.
- Manual: at `final_jd`, type "rewrite the responsibilities section in second person" in the rail, send, confirm the JD re-streams with second-person responsibilities.
- Backend unit: each action handler tested with a mock state, asserting state mutation and stage routing.

---

## 5. Bucket C — Polish + recovery (F6, F8)

### 5.1 Click-to-scroll stepper (F6)

**`frontend/src/components/Chat/JDStepper.jsx`** — each pill with state `done` becomes a `<button>` with `onClick={() => scrollToStage(stage)}`. `scrollToStage` queries `document.querySelector(\`.agent-block[data-stage="${stage}"]\`)` (the `data-stage` attribute is already present from Phase 1) and calls `.scrollIntoView({ behavior: 'smooth', block: 'start' })`. `current` / `pending` / `skipped` / `retry` pills stay non-clickable.

No backend changes.

### 5.2 Retry card in rail (F8)

**`backend/agents/orchestrator.py`** — add `retry_stage` action:

```python
elif action == "retry_stage":
    failed = state.get("error_stage")
    if failed:
        state["retry_count"] = 0
        state["error_stage"] = None
        state["error_code"] = None
        state["error_message"] = None
        state["stage"] = failed  # re-enter the failed stage
```

The compiled graph's conditional edge already routes to the correct node from `state["stage"]`, so resetting the stage is sufficient.

**`frontend/src/components/Chat/RailStateCard.jsx`** — when `graphState.error_stage` is set, replace the current error banner with an error card containing a `Retry stage` button that sends `{ action: 'retry_stage', action_data: {} }`.

### 5.3 Verification

- Manual: complete `intake`, click the ① pill, confirm canvas scrolls to the intake agent block.
- Manual: force a `final_jd` failure (e.g. break the prompt path temporarily), see the retry card appear in the rail, click Retry, confirm the stage re-runs.

---

## 6. Bucket D — Hygiene (F4, F9 + tech debt)

### 6.1 F4 — Variant follow-up refinement

This is the variant-stage analog of F7 (Bucket B). When `workflowStage === 'jd_variants'` and the user sends a rail message, route it to `regenerate_variants` with `refinement = <message>`. The action and node-side handling already exist after Bucket B; this is purely the rail's send-routing logic.

### 6.2 F9 — Centralized greeting

Today the greeting text lives in two places:
- `backend/services/chat_service.py:26` — `GREETING_MESSAGE = ...`
- `frontend/src/context/ChatContext.jsx` — `resetChat()` hardcodes the same text.

**Fix:** keep the constant in `chat_service.py` as the single source of truth. The session-creation API response already includes the assistant message; `ChatContext.resetChat` should set `messages = []` (not seed an assistant message) and let the backend's first `done` event populate the greeting from the persisted `chat_sessions.messages` JSON. If the new-session endpoint doesn't yet seed the greeting into the session record, extend it to do so.

### 6.3 Tech debt items

- **Stage skip emission for `intake` / `final_jd`** (`orchestrator.py`): these stages never SOFT_SKIP today, but the orchestrator's `_run_meta` should still record them so future stages can be added without retrofitting. Add a single line in each node's success path to append to `_run_meta["transitions"]`.
- **TypedDict warnings in `orchestrator.py`**: change `state: dict` → `state: AgentState` on the helper functions; resolve `action_data is None when action is set` by initializing `action_data = action_data or {}` in `apply_user_action`.
- **`current_user["id"]` → `user_id`** in `backend/routers/positions.py`, `candidates.py`, `talent_pool.py`. Mechanical rename. Tracked in `docs/TECH_DEBT.md`.

### 6.4 Verification

- Manual: start a new session; confirm greeting renders correctly and is identical to the previous behavior (no double greeting, no missing greeting).
- Backend unit: hit each touched router endpoint with a known user, assert no `KeyError` on `user_id` access.

---

## 7. Out of scope (Phase 3)

- Auto-detecting which JD section a rail rewrite targets ("rewrite the responsibilities" → patch only that markdown section, not the whole JD).
- Per-variant streaming (today variants generate as a single JSON blob; live token streaming for each variant card is a UX nicety).
- Offline / disconnect handling beyond Phase 1's "Reconnecting…" toast.
- Optimistic UI for bias-fix Apply.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| `astream_events` behaves differently across LLM providers (OpenAI vs Anthropic adapters) | `JD_STREAM_LIVE=0` flag in Bucket A is one-line revert. Test against both providers before removing flag in Bucket D. |
| Bias-fix `str.replace` finds the wrong occurrence (e.g. "rockstar" inside a longer word) | The bias checker already returns full-phrase boundaries; replace uses `count=1` (first match) so over-replacement is bounded. If false-positive replacements surface in testing, switch to whole-word regex. |
| `regenerate_variants` loops if LLM keeps failing | Existing `retry_count >= 2` guard in `run_drafting_variants` still applies. |
| Click-to-scroll stepper races a stage that hasn't rendered its agent block yet | Only `done` pills are clickable; by definition the block exists. |
| Backend message re-routing (F7) misroutes a clarifying chat message as a JD rewrite | Gate routing on `workflowStage in {'final_jd', 'complete'}` AND `state.final_jd` non-empty. Below that, rail messages stay as plain chat. |

---

## 9. PR sequencing

```
main
 └── task/jd_chat_redesign (Phase 1, currently)
     ├── phase-2/bucket-a-streaming      → merge first
     ├── phase-2/bucket-b-canvas-editing → merge after A
     ├── phase-2/bucket-c-polish         → merge after A (parallel with B)
     └── phase-2/bucket-d-hygiene        → merge last
```

Each bucket is one PR. Bucket A is the only ordering constraint; C can land in parallel with B because the files touched don't overlap.
