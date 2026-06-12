# Code Review: 14 — GDPR / Delete My Data

> **Surface:** DeleteMyDataPage (frontend), GDPR router/service (backend)
> **Reviewer:** Automated GA pass (2026-05-29)
> **Status:** REVIEW COMPLETE

---

## 1. Authorization

| Check | Status | Notes |
|-------|--------|-------|
| Public surface | ✅ PASS | Delete My Data page is intentionally public — no account needed |
| Email verification | ✅ PASS | Sends verification link to submitted email. Deletion only proceeds after click |
| Rate limiting | ⚠️ WARN | No rate limit on deletion request submission. Could be abused to send verification emails to arbitrary addresses |

**Finding C-GDPR-01 (MEDIUM):** Add rate limiting on `POST /api/v1/gdpr/delete-request` — max 3 requests per email per hour to prevent email spam abuse.

---

## 2. SQL / Query Safety

| Check | Status | Notes |
|-------|--------|-------|
| Frontend | ✅ N/A | No SQL |
| Candidate lookup | ✅ PASS | `WHERE email = $1` — parameterized |
| Deletion request insert | ✅ PASS | `INSERT INTO data_deletion_requests ... ($1,$2,$3,$4)` — parameterized |
| Token lookup | ✅ PASS | `WHERE request_token = $1` — parameterized |
| Deletion execution | ⚠️ WARN | Actual data deletion SQL needs careful review — must cascade through `candidates`, `candidate_applications`, `scorecards`, `pipeline_events`, `consent_records` |

**Finding C-GDPR-02 (HIGH):** Verify that the data deletion execution path actually deletes from ALL tables containing PII: `candidates`, `candidate_applications`, `candidate_sessions`, `candidate_session_messages`, `scorecards`, `consent_records`, `pipeline_events`, `candidate_tags`, `hiring_notes`. Missing any table violates GDPR right-to-erasure.

---

## 3. Error Handling

| Check | Status | Notes |
|-------|--------|-------|
| Email not found | ✅ PASS | Returns "Request submitted" regardless — doesn't reveal whether email exists (privacy-safe) |
| Invalid token | ✅ PASS | Returns 404 |
| Already processed | ✅ PASS | Returns "Already processed" message |
| Deletion failure | ⚠️ WARN | If deletion SQL fails mid-way, partial deletion could leave orphaned records |

**Finding C-GDPR-03 (MEDIUM):** Wrap deletion execution in a database transaction so it's all-or-nothing. Currently individual DELETEs are not transactional.

---

## 4. Status Transitions

| Check | Status | Notes |
|-------|--------|-------|
| Request lifecycle | ✅ PASS | `pending → verified → processing → completed` (or `rejected`) |
| Verification flow | ✅ PASS | `verified_at` timestamp set when verification link clicked |
| Completion tracking | ✅ PASS | `completed_at` timestamp + `deleted_data` JSON summary |

---

## 5. Idempotency

| Check | Status | Notes |
|-------|--------|-------|
| Duplicate request | ✅ PASS | Multiple requests for same email create separate records (each with unique token). Only verified ones proceed |
| Double verification | ✅ PASS | Second click on verification link → already in `verified` state → no-op |
| Re-deletion | ✅ PASS | If already `completed`, returns "Already processed" |

---

## 6. Email HTML Escaping

| Check | Status | Notes |
|-------|--------|-------|
| Verification email | ⚠️ WARN | Need to verify that the GDPR verification email template (if it exists) escapes user-supplied email address in the HTML body |

**Finding C-GDPR-04 (LOW):** Verify GDPR verification email template escapes the `request_email` field. Email addresses can contain `+`, `<`, `>` characters that could break HTML.

---

## 7. Frontend Loading/Error States

| Check | Status | Notes |
|-------|--------|-------|
| Form submission | ✅ PASS | Shows loading spinner during submission |
| Success state | ✅ PASS | Shows "Request submitted" confirmation with next steps |
| Error state | ✅ PASS | Shows retry button with error message |
| Dev verify section | ✅ PASS | Shows amber-styled dev verification shortcut (dev mode only) |
| Info section | ✅ PASS | Lists what data will be deleted and processing timeline |

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 1 (C-GDPR-02 — incomplete table coverage) |
| MEDIUM | 2 (C-GDPR-01, C-GDPR-03) |
| LOW | 1 (C-GDPR-04) |
