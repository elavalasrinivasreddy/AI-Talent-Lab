# Code Review: 09 — Hire Requests UI

> **Surface:** HireRequestListPage, HireRequestForm, HireRequestDetailPage, HireRequestCard, RelayVisualization, helpers.js, icons.jsx
> **Reviewer:** Automated GA pass (2026-05-29)
> **Status:** REVIEW COMPLETE

---

## 1. Authorization

| Check | Status | Notes |
|-------|--------|-------|
| List fetch scoped | ✅ PASS | `hireRequestsApi.list()` uses Bearer; backend scopes by `org_id` |
| Create requires auth | ✅ PASS | `POST /api/v1/hire-requests` checks auth token |
| Approve/reject gated | ✅ PASS | Backend `approve_request` checks `dept_admin` or `org_head` role |
| Accept gated | ✅ PASS | Backend `accept_request` checks `hr` role |
| dept_id key fix | ✅ FIXED | C1 from code_review_findings.md was fixed — uses `dept_id` not `department_id` |
| Role display | ⚠️ WARN | Frontend shows "Approve" button to all users. Only backend rejects non-`dept_admin` users |

**Finding C-HR-01 (LOW):** Hide "Approve" / "Reject" buttons on HireRequestDetailPage when user role is not `dept_admin` or `org_head`. Currently shows buttons that result in 403 on click.

---

## 2. SQL / Query Safety

| Check | Status | Notes |
|-------|--------|-------|
| Frontend | ✅ N/A | No SQL |
| Repository queries | ✅ PASS | `HireRequestRepository` uses parameterized `$N` syntax throughout. All queries scoped by `org_id` |
| `update()` method | ✅ PASS | Uses `allowed` set to whitelist updateable columns — prevents SQL injection via field names |
| `_LIST_SELECT` join | ✅ PASS | No dynamic SQL in the join. All static with parameterized WHERE |

---

## 3. Error Handling

| Check | Status | Notes |
|-------|--------|-------|
| Request not found | ✅ PASS | Backend returns 404; frontend shows error state |
| Create validation | ⚠️ KNOWN | C5 from code_review_findings.md — `comp_min/comp_max/experience_min/experience_max` not coerced to int in legacy shim |
| Approve already-approved | ✅ PASS | Service layer checks `status == 'pending'` before calling `repo.approve()` |
| Form validation | ✅ PASS | Frontend validates `role_name` required before submit |

---

## 4. Status Transitions

| Check | Status | Notes |
|-------|--------|-------|
| Lifecycle | ✅ PASS | `pending → approved → accepted → fulfilled` and `pending → rejected` documented and enforced in service layer |
| Cancel from any state | ⚠️ WARN | `repo.cancel()` doesn't check current status — can cancel a `fulfilled` request |

**Finding C-HR-02 (MEDIUM):** `HireRequestRepository.cancel()` should only allow cancellation from `pending` or `approved` states. Cancelling a `fulfilled` request (which has a linked position) is semantically wrong.

---

## 5. Idempotency

| Check | Status | Notes |
|-------|--------|-------|
| Approve twice | ✅ PASS | Service layer checks `status == 'pending'` — second call fails with "Request already processed" |
| Accept twice | ✅ PASS | Checks `status == 'approved'` — second call rejected |
| Create duplicate | ⚠️ WARN | No unique constraint on `(org_id, role_name, status='pending')` — user can submit identical requests |

**Finding C-HR-03 (LOW):** Consider rate-limiting or deduplication on create endpoint to prevent accidental duplicate submissions.

---

## 6. Email HTML Escaping

| Check | Status | Notes |
|-------|--------|-------|
| Hire request raised email | ✅ PASS | `send_hire_request_raised()` escapes `raiser_name`, `role_name`, `dept_name` |
| Hire request approved email | ✅ PASS | All user-supplied fields escaped |
| Hire request rejected email | ✅ PASS | `reason` field escaped via `html.escape(reason)` |
| Hire request picked up email | ✅ PASS | All fields escaped |
| Raw SQL notifications | ⚠️ KNOWN | C7 from code_review_findings.md — 9 raw INSERT INTO notifications bypass NotificationService. No HTML escaping there, but notification fields aren't rendered as HTML |

---

## 7. Frontend Loading/Error States

| Check | Status | Notes |
|-------|--------|-------|
| List loading | ✅ PASS | Shows skeleton cards during load |
| Detail loading | ✅ PASS | Full-page skeleton |
| Form validation errors | ✅ PASS | Inline field errors |
| Empty list | ✅ PASS | "No hire requests" empty state |
| Relay visualization | ✅ PASS | Shows status timeline with current stage highlighted |

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 (C-HR-02) |
| LOW | 2 (C-HR-01, C-HR-03) |
