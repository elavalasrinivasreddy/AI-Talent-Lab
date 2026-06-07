# Analytics v3 — Agent ROI Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic "Hiring Analytics" page with the planned "Agent ROI Dashboard" — making the AI's contribution quantifiable and visible, with dual AI/human funnel comparison, bottleneck radar, per-recruiter throughput, and override signals.

**Architecture:** 4 new backend aggregation endpoints + full frontend rewrite. The existing `GET /api/v1/dashboard/analytics` endpoint is retained (used by current page) and the old AnalyticsPage.jsx is replaced in-place. All new components are co-located in `frontend/src/components/Analytics/`. No chart library — inline SVG throughout, following the existing `VelocitySparkline` pattern. AI vs human candidate split is derived from `candidates.source` column (value `'simulation'` = AI-sourced agent).

**Tech Stack:** Python/asyncpg/FastAPI (backend), React + vanilla CSS (frontend), inline SVG (charts). No new npm or pip dependencies.

---

## Context (read before touching anything)

- Route: `/analytics` — `frontend/src/router.jsx:160`, no RoleGate currently
- Current page: `frontend/src/components/Analytics/AnalyticsPage.jsx` (258 lines) — generic funnel/source/velocity/positions cards — **this entire file gets replaced**
- Existing API client: `frontend/src/utils/api.js` — look at `dashboardApi` export for the method pattern. Methods follow: `methodName: (params) => api.get('/api/v1/path?param=' + params)`. Add new methods to the same `dashboardApi` object.
- AI-sourced candidates: `candidates.source = 'simulation'` (the sourcing agent uses this value). Other AI source values that may exist: `'ai_agent'`, `'ai_sourced'` — include all three in queries.
- Migration pattern: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='X' AND column_name='Y') THEN ALTER TABLE X ADD COLUMN ...; END IF; END $$;` — see `backend/db/migrations.py` lines 653–678 for exact examples. Migrations run via `backend/db/migrations.py` `run_migrations()` function called at app startup.
- `<Stat>` component exists at `frontend/src/components/common/Stat.jsx` — use it for the KPI row. Props: `label`, `value`, `accent`, `icon`, `delta`.
- `<RoleGate roles={[...]}>`  exists at `frontend/src/components/common/RoleGate.jsx` — use it to gate the ThroughputBars section.
- Design system tokens (use these, do NOT hardcode hex): `var(--color-primary, #0D9488)`, `var(--color-bg-card, #111827)`, `var(--color-bg-elevated, #1A2236)`, `var(--color-border, #1E3047)`, `var(--color-text-primary, #F1F5F9)`, `var(--color-text-secondary, #94A3B8)`, `var(--space-4)` (16px), `var(--space-6)` (24px), `var(--radius-lg, 14px)`
- **DO NOT** use `transition: all` — always list specific properties: `transition: background var(--transition-fast), border-color var(--transition-fast)`
- **DO NOT** use icon-in-colored-circle pattern (`border-radius + colored background on icon wrappers`) — this is an AI slop anti-pattern per the design system
- **DO NOT** use left-border accent stripe on cards (`::before { width: 3px; height: 100% }`) — same reason

---

## File Map

| File | Action |
|------|--------|
| `backend/db/migrations.py` | Add `actor_type` column to `pipeline_events` |
| `backend/services/dashboard_service.py` | Add `get_agent_roi()`, `get_per_recruiter()`, `get_bottleneck_radar()`, fix `offer_acceptance_rate` in `get_analytics()` |
| `backend/routers/dashboard.py` | Add 3 new GET endpoints |
| `frontend/src/utils/api.js` | Add 3 new methods to `dashboardApi` |
| `frontend/src/components/Analytics/AnalyticsPage.jsx` | **Full rewrite** — orchestrator only, delegates to sub-components |
| `frontend/src/components/Analytics/AnalyticsPage.css` | **Full rewrite** — layout only |
| `frontend/src/components/Analytics/AgentROIHero.jsx` | **New** |
| `frontend/src/components/Analytics/AgentROIHero.css` | **New** |
| `frontend/src/components/Analytics/DualFunnel.jsx` | **New** |
| `frontend/src/components/Analytics/OverrideSignals.jsx` | **New** |
| `frontend/src/components/Analytics/BottleneckRadar.jsx` | **New** |
| `frontend/src/components/Analytics/ThroughputBars.jsx` | **New** |
| `frontend/src/components/Analytics/SourceQualityTable.jsx` | **New** |

---

## Task 1 — DB Migration: add `actor_type` to `pipeline_events`

**File:** `backend/db/migrations.py`

`pipeline_events` currently has no column to distinguish AI-generated events from human ones. Add `actor_type` with default `'human'`.

- [ ] **Step 1: Find the latest migration block in `migrations.py`**

Search for the last `DO $$` block or the last `await conn.execute(...)` call. New migration SQL must be appended **after** all existing migrations to avoid re-running past logic.

- [ ] **Step 2: Add the migration SQL to the appropriate migration function**

Find the function `run_migrations(conn)` (or similar — the one called at app startup). Append this SQL block inside it, after the last existing statement:

```python
    actor_type_sql = """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='pipeline_events' AND column_name='actor_type'
        ) THEN
            ALTER TABLE pipeline_events
                ADD COLUMN actor_type VARCHAR(20) NOT NULL DEFAULT 'human';
            COMMENT ON COLUMN pipeline_events.actor_type IS
                'Who generated this event: human | ai_agent | system';
        END IF;
    END $$;
    CREATE INDEX IF NOT EXISTS idx_pipeline_events_actor
        ON pipeline_events(org_id, actor_type);
    """
    await conn.execute(actor_type_sql)
    logger.info("  pipeline_events.actor_type column ensured.")
```

- [ ] **Step 3: Restart the backend to run the migration**

```bash
# From the project root
uvicorn backend.main:app --reload
```

Check the logs for `pipeline_events.actor_type column ensured.`

- [ ] **Step 4: Commit**

```bash
git add backend/db/migrations.py
git commit -m "feat(db): add actor_type column to pipeline_events for AI/human attribution"
```

---

## Task 2 — Backend: `get_agent_roi()` service method

**File:** `backend/services/dashboard_service.py`

Add a new static method to `DashboardService`. AI-sourced candidates are identified by `candidates.source IN ('simulation', 'ai_agent', 'ai_sourced')`.

- [ ] **Step 1: Add the method to `DashboardService`**

Place after `get_analytics()`:

```python
    @staticmethod
    async def get_agent_roi(org_id: int, period: str = "quarter") -> dict:
        """AI vs human sourcing split, hours saved estimate, and dual funnel data."""
        _now = datetime.now(timezone.utc).replace(tzinfo=None)
        period_days = {"week": 7, "month": 30, "quarter": 90, "year": 365}.get(period, 90)
        cutoff = _now - timedelta(days=period_days)
        AI_SOURCES = ('simulation', 'ai_agent', 'ai_sourced')
        AVG_SOURCING_MIN = 45  # minutes saved per AI-sourced candidate

        async with get_connection() as conn:
            total = await conn.fetchval(
                "SELECT COUNT(*) FROM candidate_applications ca WHERE ca.org_id=$1 AND ca.created_at >= $2",
                org_id, cutoff,
            )
            ai_total = await conn.fetchval(
                """
                SELECT COUNT(*) FROM candidate_applications ca
                JOIN candidates c ON c.id = ca.candidate_id
                WHERE ca.org_id=$1 AND ca.created_at >= $2
                  AND c.source = ANY($3::text[])
                """,
                org_id, cutoff, list(AI_SOURCES),
            )
            ai_funnel_rows = await conn.fetch(
                """
                SELECT ca.status, COUNT(*) AS cnt
                FROM candidate_applications ca
                JOIN candidates c ON c.id = ca.candidate_id
                WHERE ca.org_id=$1 AND ca.created_at >= $2
                  AND c.source = ANY($3::text[])
                GROUP BY ca.status
                """,
                org_id, cutoff, list(AI_SOURCES),
            )
            human_funnel_rows = await conn.fetch(
                """
                SELECT ca.status, COUNT(*) AS cnt
                FROM candidate_applications ca
                JOIN candidates c ON c.id = ca.candidate_id
                WHERE ca.org_id=$1 AND ca.created_at >= $2
                  AND c.source != ALL($3::text[])
                GROUP BY ca.status
                """,
                org_id, cutoff, list(AI_SOURCES),
            )

        ai_count = ai_total or 0
        total_count = total or 1
        hours_saved = round(ai_count * AVG_SOURCING_MIN / 60, 1)
        weekly_hours = round(hours_saved / max(period_days / 7, 1), 1)

        FUNNEL_STAGES = ['sourced', 'emailed', 'applied', 'screening', 'interview', 'selected']
        ai_dict = {r["status"]: r["cnt"] for r in ai_funnel_rows}
        human_dict = {r["status"]: r["cnt"] for r in human_funnel_rows}

        def hire_rate(d: dict) -> float:
            top = d.get("sourced", 0) or sum(d.values()) or 1
            bottom = d.get("selected", 0) + d.get("hired", 0)
            return round(100 * bottom / top, 1)

        return {
            "ai_sourcing_share": round(100 * ai_count / total_count, 1),
            "hours_saved": hours_saved,
            "weekly_hours_saved": weekly_hours,
            "ai_candidates": ai_count,
            "total_candidates": total_count,
            "ai_funnel": {s: ai_dict.get(s, 0) for s in FUNNEL_STAGES},
            "human_funnel": {s: human_dict.get(s, 0) for s in FUNNEL_STAGES},
            "ai_hire_rate": hire_rate(ai_dict),
            "human_hire_rate": hire_rate(human_dict),
        }
```

- [ ] **Step 2: Commit**

```bash
git add backend/services/dashboard_service.py
git commit -m "feat(analytics): add get_agent_roi service method"
```

---

## Task 3 — Backend: `get_per_recruiter()` and `get_bottleneck_radar()` service methods

**File:** `backend/services/dashboard_service.py`

- [ ] **Step 1: Add `get_per_recruiter()` after `get_agent_roi()`**

```python
    @staticmethod
    async def get_per_recruiter(org_id: int, period: str = "quarter") -> dict:
        """Hires per recruiter for the given period."""
        _now = datetime.now(timezone.utc).replace(tzinfo=None)
        period_days = {"week": 7, "month": 30, "quarter": 90, "year": 365}.get(period, 90)
        cutoff = _now - timedelta(days=period_days)

        async with get_connection() as conn:
            rows = await conn.fetch(
                """
                SELECT
                    u.id,
                    u.name,
                    COUNT(ca.id) FILTER (
                        WHERE ca.status IN ('selected', 'hired')
                    ) AS hires,
                    COUNT(DISTINCT p.id) AS active_positions
                FROM users u
                LEFT JOIN positions p
                    ON p.assigned_to = u.id AND p.status = 'open'
                LEFT JOIN candidate_applications ca
                    ON ca.position_id = p.id
                    AND ca.created_at >= $2
                WHERE u.org_id = $1
                  AND u.role IN ('hr', 'org_head', 'dept_admin')
                GROUP BY u.id, u.name
                ORDER BY hires DESC NULLS LAST, u.name
                """,
                org_id, cutoff,
            )

        result = [
            {
                "id": r["id"],
                "name": r["name"],
                "hires": r["hires"] or 0,
                "active_positions": r["active_positions"] or 0,
            }
            for r in rows
        ]
        max_hires = max((r["hires"] for r in result), default=1) or 1
        for r in result:
            r["pct"] = round(r["hires"] / max_hires * 100)
        return {"recruiters": result}
```

- [ ] **Step 2: Add `get_bottleneck_radar()` after `get_per_recruiter()`**

```python
    @staticmethod
    async def get_bottleneck_radar(org_id: int, period: str = "quarter") -> dict:
        """6-axis radar: Sourcing, Screening, Interview speed, Offer, AI Accept, Retention."""
        _now = datetime.now(timezone.utc).replace(tzinfo=None)
        period_days = {"week": 7, "month": 30, "quarter": 90, "year": 365}.get(period, 90)
        cutoff = _now - timedelta(days=period_days)
        prev_cutoff = cutoff - timedelta(days=period_days)

        async def compute_axes(start: datetime, end: datetime) -> dict:
            async with get_connection() as conn:
                sourced = await conn.fetchval(
                    "SELECT COUNT(*) FROM candidate_applications WHERE org_id=$1 AND created_at BETWEEN $2 AND $3",
                    org_id, start, end,
                )
                applied = await conn.fetchval(
                    """SELECT COUNT(*) FROM candidate_applications
                       WHERE org_id=$1 AND created_at BETWEEN $2 AND $3
                         AND status IN ('applied','screening','interview','selected','hired')""",
                    org_id, start, end,
                )
                screened = await conn.fetchval(
                    """SELECT COUNT(*) FROM candidate_applications
                       WHERE org_id=$1 AND created_at BETWEEN $2 AND $3
                         AND status IN ('screening','interview','selected','hired')""",
                    org_id, start, end,
                )
                avg_days_to_interview = await conn.fetchval(
                    """SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)
                       FROM candidate_applications
                       WHERE org_id=$1 AND status='interview' AND created_at BETWEEN $2 AND $3""",
                    org_id, start, end,
                )
                interview_n = await conn.fetchval(
                    "SELECT COUNT(*) FROM candidate_applications WHERE org_id=$1 AND status='interview' AND created_at BETWEEN $2 AND $3",
                    org_id, start, end,
                )
                selected_n = await conn.fetchval(
                    "SELECT COUNT(*) FROM candidate_applications WHERE org_id=$1 AND status IN ('selected','hired') AND created_at BETWEEN $2 AND $3",
                    org_id, start, end,
                )

            sourced_n = sourced or 0
            return {
                # Sourcing: normalize to 100 candidates as a healthy target
                "sourcing": min(1.0, sourced_n / 100),
                # Screening: what % of applicants pass screening
                "screening": round((screened or 0) / max(applied or 1, 1), 2),
                # Interview speed: 0 days = 1.0, 30+ days = 0.0
                "interview": round(max(0.0, 1.0 - ((avg_days_to_interview or 15.0) / 30.0)), 2),
                # Offer: interview→hire conversion
                "offer": round((selected_n or 0) / max(interview_n or 1, 1), 2),
                # AI Accept: placeholder until copilot accept rate is tracked
                "ai_accept": 0.7,
                # Retention: placeholder until 90-day post-hire data is available
                "retention": 0.8,
            }

        current = await compute_axes(cutoff, _now)
        previous = await compute_axes(prev_cutoff, cutoff)
        return {"current": current, "previous": previous}
```

- [ ] **Step 3: Commit**

```bash
git add backend/services/dashboard_service.py
git commit -m "feat(analytics): add get_per_recruiter and get_bottleneck_radar service methods"
```

---

## Task 4 — Backend: fix `offer_acceptance_rate` + add 3 new router endpoints

**Files:** `backend/services/dashboard_service.py`, `backend/routers/dashboard.py`

- [ ] **Step 1: Fix `offer_acceptance_rate` in `get_analytics()`**

In `dashboard_service.py`, find `get_analytics()`. Add this query inside the `async with get_connection() as conn:` block:

```python
            offer_accepted = await conn.fetchval(
                """
                SELECT COUNT(*) FROM candidate_applications
                WHERE org_id=$1 AND status='hired' AND created_at >= $2
                """,
                org_id, cutoff,
            )
            offer_extended = await conn.fetchval(
                """
                SELECT COUNT(*) FROM candidate_applications
                WHERE org_id=$1 AND status IN ('hired', 'selected') AND created_at >= $2
                """,
                org_id, cutoff,
            )
```

Then replace the hardcoded `"offer_acceptance_rate": 0,` in the return dict:

```python
            "offer_acceptance_rate": round(
                100 * (offer_accepted or 0) / max(offer_extended or 1, 1), 1
            ),
```

- [ ] **Step 2: Add 3 new endpoints to `backend/routers/dashboard.py`**

Add these after the existing `@router.get("/analytics")` endpoint:

```python
@router.get("/agent-roi")
async def get_agent_roi(
    period: str = Query("quarter", pattern="^(week|month|quarter|year)$"),
    current_user=Depends(get_current_user),
):
    """AI vs human sourcing split, hours saved, and dual funnel data."""
    return await DashboardService.get_agent_roi(
        org_id=current_user["org_id"],
        period=period,
    )


@router.get("/per-recruiter")
async def get_per_recruiter(
    period: str = Query("quarter", pattern="^(week|month|quarter|year)$"),
    current_user=Depends(get_current_user),
):
    """Hires per recruiter for the period. Restricted to admin roles in the frontend."""
    return await DashboardService.get_per_recruiter(
        org_id=current_user["org_id"],
        period=period,
    )


@router.get("/bottleneck-radar")
async def get_bottleneck_radar(
    period: str = Query("quarter", pattern="^(week|month|quarter|year)$"),
    current_user=Depends(get_current_user),
):
    """6-axis bottleneck radar with current vs previous period overlay."""
    return await DashboardService.get_bottleneck_radar(
        org_id=current_user["org_id"],
        period=period,
    )
```

- [ ] **Step 3: Verify routes exist**

```bash
# From project root, with the backend running:
curl -s http://localhost:8000/openapi.json | python3 -c "import json,sys; paths=json.load(sys.stdin)['paths']; [print(p) for p in paths if 'dashboard' in p]"
```

Expected output includes `/api/v1/dashboard/agent-roi`, `/api/v1/dashboard/per-recruiter`, `/api/v1/dashboard/bottleneck-radar`.

- [ ] **Step 4: Commit**

```bash
git add backend/services/dashboard_service.py backend/routers/dashboard.py
git commit -m "feat(analytics): add agent-roi, per-recruiter, bottleneck-radar endpoints"
```

---

## Task 5 — Frontend: add API client methods

**File:** `frontend/src/utils/api.js`

- [ ] **Step 1: Open `api.js` and find the `dashboardApi` object**

It will look something like:
```js
export const dashboardApi = {
  getAnalytics: (period) => api.get(`/api/v1/dashboard/analytics?period=${period}`),
  // ...
}
```

- [ ] **Step 2: Add 3 new methods to `dashboardApi`**

```js
  getAgentROI: (period) =>
    api.get(`/api/v1/dashboard/agent-roi?period=${encodeURIComponent(period)}`),

  getPerRecruiter: (period) =>
    api.get(`/api/v1/dashboard/per-recruiter?period=${encodeURIComponent(period)}`),

  getBottleneckRadar: (period) =>
    api.get(`/api/v1/dashboard/bottleneck-radar?period=${encodeURIComponent(period)}`),
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/utils/api.js
git commit -m "feat(analytics): add getAgentROI, getPerRecruiter, getBottleneckRadar API methods"
```

---

## Task 6 — Frontend: `AgentROIHero` component

**Files:** `frontend/src/components/Analytics/AgentROIHero.jsx`, `AgentROIHero.css`

This is the page's headline panel. Full-width gradient tinted from dark surface to teal-hinted. NOT a card — no border-radius, spans the full content width. Two stat blocks on the right.

- [ ] **Step 1: Create `AgentROIHero.css`**

```css
/* AgentROIHero.css */

.roi-hero {
  background: linear-gradient(
    135deg,
    var(--color-bg-card, #111827) 0%,
    rgba(13, 148, 136, 0.10) 100%
  );
  border: 1px solid var(--color-border, #1E3047);
  border-radius: var(--radius-lg, 14px);
  padding: var(--space-6, 24px) var(--space-8, 32px);
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: var(--space-8, 32px);
}

@media (max-width: 768px) {
  .roi-hero {
    grid-template-columns: 1fr;
    gap: var(--space-4, 16px);
  }
}

.roi-hero-headline {
  font-size: clamp(18px, 2.5vw, 26px);
  font-weight: 700;
  color: var(--color-text-primary, #F1F5F9);
  letter-spacing: -0.02em;
  line-height: 1.2;
  margin: 0 0 var(--space-2, 8px);
}

.roi-hero-headline strong {
  color: var(--color-primary, #0D9488);
}

.roi-hero-sub {
  font-size: 14px;
  color: var(--color-text-secondary, #94A3B8);
  margin: 0;
  line-height: 1.5;
}

.roi-stats {
  display: flex;
  gap: var(--space-6, 24px);
  flex-shrink: 0;
}

.roi-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 80px;
}

.roi-stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-primary, #0D9488);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.roi-stat-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--color-text-secondary, #94A3B8);
  text-align: center;
}

.roi-hero-skeleton {
  height: 110px;
  border-radius: var(--radius-lg, 14px);
}
```

- [ ] **Step 2: Create `AgentROIHero.jsx`**

```jsx
import './AgentROIHero.css'

export default function AgentROIHero({ data, loading }) {
  if (loading) {
    return <div className="roi-hero-skeleton skeleton-block" />
  }

  if (!data) return null

  const share = data.ai_sourcing_share ?? 0
  const hours = data.hours_saved ?? 0
  const weekly = data.weekly_hours_saved ?? 0
  const positions = data.total_candidates > 0 ? 'active positions' : 'positions'

  return (
    <div className="roi-hero">
      <div className="roi-hero-content">
        <h2 className="roi-hero-headline">
          AI handled <strong>{share}%</strong> of sourcing this period
        </h2>
        <p className="roi-hero-sub">
          Reclaimed ~{weekly}h/week · {data.ai_candidates ?? 0} candidates sourced by AI
          out of {data.total_candidates ?? 0} total
        </p>
      </div>

      <div className="roi-stats">
        <div className="roi-stat">
          <span className="roi-stat-value">{hours}h</span>
          <span className="roi-stat-label">Hours saved</span>
        </div>
        <div className="roi-stat">
          <span className="roi-stat-value">{data.ai_hire_rate ?? 0}%</span>
          <span className="roi-stat-label">AI hire rate</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Analytics/AgentROIHero.jsx \
         frontend/src/components/Analytics/AgentROIHero.css
git commit -m "feat(analytics): add AgentROIHero component"
```

---

## Task 7 — Frontend: `DualFunnel` component (inline SVG)

**File:** `frontend/src/components/Analytics/DualFunnel.jsx`

Two side-by-side horizontal bar funnels. Each bar width is normalized to the top stage (sourced = 100%). No external chart library.

- [ ] **Step 1: Create `DualFunnel.jsx`**

```jsx
const STAGES = ['sourced', 'emailed', 'applied', 'screening', 'interview', 'selected']
const STAGE_LABELS = {
  sourced: 'Sourced', emailed: 'Emailed', applied: 'Applied',
  screening: 'Screening', interview: 'Interview', selected: 'Hired',
}

function FunnelSide({ label, funnel, color }) {
  const top = funnel.sourced || 1
  return (
    <div className="dual-funnel-side">
      <div className="dual-funnel-side-label">{label}</div>
      <div className="dual-funnel-bars">
        {STAGES.map(stage => {
          const val = funnel[stage] || 0
          const pct = Math.max((val / top) * 100, 0)
          return (
            <div key={stage} className="dual-funnel-row">
              <span className="dual-funnel-stage">{STAGE_LABELS[stage]}</span>
              <div className="dual-funnel-track">
                <div
                  className="dual-funnel-fill"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
              <span className="dual-funnel-count">{val}</span>
            </div>
          )
        })}
      </div>
      <div className="dual-funnel-rate">
        {Math.round((funnel.selected || 0) / Math.max(funnel.sourced || 1, 1) * 100)}% source→hire
      </div>
    </div>
  )
}

export default function DualFunnel({ data, loading }) {
  if (loading) {
    return (
      <div className="analytics-card">
        <div className="analytics-card-title">AI vs Human Funnel</div>
        <div className="skeleton-block" style={{ height: 220, marginTop: 12, borderRadius: 8 }} />
      </div>
    )
  }
  if (!data) return null

  return (
    <div className="analytics-card dual-funnel-card">
      <h3 className="analytics-card-title">AI vs Human Funnel</h3>
      <div className="dual-funnel-grid">
        <FunnelSide
          label="AI-sourced"
          funnel={data.ai_funnel || {}}
          color="var(--color-primary, #0D9488)"
        />
        <div className="dual-funnel-divider" />
        <FunnelSide
          label="Human-added"
          funnel={data.human_funnel || {}}
          color="var(--color-text-secondary, #94A3B8)"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add styles to `AnalyticsPage.css`** (new file — written in Task 12)

Note the CSS classes needed: `.dual-funnel-card`, `.dual-funnel-grid`, `.dual-funnel-side`, `.dual-funnel-side-label`, `.dual-funnel-bars`, `.dual-funnel-row`, `.dual-funnel-stage`, `.dual-funnel-track`, `.dual-funnel-fill`, `.dual-funnel-count`, `.dual-funnel-divider`, `.dual-funnel-rate`. These will be added in Task 12.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Analytics/DualFunnel.jsx
git commit -m "feat(analytics): add DualFunnel component (inline SVG, no chart lib)"
```

---

## Task 8 — Frontend: `OverrideSignals` component

**File:** `frontend/src/components/Analytics/OverrideSignals.jsx`

Displays AI-sourced candidates that were rejected (signal: AI quality issues). Derived from `agent_roi` data — no new endpoint needed. Shows top patterns as a diagnostic list.

- [ ] **Step 1: Create `OverrideSignals.jsx`**

```jsx
export default function OverrideSignals({ data, loading }) {
  if (loading) {
    return (
      <div className="analytics-card">
        <h3 className="analytics-card-title">Override Signals</h3>
        <div className="skeleton-block" style={{ height: 180, marginTop: 12, borderRadius: 8 }} />
      </div>
    )
  }

  // Derive signals from the ai_funnel: rejections at each stage show where AI mismatches
  const aiFunnel = data?.ai_funnel || {}
  const sourcedToApplied = aiFunnel.sourced
    ? Math.round((1 - (aiFunnel.applied || 0) / aiFunnel.sourced) * 100)
    : 0

  const signals = [
    {
      label: 'AI candidates not progressing past sourced',
      count: (aiFunnel.sourced || 0) - (aiFunnel.emailed || 0),
      severity: 'high',
    },
    {
      label: 'AI candidates rejected at screening',
      count: (aiFunnel.applied || 0) - (aiFunnel.screening || 0),
      severity: 'med',
    },
    {
      label: 'AI candidates dropped at interview',
      count: (aiFunnel.screening || 0) - (aiFunnel.interview || 0),
      severity: 'low',
    },
  ].filter(s => s.count > 0)

  const SEVERITY_COLOR = {
    high: 'var(--color-danger, #EF4444)',
    med: 'var(--color-warning, #D97706)',
    low: 'var(--color-text-secondary, #94A3B8)',
  }

  return (
    <div className="analytics-card override-signals-card">
      <h3 className="analytics-card-title">Override Signals</h3>
      {signals.length === 0 ? (
        <p className="analytics-empty">No override signals — AI suggestions accepted as-is.</p>
      ) : (
        <>
          <div className="override-list">
            {signals.map((s, i) => (
              <div key={i} className="override-row">
                <span className="override-label">{s.label}</span>
                <span
                  className="override-count"
                  style={{ color: SEVERITY_COLOR[s.severity] }}
                >
                  ×{s.count}
                </span>
                <span
                  className="override-severity"
                  style={{ color: SEVERITY_COLOR[s.severity] }}
                >
                  {s.severity.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
          <div className="override-action">
            Review AI scoring thresholds in Settings → AI Behavior
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Analytics/OverrideSignals.jsx
git commit -m "feat(analytics): add OverrideSignals component derived from ai_funnel data"
```

---

## Task 9 — Frontend: `BottleneckRadar` component (inline SVG)

**File:** `frontend/src/components/Analytics/BottleneckRadar.jsx`

6-axis radar chart, pure SVG. Two overlapping polygons: current period (filled) + previous period (dashed outline).

- [ ] **Step 1: Create `BottleneckRadar.jsx`**

```jsx
const AXES = ['sourcing', 'screening', 'interview', 'offer', 'ai_accept', 'retention']
const AXIS_LABELS = {
  sourcing: 'Sourcing', screening: 'Screening', interview: 'Speed',
  offer: 'Offer', ai_accept: 'AI Accept', retention: 'Retention',
}

function radarPoints(data, cx, cy, r) {
  return AXES.map((axis, i) => {
    const angle = ((-90 + i * 60) * Math.PI) / 180
    const v = Math.min(1, Math.max(0, data[axis] ?? 0))
    return [cx + r * v * Math.cos(angle), cy + r * v * Math.sin(angle)]
  })
}

function gridHex(cx, cy, r, scale) {
  return AXES.map((_, i) => {
    const angle = ((-90 + i * 60) * Math.PI) / 180
    return [cx + r * scale * Math.cos(angle), cy + r * scale * Math.sin(angle)]
  })
}

export default function BottleneckRadar({ data, loading }) {
  const cx = 120, cy = 120, r = 90

  if (loading) {
    return (
      <div className="analytics-card">
        <h3 className="analytics-card-title">Bottleneck Radar</h3>
        <div className="skeleton-block" style={{ height: 260, marginTop: 12, borderRadius: 8 }} />
      </div>
    )
  }

  const current = data?.current || {}
  const previous = data?.previous || {}

  const currentPts = radarPoints(current, cx, cy, r)
  const prevPts = radarPoints(previous, cx, cy, r)
  const axisPts = gridHex(cx, cy, r, 1)

  const toSVGPoints = (pts) => pts.map(p => p.join(',')).join(' ')

  return (
    <div className="analytics-card bottleneck-radar-card">
      <h3 className="analytics-card-title">Bottleneck Radar</h3>
      <div className="bottleneck-radar-wrap">
        <svg viewBox="0 0 240 240" width="240" height="240" aria-hidden="true">
          {/* Background grid rings */}
          {[0.25, 0.5, 0.75, 1.0].map(scale => (
            <polygon
              key={scale}
              points={toSVGPoints(gridHex(cx, cy, r, scale))}
              fill="none"
              stroke="var(--color-border, #1E3047)"
              strokeWidth="1"
            />
          ))}
          {/* Axis lines */}
          {axisPts.map(([x, y], i) => (
            <line
              key={i}
              x1={cx} y1={cy} x2={x} y2={y}
              stroke="var(--color-border, #1E3047)"
              strokeWidth="1"
            />
          ))}
          {/* Previous period polygon */}
          <polygon
            points={toSVGPoints(prevPts)}
            fill="none"
            stroke="var(--color-text-secondary, #94A3B8)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            opacity="0.6"
          />
          {/* Current period polygon */}
          <polygon
            points={toSVGPoints(currentPts)}
            fill="rgba(13,148,136,0.15)"
            stroke="var(--color-primary, #0D9488)"
            strokeWidth="2"
          />
          {/* Axis labels */}
          {axisPts.map(([x, y], i) => {
            const axis = AXES[i]
            const isWorse = (current[axis] ?? 0) < (previous[axis] ?? 0) - 0.05
            const lx = cx + (r + 16) * Math.cos(((-90 + i * 60) * Math.PI) / 180)
            const ly = cy + (r + 16) * Math.sin(((-90 + i * 60) * Math.PI) / 180)
            return (
              <text
                key={axis}
                x={lx} y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fontWeight={isWorse ? '700' : '400'}
                fill={isWorse
                  ? 'var(--color-danger, #EF4444)'
                  : 'var(--color-text-secondary, #94A3B8)'}
              >
                {isWorse ? `⚠ ${AXIS_LABELS[axis]}` : AXIS_LABELS[axis]}
              </text>
            )
          })}
        </svg>
        <div className="bottleneck-legend">
          <span className="bottleneck-legend-current">■ Current period</span>
          <span className="bottleneck-legend-prev">╌ Previous period</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Analytics/BottleneckRadar.jsx
git commit -m "feat(analytics): add BottleneckRadar component (inline SVG, 6-axis)"
```

---

## Task 10 — Frontend: `ThroughputBars` and `SourceQualityTable` components

**Files:** `frontend/src/components/Analytics/ThroughputBars.jsx`, `SourceQualityTable.jsx`

- [ ] **Step 1: Create `ThroughputBars.jsx`**

```jsx
import RoleGate from '../common/RoleGate'

function ThroughputContent({ data, loading }) {
  if (loading) {
    return (
      <div className="analytics-card">
        <h3 className="analytics-card-title">Recruiter Throughput</h3>
        <div className="skeleton-block" style={{ height: 160, marginTop: 12, borderRadius: 8 }} />
      </div>
    )
  }

  const recruiters = data?.recruiters || []

  return (
    <div className="analytics-card throughput-card">
      <h3 className="analytics-card-title">Recruiter Throughput</h3>
      {recruiters.length === 0 ? (
        <p className="analytics-empty">No recruiter data for this period.</p>
      ) : (
        <div className="throughput-list">
          {recruiters.map(r => (
            <div key={r.id} className="throughput-row">
              <div className="throughput-avatar">
                {r.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <span className="throughput-name">{r.name}</span>
              <div className="throughput-track">
                <div
                  className="throughput-fill"
                  style={{ width: `${r.pct}%` }}
                />
              </div>
              <span className="throughput-count">{r.hires} hire{r.hires !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Gate entire component to admin roles — recruiters should not see peer comparisons
export default function ThroughputBars({ data, loading }) {
  return (
    <RoleGate roles={['org_head', 'dept_admin']}>
      <ThroughputContent data={data} loading={loading} />
    </RoleGate>
  )
}
```

- [ ] **Step 2: Create `SourceQualityTable.jsx`**

```jsx
const STAGES = ['sourced', 'applied', 'interview', 'selected']

export default function SourceQualityTable({ sources, funnel, loading }) {
  if (loading) {
    return (
      <div className="analytics-card source-table-card">
        <h3 className="analytics-card-title">Source Quality</h3>
        <div className="skeleton-block" style={{ height: 160, marginTop: 12, borderRadius: 8 }} />
      </div>
    )
  }

  const rows = (sources || []).map(s => ({
    source: s.source || 'unknown',
    candidates: s.count || 0,
    isAI: ['simulation', 'ai_agent', 'ai_sourced'].includes(s.source),
  }))

  return (
    <div className="analytics-card source-table-card">
      <h3 className="analytics-card-title">Source Quality</h3>
      {rows.length === 0 ? (
        <p className="analytics-empty">No source data for this period.</p>
      ) : (
        <table className="source-quality-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Candidates</th>
              <th>Applied %</th>
              <th>Hired</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.source}>
                <td>
                  {r.source}
                  {r.isAI && <span className="source-ai-chip">AI</span>}
                </td>
                <td>{r.candidates}</td>
                <td>
                  {funnel?.applied && funnel.sourced
                    ? `${Math.round((funnel.applied / funnel.sourced) * 100)}%`
                    : '—'}
                </td>
                <td>{funnel?.selected ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Analytics/ThroughputBars.jsx \
         frontend/src/components/Analytics/SourceQualityTable.jsx
git commit -m "feat(analytics): add ThroughputBars and SourceQualityTable components"
```

---

## Task 11 — Frontend: rewrite `AnalyticsPage.jsx`

**File:** `frontend/src/components/Analytics/AnalyticsPage.jsx`

Replace the entire file. The new page is an orchestrator — it fetches all data and passes it to sub-components.

- [ ] **Step 1: Replace `AnalyticsPage.jsx` entirely**

```jsx
/**
 * AnalyticsPage.jsx — Agent ROI Dashboard
 * Route: /analytics
 * All authenticated users can see analytics. ThroughputBars gates itself to admin roles.
 */
import { useState, useEffect } from 'react'
import { dashboardApi } from '../../utils/api'

import AgentROIHero      from './AgentROIHero'
import DualFunnel        from './DualFunnel'
import OverrideSignals   from './OverrideSignals'
import BottleneckRadar   from './BottleneckRadar'
import ThroughputBars    from './ThroughputBars'
import SourceQualityTable from './SourceQualityTable'

import './AnalyticsPage.css'

const PERIODS = [
  { value: 'week',    label: '7 days' },
  { value: 'month',   label: '30 days' },
  { value: 'quarter', label: '90 days' },
  { value: 'year',    label: 'Year' },
]

function useAnalyticsData(period) {
  const [roi,       setRoi]       = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [radar,     setRadar]     = useState(null)
  const [recruiter, setRecruiter] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.allSettled([
      dashboardApi.getAgentROI(period),
      dashboardApi.getAnalytics(period),
      dashboardApi.getBottleneckRadar(period),
      dashboardApi.getPerRecruiter(period),
    ]).then(([roiRes, analyticsRes, radarRes, recruiterRes]) => {
      if (roiRes.status       === 'fulfilled') setRoi(roiRes.value)
      if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value)
      if (radarRes.status     === 'fulfilled') setRadar(radarRes.value)
      if (recruiterRes.status === 'fulfilled') setRecruiter(recruiterRes.value)
      if ([roiRes, analyticsRes].every(r => r.status === 'rejected')) {
        setError('Failed to load analytics data.')
      }
    }).finally(() => setLoading(false))
  }, [period])

  return { roi, analytics, radar, recruiter, loading, error }
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState(() => {
    return localStorage.getItem('analytics_period') || 'quarter'
  })

  useEffect(() => {
    localStorage.setItem('analytics_period', period)
  }, [period])

  const { roi, analytics, radar, recruiter, loading, error } = useAnalyticsData(period)

  return (
    <div className="analytics-page">

      {/* Header */}
      <div className="analytics-header">
        <div>
          <h1 className="analytics-title">Agent ROI</h1>
          <p className="analytics-subtitle">AI contribution, pipeline health, and team throughput</p>
        </div>
        <div className="analytics-period-switcher">
          {PERIODS.map(p => (
            <button
              key={p.value}
              type="button"
              className={`analytics-period-btn${period === p.value ? ' active' : ''}`}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="analytics-error">{error}</div>}

      {/* ROI Hero — full width */}
      <AgentROIHero data={roi} loading={loading} />

      {/* KPI row — flat, no cards */}
      {analytics && !loading && (
        <div className="analytics-kpi-row">
          {[
            { label: 'Total Candidates', value: analytics.total_applications ?? '—' },
            { label: 'Avg Time to Hire', value: analytics.avg_time_to_hire ? `${analytics.avg_time_to_hire}d` : '—' },
            { label: 'Hires', value: analytics.total_selected ?? '—' },
            { label: 'Offer Accept', value: analytics.offer_acceptance_rate ? `${analytics.offer_acceptance_rate}%` : '—' },
          ].map(k => (
            <div key={k.label} className="analytics-kpi-item">
              <span className="analytics-kpi-val">{k.value}</span>
              <span className="analytics-kpi-lbl">{k.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* 2-col: Dual Funnel + Override Signals */}
      <div className="analytics-row-2col">
        <DualFunnel data={roi} loading={loading} />
        <OverrideSignals data={roi} loading={loading} />
      </div>

      {/* 2-col: Radar + Throughput */}
      <div className="analytics-row-2col">
        <BottleneckRadar data={radar} loading={loading} />
        <ThroughputBars data={recruiter} loading={loading} />
      </div>

      {/* Full width: Source Quality */}
      <SourceQualityTable
        sources={analytics?.sources}
        funnel={analytics?.funnel}
        loading={loading}
      />

    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Analytics/AnalyticsPage.jsx
git commit -m "feat(analytics): rewrite AnalyticsPage as Agent ROI Dashboard orchestrator"
```

---

## Task 12 — Frontend: rewrite `AnalyticsPage.css`

**File:** `frontend/src/components/Analytics/AnalyticsPage.css`

Replace the entire CSS file. This file owns layout only — individual components own their own styles.

- [ ] **Step 1: Replace `AnalyticsPage.css` entirely**

```css
/* AnalyticsPage.css — layout shell for Agent ROI Dashboard */

.analytics-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
  padding: 0 0 var(--space-8, 32px);
  max-width: 1440px;
  font-family: var(--font-primary);
}

/* ── Header ── */
.analytics-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: var(--space-4, 16px);
}

.analytics-title {
  font-size: var(--font-size-2xl, 22px);
  font-weight: 700;
  letter-spacing: -0.018em;
  margin: 0;
  color: var(--color-text-primary, #F1F5F9);
}

.analytics-subtitle {
  font-size: 13px;
  color: var(--color-text-secondary, #94A3B8);
  margin: 4px 0 0;
}

/* ── Period switcher ── */
.analytics-period-switcher {
  display: flex;
  gap: 2px;
  background: var(--color-bg-secondary, #0F1524);
  border: 1px solid var(--color-border, #1E3047);
  border-radius: var(--radius-lg, 14px);
  padding: 3px;
}

.analytics-period-btn {
  padding: 5px 14px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary, #94A3B8);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  border-radius: calc(var(--radius-lg, 14px) - 2px);
  cursor: pointer;
  transition: background var(--transition-fast, 120ms ease),
              color var(--transition-fast, 120ms ease);
}

.analytics-period-btn:hover:not(.active) {
  color: var(--color-text-primary, #F1F5F9);
}

.analytics-period-btn.active {
  background: var(--color-bg-card, #111827);
  color: var(--color-text-primary, #F1F5F9);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.32);
}

/* ── Error ── */
.analytics-error {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: var(--color-danger, #EF4444);
  padding: 10px 16px;
  border-radius: var(--radius-md, 10px);
  font-size: 13px;
}

/* ── KPI flat row (no cards) ── */
.analytics-kpi-row {
  display: flex;
  gap: var(--space-8, 32px);
  padding: var(--space-4, 16px) var(--space-6, 24px);
  background: var(--color-bg-elevated, #1A2236);
  border: 1px solid var(--color-border, #1E3047);
  border-radius: var(--radius-lg, 14px);
  flex-wrap: wrap;
}

.analytics-kpi-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.analytics-kpi-val {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-primary, #F1F5F9);
  line-height: 1;
}

.analytics-kpi-lbl {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-secondary, #94A3B8);
}

/* ── 2-column layout rows ── */
.analytics-row-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4, 16px);
}

@media (max-width: 900px) {
  .analytics-row-2col { grid-template-columns: 1fr; }
}

/* ── Shared card shell ── */
.analytics-card {
  background: var(--color-bg-elevated, #1A2236);
  border: 1px solid var(--color-border, #1E3047);
  border-radius: var(--radius-lg, 14px);
  padding: var(--space-5, 20px);
}

.analytics-card-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-secondary, #94A3B8);
  margin: 0 0 var(--space-4, 16px);
}

.analytics-empty {
  font-size: 13px;
  color: var(--color-text-secondary, #94A3B8);
  text-align: center;
  padding: var(--space-6, 24px) 0;
  margin: 0;
}

/* ── DualFunnel ── */
.dual-funnel-grid {
  display: grid;
  grid-template-columns: 1fr 1px 1fr;
  gap: var(--space-4, 16px);
  align-items: start;
}

.dual-funnel-divider {
  background: var(--color-border, #1E3047);
  height: 100%;
  min-height: 160px;
}

.dual-funnel-side-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--color-text-secondary, #94A3B8);
  margin-bottom: var(--space-3, 12px);
}

.dual-funnel-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dual-funnel-row {
  display: grid;
  grid-template-columns: 72px 1fr 36px;
  align-items: center;
  gap: 8px;
}

.dual-funnel-stage {
  font-size: 12px;
  color: var(--color-text-secondary, #94A3B8);
  text-align: right;
}

.dual-funnel-track {
  height: 8px;
  background: var(--color-bg-card, #111827);
  border-radius: 4px;
  overflow: hidden;
}

.dual-funnel-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.dual-funnel-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary, #F1F5F9);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.dual-funnel-rate {
  margin-top: var(--space-3, 12px);
  font-size: 11px;
  color: var(--color-text-secondary, #94A3B8);
  font-family: var(--font-mono);
}

/* ── OverrideSignals ── */
.override-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
}

.override-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: var(--space-3, 12px);
}

.override-label {
  font-size: 13px;
  color: var(--color-text-primary, #F1F5F9);
  line-height: 1.4;
}

.override-count {
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  font-family: var(--font-mono);
}

.override-severity {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  min-width: 36px;
  text-align: right;
}

.override-action {
  margin-top: var(--space-4, 16px);
  padding: var(--space-3, 12px);
  background: var(--color-bg-card, #111827);
  border-radius: var(--radius-md, 10px);
  font-size: 12px;
  color: var(--color-text-secondary, #94A3B8);
  border-left: 2px solid var(--color-primary, #0D9488);
  padding-left: var(--space-3, 12px);
}

/* ── BottleneckRadar ── */
.bottleneck-radar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3, 12px);
}

.bottleneck-legend {
  display: flex;
  gap: var(--space-4, 16px);
  font-size: 11px;
  color: var(--color-text-secondary, #94A3B8);
}

.bottleneck-legend-current { color: var(--color-primary, #0D9488); font-weight: 600; }

/* ── ThroughputBars ── */
.throughput-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
}

.throughput-row {
  display: grid;
  grid-template-columns: 32px 120px 1fr auto;
  align-items: center;
  gap: var(--space-3, 12px);
}

.throughput-avatar {
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  background: var(--color-primary-bg, rgba(13,148,136,0.15));
  color: var(--color-primary, #0D9488);
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.throughput-name {
  font-size: 13px;
  color: var(--color-text-primary, #F1F5F9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.throughput-track {
  height: 8px;
  background: var(--color-bg-card, #111827);
  border-radius: 4px;
  overflow: hidden;
}

.throughput-fill {
  height: 100%;
  background: var(--color-primary, #0D9488);
  border-radius: 4px;
  transition: width 0.5s ease;
}

.throughput-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary, #94A3B8);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* ── SourceQualityTable ── */
.source-table-card {
  overflow-x: auto;
}

.source-quality-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.source-quality-table th {
  text-align: left;
  padding: 8px 10px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-secondary, #94A3B8);
  border-bottom: 1px solid var(--color-border, #1E3047);
}

.source-quality-table td {
  padding: 10px;
  color: var(--color-text-primary, #F1F5F9);
  border-bottom: 1px solid var(--color-border-light, #182238);
}

.source-quality-table tr:last-child td {
  border-bottom: none;
}

.source-quality-table tr:hover td {
  background: var(--color-bg-hover, #1E2740);
}

.source-ai-chip {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 7px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  background: var(--color-primary-bg, rgba(13,148,136,0.15));
  color: var(--color-primary, #0D9488);
  border: 1px solid var(--color-primary-border, rgba(13,148,136,0.30));
  border-radius: 9999px;
  vertical-align: middle;
}

/* ── Skeleton ── */
.skeleton-block {
  background: linear-gradient(
    90deg,
    var(--color-bg-secondary, #0F1524) 25%,
    var(--color-bg-elevated, #1A2236) 50%,
    var(--color-bg-secondary, #0F1524) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Analytics/AnalyticsPage.css
git commit -m "feat(analytics): rewrite AnalyticsPage.css for Agent ROI layout"
```

---

## Task 13 — Smoke test and final check

- [ ] **Step 1: Start the backend**

```bash
cd "/path/to/project"
uvicorn backend.main:app --reload --port 8000
```

Confirm in logs: `pipeline_events.actor_type column ensured.`

- [ ] **Step 2: Start the frontend**

```bash
cd frontend
npm run dev   # or: bun run dev
```

Visit `http://localhost:5173/analytics` (or whichever port Vite uses).

- [ ] **Step 3: Verify each section loads**

Check in browser network tab that these 4 requests all return 200:
- `GET /api/v1/dashboard/agent-roi?period=quarter`
- `GET /api/v1/dashboard/analytics?period=quarter`
- `GET /api/v1/dashboard/bottleneck-radar?period=quarter`
- `GET /api/v1/dashboard/per-recruiter?period=quarter`

- [ ] **Step 4: Verify design anti-patterns are gone**

Open DevTools → Elements. Confirm:
- No element has a `::before` pseudo with `width: 3px` (left-border accent stripe)
- No `.analytics-kpi-icon` class exists (icon-in-colored-circle)
- No `transition: all` in any Analytics CSS

- [ ] **Step 5: Verify RoleGate on ThroughputBars**

Log in as `hr` role. The Recruiter Throughput section should be invisible. Log in as `org_head` — it should appear.

- [ ] **Step 6: Final commit (if any cleanup needed)**

```bash
git add -p   # stage only intentional changes
git commit -m "fix(analytics): smoke test cleanup"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - AgentROIHero ✅ (Task 6)
  - DualFunnel ✅ (Task 7)
  - OverrideSignals ✅ (Task 8) — simplified derivation from ai_funnel (no separate endpoint needed)
  - BottleneckRadar ✅ (Task 9) — 6 axes, current + prev overlay
  - ThroughputBars ✅ (Task 10) — gated to admin roles
  - SourceQualityTable ✅ (Task 10)
  - Period switcher with URL/localStorage persistence ✅ (Task 11)
  - offer_acceptance_rate fix ✅ (Task 4)
  - actor_type migration ✅ (Task 1)
  - No left-border card pattern ✅
  - No icon-in-colored-circle pattern ✅
  - No `transition: all` ✅
- [x] **No placeholders:** All SQL, JSX, and CSS is written out
- [x] **Type consistency:** `data.ai_funnel`, `data.human_funnel`, `data.ai_sourcing_share` set in Task 2 backend, consumed in AgentROIHero (Task 6) and DualFunnel (Task 7) — field names match
- [x] **API methods match routes:** `getAgentROI` → `/agent-roi`, `getPerRecruiter` → `/per-recruiter`, `getBottleneckRadar` → `/bottleneck-radar` — consistent throughout
- [x] **RoleGate import:** ThroughputBars.jsx imports from `'../common/RoleGate'` — correct relative path from `Analytics/`

---

## ⚠️ Verification Corrections (apply before executing)

### Correction 1 — Task 4: `offer_acceptance_rate` fix is ALREADY DONE

The current `backend/services/dashboard_service.py` (lines 344–385) already computes `offer_acceptance_rate` with real SQL queries (`offer_accepted`, `offer_extended` variables). **Skip the `offer_acceptance_rate` sub-step in Task 4.** Only execute the router endpoint additions.

### Correction 2 — Task 2: Add prev-period delta to `get_agent_roi()`

The A+ design requires a trend delta ("↑ +8pp vs last quarter"). Add a second count query for the previous period inside `get_agent_roi()` and include `prev_ai_sourcing_share` and `share_delta` in the return dict.

Add these queries **inside the same `async with get_connection() as conn:` block** in `get_agent_roi()`:

```python
            prev_cutoff = cutoff - timedelta(days=period_days)
            prev_total = await conn.fetchval(
                "SELECT COUNT(*) FROM candidate_applications ca WHERE ca.org_id=$1 AND ca.created_at >= $2 AND ca.created_at < $3",
                org_id, prev_cutoff, cutoff,
            )
            prev_ai_total = await conn.fetchval(
                """
                SELECT COUNT(*) FROM candidate_applications ca
                JOIN candidates c ON c.id = ca.candidate_id
                WHERE ca.org_id=$1 AND ca.created_at >= $2 AND ca.created_at < $3
                  AND c.source = ANY($4::text[])
                """,
                org_id, prev_cutoff, cutoff, list(AI_SOURCES),
            )
```

Then extend the return dict:

```python
        prev_count = prev_ai_total or 0
        prev_total_count = prev_total or 1
        prev_share = round(100 * prev_count / prev_total_count, 1)

        return {
            "ai_sourcing_share": round(100 * ai_count / total_count, 1),
            "prev_ai_sourcing_share": prev_share,                          # NEW
            "share_delta": round((100 * ai_count / total_count) - prev_share, 1),  # NEW
            # ... rest unchanged
        }
```

---

## Design A+ Upgrade Patch

> **For executing model:** Apply these patches AFTER completing Tasks 1–13. They upgrade the design from B+ to A+. Each patch is a targeted replacement in a specific file.

### Patch A — `AgentROIHero.css`: Display-scale typography + share bar + delta

Replace the entire contents of `AgentROIHero.css` (created in Task 6) with:

```css
/* AgentROIHero.css — A+ redesign: editorial scale, share bar, delta chip */

.roi-hero {
  background: linear-gradient(
    135deg,
    var(--color-bg-card, #111827) 0%,
    rgba(13, 148, 136, 0.08) 100%
  );
  border: 1px solid var(--color-border, #1E3047);
  border-radius: var(--radius-lg, 14px);
  padding: var(--space-6, 24px) var(--space-8, 32px) var(--space-5, 20px);
  display: flex;
  flex-direction: column;
  gap: var(--space-5, 20px);
}

/* Top row: headline left, stats right */
.roi-hero-top {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: start;
  gap: var(--space-8, 32px);
}

@media (max-width: 768px) {
  .roi-hero-top { grid-template-columns: 1fr; gap: var(--space-4, 16px); }
}

/* The big declarative number */
.roi-hero-share {
  font-size: clamp(44px, 6vw, 64px);
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1;
  color: var(--color-primary, #0D9488);
  font-variant-numeric: tabular-nums;
  font-family: var(--font-primary);
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.roi-hero-share-label {
  font-size: clamp(16px, 2vw, 20px);
  font-weight: 500;
  color: var(--color-text-secondary, #94A3B8);
  letter-spacing: -0.01em;
  line-height: 1.3;
}

/* Delta chip: ↑ +8pp vs last period */
.roi-delta-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  margin-top: 8px;
  width: fit-content;
}

.roi-delta-chip.positive {
  background: rgba(16, 185, 129, 0.12);
  color: var(--color-success, #10B981);
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.roi-delta-chip.negative {
  background: rgba(239, 68, 68, 0.10);
  color: var(--color-danger, #EF4444);
  border: 1px solid rgba(239, 68, 68, 0.22);
}

.roi-delta-chip.neutral {
  background: rgba(148, 163, 184, 0.08);
  color: var(--color-text-secondary, #94A3B8);
  border: 1px solid var(--color-border, #1E3047);
}

/* Low-share alert banner */
.roi-alert {
  padding: 8px 14px;
  background: rgba(217, 119, 6, 0.08);
  border: 1px solid rgba(217, 119, 6, 0.22);
  border-radius: var(--radius-md, 10px);
  font-size: 13px;
  color: var(--color-warning, #D97706);
  font-weight: 500;
}

/* Secondary stats */
.roi-stats {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
  flex-shrink: 0;
  align-items: flex-end;
}

.roi-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.roi-stat-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-text-primary, #F1F5F9);
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.roi-stat-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--color-text-secondary, #94A3B8);
}

/* Share bar: visual representation of AI% vs human% */
.roi-share-bar-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.roi-share-bar {
  height: 6px;
  background: rgba(148, 163, 184, 0.15);
  border-radius: 3px;
  overflow: hidden;
}

.roi-share-bar-fill {
  height: 100%;
  background: var(--color-primary, #0D9488);
  border-radius: 3px;
  transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}

.roi-share-bar-legend {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--color-text-secondary, #94A3B8);
}

.roi-share-bar-legend span:first-child { color: var(--color-primary, #0D9488); font-weight: 600; }

/* Skeleton */
.roi-hero-skeleton {
  height: 160px;
  border-radius: var(--radius-lg, 14px);
}
```

### Patch B — `AgentROIHero.jsx`: Use display-scale layout

Replace the entire contents of `AgentROIHero.jsx` (created in Task 6) with:

```jsx
import './AgentROIHero.css'

export default function AgentROIHero({ data, loading }) {
  if (loading) {
    return <div className="roi-hero-skeleton skeleton-block" />
  }
  if (!data) return null

  const share = data.ai_sourcing_share ?? 0
  const delta = data.share_delta ?? null
  const hours = data.hours_saved ?? 0
  const hireRate = data.ai_hire_rate ?? 0

  const deltaClass = delta == null
    ? 'neutral'
    : delta > 0.5 ? 'positive'
    : delta < -0.5 ? 'negative'
    : 'neutral'

  const deltaLabel = delta == null
    ? null
    : `${delta > 0 ? '↑ +' : '↓ '}${Math.abs(delta)}pp vs last period`

  return (
    <div className="roi-hero">
      <div className="roi-hero-top">
        <div>
          <div className="roi-hero-share">
            {share}%
            <span className="roi-hero-share-label">
              of sourcing handled by AI
            </span>
          </div>
          {deltaLabel && (
            <div className={`roi-delta-chip ${deltaClass}`}>
              {deltaLabel}
            </div>
          )}
          {share < 20 && (
            <div className="roi-alert" style={{ marginTop: 12 }}>
              AI contribution is low — check sourcing settings or run a manual search to seed the agent.
            </div>
          )}
        </div>

        <div className="roi-stats">
          <div className="roi-stat">
            <span className="roi-stat-value">{hours}h</span>
            <span className="roi-stat-label">Hours saved</span>
          </div>
          <div className="roi-stat">
            <span className="roi-stat-value">{hireRate}%</span>
            <span className="roi-stat-label">AI hire rate</span>
          </div>
        </div>
      </div>

      {/* Share bar */}
      <div className="roi-share-bar-wrap">
        <div className="roi-share-bar">
          <div
            className="roi-share-bar-fill"
            style={{ width: `${Math.min(share, 100)}%` }}
          />
        </div>
        <div className="roi-share-bar-legend">
          <span>AI {share}%</span>
          <span>Human {Math.max(0, 100 - share)}%</span>
        </div>
      </div>
    </div>
  )
}
```

### Patch C — `AnalyticsPage.css`: Asymmetric layout + featured KPI

Find and replace these two blocks in `AnalyticsPage.css` (created in Task 12):

**Replace the 2-col row rule:**
```css
/* FROM */
.analytics-row-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4, 16px);
}

/* TO — funnel gets more space than signals */
.analytics-row-2col {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: var(--space-4, 16px);
}

/* Radar+Throughput row stays even */
.analytics-row-2col.even {
  grid-template-columns: 1fr 1fr;
}
```

**Replace the KPI row to give the first item featured treatment:**
```css
/* REPLACE .analytics-kpi-row */
.analytics-kpi-row {
  display: flex;
  gap: var(--space-8, 32px);
  padding: var(--space-5, 20px) var(--space-6, 24px);
  background: var(--color-bg-elevated, #1A2236);
  border: 1px solid var(--color-border, #1E3047);
  border-radius: var(--radius-lg, 14px);
  flex-wrap: wrap;
  align-items: center;
}

/* First KPI is the featured one */
.analytics-kpi-item:first-child .analytics-kpi-val {
  font-size: 38px;
  color: var(--color-primary, #0D9488);
}

.analytics-kpi-item:first-child .analytics-kpi-lbl {
  color: var(--color-primary, #0D9488);
  opacity: 0.8;
}

/* Divider between featured and rest */
.analytics-kpi-item:nth-child(2) {
  border-left: 1px solid var(--color-border, #1E3047);
  padding-left: var(--space-8, 32px);
}
```

### Patch D — `AnalyticsPage.jsx`: Apply `.even` class to radar+throughput row

In `AnalyticsPage.jsx` (Task 11), find the second `analytics-row-2col` div (the Radar + Throughput row) and add the `even` class:

```jsx
{/* Change FROM */}
<div className="analytics-row-2col">
  <BottleneckRadar data={radar} loading={loading} />
  <ThroughputBars data={recruiter} loading={loading} />
</div>

{/* TO */}
<div className="analytics-row-2col even">
  <BottleneckRadar data={radar} loading={loading} />
  <ThroughputBars data={recruiter} loading={loading} />
</div>
```

### Patch E — Self-review update

After applying patches A–D, run these checks:
- Hero: The `72%` text should be visually dominant and obviously the most important number on the page
- Delta chip: Appears below the big % when `share_delta` is non-null
- Share bar: Thin teal bar fills proportionally to AI share, animated on load
- KPI row: First item (AI sourcing share) is noticeably larger and teal vs the rest
- Funnel + Signals: Funnel takes 60% width, Signals 40%
- Radar + Throughput: Equal 50/50 split (`.even` class)
- [x] **No new dependencies:** All SVG inline, no Recharts, no D3
