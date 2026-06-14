# Self-Serve Analytics + Scheduled Insight Reports — Implementation Plan

> **Status:** Proposed (planning only — implementation follows approval)
> **Date:** 2026-06-14
> **Owner:** Elavala
> **Supersedes the analytics half of:** `docs/archive/superpowers/plans/2026-06-06-analytics-redesign.md`

---

## TL;DR

We **keep the two existing tabs** ("Agent ROI" and "System Health") and **add a third tab —
"Explore"** — that is a **self-serve analytics workspace**: users build their own dashboards by
dragging widgets onto a grid, and for each widget they pick the metric, the group-by (X axis),
the date range, and filters — without writing SQL. They can then **schedule a report** on any
saved dashboard; on the chosen cadence our system renders a **PDF/HTML report with AI-written
insights** and emails it out (insights live *inside the report*; the email body carries a
short summary).

We also **improve the two existing tabs in place** — most importantly, replacing the two
**hardcoded** radar values in the Agent ROI tab with real data (details in §6).

The whole thing is built **on the stack we already have** — FastAPI + asyncpg + Postgres,
React, Celery + Redis, Resend. **No new BI infrastructure.** The one architectural idea that
makes this safe and flexible is a **semantic metric registry** (explained below in plain
terms).

**Recommendation:** build it natively, ship in phases. Nothing existing is removed; the new
Explore tab sits beside the current two, and we seed it with a couple of preset dashboards
(including an "Agent ROI" preset) so users see what good looks like.

> **Workflow note (for implementation):** this is a **planning document only**. When the build
> begins, follow the per-step commit + `docs/qa/bug_fixes_log.md` tracking workflow described in
> §10 — commit each meaningful step with a clear message, and update the tracker entry (#228)
> *before* each commit.

---

## 1. Why today's analytics fall short

The current `/analytics` page (`frontend/src/components/Analytics/AnalyticsPage.jsx`) has two
tabs, both **hardcoded**:

- **Agent ROI** — AI-vs-human funnel, bottleneck radar, recruiter leaderboard. It answers
  exactly one question ("how much did the AI do?") and nothing else.
- **System Health** — Celery task health, LLM cost, JD generation stats. This is *ops
  telemetry*, not business analytics.

Concrete problems:

1. **It's not real analytics.** Several "metrics" are literally constants in the backend.
   In `get_bottleneck_radar()` (`backend/services/dashboard_service.py`), `ai_accept` is
   hardcoded to `0.7` and `retention` to `0.8`. The radar looks data-driven but isn't.
2. **No org-level or dept-level slicing.** There's a global period switcher
   (`week/month/quarter/year`) and a coarse `dept_id` filter on a couple of endpoints, but a
   user cannot ask "show me time-to-hire **by department** for **Q2**" or "applications **by
   source** for the **Engineering** dept this month." Every chart is pre-decided.
3. **Zero customisation.** Users can't choose what they see, change a chart's axis, add a
   filter, or save a view. One layout fits everybody.
4. **No way to get analytics out of the app.** No export, no scheduled digest, no email. A
   hiring manager who wants a Monday-morning snapshot has to log in and read fixed cards.

Meanwhile the **data is already there and well-shaped** for real analytics — we just aren't
exposing it flexibly.

---

## 2. What we're building (three pillars)

```
┌─────────────────────────────────────────────────────────────────────┐
│  PILLAR A — Analytics Foundation (the "semantic layer")             │
│  A registry of safe, reusable METRICS and DIMENSIONS over our data. │
│  One query engine that turns a widget's config into safe SQL.       │
└─────────────────────────────────────────────────────────────────────┘
                                  │  powers
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PILLAR B — Drag-and-Drop Dashboard Builder (frontend)             │
│  Grid of widgets. Per widget: pick metric, X axis, date range,      │
│  filters, chart type. Save / share dashboards. Org & dept presets.  │
└─────────────────────────────────────────────────────────────────────┘
                                  │  any saved dashboard can be
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PILLAR C — Scheduled Insight Reports                              │
│  User schedules a dashboard → Celery renders a PDF/HTML report with │
│  AI-written insights → Resend emails it (summary in the body).      │
└─────────────────────────────────────────────────────────────────────┘
```

Each pillar is a separable phase, so we can ship value early (Pillar A + a few preset charts)
before the full builder exists.

---

## 3. The architecture, in plain language

You said you don't have a strong view on the engine — so here's the reasoning spelled out,
then the recommendation.

### The core problem to solve

"Let users change the X and Y axis and pick any column" sounds simple, but in a **multi-tenant
SaaS** it's the dangerous part. If the browser could send SQL (or even raw column/table
names) to the server, a user could read another organization's data, run a query that locks
the database, or break when someone renames a column. We must **never** let the client send
SQL or raw schema names.

### Three ways to build it

| Option | What it is | Pros | Cons | Verdict |
|---|---|---|---|---|
| **A. Custom on our stack** | We write a small "query engine" in FastAPI that knows a fixed catalog of metrics/dimensions and builds safe SQL itself. | No new infra; perfect fit with our `org_id`/RLS security; matches our code; full control of UX. | We build the catalog + engine ourselves. | ✅ **Recommended** |
| **B. Semantic layer (Cube.dev)** | Run Cube as a separate service; it generates/caches queries; we build only the UI. | Less query plumbing; built-in caching. | New service to run + secure; another moving part; per-tenant security needs careful wiring. | Overkill for now |
| **C. Embed BI (Metabase / Superset)** | Drop in a whole open-source BI app. | Fastest to "lots of charts." | Heavy infra; won't match our design system; per-tenant row security is awkward; users leave our UX. | No |

We recommend **A**. The reason it's not as much work as it sounds is the **semantic metric
registry** — the one concept worth understanding.

### The semantic metric registry (the key idea)

Instead of letting users touch tables and columns, we define — **once, in our backend code** —
a catalog of **Metrics** (things you can measure) and **Dimensions** (ways to slice them).
Think of it as a safe menu.

```
METRIC  (the "Y axis" / the number)         DIMENSION (the "X axis" / the slice)
──────────────────────────────────────      ──────────────────────────────────────
applications        COUNT(*)                date            day / week / month bucket
hires               COUNT(status=hired)      department      departments.name
avg_time_to_hire    AVG(hired_at-created)    source          candidates.source
avg_ats_score       AVG(skill_match_score)   status          application status
interviews          COUNT(interviews)        position        positions.role_name
offer_accept_rate   hired / offers           recruiter       users.name (assigned)
llm_cost_usd        SUM(llm cost)            actor_type      human / ai_agent / system
```

A **widget** is then just a small JSON spec the user composes through the UI:

```json
{
  "metric": "avg_time_to_hire",
  "dimension": "department",     // X axis
  "chart": "bar",
  "date_range": { "preset": "last_quarter" },
  "filters": [{ "field": "status", "op": "in", "value": ["selected", "hired"] }]
}
```

The browser only ever sends **these whitelisted keys** ("avg_time_to_hire", "department", …).
The backend looks each one up in the registry, and **the registry — not the user — owns the
actual SQL fragment** (`AVG(...)`, `GROUP BY departments.name`, etc.). The engine then:

1. validates every key against the catalog (anything unknown is rejected),
2. always injects `WHERE org_id = $current_user_org` (and dept scoping for non-admins),
3. builds a single **parameterized** query (values bound as `$1, $2…`, never string-concatenated),
4. runs it and returns rows ready to chart.

So users get genuine "change the axis / pick the column / set the date range" freedom, but the
surface area is a **safe, fixed menu** we control. This is exactly what Cube/Looker do under
the hood — we're just implementing a focused version for our own schema, with no extra
service to run.

> **One-line summary:** the client composes a *spec from a menu*; the server owns the *SQL*.
> Flexible for users, safe for the platform.

---

## 4. Data model — new tables

Four new tables. They follow our existing rules: every row carries `org_id`, migrations are
idempotent `DO $$` blocks appended to `backend/db/migrations.py` and run at startup.

### 4.1 `dashboards` — a saved canvas

```sql
CREATE TABLE IF NOT EXISTS dashboards (
    id              SERIAL PRIMARY KEY,
    org_id          INTEGER NOT NULL REFERENCES organizations(id),
    department_id   INTEGER REFERENCES departments(id),   -- NULL = org-wide
    owner_user_id   INTEGER NOT NULL REFERENCES users(id),
    name            TEXT    NOT NULL,
    description     TEXT,
    scope           TEXT    NOT NULL DEFAULT 'private',    -- private | dept | org
    is_preset       BOOLEAN NOT NULL DEFAULT FALSE,        -- system-seeded (e.g. Agent ROI)
    layout          JSONB   NOT NULL DEFAULT '[]',         -- grid positions: [{i,x,y,w,h}]
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dashboards_org ON dashboards(org_id, department_id);
```

`scope` controls visibility: `private` (only owner), `dept` (anyone in the department), `org`
(everyone in the org). Admins (`org_head`/`dept_admin`) can publish dept/org dashboards.

### 4.2 `dashboard_widgets` — one chart on a dashboard

```sql
CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id              SERIAL PRIMARY KEY,
    dashboard_id    INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    org_id          INTEGER NOT NULL REFERENCES organizations(id),
    title           TEXT    NOT NULL,
    spec            JSONB   NOT NULL,   -- {metric, dimension, chart, date_range, filters,...}
    position        JSONB   NOT NULL DEFAULT '{}',  -- {x,y,w,h} grid cell
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_widgets_dashboard ON dashboard_widgets(dashboard_id);
```

The `spec` JSON is the widget definition from §3 (metric + dimension + chart + date_range +
filters). Keeping it as JSONB means we can add new options later without migrations.

### 4.3 `report_schedules` — a user-defined scheduled report

```sql
CREATE TABLE IF NOT EXISTS report_schedules (
    id              SERIAL PRIMARY KEY,
    org_id          INTEGER NOT NULL REFERENCES organizations(id),
    dashboard_id    INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    created_by      INTEGER NOT NULL REFERENCES users(id),
    name            TEXT    NOT NULL,
    cadence         TEXT    NOT NULL,            -- daily | weekly | monthly
    send_at_hour    SMALLINT NOT NULL DEFAULT 8, -- local hour (org timezone)
    weekday         SMALLINT,                    -- 0-6 for weekly
    day_of_month    SMALLINT,                    -- 1-28 for monthly
    recipients      JSONB   NOT NULL DEFAULT '[]', -- ["a@x.com", ...] or role keys
    format          TEXT    NOT NULL DEFAULT 'pdf', -- pdf | html
    date_window     TEXT    NOT NULL DEFAULT 'last_period', -- what range the report covers
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    next_run_at     TIMESTAMP NOT NULL,          -- computed; the dispatcher reads this
    last_run_at     TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_report_sched_due ON report_schedules(enabled, next_run_at);
```

`next_run_at` is the heartbeat the scheduler polls (see §6). We compute it from
`cadence`/`send_at_hour`/`weekday`/`day_of_month` using the org timezone.

### 4.4 `report_runs` — history / audit of sends

```sql
CREATE TABLE IF NOT EXISTS report_runs (
    id              SERIAL PRIMARY KEY,
    org_id          INTEGER NOT NULL REFERENCES organizations(id),
    schedule_id     INTEGER REFERENCES report_schedules(id) ON DELETE SET NULL,
    status          TEXT    NOT NULL,    -- success | failed | partial
    recipients      JSONB,
    insights_summary TEXT,               -- the AI summary we put in the email body
    error           TEXT,
    duration_ms     INTEGER,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
```

> We already have a `task_run_log` table — `report_runs` is the report-specific equivalent and
> can reuse the same logging conventions.

### 4.5 The metric/dimension catalog — *code, not a table*

The registry from §3 lives in **Python**, not the database (it's behavior, not data). New
module `backend/services/analytics/registry.py`:

```python
# Each metric/dimension is a small, safe descriptor. No user input reaches SQL text.
@dataclass(frozen=True)
class Metric:
    key: str                 # "avg_time_to_hire"  (what the client sends)
    label: str               # "Avg Time to Hire"
    sql: str                 # "AVG(EXTRACT(EPOCH FROM (hired_at - ca.created_at))/86400)"
    base: str                # logical source: "applications" | "interviews" | "llm"
    unit: str = ""           # "days" | "%" | "$"
    roles: tuple = ()        # () = all; ("org_head","dept_admin") = restricted

@dataclass(frozen=True)
class Dimension:
    key: str                 # "department"
    label: str               # "Department"
    sql: str                 # "departments.name"
    join: str | None = None  # optional JOIN fragment the engine adds when used

METRICS    = { m.key: m for m in (...) }
DIMENSIONS = { d.key: d for d in (...) }
```

The full proposed catalog is in §7.

---

## 5. Backend — the query engine + endpoints

### 5.1 The query engine (the heart of Pillar A)

New module `backend/services/analytics/query_engine.py`, one function:

```python
async def run_widget_query(spec: dict, current_user: dict) -> dict:
    """Compile a validated widget spec into ONE safe parameterized SQL query and run it."""
```

Steps (mirrors §3):

1. **Validate** `spec.metric` and `spec.dimension` against `registry.METRICS` / `DIMENSIONS`.
   Unknown key → `400`. Check `metric.roles` against `current_user["role"]`.
2. **Resolve base + joins.** Choose the base table (e.g. `candidate_applications ca`) from the
   metric's `base`, add the dimension's `join` if any.
3. **Tenant guard (non-negotiable).** Always append `WHERE ca.org_id = $1` from the JWT, never
   from the request. For non-admin roles, also append `AND ca.department_id = $2` using
   the existing `_resolve_dept_id()` rule already in `routers/dashboard.py`.
4. **Date range.** Translate presets (`last_7_days`, `last_quarter`, `custom{from,to}`) into a
   bound `created_at BETWEEN $n AND $m`. Date bucketing (`day/week/month`) uses
   `date_trunc($bucket, created_at)`.
5. **Filters.** Each filter `{field, op, value}` is validated against the catalog; only
   whitelisted ops (`=, in, >, <, between`) are allowed; values are **bound parameters**.
6. **Assemble + execute** with asyncpg (`conn.fetch`). Cap rows (e.g. `LIMIT 1000`) and add a
   statement timeout so a heavy query can't hurt the DB.
7. **Shape** the result: `{ "columns": [...], "rows": [...], "meta": {metric, dimension, unit} }`
   — ready for the chart component.

Because step 6 produces exactly one parameterized query and steps 1–5 only ever read from the
in-code registry, **no user string ever becomes SQL**. That's the whole safety story.

> **Performance note:** all our analytics read from `candidate_applications`, `pipeline_events`,
> `interviews`, `llm_usage_log`. These already have `org_id` indexes. For heavy org-wide
> queries we add a short Redis cache (we already run Redis for Celery) keyed by
> `(org_id, dept, spec_hash, date_range)` with a 5–10 min TTL. Phase 2+.

### 5.2 API endpoints

New router `backend/routers/analytics.py`, prefix `/api/v1/analytics` — same `get_current_user`
dependency and role helpers as `dashboard.py`.

| Method & path | Purpose |
|---|---|
| `GET /catalog` | Return the metric + dimension menu (filtered by the caller's role) so the builder UI can render its pickers. |
| `POST /query` | Run **one** widget spec, return chart-ready rows. The builder calls this live as the user tweaks a widget. |
| `POST /query/batch` | Run all widgets on a dashboard in one round-trip (dashboard load). |
| `GET /dashboards` | List dashboards visible to the user (private + dept + org + presets). |
| `POST /dashboards` | Create a dashboard. |
| `GET /dashboards/{id}` | Fetch a dashboard + its widgets. |
| `PUT /dashboards/{id}` | Update name/scope/layout/widgets (autosave). |
| `DELETE /dashboards/{id}` | Delete (owner or admin only). |
| `GET/POST/PUT/DELETE /report-schedules` | CRUD for scheduled reports. |
| `POST /report-schedules/{id}/run-now` | Fire a one-off send (test button). |

Validation models go in `backend/models/analytics.py` (Pydantic), consistent with
`backend/models/settings.py`.

### 5.3 Relationship to the existing tabs (nothing is removed)

Both existing tabs **stay exactly where they are**. The new query engine is purely additive —
it powers the new **Explore** tab only. Specifically:

- **Agent ROI tab** — kept. Its `dashboard_service.py` methods (`get_agent_roi`, `get_per_recruiter`,
  `get_bottleneck_radar`, `get_analytics`) are unchanged *except* for the two hardcoded radar
  fixes in §6. Separately, we **also** seed an "Agent ROI" *preset* inside the Explore tab built
  from catalog widgets, as a worked example users can clone — but the original tab remains.
- **System Health tab** — kept as-is. It reads real data already (`ops_service.py`); we only
  add small enhancements (§6.2). It stays beside the others.
- **New Explore tab** — the self-serve builder. Added as a third tab button in
  `AnalyticsPage.jsx` (the tab state already supports `'roi' | 'ops'`; we add `'explore'`).

---

## 6. Reviewing & improving the two existing tabs

You asked me to (a) check where the hardcoded values actually live, and (b) propose making the
existing tabs more insightful. Here's the audit.

### 6.1 Agent ROI tab — fix the two fake numbers (this is where they are)

**Important correction:** the hardcoded values are **not in System Health.** They are in the
**Agent ROI** tab, specifically `backend/services/dashboard_service.py` →
`get_bottleneck_radar()` (lines ~597–600), which feeds `BottleneckRadar.jsx`:

```python
# AI Accept: placeholder until copilot accept rate is tracked
"ai_accept": 0.7,
# Retention: placeholder until 90-day post-hire data is available
"retention": 0.8,
```

The other four radar axes (`sourcing`, `screening`, `interview`, `offer`) are computed from
real data. Only these two are constants. Recommended fixes:

**`ai_accept` → derive from real Copilot data (quick win available now).**
We already have a `copilot_suggestions` table with an `is_dismissed` flag. A real acceptance
proxy for the period is:

```sql
SELECT
  COUNT(*)                                AS suggested,
  COUNT(*) FILTER (WHERE NOT is_dismissed) AS acted_on
FROM copilot_suggestions
WHERE org_id = $1 AND created_at BETWEEN $2 AND $3;
-- ai_accept = acted_on / NULLIF(suggested, 0)
```

> Caveat: `is_dismissed = false` means "not dismissed," which is a reasonable *proxy* for
> "accepted/acted on" but not a true accept signal. For a precise metric, add an
> `accepted_at TIMESTAMP` (or `is_accepted BOOLEAN`) column to `copilot_suggestions` and set it
> when the user follows the suggestion's `action_url`. **Recommendation:** ship the dismissal
> proxy now (real data, no migration), and add explicit accept-tracking as a fast follow.

**`retention` → no data source exists yet; do not fake it.**
There is genuinely no post-hire/90-day data in the schema. Two honest options:

1. **Replace the axis** with a real one that *does* have data, e.g. **"Completion"** =
   `applied → hired` pass-through, or **"Screen quality"** = avg ATS score of hires. Keeps the
   radar a full hexagon and every axis truthful. ✅ *Recommended.*
2. **Drop to a 5-axis radar** until post-hire tracking exists.

Either way, remove the constant. (When real retention data lands later — e.g. an
`employment_outcomes` table — we add the 6th axis back.)

**Other Agent ROI improvements (optional, higher insight):**

- **Add department scoping** to `get_agent_roi` / `get_bottleneck_radar` (today only some
  dashboard endpoints accept `dept_id`). This lets admins compare AI ROI *across departments* —
  directly addressing your "dept level too" point.
- **Show period-over-period deltas** on the hero stats (the radar already overlays previous
  period; the hero numbers don't). Cheap, high signal.
- **Make the radar normalization thresholds configurable** instead of magic numbers (sourcing
  is normalized to "100 candidates = healthy," which is arbitrary per org).

### 6.2 System Health tab — already real; small enhancements

Audit result: **System Health reads entirely real data.** `ops_service.py`
(`get_celery_stats`, `get_llm_stats`, `get_jd_stats`) queries `task_run_log`, `llm_usage_log`,
and `positions`. **No hardcoded business values.** Nothing to "un-fake" here.

Suggested enhancements (optional):

- **Cost-per-hire** and **cost-per-candidate** derived tiles (join `llm_usage_log` totals with
  hires) — turns raw LLM cost into a business number leaders care about.
- **Failed-task drill-down**: list the most recent failed `task_run_log` rows so an admin can
  act, not just see a success-rate %.
- **Budget threshold/alerting** hook: flag when monthly LLM cost crosses a configured ceiling.

> Each fix above should be its **own commit** and its **own line** in the tracker (§10), e.g.
> "fix(analytics): replace hardcoded ai_accept radar value with copilot-derived rate."

---

## 7. The "Explore" tab — drag-and-drop builder (frontend)

All new components live in `frontend/src/components/Analytics/explore/`. The tab has two modes:
**View** (read a dashboard) and **Edit** (drag, add, configure widgets).

### 7.1 Layout & interaction

```
┌──────────────────────────────────────────────────────────────────────┐
│  [ Dashboard ▾ My Hiring View ]   [ Date: Last 30 days ▾ ]  [+ Widget] │  ← toolbar
│                                                  [ Edit ] [ Schedule ▾ ]│
├──────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐ ┌───────────────┐ ┌──────────────────────────────┐ │
│  │ Hires (number)│ │ Apps by Source│ │  Time-to-hire by Department   │ │
│  │      42       │ │   (pie)       │ │        (bar)                   │ │  ← draggable,
│  │   ▲ +12% MoM  │ │   ◔           │ │   ▆ ▃ ▅ ▂                      │ │    resizable
│  └───────────────┘ └───────────────┘ └──────────────────────────────┘ │    grid cells
│  ┌──────────────────────────────────────────┐ ┌────────────────────┐  │
│  │ Pipeline funnel over time (line)          │ │ Top positions(table)│ │
│  └──────────────────────────────────────────┘ └────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

When the user clicks **+ Widget** or a widget's gear icon, a **config panel** slides in:

```
Widget config
─────────────────────────────
Chart type:  [ Bar ▾ ]  (bar | line | area | pie | number | table | funnel)
Measure (Y): [ Avg Time to Hire ▾ ]        ← from catalog, role-filtered
Group by (X):[ Department ▾ ]              ← dimension list
Date range:  [ Last 30 days ▾ | custom ]
Filters:     [ Status in (selected, hired) ] [+ add filter]
Department:  [ All | Engineering | … ]     ← admins only; auto-scoped otherwise
─────────────────────────────
            [ Live preview renders as you change any field ]
```

Every change re-calls `POST /api/v1/analytics/query` with the widget spec and re-renders the
preview — this is the "change X and Y axis / pick the column / set the date range" experience
you described, backed by the safe engine from §5.

### 7.2 Libraries (one scoped new dependency)

| Need | Library | Why / tradeoff |
|---|---|---|
| Drag-resize grid | **`react-grid-layout`** | The de-facto React dashboard grid (used by Grafana-likes). Handles drag, resize, responsive breakpoints, and serialises positions to the `layout` JSON we store. |
| Charts | **`recharts`** | Declarative, React-native, themeable to our design tokens. Hand-rolling 7 configurable chart types in inline SVG (our current approach) would be a large, bug-prone effort. |

> **Tradeoff vs our "no chart lib / inline SVG" ethos:** the existing fixed cards (funnel,
> radar, sparkline) are bespoke SVG and can stay. But a *configurable* builder with 7 chart
> types and axis-switching is exactly the case a chart library exists for. Recharts is ~50KB
> gzipped, tree-shakeable, and is loaded **only on the Explore tab** (already lazy-loaded via
> `router.jsx`). Net: justified, scoped, and reversible. If you'd rather avoid it, the fallback
> is to support fewer chart types (number, bar, line, table) in inline SVG — but I recommend
> Recharts.

### 7.3 Component map

| Component | Responsibility |
|---|---|
| `ExploreTab.jsx` | Tab entry; dashboard selector, mode toggle, loads `GET /dashboards/{id}` + `query/batch`. |
| `DashboardGrid.jsx` | Wraps `react-grid-layout`; renders widgets; persists layout on drag (autosave via `PUT /dashboards/{id}`). |
| `WidgetCard.jsx` | One widget: title, gear (edit), the chart, loading/empty/error states. |
| `WidgetRenderer.jsx` | Maps `spec.chart` → Recharts component (or bespoke SVG for number/funnel). |
| `WidgetConfigPanel.jsx` | The slide-in editor (measure, dimension, date range, filters, chart type) + live preview. |
| `CatalogProvider.jsx` | Fetches `GET /catalog` once, supplies measure/dimension options to pickers. |
| `useWidgetQuery.js` | Hook: debounced `POST /query` per widget spec; caches by spec hash. |
| `ScheduleDialog.jsx` | Create/edit a `report_schedule` for the current dashboard (§8). |

All styling uses the existing design tokens (`var(--color-primary, #0D9488)`, `--color-bg-card`,
etc.) and avoids the documented AI-slop anti-patterns (no icon-in-colored-circle, no left-border
accent stripe, no `transition: all`) from `docs/design/00_design_system.md`.

---

## 8. Scheduled reports with AI insights

Goal: a user opens any saved dashboard, clicks **Schedule**, picks a cadence + recipients, and
from then on receives a **report (PDF or HTML) with AI-written insights inside it**, while the
**email body** carries only a short summary. This reuses Celery + Redis + Resend — no new infra.

### 8.1 Dynamic scheduling — the "dispatcher" pattern

Our current Celery Beat schedule (`backend/celery_app.py`) is **static** — fine for fixed jobs,
but users will create *arbitrary* schedules at runtime. Rather than adopt a new scheduler
(RedBeat etc.), we mirror the pattern already in `tasks/scheduled_search.py`:

1. Add **one** Beat entry that runs every 15 minutes — a **dispatcher**:

```python
# celery_app.py  →  beat_schedule
"dispatch-due-reports": {
    "task": "backend.tasks.report_dispatch.dispatch_due_reports",
    "schedule": 900.0,   # every 15 min
},
```

2. The dispatcher queries `report_schedules WHERE enabled AND next_run_at <= NOW()`, and for each
   due row enqueues a `render_and_send_report.delay(schedule_id)` task, then advances
   `next_run_at` to the next occurrence (same idea as `scheduled_search` advancing `next_search_at`).

```python
@celery_app.task(name="backend.tasks.report_dispatch.dispatch_due_reports")
def dispatch_due_reports() -> dict:
    async def _dispatch():
        async with get_admin_connection() as conn:
            due = await conn.fetch(
                "SELECT id FROM report_schedules WHERE enabled AND next_run_at <= NOW() LIMIT 50"
            )
            for row in due:
                render_and_send_report.delay(row["id"])
                await conn.execute(
                    "UPDATE report_schedules SET last_run_at=NOW(), next_run_at=$2 WHERE id=$1",
                    row["id"], _compute_next_run(row),   # cadence-aware, org timezone
                )
            return {"dispatched": len(due)}
    return run_async(_dispatch())
```

This needs **zero new dependencies**, is crash-safe (a missed tick just runs late), and matches
existing code the team already understands.

### 8.2 Rendering the report

New task `backend/tasks/report_dispatch.py → render_and_send_report(schedule_id)`:

1. Load the schedule + its dashboard + widgets.
2. For each widget, run the **same query engine** (`run_widget_query`) over the report's
   `date_window` (e.g. "last completed week"). *Reusing the engine means the report always
   matches what the user sees on screen — single source of truth.*
3. **Generate insights** (§8.3) from the resulting datasets.
4. **Render** the document:
   - **PDF (recommended default):** render an HTML report template, convert with a headless
     renderer. We should use the project's existing **`pdf` skill / WeasyPrint-style HTML→PDF**
     path rather than introducing a browser engine. Charts are drawn server-side as static
     SVG/PNG (we can reuse the bespoke SVG renderers, or a small matplotlib pass) so no browser
     is needed in the worker.
   - **HTML:** the same template, inlined for email clients.
5. **Send** via the existing `EmailProvider` (`adapters/email/resend.py`) — attach the PDF, set
   the body to the short summary, to each recipient.
6. Write a `report_runs` row (success/failed, recipients, `insights_summary`, duration).

> **Why PDF attachment + HTML option:** per your call — the full report (charts + AI insights)
> is the **attachment**; the **email body** is a 3–5 line summary so people get the gist without
> opening it. Inline-image email is finicky across clients (Outlook/Gmail strip things); an
> attached PDF renders identically everywhere and is easy to forward to leadership.

### 8.3 The AI insights (Gen-AI layer)

This is where it gets genuinely valuable and plays to your strength. After the data is gathered,
we ask the LLM (via the existing `adapters/llm/factory.get_llm()`) to **narrate what changed and
why it matters** — not to invent numbers.

Guardrails so insights are trustworthy:

- **Compute first, narrate second.** The backend computes period-over-period deltas, top movers,
  funnel drop-offs, and outliers in Python. We pass the LLM a compact, *factual* JSON of
  these — never raw tables to "analyze freely."
- **The LLM only writes prose** over numbers we already verified. Prompt: *"You are a hiring
  analyst. Given these metrics and deltas for {org/dept} over {period}, write 3–5 concise,
  specific insights and one recommended action. Do not state any number not present in the
  data."*
- **Structured output**: `{ "summary": "...", "insights": ["..."], "recommended_action": "..." }`.
  `summary` → email body; `insights` + `recommended_action` → inside the report.
- Log token cost to `llm_usage_log` (operation `report_insights`) so it shows up in System Health.

Example email body (auto-generated summary):

> **Weekly Hiring Report — Engineering — Jun 2–8**
> Time-to-hire improved 18% (24→20 days); the screening stage is now the main bottleneck
> (41% drop-off). AI sourced 63% of new candidates. Full charts + 4 insights attached (PDF).

### 8.4 Schedule UI

`ScheduleDialog.jsx` (opened from the Explore toolbar): name, cadence (daily/weekly/monthly),
time, recipients (pick org users by role, or free emails), format (PDF/HTML), and a **"Send test
now"** button that calls `POST /report-schedules/{id}/run-now`. Managing schedules lives under
the dashboard's overflow menu and a small "Scheduled reports" list.

---

## 9. The starter catalog (org- and dept-level)

This is the v1 menu the Explore builder exposes. Everything is automatically org-scoped, and
dept-scoped for non-admins; admins can group by or filter on `department` to compare across the
whole org — which is exactly the org-level *and* dept-level analytics gap you flagged.

**Measures (the "Y axis" / number):**

| Key | Label | Source | Unit | Role |
|---|---|---|---|---|
| `applications` | Applications | `candidate_applications` | count | all |
| `hires` | Hires | `candidate_applications` (selected/hired) | count | all |
| `rejections` | Rejections | `candidate_applications` (rejected) | count | all |
| `avg_time_to_hire` | Avg Time to Hire | hired_at − created_at | days | all |
| `avg_ats_score` | Avg Match Score | `skill_match_score` | score | all |
| `offer_accept_rate` | Offer Acceptance | hired / offered | % | all |
| `pass_through_rate` | Stage Pass-through | stage→next conversion | % | all |
| `interviews` | Interviews | `interviews` | count | all |
| `positions_opened` | Positions Opened | `positions` | count | all |
| `positions_filled` | Positions Filled | `positions` (closed-filled) | count | all |
| `ai_sourced_share` | AI-Sourced Share | `candidates.source` ∈ AI set | % | all |
| `copilot_accept_rate` | Copilot Accept Rate | `copilot_suggestions` | % | admin |
| `llm_cost_usd` | LLM Cost | `llm_usage_log` | $ | admin |
| `cost_per_hire` | Cost per Hire | llm cost / hires | $ | admin |

**Dimensions (the "X axis" / slice):**

| Key | Label | Source |
|---|---|---|
| `date` | Date (day/week/month) | `date_trunc(bucket, created_at)` |
| `department` | Department | `departments.name` |
| `source` | Candidate Source | `candidates.source` |
| `status` | Pipeline Stage | application status |
| `position` | Position | `positions.role_name` |
| `recruiter` | Recruiter (admin) | assigned `users.name` |
| `actor_type` | Actor (human/AI/system) | `pipeline_events.actor_type` |

**Filters:** any dimension (equals / in), plus numeric ranges on scores and an explicit date
range. New measures/dimensions are added by appending one descriptor to the registry — no schema
change, no UI change.

---

## 10. Implementation workflow (commits + bug-log tracking)

Per your instruction, the build follows this discipline at **every meaningful step**:

1. **Make the change** for one logical step (one task from §10.1).
2. **Update the tracker** entry `#228` in `docs/qa/bug_fixes_log.md` — tick the step's checkbox
   and note files touched. *(Do this **before** committing, as you asked.)*
3. **Commit** with a conventional message. Suggested prefixes, matching repo style:
   - `feat(analytics): …` new capability
   - `fix(analytics): …` the radar/placeholder fixes
   - `chore(db): …` migrations
   - `test(analytics): …` tests
   Example: `feat(analytics): add /api/v1/analytics/query engine with metric registry`.
4. **Run the relevant test** (or smoke-check the endpoint/UI) before moving on.

A single tracker entry (#228) is seeded now with a checklist; the implementer updates *that one
item* as the work progresses (rather than adding 20 separate entries) — this matches your "add
one item, update it at every step" request. Discrete bug-style fixes (e.g. the two radar
placeholders) may additionally get their own numbered entries since they are true fixes.

### 10.1 Task-by-task breakdown (implementation order)

Sequenced so each task is independently committable and testable. **Phase letters** map to §12.

**Phase 1 — Foundation (backend engine, no UI yet)**
1. `chore(db)`: add `dashboards`, `dashboard_widgets`, `report_schedules`, `report_runs`
   migrations (idempotent `DO $$` blocks). *Test: tables exist after startup.*
2. `feat(analytics)`: metric/dimension **registry** module (`services/analytics/registry.py`).
3. `feat(analytics)`: **query engine** (`services/analytics/query_engine.py`) — validate spec,
   inject org/dept guard, build parameterized SQL, execute. *Test: unit tests incl. an
   injection attempt and a cross-org attempt that must fail.*
4. `feat(analytics)`: router `GET /catalog`, `POST /query`, `POST /query/batch`.

**Phase 2 — Fix & enrich existing tabs (independent, ship anytime)**
5. `fix(analytics)`: replace hardcoded `ai_accept` with copilot-derived rate (§6.1).
6. `fix(analytics)`: replace/drop hardcoded `retention` axis (§6.1).
7. `feat(analytics)`: add `dept_id` scoping to `get_agent_roi` / `get_bottleneck_radar`.
8. *(optional)* System Health: cost-per-hire tile + failed-task drill-down (§6.2).

**Phase 3 — Explore tab (frontend builder)**
9. `chore(fe)`: add `react-grid-layout` + `recharts`; create the third tab button + route branch.
10. `feat(fe)`: `CatalogProvider`, `WidgetConfigPanel`, `WidgetRenderer`, live preview.
11. `feat(fe)`: `DashboardGrid` drag/resize + autosave; dashboard CRUD wiring.
12. `feat(analytics)`: dashboards CRUD endpoints + `models/analytics.py`.
13. `feat(analytics)`: seed an "Agent ROI" preset dashboard.

**Phase 4 — Scheduled insight reports**
14. `feat(analytics)`: `report_schedules` CRUD + `ScheduleDialog.jsx`.
15. `feat(tasks)`: `report_dispatch.dispatch_due_reports` + Beat entry (dispatcher).
16. `feat(reports)`: `render_and_send_report` — query reuse + HTML/PDF render + Resend send.
17. `feat(reports)`: AI insight generation (compute-then-narrate) + `report_runs` logging.
18. `test`: end-to-end "send test now" produces a PDF with real numbers + insights.

---

## 11. Can a smaller model (e.g. Sonnet) build this?

**Short answer: yes for most of it, with two tasks flagged for extra care.** This plan is
deliberately written task-by-task with explicit file paths, patterns to copy, and acceptance
criteria — which is exactly what lets a capable coding model execute reliably. Difficulty by
phase:

| Work | Sonnet-suitable? | Notes |
|---|---|---|
| Migrations (Task 1) | ✅ Easy | Copy the existing idempotent `DO $$` pattern. |
| Registry + catalog (2) | ✅ Easy | Mechanical: fill in descriptors. |
| **Query engine (3)** | ⚠️ **Careful** | Security-critical (tenant isolation + SQL building). Sonnet can write it from this spec, but it **must** get a focused review + the injection/cross-org tests before trusting it. |
| Catalog/query endpoints (4) | ✅ Easy | Standard FastAPI, mirrors `dashboard.py`. |
| Radar placeholder fixes (5–7) | ✅ Easy | Small, well-specified. |
| Explore UI (9–11) | ✅ Medium | Standard React + two well-documented libs; the config-panel↔preview loop is the fiddly part but routine. |
| Dashboards CRUD (12–13) | ✅ Easy | CRUD. |
| **Reports + scheduler (14–17)** | ⚠️ **Medium-hard** | The dispatcher is straightforward (copy `scheduled_search`). The HTML→PDF render and the compute-then-narrate insight layer have the most moving parts; build behind a "send test now" button and iterate. |

**Recommended division of labor (your option A):**

1. **You/Sonnet implement** straight from this doc, phase by phase, with the per-step commit +
   tracker discipline (§10).
2. For the **two flagged tasks** (query engine, report/insight pipeline), lean on the project's
   own skills during implementation: `security-review` (tenant isolation, injection),
   `python-testing` / `tdd-workflow` (the engine's tests), `pdf` (the report render), and
   `api-design` (endpoint shape).
3. **I do the final code review** — ideally per-phase, not just at the end — focusing hardest on
   the query engine's safety and the report pipeline's correctness. (If you'd rather, I can also
   drive the whole thing end-to-end; but option A keeps you in control and is a good fit here.)

The one thing **not** to delegate blindly is the query engine's tenant-isolation guarantee. If
that's correct (org filter always injected from the JWT, never the request; everything
parameterized; cross-org test passes), the rest is low-risk, conventional work.

---

## 12. Phased rollout & effort

| Phase | Ships | Value delivered | Rough effort* |
|---|---|---|---|
| **1. Foundation** | Registry + query engine + catalog/query APIs | Safe query layer; internally testable | 3–5 days |
| **2. Fix existing tabs** | Real `ai_accept`, honest radar, dept scoping | Existing analytics become trustworthy — *ship first, independent* | 1–2 days |
| **3. Explore tab** | Drag-drop builder, save/share dashboards, presets | The self-serve experience you asked for | 5–8 days |
| **4. Scheduled reports** | Cadence scheduler + PDF/HTML + AI insights + email | Reports land in inboxes automatically | 4–6 days |

*Solo developer with AI assistance; not calendar-committed. Phase 2 can go out immediately and
independently — it's the fastest credibility win.*

**Suggested order:** do **Phase 2 first** (small, high-trust fixes to what exists), then 1 → 3 → 4.

---

## 13. Risks & open decisions

- **Query performance at scale.** Big org-wide group-bys could be slow. Mitigation: `org_id`
  indexes (exist), `LIMIT` + statement timeout, and a Redis cache (Phase 3+). Open: do we
  pre-aggregate a daily rollup table if orgs get large? (defer until needed.)
- **Tenant isolation is the #1 risk.** Covered by the engine design + mandatory cross-org tests.
  Treat any change here as security-sensitive.
- **PDF rendering in the worker.** Prefer HTML→PDF (WeasyPrint via the `pdf` skill) with
  server-drawn static charts to avoid running a headless browser in Celery. Open decision: HTML→PDF
  vs a headless-Chrome service — recommend the former.
- **Insight trustworthiness.** The compute-then-narrate guardrail prevents hallucinated numbers,
  but insights should be reviewed during Phase 4 bring-up before enabling for all orgs.
- **Copilot "accept" proxy.** Dismissal-based now; add explicit `accepted_at` tracking as a fast
  follow for a true metric.
- **Permissions for shared dashboards.** Confirm who can publish `org`/`dept`-scoped dashboards
  (proposed: `org_head`/`dept_admin`). Easy to adjust.

---

## 14. What this plan deliberately does *not* do

- It does **not** remove or replace the Agent ROI or System Health tabs.
- It does **not** add a heavyweight BI tool or a new always-on service.
- It does **not** let the browser send SQL or raw schema names — ever.
- It does **not** invent metrics that have no data source (hence the honest `retention` fix).

---

*End of plan. Implementation is gated on your approval; nothing in the codebase has been changed
by this document.*
