> **Build status:** ✅ Redesigned (2026-05-29)
> Consolidated docs index: [../../README.md](../../README.md) · Status tracker: [../../STATUS.md](../../STATUS.md) · Design system: [../00_design_system.md](../00_design_system.md)
> This page merges the v3 redesign spec with the pre-v3 behavioral spec (appendix below, where one existed).

# Page 02 — Positions List

**Pattern:** *Pipeline Garden* (variant A)
**Replaces:** generic table rows with status / candidate count / dept columns
**Why:** A table reduces every position to identical-looking rows. The Garden cards surface the *shape* of each pipeline at a glance — daily trend sparkline, full-funnel mini-strip, AI activity badge, urgency sort.

Preview reference: `/tmp/atl-design-preview-v3.html` → tab "Positions".

---

## 1. Route & layout

| Aspect | Value |
|---|---|
| Route | `/positions` |
| Auth | Required (JWT) |
| Layout | App shell · 2-column garden grid on desktop, single column on tablet |
| Role-adaptive | Admin sees all dept positions; recruiter sees own dept; HM sees assigned |

---

## 2. Backend tie-in

| Endpoint | Used for |
|---|---|
| `GET /api/v1/positions/?status=&dept=&owner=&page=` | Position list |
| `GET /api/v1/positions/{id}/sparkline?days=30` | Daily applicants for sparkline (**new** — see §7) |
| `GET /api/v1/positions/{id}/stage-counts` | 7-stage pipeline counts per card (**new** — or derive from existing pipeline endpoint) |
| `GET /api/v1/dashboard/copilot?type=stale_position` | Stalled-position annotations on Garden cards |

DB fields read from `positions`:
- `role_name`, `status` (draft/open/on_hold/closed/archived)
- `priority` (urgent/high/normal/low) · `headcount` · `department_id` · `assigned_to` (owner)
- `last_search_at` · `next_search_at` · `search_interval_hours` (for AI activity badge)
- `created_at` · count of `pipeline_events` (for trend)
- `comp_min` / `comp_max` (display in meta line — see PRODUCT_PLAN §13 Phase 2)

---

## 3. Layout per card

```
┌── Position Card ────────────────────────────────────────────────┐
│  Senior ML Engineer  [Active chip]                  [Urgent pri]│
│  Engineering · Bangalore · Hybrid · ₹40–60 · 12d open    PLT-2891│
│                                                                  │
│  Daily applications · last 30 days · ↑ trending                 │
│  [────────── 30-day sparkline (SVG) ──────────────────]         │
│                                                                  │
│  ┌────┬────┬────┬────┬────┬────┬────┐                          │
│  │ 34 │ 28 │ 18 │ 9  │ 5  │ 1  │ 2  │ ← 7-stage pipeline strip │
│  │Src │Eml │App │Scr │Int │Sel │Rej │   (colored top border per │
│  └────┴────┴────┴────┴────┴────┴────┘    stage palette)        │
│                                                                  │
│  ⚡ AI sourcing daily · last run 6h ago     [Run now] [Open →]  │
└──────────────────────────────────────────────────────────────────┘
```

Stalled cards (no events in 7 days) get a red left-border tint + "AI search paused · JD may be too narrow" badge in foot.

---

## 4. Toolbar

```
[search-input: "Search positions, roles, skills..." (280px)]
[segmented: All · Critical · Active · Stable · Closed (with counts)]
[dept select (admin only): All depts · Engineering · ...]
                              [sort: Urgency · Newest · Activity ▼]
```

Default sort: **stalled-first** (`status=open` AND `last_event_at < now() - 7d` first), then by `last_event_at desc`.

---

## 5. Card states

| State | Visual |
|---|---|
| Stalled (0 events 7d) | red left border (`rgba(239,68,68,.4)`); foot warning |
| Hot (offer stage or interview-heavy) | amber left border; "1 offer sent · awaiting" |
| Healthy active | default border |
| Closed | 72% opacity; foot shows "✓ Hired X · N auto-pooled" |
| Draft | dashed border (signal: not yet sourcing) |

---

## 6. Components to build

| Component | Path | Notes |
|---|---|---|
| `<PositionsListPage>` | `frontend/src/components/Positions/PositionsListPage.jsx` | Refactor (currently 156 lines) |
| `<PositionGarden>` | `Positions/PositionGarden.jsx` | Grid container |
| `<PositionCard>` | `Positions/PositionCard.jsx` | Single card |
| `<SparklineApplicants>` | `Positions/SparklineApplicants.jsx` | Inline SVG, 300×36, normalized to max |
| `<StagePipeStrip>` | `Positions/StagePipeStrip.jsx` | 7-cell strip with top accent border per stage |
| `<PositionsToolbar>` | `Positions/PositionsToolbar.jsx` | Search + segment + sort |

Card uses `<Chip>` (status + priority), `<StatusBadge>` (stage color tokens), no emoji.

---

## 7. New backend (optional but recommended)

The current pipeline endpoint returns stages with current counts; for the sparkline we need daily new-applicants series.

Option A (additive, recommended):
- `GET /api/v1/positions/{id}/applicants-daily?days=30` returns `[{date: "2026-05-01", count: 4}, ...]` — single SQL aggregation on `pipeline_events.event_type='applied'` filtered to position_id.

Option B (defer): client-side derives from `GET /api/v1/dashboard/activity?position_id=X&limit=200` — works but heavy.

Pick A. ~15 lines of new code in `backend/routers/positions.py` + a repo method.

---

## 8. Empty / loading / error states

| Condition | Display |
|---|---|
| No positions yet | "No positions. Click **+ New Hire** to create one via chat." → routes to `/chat` |
| No positions matching filter | "No positions in this filter. [Clear filters]" |
| Single-card sparkline empty | 30-day flat line at 0 + small label "No applications in last 30 days" |
| Loading | 4 skeleton cards (height 280px, shimmer animation) |
| API error | Card-level retry: "Failed to load this position. [Retry]" |

---

## 9. Build notes

1. Build `<PositionCard>` first against mock data; verify it renders all card states (stalled/hot/healthy/closed/draft).
2. Wire `dashboardApi` for list + sparkline + stage-counts.
3. Replace existing `<PositionsListPage>` table return tree.
4. The existing CSS file `PositionsListPage.css` can be reused but most styles will be superseded by the new `<PositionCard>` styles in a co-located CSS module.
5. Keep route + URL params (`?status=&dept=`) backwards-compatible so existing bookmarks work.
