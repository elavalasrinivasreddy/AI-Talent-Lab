# Code Review: 05 — Interviews List

> **Surface:** InterviewsListPage (frontend), interviewsApi (backend)
> **Reviewer:** Automated GA pass (2026-05-29)
> **Status:** REVIEW COMPLETE

---

## 1. Authorization

| Check | Status | Notes |
|-------|--------|-------|
| API calls scoped | ✅ PASS | `interviewsApi.list({ filter: tab })` uses Bearer token; backend scopes by `org_id` |
| Role gate | ⚠️ WARN | No `RoleGate` on the `/interviews` route. All authenticated roles can access interview list. Spec implies `team_lead` should only see interviews for positions they're assigned to |

**Finding C-IV-01 (MEDIUM):** Backend `GET /api/v1/interviews` should optionally filter by `assigned_to` or `created_by` when the user role is `team_lead`.

---

## 2. SQL / Query Safety

| Check | Status | Notes |
|-------|--------|-------|
| Frontend | ✅ N/A | No SQL |
| Backend interview queries | ✅ PASS | Uses `AND org_id = $1` in all queries |

---

## 3. Error Handling

| Check | Status | Notes |
|-------|--------|-------|
| Load failure | ✅ PASS | `console.error` on catch, `loading` state cleared in `finally` |
| Empty results | ✅ PASS | Shows empty state with contextual message |
| Search no results | ✅ PASS | Separate message for "No matching interviews" vs "No interviews yet" |

---

## 4. Status Transitions

| Check | Status | Notes |
|-------|--------|-------|
| Interview card navigation | ✅ PASS | Clicking navigates to position detail, doesn't mutate interview state |
| No status mutations | ✅ N/A | List page is read-only |

---

## 5. Idempotency

| Check | Status | Notes |
|-------|--------|-------|
| Read-only surface | ✅ N/A | No mutations |

---

## 6. Email HTML Escaping

| Check | Status | Notes |
|-------|--------|-------|
| Not applicable | ✅ N/A | No emails from this surface |

---

## 7. Frontend Loading/Error States

| Check | Status | Notes |
|-------|--------|-------|
| Skeleton loading | ✅ PASS | Shows `InterviewSkeleton` (4 animated blocks) during load |
| Empty state | ✅ PASS | Icon + heading + description with contextual text |
| Day selector strip | ✅ PASS | Shows interview count dots per day |
| Time-grouped timeline | ✅ PASS | Groups interviews by time slot for visual clarity |
| Status chips | ✅ PASS | Uses shared `Chip` component with correct variant mapping |

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 (C-IV-01) |
| LOW | 0 |
