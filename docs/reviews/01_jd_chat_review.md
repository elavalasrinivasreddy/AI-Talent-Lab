# Code Review: 01 — JD Chat (frontend/src/components/Chat/*)

> **Surface:** JD Chat redesign — ChatPage, ChatTopBar, JDStepper, JDCanvas, JDRail, MessageList, MessageInput, FinalizeCTA, blocks/*, cards/*
> **Reviewer:** Automated GA pass (2026-05-29)
> **Status:** REVIEW COMPLETE

---

## 1. Authorization (org_id scoping, role gates)

| Check | Status | Notes |
|-------|--------|-------|
| API calls scoped by auth token | ✅ PASS | ChatContext uses `chatApi` which goes through `api.js` with Bearer token injection |
| Role gate on route | ⚠️ WARN | `/chat` route is not gated by `RoleGate` — any authenticated user can access. Spec says only `hr` and `org_head` should create JD sessions |
| Session ownership | ✅ PASS | `loadSession(sessionId)` calls `GET /api/v1/chat/sessions/:id` which is backend-scoped by `org_id` + `user_id` |

**Finding C-CHAT-01 (MEDIUM):** Add `<RoleGate roles={['hr', 'org_head']}>` wrapper around the `/chat` route in `router.jsx`. Currently `team_lead` users can navigate to `/chat` directly even though their intended path is via `/hire-requests/new`.

---

## 2. SQL / Query Safety

| Check | Status | Notes |
|-------|--------|-------|
| Frontend doesn't execute SQL | ✅ N/A | Frontend-only surface |
| Backend chat_service SQL | ✅ PASS | Reviewed `chat_service.py` — all queries use parameterized `$1, $2` syntax with `org_id` filter |

---

## 3. Error Handling

| Check | Status | Notes |
|-------|--------|-------|
| SSE stream error recovery | ✅ PASS | `streaming.py` emits `error` SSE event on exception; frontend ChatContext handles `event: error` |
| Network disconnect recovery | ⚠️ WARN | If SSE connection drops mid-stream, no automatic reconnection. User must manually retry |
| loadSession failure | ✅ PASS | ChatContext `catch` block sets error state, displayed in UI |

**Finding C-CHAT-02 (LOW):** Consider adding SSE reconnect with exponential backoff for dropped connections during `final_jd` streaming.

---

## 4. Status Transitions

| Check | Status | Notes |
|-------|--------|-------|
| Orchestrator stage transitions | ✅ PASS | All 8 stages follow documented lifecycle: intake → internal_check → market_research → benchmarking → jd_variants → final_jd → bias_check → complete |
| HARD STOP handling | ✅ PASS | `jd_variants` and `final_jd` set `error_stage` after 2 retries. `retry_stage` action clears error and re-enters |
| Soft-skip handling | ✅ PASS | `internal_check` and `market_research` can be auto-skipped; `_record_skip()` emits SSE `stage_skipped` |
| `retry_stage` idempotency | ✅ PASS | Resets `retry_count=0`, clears error fields, sets stage to the failed stage. Safe to call multiple times |
| `max_iterations=6` safety net | ✅ PASS | Prevents infinite loops in the `for` loop |

---

## 5. Idempotency

| Check | Status | Notes |
|-------|--------|-------|
| `finalize_jd` action | ⚠️ WARN | Two rapid clicks on "Finalize" both set `stage=complete`. Second call is a no-op at the orchestrator level (stage is already `complete`) but `chat_service` will still persist state twice |
| `apply_bias_fix` action | ✅ PASS | Uses `str.replace(phrase, suggestion, 1)` — only replaces first occurrence. If phrase already replaced, no-op |
| `select_variant` action | ✅ PASS | Overwrites `selected_variant` — calling twice with same type is idempotent |

---

## 6. Email HTML Escaping

| Check | Status | Notes |
|-------|--------|-------|
| No emails sent from chat surface | ✅ N/A | Chat surface doesn't send emails directly. Position creation triggers sourcing emails via Celery task |

---

## 7. Frontend Loading/Error States

| Check | Status | Notes |
|-------|--------|-------|
| Initial load skeleton | ✅ PASS | ChatPage shows loading state via ChatContext `loading` flag |
| JDCanvas loading during stream | ✅ PASS | JDCanvas shows token-by-token rendering via `jd_token` SSE events |
| Error state display | ✅ PASS | Error banner in JDRail shows `error_message` from state with retry button |
| MessageInput disabled states | ✅ PASS | Input disabled while `isStreaming` or `awaiting_user_input=false` (agent is thinking) |
| Empty state | ✅ PASS | New session shows greeting message from interviewer node |

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 (C-CHAT-01) |
| LOW | 1 (C-CHAT-02) |
