# Code Review Findings — task/jd_chat_redesign branch
<!-- Generated: 2026-05-29 by Claude Sonnet 4.6 + Opus 4.8 review agents -->
<!-- Status: C1 and C2 FIXED. C3–C10 pending. -->

## Scope
Branch: `task/jd_chat_redesign` vs `main`
Diff: 238 files, ~32k insertions
Review method: 7-angle parallel review (Angles A–G) via Opus 4.8 subagents + Opus 4.8 verification pass

## Surfaces reviewed
- backend/dependencies.py (role system refactor)
- backend/routers/auth.py
- backend/routers/hire_requests.py
- backend/routers/positions.py (partial)
- backend/routers/platform.py
- backend/services/auth_service.py
- backend/services/hire_request_service.py
- frontend/src/context/AuthContext.jsx
- frontend/src/utils/api.js
- frontend/src/router.jsx

## Surfaces reviewed (GA pass — 2026-05-29)

All 19 remaining surfaces have been reviewed. Individual review docs:

| # | Surface | Review doc | Findings |
|---|---------|-----------|----------|
| 1 | JD Chat | [01_jd_chat_review.md](01_jd_chat_review.md) | 0 CRIT, 0 HIGH, 1 MED, 1 LOW |
| 2 | Dashboard v3 | [02_dashboard_review.md](02_dashboard_review.md) | 0 CRIT, 0 HIGH, 1 MED, 0 LOW |
| 3 | Positions | [03_positions_review.md](03_positions_review.md) | 0 CRIT, 0 HIGH, 1 MED, 1 LOW |
| 4 | Candidate Detail | [04_candidate_detail_review.md](04_candidate_detail_review.md) | 0 CRIT, 0 HIGH, 0 MED, 2 LOW |
| 5 | Interviews | [05_interviews_review.md](05_interviews_review.md) | 0 CRIT, 0 HIGH, 1 MED, 0 LOW |
| 6 | Talent Pool | [06_talent_pool_review.md](06_talent_pool_review.md) | 0 CRIT, 0 HIGH, 0 MED, 1 LOW |
| 7 | Analytics | [07_analytics_review.md](07_analytics_review.md) | 0 CRIT, 1 HIGH, 1 MED, 0 LOW |
| 8 | Settings | [08_settings_review.md](08_settings_review.md) | 0 CRIT, 0 HIGH, 2 MED, 1 LOW |
| 9 | Hire Requests UI | [09_hire_requests_review.md](09_hire_requests_review.md) | 0 CRIT, 0 HIGH, 1 MED, 2 LOW |
| 10 | Platform Admin | [10_platform_admin_review.md](10_platform_admin_review.md) | 0 CRIT, 0 HIGH, 0 MED, 0 LOW |
| 11 | Apply Page | [11_apply_page_review.md](11_apply_page_review.md) | 0 CRIT, 0 HIGH, 1 MED, 1 LOW |
| 12 | Panel Feedback | [12_panel_feedback_review.md](12_panel_feedback_review.md) | 0 CRIT, 0 HIGH, 0 MED, 1 LOW |
| 13 | Career Page | [13_career_page_review.md](13_career_page_review.md) | 0 CRIT, 0 HIGH, 0 MED, 0 LOW |
| 14 | GDPR | [14_gdpr_review.md](14_gdpr_review.md) | 0 CRIT, 1 HIGH, 2 MED, 1 LOW |
| 15 | Agents | [15_agents_review.md](15_agents_review.md) | 0 CRIT, 0 HIGH, 2 MED, 0 LOW |
| 16 | Tavily Adapter | [16_tavily_adapter_review.md](16_tavily_adapter_review.md) | 0 CRIT, 0 HIGH, 0 MED, 1 LOW |
| 17 | Migrations | [17_migrations_review.md](17_migrations_review.md) | 0 CRIT, 0 HIGH, 3 MED, 2 LOW |
| 18 | Hire Requests Repo | [18_hire_requests_repo_review.md](18_hire_requests_repo_review.md) | 0 CRIT, 0 HIGH, 0 MED, 1 LOW |
| 19 | Models + Config | [19_models_config_review.md](19_models_config_review.md) | 0 CRIT, 0 HIGH, 0 MED, 1 LOW |

### Consolidated totals (GA pass only — excludes C1–C10 from initial review)

| Severity | Count | Top concern |
|----------|-------|-------------|
| CRITICAL | 0 | — |
| HIGH | 2 | C-ANA-02 (analytics endpoints missing), C-GDPR-02 (deletion table coverage) |
| MEDIUM | 16 | Role gates, idempotency guards, state persistence, rate limiting |
| LOW | 15 | UI polish, debounce, enum validation |

---

## Confirmed Findings

### C1 — FIXED ✅
**File:** `backend/routers/hire_requests.py` lines 142, 163
**Severity:** CRITICAL (auth mechanism broken)
**Bug:** `current_user.get("department_id")` → key doesn't exist. `dependencies.py:61` stores it as `"dept_id"`. Always returns `None`, so `HireRequestService.approve_request` always gets `dept_id=None` and raises `InsufficientPermissionsError` for every dept_admin approval attempt.
**Fix applied:** Changed both occurrences to `current_user.get("dept_id")`.

### C2 — FIXED ✅
**File:** `backend/routers/positions.py` line 200
**Severity:** CRITICAL (silent notification failure)
**Bug:** `WHERE u.role IN ('admin', 'hiring_manager')` — these roles were renamed in the role refactor. No users have these roles. The INSERT...SELECT matches zero rows; nobody is notified when a position is submitted for approval.
**Fix applied:** Changed to `WHERE u.role IN ('org_head', 'team_lead', 'dept_admin')`.

### C3 — PENDING
**File:** `frontend/src/context/AuthContext.jsx` line 76
**Severity:** HIGH
**Bug:** Bootstrap `catch` block is bare — clears session on ANY error including transient 5xx/network. Unlike `refreshUser` which guards on `e?.status === 401`.
**Fix:** Check error status before clearing:
```jsx
} catch (e) {
  if (cancelled) return
  if (e?.response?.status === 401 || e?.status === 401) {
    setUser(null); setOrg(null); setToken(null)
    saveSession(null, null, null)
  }
  // transient errors: leave state intact, user stays logged in
} finally {
```

### C4 — PENDING
**File:** `backend/services/position_service.py` ~line 249 (`record_approval_decision`)
**Severity:** HIGH
**Bug:** No idempotency guard. Two concurrent POSTs to `/approval-decision?decision=approved` both see status='pending', both UPDATE to approved, both dispatch `run_candidate_search.delay()`. Candidates receive duplicate outreach.
**Fix:** Add guard at the start of `record_approval_decision`:
```python
if position["approval_status"] == decision:
    return position  # already in this state, no-op
```

### C5 — PENDING
**File:** `backend/routers/positions.py` line ~455 (legacy `submit_hire_request` shim)
**Severity:** HIGH
**Bug:** `body: dict` — `comp_min`, `comp_max`, `experience_min`, `experience_max` are passed raw (no `int()` coercion). `HireRequestService._validate_payload` does bare `< 0` comparisons without type checking. String value → `TypeError: '<' not supported between 'str' and 'int'` → unhandled 500.
**Fix:** Add coercion in the legacy shim:
```python
def _to_int_or_none(v):
    try: return int(v) if v is not None else None
    except (TypeError, ValueError): return None

experience_min=_to_int_or_none(body.get("experience_min")),
experience_max=_to_int_or_none(body.get("experience_max")),
comp_min=_to_int_or_none(body.get("comp_min")),
comp_max=_to_int_or_none(body.get("comp_max")),
```

### C6 — PENDING
**File:** `frontend/src/utils/api.js` line 11
**Severity:** MEDIUM (PLAUSIBLE)
**Bug:** Default `_tokenGetter = () => null`. Before `AuthContext`'s mount effect calls `setTokenGetter`, any API call sends no Authorization header. Previously fell back to `localStorage.getItem('token')`.
**Fix:** Wire `setTokenGetter` in a layout effect (`useLayoutEffect`) so it fires before children paint, OR keep the sessionStorage fallback:
```js
let _tokenGetter = () => {
  try { return JSON.parse(sessionStorage.getItem('atl_session') || 'null')?.token || null }
  catch { return null }
}
```

### C7 — PENDING
**File:** `backend/services/hire_request_service.py` lines 197, 212, 355, 372, 386, 496, 632, 704, 775
**Severity:** MEDIUM (schema evolution risk)
**Bug:** 9 raw `INSERT INTO notifications (org_id, user_id, type, title, message, action_url)` SQL statements bypass `NotificationService.create()` and `NotificationRepository.create()`. If a NOT NULL column is added to `notifications`, all 9 break silently inside transactions.
**Fix:** Replace with `NotificationService.create_for_role(...)` calls (already exists in `backend/services/notification_service.py`).

### C8 — PENDING
**File:** `backend/routers/positions.py` (`get_applicants_daily`)
**Severity:** LOW-MEDIUM
**Bug:** `days: int = 30` has no upper bound. `?days=999999` scans full history of `candidate_applications`.
**Fix:** `days = min(max(days, 1), 365)`

### C9 — PENDING
**File:** `backend/routers/positions.py` lines 252-253, `get_stage_counts` lines 280-281
**Severity:** LOW
**Bug:** Both handlers use `async with get_connection() as conn:` instead of `db=Depends(get_db)`, inconsistent with every other handler in the same router.
**Fix:** Add `db: asyncpg.Connection = Depends(get_db)` parameter to both handlers.

### C10 — PENDING
**File:** `backend/routers/platform.py` lines 17, 44, 69
**Severity:** LOW
**Bug:** Same `get_connection()` pattern as C9 — all three platform handlers bypass the standard connection injection.
**Fix:** Add `db=Depends(get_db)` to all three handlers.

---

## GA Review — COMPLETED (2026-05-29)

All 19 surfaces have been reviewed across the 7-angle checklist:
1. ✅ Authorization (org_id scoping, role gates)
2. ✅ SQL / query safety (parameterized queries, org scoping)
3. ✅ Error handling (service exceptions, standard error format)
4. ✅ Status transitions (HARD STOP handling, retry idempotency)
5. ✅ Frontend loading/error states (skeletons, empty states, role checks)
6. ✅ Email HTML escaping (`html.escape()` on all user-supplied fields)
7. ✅ Idempotency (mutation endpoints, double-click protection)

### Priority fixes (pre-merge)

1. **C3–C10** from initial review — still PENDING (see sections above)
2. **C-GDPR-02** (HIGH) — verify data deletion covers ALL PII-containing tables
3. **C-ANA-02** (HIGH) — analytics backend endpoints not yet implemented
4. **C-MIG-04** (MEDIUM) — AI behavior settings have no DB storage
5. **C-GDPR-01** (MEDIUM) — add rate limiting on deletion request endpoint
6. **C-GDPR-03** (MEDIUM) — wrap deletion in DB transaction
7. **C-SET-03** (MEDIUM) — duplicate user invite prevention

---

## Session handoff notes
- Branch: `task/jd_chat_redesign`
- All work was done by Google Antigravity (Opus 4.6), not yet committed to git
- Commit strategy: one commit per feature, after all issues on that feature are fixed
- C1 and C2 were fixed in this session (2026-05-29)
- Remaining fixes (C3–C10) should be applied before committing
- After fixes, update `docs/STATUS.md` and `docs/design/WORKPLAN.md`
