# Code Review: 11 — Apply Page (Candidate Chat)

> **Surface:** ApplyPage (frontend), candidate_chat agent (backend), candidate sessions
> **Reviewer:** Automated GA pass (2026-05-29)
> **Status:** REVIEW COMPLETE

---

## 1. Authorization

| Check | Status | Notes |
|-------|--------|-------|
| Magic link authentication | ✅ PASS | Apply page accessed via signed JWT magic link — no account needed |
| Token expiry check | ✅ PASS | Backend verifies `magic_link_expires_at` and rejects expired tokens |
| Token single-use for apply | ⚠️ WARN | Apply magic links are NOT single-use (unlike panel feedback links). Candidate can revisit and continue session. This is by design per spec |
| Org scoping | ✅ PASS | `candidate_sessions.org_id` populated from the magic link JWT payload |
| No cross-org leak | ✅ PASS | Session can only access the candidate_application it was created for |

---

## 2. SQL / Query Safety

| Check | Status | Notes |
|-------|--------|-------|
| Frontend | ✅ N/A | No SQL |
| Backend candidate_chat queries | ✅ PASS | All queries use parameterized syntax with `org_id` scoping |
| Session creation | ✅ PASS | `INSERT INTO candidate_sessions` uses `$1,$2,$3` syntax |
| Resume text storage | ✅ PASS | Stored as TEXT, file discarded after extraction (per rule #8) |

---

## 3. Error Handling

| Check | Status | Notes |
|-------|--------|-------|
| Invalid/expired link | ✅ PASS | Shows "This link has expired" message with no retry option |
| Chat agent failure | ✅ PASS | `candidate_chat.py` catches LLM exceptions and surfaces empathetic error message |
| Resume parse failure | ✅ PASS | Falls back to "We couldn't parse your resume. Please describe your experience instead." |
| Session save failure | ⚠️ WARN | If `candidate_sessions` UPDATE fails, the session state is lost but the user gets no visible error |

**Finding C-APPLY-01 (MEDIUM):** If session state persistence fails, show a "Your progress may not be saved" warning rather than silently continuing.

---

## 4. Status Transitions

| Check | Status | Notes |
|-------|--------|-------|
| Session lifecycle | ✅ PASS | `active → completed`. Backend sets `completed_at` timestamp |
| Application status | ✅ PASS | On completion, `candidate_applications.status` updated from `outreached`/`clicked` to `applied` |
| Consent recording | ✅ PASS | Consent records created in `consent_records` table at session start |
| Double completion | ⚠️ WARN | If candidate refreshes during the completion step, the completion handler fires again |

**Finding C-APPLY-02 (LOW):** Add idempotency guard: if `candidate_sessions.status == 'completed'`, skip the completion side effects (status update, consent re-record).

---

## 5. Idempotency

| Check | Status | Notes |
|-------|--------|-------|
| Session resume | ✅ PASS | Same magic link re-opens existing session with preserved state |
| Message replay | ✅ PASS | Chat messages stored in `candidate_session_messages` — no duplicates on resume |
| Double submit | ⚠️ WARN (C-APPLY-02) | See finding above |

---

## 6. Email HTML Escaping

| Check | Status | Notes |
|-------|--------|-------|
| Outreach email | ✅ PASS | `send_candidate_outreach()` escapes `candidate_name`, `role_name`, `org_name` |
| Follow-up email | ✅ PASS | Same escaping pattern |
| Magic link URL | ✅ PASS | URL escaped with `html.escape(url, quote=True)` |

---

## 7. Frontend Loading/Error States

| Check | Status | Notes |
|-------|--------|-------|
| Link validation loading | ✅ PASS | Shows "Verifying your link…" during validation |
| Expired link | ✅ PASS | Shows empathetic "this link has expired" message |
| Chat loading | ✅ PASS | Shows typing indicator during AI response |
| Resume upload progress | ✅ PASS | Shows upload progress bar |
| Completion confirmation | ✅ PASS | Shows "Application submitted!" with status portal link |
| Mobile responsive | ✅ PASS | 560px centered card, 44px touch targets |

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 (C-APPLY-01) |
| LOW | 1 (C-APPLY-02) |
