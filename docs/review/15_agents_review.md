# Code Review: 15 — Backend Agents (Orchestrator, Drafting, Streaming, Retry)

> **Surface:** agents/orchestrator.py, agents/nodes/drafting.py, agents/nodes/interviewer.py, agents/nodes/internal_analyst.py, agents/nodes/market_intelligence.py, agents/nodes/benchmarking.py, agents/streaming.py, agents/state.py, agents/bias_checker.py
> **Reviewer:** Automated GA pass (2026-05-29)
> **Status:** REVIEW COMPLETE

---

## 1. Authorization

| Check | Status | Notes |
|-------|--------|-------|
| Agent state contains org_id | ✅ PASS | `AgentState` has `org_id: int`, `user_id: int` fields. Set during `create_initial_state()` |
| No cross-org state bleed | ✅ PASS | Each session has its own state. State loaded from DB scoped by `session_id` + `org_id` |
| Internal analyst org scoping | ✅ PASS | Past JD lookup filters by `org_id` from state |
| LLM prompt injection | ⚠️ WARN | User messages are injected into LLM prompts without sanitization. A user could include prompt injection in their messages |

**Finding C-AGENT-01 (MEDIUM):** User messages (especially `requirements` from hire requests and chat messages) are concatenated directly into LLM prompts. While this is standard for chat applications, consider adding a guardrail prompt that instructs the LLM to ignore system-override attempts.

---

## 2. SQL / Query Safety

| Check | Status | Notes |
|-------|--------|-------|
| Agents don't execute SQL | ✅ PASS | Agents work with in-memory state. SQL is in `chat_service.py` and repositories |
| State persistence | ✅ PASS | `chat_service` serializes state to JSON and stores in `chat_sessions.graph_state` |

---

## 3. Error Handling

| Check | Status | Notes |
|-------|--------|-------|
| LLM call failure (drafting) | ✅ PASS | `try/except` with `retry_count`. After 2 failures: sets `error_stage`, `error_code`, `error_message` |
| LLM call failure (interviewer) | ✅ PASS | Same retry pattern |
| Market research failure | ✅ PASS | Soft-skip: sets `market_skipped=True`, records skip reason |
| Internal analyst failure | ✅ PASS | Soft-skip: sets `internal_skipped=True` |
| Bias check failure | ✅ PASS | Sets `bias_skipped=True`, records empty issues |
| JSON parse failure | ⚠️ WARN | If LLM returns malformed JSON for variants, `json.loads` raises `JSONDecodeError`, caught by outer `except Exception` → retry |
| `max_iterations=6` | ✅ PASS | Safety net against infinite loops |
| Streaming failure | ✅ PASS | `streaming.py` emits `STREAM_INTERRUPTED` error event |

**Finding C-AGENT-02 (MEDIUM):** `streaming.py` line 55 exposes internal exception details via `str(e)` in the error SSE event: `"details": str(e)`. Per quality rules, internal error details should not be exposed to API responses/events.

---

## 4. Status Transitions

| Check | Status | Notes |
|-------|--------|-------|
| Stage lifecycle | ✅ PASS | Documented 8-stage pipeline enforced in `run_agent()` |
| HARD STOP stages | ✅ PASS | `jd_variants` and `final_jd` retry once, then surface error card. No auto-skip |
| Soft-skip stages | ✅ PASS | `internal_check` and `market_research` can auto-skip when no data available |
| `retry_stage` action | ✅ PASS | Clears error, resets retry_count=0, resumes from failed stage. Idempotent (calling on non-error state is a no-op because `error_stage` is None) |
| Unknown stage guard | ✅ PASS | `else: logger.warning(f"Unknown stage: {current_stage}"); break` |
| `finalize_jd` with draft status | ✅ PASS | `status=draft` keeps stage at `final_jd`, doesn't mark complete |
| `complete` stage | ✅ PASS | Terminal — breaks the loop immediately |
| `section_rewrite` one-shot | ✅ PASS | `state.pop("section_rewrite", None)` consumed after use |
| `variant_refinement` one-shot | ✅ PASS | `state.pop("variant_refinement", None)` consumed after use |

---

## 5. Idempotency

| Check | Status | Notes |
|-------|--------|-------|
| `retry_stage` | ✅ PASS | Safe to call multiple times — resets count and re-enters stage |
| `apply_bias_fix` | ✅ PASS | `str.replace(phrase, suggestion, 1)` — replaces first occurrence only. If already applied, phrase not found → no change |
| `finalize_jd` twice | ✅ PASS | Overwrites `final_jd` content, sets stage to `complete`. Second call on `complete` stage is a no-op |
| `select_variant` twice | ✅ PASS | Overwrites `selected_variant` — idempotent |

---

## 6. Email HTML Escaping

| Check | Status | Notes |
|-------|--------|-------|
| Not applicable | ✅ N/A | Agents don't send emails. Email sending happens in Celery tasks via EmailService |

---

## 7. State Persistence

| Check | Status | Notes |
|-------|--------|-------|
| State saved after node completion | ✅ PASS | `chat_service` persists state to DB after every `run_agent()` call (per rule #6) |
| Resume after refresh | ✅ PASS | `loadSession` fetches state from DB and resumes |
| `_run_meta` transient field | ✅ PASS | Consumed same-turn for SSE emission, not persisted long-term |

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 2 (C-AGENT-01, C-AGENT-02) |
| LOW | 0 |
