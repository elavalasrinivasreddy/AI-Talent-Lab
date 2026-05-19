# Page 01 — Dashboard

**Pattern:** *Today's Briefing — NOW / NEXT / PULSE lanes* (variant A)
**Replaces:** 4-card KPI strip + horizontal funnel + 2-column (positions table + activity feed)
**Why:** Counts don't tell users what to *do*. The three lanes turn the dashboard into an action surface — what's on fire, what's on the calendar, what AI did overnight.

Preview reference: `/tmp/atl-design-preview-v3.html` → tab "Dashboard".
Existing doc this supersedes: `docs/pages/03_dashboard.md`.

---

## 1. Route & layout

| Aspect | Value |
|---|---|
| Route | `/dashboard` |
| Auth | Required (JWT) |
| Layout | App shell · sidebar + main · NO global topbar (notification bell lives in topbar of main) |
| Role-adaptive | Admin / Recruiter / Hiring Manager — same lane structure, different content |

---

## 2. Backend tie-in

| Endpoint | Used for |
|---|---|
| `GET /api/v1/dashboard/stats?period=week` | Admin-only org-health strip (`org_health_score`, `time_to_hire`, `cost_per_hire`, `open_reqs`) |
| `GET /api/v1/dashboard/activity?limit=15` | PULSE lane content + lower velocity sparkline |
| `GET /api/v1/copilot/suggestions` | AI Copilot bar (6 suggestion types from `docs/pages/03_dashboard.md §2a`) |
| `GET /api/v1/dashboard/positions?status=open&page=1` | Position pulse mini-card list (right column) |
| `GET /api/v1/dashboard/funnel` | *Removed* — funnel no longer dashboard centerpiece (still used by Analytics page) |

Polling: AI Copilot suggestions refresh on a 60s timer; activity / lanes refresh every 30s. Period switcher (Today/Week/Month) controls all lane data simultaneously.

---

## 3. Layout (top to bottom)

```
[ topbar:  "Good morning, Priya."  + period switcher + New Hire button ]
[ admin-only:  dept chip bar (All / Engineering / Design / Sales / CS) ]
[ admin-only:  4-card health strip — Org Health / Open Reqs / Time-to-Hire / Cost-per-Hire ]
[ AI Copilot bar — horizontal scroll of 4-6 actionable pills (dismiss × per pill, "Dismiss all" right) ]
[ THE THREE LANES  (3-column grid) ]
   NOW (red lane)           NEXT (amber lane)        PULSE (teal lane)
   stalled / overdue        scheduled today/wk       AI overnight activity
   - 5 row count            - 8 row count            - 12 row count
   - each row is action     - each row is action     - each row is action

[ velocity sparkline (2/3 width) + position pulse mini-cards (1/3 width) ]
```

---

## 4. The three lanes

Each lane is a `div.tb-lane` with semantic background tint (lane-color-bg → transparent).

### NOW (red) — `things stuck, needing you`

Driven by:
- Candidates at `status=offer` with `data_retained_until - now() < 2 days` → "offer expiring soon"
- Panel feedback overdue: `interview_panel.feedback_submitted = false` AND `interview.scheduled_at < now() - 72h`
- Interviews unconfirmed: `interview.scheduled_at < now() + 24h` AND candidate has not RSVP'd
- Hire requests pending > 5 days (admin only)
- Candidates ghosted at offer for > 7 days
- Positions with 0 events in last 7 days (stalled)

Each row: `[ico] [title (1 line) + meta (1 line)] [right-aligned action label "Resend" / "Nudge" / "Review"]`.

### NEXT (amber) — `on your calendar today / this week`

Driven by:
- Interviews scheduled today (`interviews.scheduled_at` between now() and now()+24h)
- Candidates moved above ATS 85% today (status changes via `pipeline_events`)
- All-panelists-submitted panels (`interview_panel` count submitted == total)
- Candidates due response by end-of-week

### PULSE (teal) — `AI did this overnight`

Driven by `pipeline_events.event_type` in:
- `candidate_sourced` (count + position name)
- `jd_generation_paused` (LangGraph state machine event)
- `outreach_email_sent` (batched count + CTR if available)
- `ats_score_updated` (re-scoring batch events)
- `rejection_email_drafted` (count awaiting send)
- `pool_match_found` (count + which positions)

---

## 5. Role-adaptive content

Use `<RoleGate>` component (see `00_design_system.md §5`).

| Element | Admin | Recruiter | Hiring Manager |
|---|---|---|---|
| Topbar greeting suffix | "Org-wide health · X hire requests pending" | "X things need you · AI working on Y" | "Your N open reqs · M interviews this week" |
| Dept chip bar | ✅ visible (All / dept list) | ❌ hidden (dept filter implicit) | ❌ hidden |
| Org health strip | ✅ visible | ❌ hidden | ❌ hidden |
| AI Copilot — `pool_match` suggestions | ✅ | ❌ | ❌ |
| AI Copilot — `pending_rejection` (drafted, awaiting send) | ✅ | ❌ | ✅ |
| AI Copilot — `uncontacted_high_score` | ✅ | ✅ | ❌ |
| NOW lane content | dept-wide + admin-scope alerts | own-dept + assigned positions | only my assigned positions |
| New Hire button label | "New Hire" | "New Hire" | "File Hire Request" (routes to `09_hire_request.md`) |

---

## 6. Empty / loading / error states

| Condition | Display |
|---|---|
| No NOW items | Lane shows `0` count + cheerful empty illustration: "✓ All clear. Nothing's blocked." |
| No NEXT items | "No interviews or deadlines scheduled. Quiet day ahead." |
| No PULSE items | "AI hasn't run yet today. Background sourcing kicks in at 6 AM IST." |
| No active positions overall | Hero CTA: "Create your first position via /chat" — replaces lanes entirely with onboarding state |
| API error per lane | In-lane retry: "Failed to load. [Retry]" — other lanes remain functional |
| First-load | Skeleton lanes (3 grey blocks with shimmer) — NOT spinner |

---

## 7. Components to build / refactor

| Component | File path | New / refactor |
|---|---|---|
| `<DashboardPage>` | `frontend/src/components/Dashboard/DashboardPage.jsx` | Refactor (currently 954 lines — likely to drop to ~300 with subcomponents) |
| `<TodaysBriefing>` | `Dashboard/TodaysBriefing.jsx` | New — owns the 3-lane grid |
| `<BriefingLane>` | `Dashboard/BriefingLane.jsx` | New — generic lane with header + rows |
| `<BriefingRow>` | `Dashboard/BriefingRow.jsx` | New — single actionable row |
| `<CopilotBar>` | `Dashboard/CopilotBar.jsx` | Refactor existing AI Copilot Action Bar |
| `<DeptChipBar>` | `Dashboard/DeptChipBar.jsx` | New — admin-only dept switcher |
| `<HealthStrip>` | `Dashboard/HealthStrip.jsx` | New — admin-only org health |
| `<PositionPulse>` | `Dashboard/PositionPulse.jsx` | New — sparkline mini-card list |
| `<VelocitySparkline>` | `Dashboard/VelocitySparkline.jsx` | New — bottom inline SVG chart |
| `<RoleGate>` | `common/RoleGate.jsx` | New shared atom (see `00_design_system.md`) |

Each `<BriefingRow>` takes a `kind` prop that maps to icon + color (bad/warn/ok).

---

## 8. Backend additions (if any)

Reads-only — no schema or endpoint changes required. **However**, two optional improvements would unlock better content:

1. Add `pipeline_events.actor_type` column (values: `human` / `ai_agent` / `system`) to distinguish AI vs human actions for the PULSE lane. Currently inferable from `event_type` patterns but explicit field would be cleaner.
2. Add `GET /api/v1/dashboard/briefing?period=&role=` endpoint that returns all three lanes pre-grouped — saves the frontend from 4-5 parallel calls. Optional optimization; can ship without.

---

## 9. Migration plan from current Dashboard

Current `DashboardPage.jsx` mixes layout + data fetching + per-role conditionals + KPI cards + funnel + table + activity in 954 lines.

Refactor steps:
1. Extract all `useEffect(dashboardApi.getX)` into custom hook `useDashboardData(role, period)` returning normalized lanes + copilot + positions + health.
2. Move the KPI Strip, Funnel, Positions Table, Activity Feed components OUT — they remain available in `frontend/src/components/Dashboard/legacy/` for one release as a fallback flag (`?legacy_dashboard=1`).
3. Replace return tree with: TopBar → DeptChipBar (admin) → HealthStrip (admin) → CopilotBar → TodaysBriefing → bottom row (Velocity + PositionPulse).
4. Delete legacy after 2 weeks of v3 in production.
