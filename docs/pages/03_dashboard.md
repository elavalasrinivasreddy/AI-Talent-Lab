# Page Design: Dashboard

> The home screen — aggregate stats, hiring funnel, positions list, and quick access to everything.

---

## 1. Overview

| Aspect | Detail |
|--------|--------|
| Route | `/` (default after login) |
| Auth | Required (JWT) |
| Layout | Sidebar + Full-width dashboard |
| Sections | Stats cards, Hiring funnel, Activity timeline, Positions table |

---

## 2. Page Layout

```
┌──────┬─────────────────────────────────────────────────────────┐
│      │  ┌─ Header ─────────────────────────────────────────┐   │
│      │  │ 📊 Dashboard              [Filters ▼] [Refresh]  │   │
│      │  │ Welcome back, {user.name}                        │   │
│      │  └──────────────────────────────────────────────────┘   │
│      │                                                         │
│ S    │  ┌─ Stats Cards ────────────────────────────────────┐   │
│ I    │  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐  │   │
│ D    │  │ │ 💼 12    │ │ 👥 156   │ │ 📧 89    │ │ 📝 34│  │   │
│ E    │  │ │ Open     │ │ Total    │ │ Emails   │ │ Apps  │ │   │
│ B    │  │ │ Positions│ │ Candidates│ │ Sent     │ │      │  │  │
│ A    │  │ │ ↑2 this  │ │ ↑23 this │ │ ↑12 this │ │ ↑5   │   │  │
│ R    │  │ │   week   │ │   week   │ │   week   │ │ today│   │  │
│      │  │ └──────────┘ └──────────┘ └──────────┘ └──────┘   │  │
│      │  └──────────────────────────────────────────────────┘   │
│      │                                                         │
│      │  ┌─ Two Column ─────────────────────────────────────┐   │
│      │  │ ┌── Hiring Funnel ────┐ ┌── Activity ──────────┐│    │
│      │  │ │ Sourced   ████ 156  │ │ 🟢 3 new apps today  ││    │
│      │  │ │ Emailed   ███  89   │ │ 🔵 5 candidates scored││   │
│      │  │ │ Applied   ██   34   │ │ 📧 2 emails delivered ││   │
│      │  │ │ Screening █    18   │ │ 💼 1 position opened  ││   │
│      │  │ │ Interview ▌    12   │ │ ✅ 1 candidate select ││   │
│      │  │ │ Selected  ▏     4   │ │                       ││   │
│      │  │ │ Rejected  ▏     8   │ │ Yesterday             ││   │
│      │  │ └─────────────────────┘ │ 🔵 12 sourced for ML  ││   │
│      │  │                         │ 📧 8 emails sent      ││   │
│      │  │                         └───────────────────────┘│   │
│      │  └──────────────────────────────────────────────────┘   │
│      │                                                         │
│      │  ┌─ Positions Table ────────────────────────────────┐   │
│      │  │ 💼 Open Positions (12)                           │   │
│      │  │ ┌────────────────────────────────────────────────│   │
│      │  │ │ [Status ▼] [Priority ▼] [Dept ▼] [🔍 Search] │ │   │
│      │  │ └────────────────────────────────────────────────│   │
│      │  │                                                  │   │
│      │  │ ┌────────────────────────────────────────────────│   │
│      │  │ │ Position          │ Cands │ Apps │ Status │ Pri│   │
│      │  │ ├────────────────────────────────────────────────│   │
│      │  │ │ Sr Python Dev     │  24   │  8   │ 🟢 Open│ 🔴││   │
│      │  │ │ ML Engineer       │  18   │  3   │ 🟢 Open│ 🟡││   │
│      │  │ │ Product Manager   │  12   │  5   │ 🟡 Hold│ 🟢││   │
│      │  │ │ DevOps Engineer   │   0   │  0   │ 📝Draft│ 🟢││   │
│      │  │ └────────────────────────────────────────────────│   │
│      │  │                                                  │   │
│      │  │ [← Prev]  Page 1 of 2  [Next →]                  │   │
│      │  └──────────────────────────────────────────────────┘   │
└──────┴─────────────────────────────────────────────────────────┘
```

---

## 3. Section Design Details

### 3.1 Stats Cards
- 4 cards in a row (responsive: 2x2 on tablet, 1x4 stack on mobile)
- Each card: large number, label, trend indicator (↑/↓ with period)
- Subtle gradient left border matching theme
- Hover: slight scale-up animation
- Click: navigates to filtered view (e.g., click "Open Positions" → filters positions table)

### 3.2 Hiring Funnel
- Horizontal bar chart, widest at top (sourced), narrowest at bottom (selected)
- Each bar: colored by stage, shows count label
- Animate bars on load (width transition)
- Click on a stage: shows breakdown by position

### 3.3 Activity Timeline
- Chronological feed, grouped by day ("Today", "Yesterday", "This Week")
- Each event: emoji icon + description + timestamp
- Max 10 items, with "View all" link
- Real-time updates (poll every 30 seconds, or WebSocket later)

### 3.4 Positions Table/Grid
- Toggle between **card view** (default) and **table view**
- Card view: Each position is a card with role name, stats, status badge, priority badge
- Table view: Compact rows with sortable columns
- Filters: Status, Priority, Department, Created By, Date Range
- Search: Free text search across role name
- Sort: By name, candidate count, date created, priority
- Pagination: 10 items per page
- Click row → navigates to Position Detail Page

---

## 4. Filters & Search

```
┌────────────────────────────────────────────────────────────┐
│ Status: [All ▼]  Priority: [All ▼]  Dept: [All ▼]         │
│ Date: [Last 30 days ▼]  Created by: [All ▼]  [🔍 Search] │
└────────────────────────────────────────────────────────────┘
```

| Filter | Options | Default |
|--------|---------|---------|
| Status | All, Open, Draft, On Hold, Closed, Archived | All |
| Priority | All, Urgent, High, Normal, Low | All |
| Department | All + list from org departments | All |
| Date Range | Last 7 days, 30 days, 90 days, All time, Custom | Last 30 days |
| Created By | All + list of org users | All |
| Search | Free text (debounced 300ms) | Empty |

---

## 5. Backend Integration

| Data | API Endpoint | Polling |
|------|-------------|---------|
| Stats cards | `GET /api/dashboard/stats` | On page load + manual refresh |
| Positions list | `GET /api/dashboard/positions?status=&priority=&dept=&page=&search=` | On filter change |
| Hiring funnel | `GET /api/dashboard/funnel` | On page load |
| Activity timeline | `GET /api/dashboard/activity?limit=10` | Poll every 30s |

---

## 6. Empty States

| When | Display |
|------|---------|
| No positions | "📋 No positions yet. Click **+ New Hire** to create your first JD." with illustration |
| No candidates | Stats show 0, funnel hidden |
| No activity | "No recent activity. Start by creating a new hire." |
| Loading | Skeleton cards with pulsing animation (no spinning wheel) |
| Error | "Failed to load dashboard. [Retry]" with error details in console |
