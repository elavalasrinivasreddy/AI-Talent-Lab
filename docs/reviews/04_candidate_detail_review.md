# Code Review: 04 — Candidate Detail

> **Surface:** CandidateDetailPage, CandidateHero, CompareToIdealGrid, ScoreBreakdownBand, TagsRow
> **Reviewer:** Automated GA pass (2026-05-29)
> **Status:** REVIEW COMPLETE

---

## 1. Authorization

| Check | Status | Notes |
|-------|--------|-------|
| Candidate fetch scoped | ✅ PASS | `GET /api/v1/candidates/:id` filters by `org_id` from JWT |
| Cross-position data leak | ✅ PASS | Candidate data includes only applications within the same org |
| Pipeline move action | ✅ PASS | `POST /candidates/:id/move` scoped by org_id |
| Note creation | ✅ PASS | `POST /hiring-notes` requires auth, inserts with org_id |

---

## 2. SQL / Query Safety

| Check | Status | Notes |
|-------|--------|-------|
| Frontend | ✅ N/A | No SQL execution |
| Backend candidate queries | ✅ PASS | All use parameterized queries with org_id scoping |
| Tags insert | ✅ PASS | `INSERT INTO candidate_tags ... ($1,$2,$3,$4)` — parameterized |

---

## 3. Error Handling

| Check | Status | Notes |
|-------|--------|-------|
| Candidate not found | ✅ PASS | 404 shows error state |
| Score data missing | ✅ PASS | `ScoreBreakdownBand` handles `null` scores gracefully with "No score data" fallback |
| Timeline load failure | ✅ PASS | Shows error inline |

---

## 4. Status Transitions

| Check | Status | Notes |
|-------|--------|-------|
| Status move | ✅ PASS | Same pipeline move as position detail — backend validates |
| Rejection flow | ⚠️ WARN | "Draft Rejection" button handler is a stub — dispatches no action yet |

**Finding C-CAND-01 (LOW):** Rejection draft button is wired but the backend `send_rejection` Celery task integration is not connected on this page. Currently silent no-op.

---

## 5. Idempotency

| Check | Status | Notes |
|-------|--------|-------|
| Tag add | ✅ PASS | `UNIQUE(org_id, candidate_id, tag)` constraint in DB — duplicate insert returns conflict, frontend catches |
| Note create | ⚠️ WARN | No client-side duplicate prevention. Rapid double-click creates two identical notes |

**Finding C-CAND-02 (LOW):** Add `isSaving` guard on note submission button.

---

## 6. Email HTML Escaping

| Check | Status | Notes |
|-------|--------|-------|
| Not applicable | ✅ N/A | No emails sent from this surface |

---

## 7. Frontend Loading/Error States

| Check | Status | Notes |
|-------|--------|-------|
| Page skeleton | ✅ PASS | `loading` flag renders skeleton layout |
| Empty timeline | ✅ PASS | Shows "No activity yet" message |
| Score data missing | ✅ PASS | Graceful degradation to dash (—) |
| Tags empty state | ✅ PASS | Shows "Add tags…" prompt |

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 2 (C-CAND-01, C-CAND-02) |
