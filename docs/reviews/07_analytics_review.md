# Code Review: 07 — Analytics

> **Surface:** AnalyticsPage (frontend), dashboardApi (backend)
> **Reviewer:** Automated GA pass (2026-05-29)
> **Status:** REVIEW COMPLETE

---

## 1. Authorization

| Check | Status | Notes |
|-------|--------|-------|
| API calls scoped | ✅ PASS | Uses `dashboardApi.*` with Bearer token |
| Role gate | ⚠️ WARN | No `RoleGate` on `/analytics` route. All authenticated users can view org-wide analytics including recruiter throughput |

**Finding C-ANA-01 (MEDIUM):** Analytics page should be gated to `org_head`, `dept_admin`, and `platform_admin` roles. A recruiter shouldn't see per-recruiter comparative throughput data.

---

## 2. SQL / Query Safety

| Check | Status | Notes |
|-------|--------|-------|
| Frontend | ✅ N/A | No SQL |
| Backend aggregation endpoints | ⚠️ WARN | Analytics endpoints (`agent-roi`, `bottleneck-radar`, `throughput`) are not yet implemented on backend. Frontend uses mock/fallback data |

**Finding C-ANA-02 (HIGH):** Four analytics endpoints referenced by the frontend don't exist yet on the backend. Frontend gracefully degrades (shows zeros) but this is a feature gap, not a code bug.

---

## 3. Error Handling

| Check | Status | Notes |
|-------|--------|-------|
| Fetch failure | ✅ PASS | Each data section (`roi`, `funnel`, `radar`, `throughput`) has independent error handling |
| Missing data | ✅ PASS | All components render with `?? 0` or `|| []` fallbacks |

---

## 4. Status Transitions

| Check | Status | Notes |
|-------|--------|-------|
| Read-only surface | ✅ N/A | Analytics page has no mutations |

---

## 5. Idempotency

| Check | Status | Notes |
|-------|--------|-------|
| Read-only | ✅ N/A | No mutations |

---

## 6. Email HTML Escaping

| Check | Status | Notes |
|-------|--------|-------|
| Not applicable | ✅ N/A | No emails |

---

## 7. Frontend Loading/Error States

| Check | Status | Notes |
|-------|--------|-------|
| Loading state | ✅ PASS | Shows skeleton placeholders |
| Error fallback | ✅ PASS | Shows "—" values when endpoints fail |
| SVG radar chart | ✅ PASS | Renders gracefully with empty data (no crash) |
| Source table empty | ✅ PASS | Shows "No source data" row |

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 1 (C-ANA-02 — backend endpoints missing) |
| MEDIUM | 1 (C-ANA-01) |
| LOW | 0 |
