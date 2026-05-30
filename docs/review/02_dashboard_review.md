# Code Review: 02 — Dashboard v3

> **Surface:** DashboardPage, TodaysBriefing, CopilotBar, DeptChipBar, HealthStrip, PositionPulse, VelocitySparkline, useDashboardData
> **Reviewer:** Automated GA pass (2026-05-29)
> **Status:** REVIEW COMPLETE

---

## 1. Authorization

| Check | Status | Notes |
|-------|--------|-------|
| Auth token on API calls | ✅ PASS | `useDashboardData` uses `dashboardApi.*` which routes through `api.js` Bearer injection |
| Role-gated sections | ✅ PASS | `HealthStrip` and `DeptChipBar` wrapped in `<RoleGate roles={['org_head','dept_admin','platform_admin']}>` |
| Period switcher data leak | ✅ PASS | Backend `/api/v1/dashboard/stats` scopes by `org_id` from token — no cross-tenant data possible |
| `team_lead` vs `hr` scoping | ⚠️ WARN | Backend `dashboard_stats` returns all positions for org, not filtered by `assigned_to` for `hr` role. A recruiter sees all org positions, not just their own |

**Finding C-DASH-01 (MEDIUM):** Backend `/api/v1/dashboard/stats` should filter positions by `assigned_to = user_id` when `role = 'hr'` to match spec §5 "Recruiter sees only their own positions."

---

## 2. SQL / Query Safety

| Check | Status | Notes |
|-------|--------|-------|
| Frontend-only | ✅ N/A | No direct SQL |
| Backend dashboard endpoints | ⚠️ WARN | `DeptChipBar` sends `dept` param but backend doesn't filter by it — DeptChipBar is non-functional (tracked in STATUS.md) |

---

## 3. Error Handling

| Check | Status | Notes |
|-------|--------|-------|
| Individual section errors | ✅ PASS | `useDashboardData` tracks `error.health`, `error.positions`, `error.lanes` separately |
| HealthStrip error prop | ✅ PASS | Shows fallback when `error.health` is set |
| Copilot dismiss error | ✅ PASS | `dismissAll` silently catches (non-critical feature) |

---

## 4. Status Transitions

| Check | Status | Notes |
|-------|--------|-------|
| No mutations on dashboard | ✅ N/A | Dashboard is read-only (except copilot dismiss) |

---

## 5. Idempotency

| Check | Status | Notes |
|-------|--------|-------|
| Copilot dismiss | ✅ PASS | `PATCH /copilot/:id/dismiss` is idempotent — sets `is_dismissed=true` regardless of current state |

---

## 6. Email HTML Escaping

| Check | Status | Notes |
|-------|--------|-------|
| No emails | ✅ N/A | Dashboard doesn't send emails |

---

## 7. Frontend Loading/Error States

| Check | Status | Notes |
|-------|--------|-------|
| Skeleton loading | ✅ PASS | `HealthStrip` and `PositionPulse` accept `loading` prop and render skeletons |
| Empty state | ✅ PASS | `TodaysBriefing` shows empty lane message when no rows |
| Legacy fallback | ✅ PASS | `?legacy_dashboard=1` loads `LegacyDashboard` via `React.lazy` with `<Suspense>` fallback |

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 (C-DASH-01) |
| LOW | 0 |
