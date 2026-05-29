> **Build status:** ❌ Not redesigned — old AnalyticsPage live
> Consolidated docs index: [../../README.md](../../README.md) · Status tracker: [../../STATUS.md](../../STATUS.md) · Design system: [../00_design_system.md](../00_design_system.md)
> This page merges the v3 redesign spec with the pre-v3 behavioral spec (appendix below, where one existed).

# Page 06 — Analytics

**Pattern:** *Agent ROI Dashboard* (variant A)
**Replaces:** Generic ATS analytics — single funnel + source pie + KPI strip
**Why:** What this product uniquely *knows* is AI-vs-human contribution. Generic analytics treat every candidate the same. The Agent ROI framing makes the value of the AI quantifiable to whoever's paying for the seat — and exposes retraining signals (where humans override AI).

Preview reference: `/tmp/atl-design-preview-v3.html` → tab "Analytics".

---

## 1. Route & layout

| Aspect | Value |
|---|---|
| Route | `/analytics` |
| Auth | Required (JWT) · roles: admin / recruiter / dept_admin |
| Layout | App shell · period switcher · ROI hero · KPI strip (de-emphasized) · 2-col grids · table at bottom |

---

## 2. Backend tie-in

| Endpoint | Used for |
|---|---|
| `GET /api/v1/dashboard/analytics?period=90d` | Aggregate metrics (already exists; needs additive fields — see §6) |
| `GET /api/v1/dashboard/agent-roi?period=90d` | **New** — AI-sourced vs human-added funnels + hours-saved estimate |
| `GET /api/v1/dashboard/override-signals?period=90d` | **New** — top reasons humans override AI |
| `GET /api/v1/dashboard/bottleneck-radar?period=90d&compare=prev` | **New** — 6-axis radar with previous-period comparison |
| `GET /api/v1/dashboard/per-recruiter?period=90d` | **New** — hires per recruiter throughput |

All endpoints are **read-only aggregations** over existing `pipeline_events` and `candidate_applications` tables. No schema changes required (assuming `pipeline_events.actor_type` or `applications.source_type` distinguishes AI-sourced vs human-added — if not, add that one column).

---

## 3. Layout

```
[ topbar: "Agent ROI" + sub  · period switcher (7d / 30d / 90d / Year) · dept filter · Export ]

[ ROI HERO — wide gradient panel ]
  "AI did 64% of sourcing this quarter."
  "Reclaimed ~12 recruiter-hours/week..."         [148 hours saved · +22h]    [₹2.1L $ value]

[ KPI STRIP — 4 cards, de-emphasized ]
  Applications 2,847 (+18%)   Time-to-Hire 21.4d (-2.8d)   Hires 38 (+12)   Offer Accept 86% (+4pp)

[ 2-COL: Funnel comparison  |  Override-signals list ]
  AI funnel (1820 → 24)        Top 4 override reasons with frequency + severity
  Human funnel (1027 → 14)     Action box: "Add comp-band override next sprint"

[ 2-COL: Bottleneck radar     |  Per-recruiter throughput ]
  6-axis radar with prev overlay      Hires per recruiter (bar list)
                                       Team note about new-hire ramp

[ Per-source quality TABLE — full width ]
  Source · Candidates · Applied % · Hired · Avg ATS · Time to Hire
  (AI sim source · Referral · Career page · Talent pool re-engaged · ...)
```

---

## 4. ROI hero

Single grid: `[headline + sub | stat | stat]`.

| Element | Source |
|---|---|
| Headline (`<b>AI did 64%</b> of sourcing this quarter`) | `agent-roi.ai_sourcing_share` × 100 |
| Sub line | hours saved + hires-fully-AI + cleanup count |
| Stat: Hours saved | `(ai_sourced_candidates × avg_recruiter_time_per_sourcing)` |
| Stat: ₹ value | hours × avg recruiter cost/hr (configurable in Settings) |

This is the **executive snapshot**. If the user only looks at one number on this page, it should be this.

---

## 5. Dual funnel comparison (the core narrative)

Two side-by-side mini-funnels. Each row: stage label + horizontal bar + count. All stages width-normalized to the top (Sourced).

- **AI-sourced funnel** (`--p` color) — Sourced → Emailed → Applied → Screening → Interview → Hired
- **Human-added funnel** (`--tx-3` neutral color) — same stages

Below each funnel: `App → Hire %` summary line. Below the pair: an **insight callout** — automatic LLM-generated 1-line interpretation:

> *"AI funnel is wider at top (cheap to source) but conversion rates are similar to human-added at the hiring end. AI sourcing replaces volume work without quality loss."*

This is the killer screenshot for the product page.

---

## 6. Override signals list

Each row:
- **What happened** (e.g. "Recruiter accepted ATS<60% candidate")
- **Most common reason** (LLM-clustered from `pipeline_events` notes)
- **Frequency count** (right-aligned, large)
- **Signal severity chip** — high / med / low

Below the list, an **Action box** with the top retraining suggestion:

> *"Action: Add comp-band override to ATS scoring next sprint."*

This list is what makes the page valuable to recruiters specifically — it shows them where the AI is wrong, not where it's right.

---

## 7. Bottleneck radar

Single SVG radar chart, 6 axes:

| Axis | Metric |
|---|---|
| Sourcing | candidates sourced / target |
| Screening | pass-through rate at screening |
| Interview | avg interview turnaround |
| Offer | avg offer-to-accept time (slowest typically — flagged) |
| AI Accept | % of AI suggestions humans accepted |
| Retention | post-hire 90-day retention (placeholder until enough data) |

Two polygons overlaid:
- **Current period** filled (`--p` semi-transparent)
- **Previous period** dashed outline (`--tx-3`)

Axes that are *worse than previous* get a red label (e.g. "⚠ Offer (slow)"). Below the radar: 1-line interpretation.

---

## 8. Per-recruiter throughput

Bar list, one row per recruiter:

| Cell | Detail |
|---|---|
| Avatar | recruiter initials, brand gradient |
| Name | "Priya S." |
| Bar | fill proportional to hires |
| Count | "14 hires" |

Below: **Team note** box highlighting outliers (new hires ramping, top performers, anyone stalled). LLM-generated from team data.

---

## 9. Per-source quality table

Full-width table at bottom. Rows: Simulation source (AI), Referral, Career page, Talent pool (re-engaged), [external integrations when live: LinkedIn, Naukri].

Columns:
- Source (with AI chip if applicable)
- Candidates (volume)
- Applied %
- Hired (count, colored if >0)
- Avg ATS
- Time to Hire

Hired column is the goal metric — colored green when > 0. Row click drills into a per-source filtered candidate list.

---

## 10. Period switcher

`[7d] [30d] [90d-on] [Year]` — top right of page. One switcher controls all panels. URL synced (`?period=90d`).

Dept filter (admin only) sits next to switcher and scopes all panels to a single department.

---

## 11. Components to build / refactor

| Component | Path | Notes |
|---|---|---|
| `<AnalyticsPage>` | `frontend/src/components/Analytics/AnalyticsPage.jsx` | Refactor (258 lines) — currently has KPIStrip + Funnel + Source + Velocity + TopPositions |
| `<AgentROIHero>` | `Analytics/AgentROIHero.jsx` | New — gradient hero with headline + 2 stats |
| `<KpiStrip>` | `Analytics/KpiStrip.jsx` | Refactor existing — use new `<Stat>` atom |
| `<DualFunnel>` | `Analytics/DualFunnel.jsx` | New — AI vs human funnel comparison |
| `<OverrideList>` | `Analytics/OverrideList.jsx` | New |
| `<BottleneckRadar>` | `Analytics/BottleneckRadar.jsx` | New — inline SVG, no chart lib |
| `<ThroughputBars>` | `Analytics/ThroughputBars.jsx` | New |
| `<SourceQualityTable>` | `Analytics/SourceQualityTable.jsx` | New (or evolve existing TopPositionsCard) |
| `<PeriodSwitcher>` | `common/PeriodSwitcher.jsx` | New shared atom (also used on Dashboard) |

**Decide:** Recharts vs inline SVG. v3 preview uses inline SVG (no dep). For BottleneckRadar — inline SVG is fine. For dual funnel — inline SVG is fine. **No need to introduce Recharts** unless we want hover tooltips on every bar.

---

## 12. Empty / loading / error states

| Condition | Display |
|---|---|
| Insufficient data (period has <10 candidates) | Page replaced with "Not enough hiring activity in this period. Try a longer range." |
| No AI-sourced candidates yet | Dual funnel collapses to a single funnel + banner "AI sourcing not yet enabled · [Configure in Settings →]" |
| Override list empty | "No human overrides logged yet. AI suggestions accepted as-is." |
| Bottleneck radar — only current period | Render single polygon, no dashed overlay |
| Per-recruiter — single user | Hide the bar list, show single-line summary |
| API error per panel | Panel-level retry + other panels remain functional |
| Loading | Skeleton blocks per panel |

---

## 13. Build notes

1. Backend: add the 4 aggregation endpoints (~60-80 lines total in `dashboard_service.py` + repos).
2. Make sure `pipeline_events` events have an `actor_type` ('human' | 'ai_agent' | 'system') or that `candidate_applications.source` cleanly identifies AI vs human-added.
3. Frontend: build panels independently, each with own loading state.
4. Default period: 90d. Persist user's last choice in localStorage.
5. The current `AnalyticsPage.css` becomes mostly obsolete — replace with co-located CSS modules per panel.
