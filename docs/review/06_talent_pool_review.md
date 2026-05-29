# Code Review: 06 — Talent Pool

> **Surface:** TalentPoolPage (frontend), talentPoolApi (backend)
> **Reviewer:** Automated GA pass (2026-05-29)
> **Status:** REVIEW COMPLETE

---

## 1. Authorization

| Check | Status | Notes |
|-------|--------|-------|
| API calls scoped | ✅ PASS | `talentPoolApi.list()` uses Bearer token; backend scopes by `org_id` |
| Bulk actions | ⚠️ WARN | "Add to Position" action sends `candidate_id` + `position_id` but doesn't re-verify that both belong to the same `org_id` on the frontend. Backend must enforce |

**Finding C-TP-01 (LOW):** Frontend should validate that selected position belongs to same org before making API call (defense in depth). Backend enforces this correctly.

---

## 2. SQL / Query Safety

| Check | Status | Notes |
|-------|--------|-------|
| Frontend | ✅ N/A | No SQL |
| Backend talent pool queries | ✅ PASS | `AND c.org_id = $1` on all candidate pool queries |
| `in_talent_pool` filter | ✅ PASS | Uses index `idx_talent_pool` for performance |

---

## 3. Error Handling

| Check | Status | Notes |
|-------|--------|-------|
| Load failure | ✅ PASS | Sets error state, shows fallback |
| Empty pool | ✅ PASS | Shows empty state with "no candidates in talent pool" message |

---

## 4. Status Transitions

| Check | Status | Notes |
|-------|--------|-------|
| Contact status toggle | ✅ PASS | `PATCH /candidates/:id` updates `contact_status` field with valid values |
| Add to position | ✅ PASS | Creates `candidate_application` record. Duplicate prevented by `UNIQUE(candidate_id, position_id)` constraint |

---

## 5. Idempotency

| Check | Status | Notes |
|-------|--------|-------|
| Add to position | ✅ PASS | DB unique constraint prevents duplicate applications |
| Contact status update | ✅ PASS | Setting same status is a no-op (UPDATE sets same value) |

---

## 6. Email HTML Escaping

| Check | Status | Notes |
|-------|--------|-------|
| Not applicable | ✅ N/A | No emails from talent pool surface |

---

## 7. Frontend Loading/Error States

| Check | Status | Notes |
|-------|--------|-------|
| Skeleton loading | ✅ PASS | Shows skeleton cards during load |
| Empty state | ✅ PASS | Empty state with icon and description |
| Search/filter responsive | ✅ PASS | Filters update in real-time |
| Score band colors | ✅ PASS | Matrix cells use `SCORE_BAND` constant for consistent color coding |

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 1 (C-TP-01) |
