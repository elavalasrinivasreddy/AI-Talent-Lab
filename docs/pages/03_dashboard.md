# Page Design: Dashboard
> **Version 2.1 — Updated**
> Home screen after login. Stats cards controlled by one global period selector.
> Positions table + activity feed side by side. Hiring funnel below stats.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Route | `/` (default after login) |
| Auth | Required (JWT) |
| Layout | Sidebar + full-width dashboard |
| Dept scope | Admin: sees [All Departments ▼] selector. Recruiters/Hiring Managers: their dept only. |

---

## 2. Page Layout

```
┌──────┬─────────────────────────────────────────────────────────────┐
│      │  ┌── HEADER ──────────────────────────────────────────────┐ │
│      │  │  📊 Dashboard  ·  Welcome back, Srinivas               │ │
│      │  │                      [Today]  [This Week]  [This Month] │ │
│      │  └────────────────────────────────────────────────────────┘ │
│ S    │                                                             │
│ I    │  ┌── STATS CARDS (4 in a row) ─────────────────────────────┐│
│ D    │  │  [Open Positions]  [Total Candidates]  [Interviews]  [Applications] ││
│ E    │  └────────────────────────────────────────────────────────┘ │
│ B    │                                                             │
│ A    │  ┌── HIRING FUNNEL ───────────────────────────────────────┐ │
│ R    │  │  (horizontal bar chart)                                │ │
│      │  └────────────────────────────────────────────────────────┘ │
│      │                                                             │
│      │  ┌── POSITIONS TABLE (60%) ─┐  ┌── ACTIVITY FEED (40%) ──┐ │
│      │  │  (filterable list)       │  │  (event timeline)        │ │
│      │  └──────────────────────────┘  └──────────────────────────┘ │
└──────┴─────────────────────────────────────────────────────────────┘
```

---

## 3. Global Period Selector

```
                    [Today]  [This Week]  [This Month]
```

**One selector controls all 4 stat cards simultaneously.** No per-card toggles.

Delta comparisons:
- Today → vs yesterday
- This Week → vs last week
- This Month → vs last month

---

## 4. Stats Cards

4 cards in a row. 2×2 on tablet, stacked on mobile.

```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  🎯             │ │  👥             │ │  🎙️            │ │  📝             │
│  Open           │ │  Total          │ │  Interviews     │ │  Applications   │
│  Positions      │ │  Candidates     │ │  This Week      │ │  This Week      │
│                 │ │                 │ │                 │ │                 │
│      12         │ │      248        │ │       8         │ │      34         │
│                 │ │                 │ │                 │ │                 │
│  ↑ 2 this week  │ │  ↑ 23 this week │ │  ↓ 1 from last  │ │  ↑ 5 today      │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
```

**Design:**
- Large number (`--text-3xl`, weight 600)
- Icon top-right corner
- Trend: green ↑ for positive growth, red ↓ where increase is bad (e.g. rejections)
- Subtle left border gradient in accent color
- Hover: `transform: scale(1.02)` animation
- Clickable: "Open Positions" → filters positions table to `status: open`

---

## 5. Hiring Funnel

Horizontal bar chart. Each bar animated on page load.

```
┌── Hiring Funnel ─────────────────────────────────────────────────┐
│  Engineering Dept · This Month                                   │
│                                                                  │
│  Sourced     ████████████████████████████████████████  156      │
│  Emailed     ████████████████████████████████          89       │
│  Applied     ████████████████████                      34       │
│  Screening   ██████████████                            18       │
│  Interview   █████████                                 12       │
│  Selected    ██                                         4       │
│  Rejected    █████                                      8       │
│                                                                  │
│  Click a stage → filter positions table to that stage           │
└──────────────────────────────────────────────────────────────────┘
```

Each bar uses the pipeline status color. Clicking a stage filters the positions table.

---

## 6. Positions Table

Left side (~60% width). Filterable, paginated.

```
┌── Recent Positions ──────────────────────────────── [View All →] ─┐
│                                                                    │
│  [🔍 Search...]  [Status ▼]  [Priority ▼]  [Dept ▼]              │
│                                                                    │
│  Role                  Dept    Candidates  Status    Priority      │
│  ──────────────────────────────────────────────────────────────   │
│  Sr Python Developer   Eng     24          ● Open    🔴 Urgent     │
│  ML Engineer           Data    18          ● Open    🟡 High       │
│  Product Manager       Prod    42          ● Hold    🟢 Normal     │
│  DevOps Engineer       Eng      5          ✏ Draft   🟢 Normal     │
│                                                                    │
│  ← Prev  Page 1 of 3  Next →                                      │
└────────────────────────────────────────────────────────────────────┘
```

**Row click:** Opens `/positions/:id`.

**Candidates count hover tooltip:**
```
Total: 24
├── In Progress: 12
├── Rejected: 10
└── Selected: 2
```

**Filters:**

| Filter | Options | Default |
|---|---|---|
| Status | All / Open / Draft / On Hold / Closed / Archived | All |
| Priority | All / Urgent / High / Normal / Low | All |
| Department | All + dept list (admin only) | Dept (non-admin) |
| Search | Free text across role name | Empty |

---

## 7. Activity Feed

Right side (~40% width). Scrollable, max-height matches positions table. Polls every 30s.

```
┌── Recent Activity ───────────────────────── Engineering Dept ──────┐
│                                                                    │
│  TODAY                                                             │
│  ────────────────────────────────────────────────────────────     │
│  💬  New comment on Priya S.                          10 min ago  │
│      "Strong skills, recommend round 2" — Neha P.                │
│                                                                    │
│  ✅  Scorecard submitted                              2 hrs ago   │
│      Raj K. rated Amit R. 4.5/5 (Technical Round)               │
│                                                                    │
│  🤖  AI sourced 5 candidates                          5 hrs ago   │
│      Found 5 matches for Sr Python Developer                      │
│                                                                    │
│  YESTERDAY                                                         │
│  ────────────────────────────────────────────────────────────     │
│  📝  Priya S. applied via magic link                              │
│  📧  8 outreach emails sent — ML Engineer                         │
│  📅  Interview scheduled — Rahul K. Round 2                      │
│                                                                    │
│  [View All Activity →]                                            │
└────────────────────────────────────────────────────────────────────┘
```

Grouped: Today / Yesterday / This Week / Earlier. Clicking events navigates to relevant position or candidate.

---

## 8. Department Filter (Topbar — Admin Only)

```
Topbar right side:   [Engineering ▼]  (Admin sees All Departments option)
```

Switching dept changes all dashboard data. Recruiters and Hiring Managers see their dept only — no selector shown.

---

## 9. Empty States

| Condition | Display |
|---|---|
| No positions | Illustration + "No positions yet. Click **+ New Hire** in the sidebar." |
| No candidates | Stats 0, funnel hidden + "Create a position to start sourcing" |
| No activity | "No recent activity. Create a position to get started." |
| Loading | Skeleton cards — NOT spinning wheels |
| Error | "Failed to load. [Retry]" in-place |

---

## 10. API Endpoints

| Data | Endpoint | Refresh |
|---|---|---|
| Stats cards | `GET /api/v1/dashboard/stats?period=week` | On load + period change |
| Hiring funnel | `GET /api/v1/dashboard/funnel` | On load |
| Positions table | `GET /api/v1/dashboard/positions?status=&priority=&page=` | On filter change |
| Activity feed | `GET /api/v1/dashboard/activity?limit=15` | Poll every 30s |
