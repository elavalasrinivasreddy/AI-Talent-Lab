# Code Review: 03 — Positions List + Position Detail

> **Surface:** PositionDetailPage, PositionHero, StageStatStrip, PipelineStackView, CandidateRankedRow, SparklineApplicants, tabs/*
> **Reviewer:** Automated GA pass (2026-05-29)
> **Status:** REVIEW COMPLETE

---

## 1. Authorization

| Check | Status | Notes |
|-------|--------|-------|
| Position fetch scoped by org_id | ✅ PASS | `positionsApi.get(id)` hits `GET /api/v1/positions/:id` which filters by `org_id` from JWT |
| Candidate search trigger | ✅ PASS | `POST /api/v1/positions/:id/trigger-search` checks auth and org_id |
| Pipeline stage move | ✅ PASS | `POST /api/v1/candidates/:id/move` scoped by org_id |
| Settings tab visibility | ⚠️ WARN | PositionSettingsTab is visible to all roles. Spec says only `hr` + `org_head` should edit position settings |

**Finding C-POS-01 (MEDIUM):** Gate the `settings` tab behind `<RoleGate roles={['hr','org_head']}>` in `PositionDetailPage.jsx`.

---

## 2. SQL / Query Safety

| Check | Status | Notes |
|-------|--------|-------|
| Frontend | ✅ N/A | No direct SQL |
| Backend `positionsApi.get` | ✅ PASS | Uses parameterized queries with `AND org_id = $N` |
| `get_applicants_daily` days param | ⚠️ KNOWN | Already tracked as C8 in code_review_findings.md — `days` has no upper bound |

---

## 3. Error Handling

| Check | Status | Notes |
|-------|--------|-------|
| Position not found | ✅ PASS | Sets `error` state, shows error message |
| Search trigger failure | ✅ PASS | Sets `searchMsg` with error text, auto-clears after timeout |
| Tab content errors | ✅ PASS | Each tab component handles its own error state |

---

## 4. Status Transitions

| Check | Status | Notes |
|-------|--------|-------|
| Pipeline stage moves | ✅ PASS | Backend `candidate_pipeline.move_stage()` validates transition legality |
| Approval flow | ⚠️ KNOWN | Already tracked as C4 — no idempotency guard on `record_approval_decision`. Two concurrent approvals dispatch duplicate Celery tasks |

---

## 5. Idempotency

| Check | Status | Notes |
|-------|--------|-------|
| Trigger search button | ✅ PASS | Uses `searching` flag to disable button during request |
| Pipeline move | ⚠️ WARN | No client-side debounce on drag-drop. Two rapid drops could fire two `move` API calls |

**Finding C-POS-02 (LOW):** Add a debounce or `isMutating` guard on the pipeline move handler.

---

## 6. Email HTML Escaping

| Check | Status | Notes |
|-------|--------|-------|
| Not directly applicable | ✅ N/A | Position surface doesn't send emails. Sourcing emails triggered via Celery are covered in email_service review |

---

## 7. Frontend Loading/Error States

| Check | Status | Notes |
|-------|--------|-------|
| Position load skeleton | ✅ PASS | `loading` state shows skeleton via conditional render |
| Summary unavailable fallback | ✅ PASS | `summaryUnavailable` flag shows fallback when stage counts endpoint fails |
| Empty pipeline | ✅ PASS | PipelineStackView shows empty state message per stage |
| Tab loading | ✅ PASS | Each tab (Candidates, JD, InterviewKit, Activity, Settings) handles loading independently |

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 (C-POS-01) |
| LOW | 1 (C-POS-02) |
