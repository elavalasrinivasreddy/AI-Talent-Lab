# Dashboard v3 — Execution Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four execution gaps in the live Dashboard v3 that cause visible UX deceptions and broken admin data.

**Architecture:** All fixes are minimal — two backend additions to `get_stats()`, two frontend component patches. No new files. No schema changes. The `get_briefing` unified endpoint already pipes `health` to the frontend; the backend additions are additive fields on the existing response.

**Tech Stack:** Python/FastAPI (backend), React + vanilla CSS (frontend). No new dependencies.

---

## Context (read before touching anything)

- Route: `/dashboard` — served by `frontend/src/components/Dashboard/DashboardPage.jsx`
- Data hook: `frontend/src/components/Dashboard/useDashboardData.js` — calls `GET /api/v1/dashboard/briefing` which returns `{ health, positions, activity, suggestions }`
- RBAC: `<RoleGate roles={['org_head', 'dept_admin']}>` wraps `<HealthStrip>` in DashboardPage.jsx
- `health` object returned by `get_briefing` → `get_stats()` in `backend/services/dashboard_service.py`
- `get_stats()` currently returns: `active_positions`, `total_candidates`, `applied_this_period`, `interviews_this_period`, `offers_this_period`, `trends`, `period`
- `HealthStrip.jsx` expects `health.org_health_score`, `health.time_to_hire`, `health.cost_per_hire` — **none of these exist** → shows `"—"` for 3 of 4 cards
- Lane tint is set via CSS `--lane-tint` on `.tb-lane` — check `frontend/src/styles/dashboard.css` and `frontend/src/components/Dashboard/BriefingLane.jsx` for how tint is applied
- Migration pattern (DO NOT use raw ALTER — use the idempotent DO $$ pattern): see `backend/db/migrations.py` lines 653–678 for examples

---

## File Map

| File | Change |
|------|--------|
| `backend/services/dashboard_service.py` | Add `avg_time_to_hire` + `selected_this_period` to `get_stats()` return |
| `frontend/src/components/Dashboard/HealthStrip.jsx` | Remap all 4 cards to fields that exist |
| `frontend/src/components/Dashboard/BriefingLane.jsx` | Accept `isEmpty` prop, apply `tb-lane--empty` class |
| `frontend/src/styles/dashboard.css` | Add `.tb-lane--empty` rule (teal tint when clear) |
| `frontend/src/components/Dashboard/TodaysBriefing.jsx` | Pass `isEmpty` to each `<BriefingLane>` |
| `frontend/src/components/Dashboard/DashboardPage.jsx` | Add period-scope hint on the switcher |

---

## Task 1 — Backend: add `avg_time_to_hire` to `get_stats()`

**File:** `backend/services/dashboard_service.py`

The method already opens a connection and runs several queries. Add one more query inside the `async with get_connection() as conn:` block, then include the result in the return dict.

- [ ] **Step 1: Open `backend/services/dashboard_service.py` and find `get_stats()`**

The method signature is:
```python
async def get_stats(org_id, user_id, role, department_id=None, period="week") -> dict:
```
The `cutoff` variable is already computed at the top of the method. The `async with get_connection() as conn:` block is around line 43.

- [ ] **Step 2: Add the avg_time_to_hire query inside the existing `async with` block**

Add this after `total_selected` is fetched (before the `return` statement):

```python
            avg_time_to_hire_raw = await conn.fetchval(
                f"""
                SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)
                FROM candidate_applications
                WHERE {app_filter}
                  AND status IN ('selected', 'hired')
                  AND created_at >= ${len(params) + 1}
                """,
                *params, cutoff,
            )
```

> **Note on params:** `params` already contains `[org_id]` (and possibly `user_id` or `department_id` depending on role). The `$N` index for `cutoff` must be `len(params) + 1` at the point of the query. Double-check the existing queries in the method — each one uses `*params` plus additional positional args. Follow the same pattern.

- [ ] **Step 3: Add the new fields to the return dict**

Find the `return { ... }` at the end of `get_stats()` and add two new keys:

```python
        return {
            "active_positions": open_positions or 0,
            "total_candidates": total_sourced or 0,
            "applied_this_period": total_applied or 0,
            "interviews_this_period": total_interview or 0,
            "offers_this_period": total_selected or 0,
            "avg_time_to_hire": round(float(avg_time_to_hire_raw or 0), 1),
            "trends": {
                "candidates": {
                    "value": current_sourced,
                    "diff": current_sourced - (prev_sourced or 0),
                    "trend": "up" if current_sourced >= (prev_sourced or 0) else "down"
                }
            },
            "period": period,
        }
```

- [ ] **Step 4: Commit**

```bash
git add backend/services/dashboard_service.py
git commit -m "feat(dashboard): add avg_time_to_hire to get_stats response"
```

---

## Task 2 — Frontend: fix HealthStrip field mapping

**File:** `frontend/src/components/Dashboard/HealthStrip.jsx`

Currently the `cards` array tries to read `health.org_health_score`, `health.time_to_hire`, and `health.cost_per_hire` — none of which exist. Replace the 4 card definitions to use the fields that are actually in the health object.

- [ ] **Step 1: Open `HealthStrip.jsx` and find the `cards` array**

It starts around line 37 inside `export default function HealthStrip({ health, loading, error, role })`.

- [ ] **Step 2: Replace the `cards` array with this**

```js
  const cards = [
    {
      label: role === 'dept_admin' ? 'Dept Open Reqs' : 'Org Open Reqs',
      value: health.active_positions ?? '—',
      accent: 'var(--color-info, #3B82F6)',
      icon: <Icon name="briefcase" size={16} />,
    },
    {
      label: 'Avg Time to Hire',
      value: health.avg_time_to_hire ? `${health.avg_time_to_hire}d` : '—',
      accent: 'var(--color-warning, #D97706)',
      icon: <Icon name="clock" size={16} />,
    },
    {
      label: 'Interviews Active',
      value: health.interviews_this_period ?? '—',
      accent: 'var(--color-primary, #0D9488)',
      icon: <Icon name="calendar" size={16} />,
    },
    {
      label: 'Offers Extended',
      value: health.offers_this_period ?? '—',
      accent: 'var(--color-success, #10B981)',
      icon: <Icon name="check-circle" size={16} />,
    },
  ]
```

> **Icon names:** The `Icon` component lives in `frontend/src/components/common/Icon.jsx`. Check the `PATHS` object in that file for valid icon names. `briefcase`, `clock`, `calendar`, `check-circle` should all be present — if any are missing, use the closest available name from that file.

- [ ] **Step 3: Verify the component renders cleanly**

Start the frontend dev server (`npm run dev` or `bun run dev` from the `frontend/` directory) and visit `/dashboard` as an `org_head` user. Confirm all 4 HealthStrip cards show real numbers instead of `—`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Dashboard/HealthStrip.jsx
git commit -m "fix(dashboard): HealthStrip maps to fields that actually exist in health response"
```

---

## Task 3 — Frontend: dynamic lane tint (NOW lane turns teal when empty)

**Problem:** The NOW lane always has a red tint via `--lane-tint`, even when count = 0 ("All clear"). A red-tinted header with "All clear" text is visually contradictory — red signals urgency.

**Fix:** Add a CSS class `tb-lane--empty` that overrides the tint to teal. Apply it in `BriefingLane.jsx` when `rows.length === 0`.

- [ ] **Step 1: Open `frontend/src/styles/dashboard.css` and add the modifier class**

Find the `.tb-lane` block (around line 349). After it, add:

```css
/* When a lane has no items, override the urgency tint to success/clear */
.tb-lane--empty {
  --lane-tint: var(--color-success, #10B981);
}
```

- [ ] **Step 2: Open `frontend/src/components/Dashboard/BriefingLane.jsx`**

Find the root element (likely a `<div className="tb-lane" ...>`). The component receives `rows`, `loading`, `error` props (confirm by reading the file). Add the empty class conditionally:

```jsx
const isEmpty = !loading && !error && rows.length === 0

return (
  <div
    className={`tb-lane${isEmpty ? ' tb-lane--empty' : ''}`}
    style={{ '--lane-tint': tintColor }}
  >
    {/* ... rest unchanged ... */}
  </div>
)
```

> **Note:** If `BriefingLane.jsx` already sets `--lane-tint` via a `style` prop, the inline style will win over the CSS class. In that case, conditionally override the `tintColor` variable instead:
> ```js
> const effectiveTint = isEmpty ? 'var(--color-success, #10B981)' : tintColor
> ```
> Then use `style={{ '--lane-tint': effectiveTint }}`.

- [ ] **Step 3: Open `TodaysBriefing.jsx` and confirm lane row data is passed correctly**

Verify `<BriefingLane>` receives `rows={lanes.now.rows}` (or equivalent). No change needed if it already does — just confirm.

- [ ] **Step 4: Visual check**

Visit `/dashboard`. If the NOW lane has 0 items, its header tint should be teal/green. If it has items (trigger by waiting for Celery, or temporarily mock a row), it should be red.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/dashboard.css frontend/src/components/Dashboard/BriefingLane.jsx
git commit -m "fix(dashboard): NOW lane shows green tint when empty (was misleadingly red)"
```

---

## Task 4 — Frontend: period switcher scope hint

**Problem:** Clicking Today / This Week / This Month appears to filter everything, but lanes (NOW/NEXT/PULSE) don't respond — only the HealthStrip changes. Users will notice and distrust the UI.

**Fix:** Add a small `title` tooltip on the period switcher wrapper explaining the current scope. This is honest without breaking any existing behavior.

- [ ] **Step 1: Open `frontend/src/components/Dashboard/DashboardPage.jsx`**

Find the period switcher block (~line 147):

```jsx
<div className="dash-period-switcher">
  {['today', 'week', 'month'].map(p => (
    <button ...>
```

- [ ] **Step 2: Wrap the switcher with a tooltip title**

```jsx
<div
  className="dash-period-switcher"
  title="Period controls the health metrics above. Lane content refreshes in real-time."
>
  {['today', 'week', 'month'].map(p => (
    <button
      key={p}
      className={`dash-period-btn${period === p ? ' active' : ''}`}
      onClick={() => setPeriod(p)}
      type="button"
    >
      {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
    </button>
  ))}
</div>
```

> **Note:** The `title` attribute shows as a browser tooltip on hover. This is the minimal honest fix. When lanes eventually support period filtering, remove this title and let the behavior speak for itself.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Dashboard/DashboardPage.jsx
git commit -m "fix(dashboard): period switcher tooltip clarifies it controls health metrics only"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All 4 identified gaps addressed (HealthStrip empty data, period deception, NOW tint contradiction, lane clarity)
- [x] **No placeholders:** All steps have exact code
- [x] **Type consistency:** `health.avg_time_to_hire` added in Task 1, consumed in Task 2 — field name matches exactly
- [x] **Params safety:** `get_stats` uses parameterized queries; Task 1 uses `len(params) + 1` to get correct `$N` index
- [x] **No new deps:** Pure CSS + existing component atoms only
