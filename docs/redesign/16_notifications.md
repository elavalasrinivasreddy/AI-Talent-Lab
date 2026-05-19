# Page 16 — Notifications (Drawer + Grouping)

**Pattern:** *Right-slide drawer with grouped notifications + actionable rows* (variant A)
**Replaces:** A single bell-icon dropdown listing raw notifications one-per-row
**Why:** PRODUCT_IMPROVEMENTS §3.2 recommendation: *"grouped notifications — '5 candidates applied today' instead of 5 separate items."* Raw notification lists scale poorly — 20 candidates apply, 20 panel feedbacks come in, 30 interview events happen, and the bell becomes useless. Grouping by entity/event keeps the surface usable.

Preview reference: not yet in `/tmp/atl-design-preview-v3.html` — to be added.
No existing dedicated doc; this surface lives inside the global topbar.

---

## 1. Route & layout

| Aspect | Value |
|---|---|
| Route | Not a page — global drawer triggered from topbar bell |
| Auth | Required (JWT) |
| Layout | Right-slide drawer (≈420px wide) overlaying main app · click outside or `Esc` to dismiss |
| Persistence | URL doesn't change · drawer state local |

Plus a permanent `/notifications` route for the **full notification history page** (when user wants to scroll deeper than recent 50).

---

## 2. Backend tie-in

| Endpoint | Used for |
|---|---|
| `GET /api/v1/notifications/?limit=50&unread_only=` | Drawer list (last 50 by default) |
| `GET /api/v1/notifications/grouped?limit=20` | **New** — server-side grouping by `(group_key, event_type)` returns aggregated items |
| `POST /api/v1/notifications/{id}/mark-read` | Mark single notification read |
| `POST /api/v1/notifications/mark-all-read` | Mark all read |
| `POST /api/v1/notifications/group/{group_key}/mark-read` | Mark whole group read |
| `GET /api/v1/notifications/preferences` | User notification settings |
| `PATCH /api/v1/notifications/preferences` | Update preferences |

DB: `notifications` table (already exists per `database_schema.md`). Add a `group_key` text column (additive — see §6).

Polling: drawer auto-refreshes every 30s when open; bell count updates via 60s polling when drawer closed.

---

## 3. Layout — drawer

```
┌── NOTIFICATIONS ───────────────────────────────[×]──┐
│                                                      │
│  [All · 23] [Unread · 7] [Mentions · 1]              │
│  [Mark all read]                       [⚙ Settings] │
│                                                      │
│  TODAY                                               │
│  ────────────────────────────────────────────       │
│  📥  5 candidates applied today                      │
│      Senior ML Eng (3) · Backend Eng (2)             │
│      Latest: Alex Chen · 2h ago        [View all →] │
│                                                      │
│  ⚡  AI sourced 12 new candidates                    │
│      Senior ML Eng pipeline · 3 above 85% ATS       │
│      6h ago                          [Review →]     │
│                                                      │
│  📋  Panel feedback complete · Maya Patel            │
│      4/4 panelists submitted · Strong Hire consensus│
│      3h ago                       [Open candidate →]│
│                                                      │
│  💬  @Priya · Neha mentioned you                     │
│      "Strong technical skills, recommend round 2"   │
│      on Priya Sharma's profile                       │
│      4h ago                              [Reply →]  │
│                                                      │
│  YESTERDAY                                           │
│  ────────────────────────────────────────────       │
│  📅  3 interviews scheduled                          │
│      ML Eng (2) · Backend Eng (1) · this week       │
│      [View calendar →]                              │
│                                                      │
│  ⏰  Panel feedback overdue                          │
│      Raj K. hasn't submitted for Priya S. (3 days)  │
│      [Send reminder →]                              │
│                                                      │
│  THIS WEEK                                           │
│  ...                                                 │
│                                                      │
│            [Load earlier · view full history →]     │
└──────────────────────────────────────────────────────┘
```

---

## 4. Grouping rules

Notifications collapse server-side when both:
- Same `event_type` (e.g. `candidate_applied`, `interview_scheduled`)
- Within same `group_key` (org-defined; usually position_id or date-bucket)

### Default groupings

| Event type | Group key | Display |
|---|---|---|
| `candidate_applied` | `position_id + day` | "N candidates applied today — position breakdown" |
| `candidate_sourced` (AI) | `position_id + sourcing-run` | "AI sourced N new candidates — Senior ML Eng" |
| `interview_scheduled` | `week_of` | "N interviews scheduled this week" |
| `panel_feedback_submitted` | `interview_id` | Shows per interview (one row per interview, not per panelist) |
| `outreach_email_sent` | `position_id + day` | "Sent N outreach emails today — Senior ML Eng" |
| `rejection_email_drafted` | `position_id` | "N rejections awaiting your send" |
| `pool_match_found` | `daily` | "AI matched N pool candidates to your open reqs" |
| `panel_feedback_overdue` | `interview_id + panelist_id` | one row per overdue panelist (NOT grouped — these need individual action) |
| `mention_in_note` | per-mention | NOT grouped — every mention is its own row |
| `hire_request_*` | per-request | NOT grouped — workflow events stay distinct |
| `status_change` | optional grouping | Hidden by default (too noisy); user can opt-in via preferences |

The grouped notification row shows:
- Primary icon (event type)
- Aggregated headline ("5 candidates applied today")
- Sub-line with breakdown ("Senior ML Eng (3) · Backend Eng (2)")
- Most recent timestamp + name preview
- Inline action (the most common follow-up — e.g. "View all", "Review", "Reply", "Send reminder")

Expanding a grouped row (click) shows the individual notifications underneath in a collapsible sub-list.

---

## 5. Row anatomy

```
[icon] [headline]                                                    [age]
       [sub-line — entity context, latest item, breakdown]
                                                                  [action →]
```

| Cell | Detail |
|---|---|
| icon | Color-coded by event type (📥 applications · ⚡ AI activity · 📋 feedback · 💬 mention · 📅 interview · ⏰ overdue · ✅ status · 📤 outreach · 🏊 pool match) |
| headline | Bold first line · grouped count + event type |
| sub-line | Breakdown + most recent timestamp/name |
| age | Relative time, right-aligned, faint |
| action | Inline contextual CTA (1 word + arrow) |

Unread rows have a subtle teal left-border (3px) + slightly stronger background tint.

---

## 6. Schema change

Add a single column to enable server-side grouping:

```sql
ALTER TABLE notifications
  ADD COLUMN group_key TEXT;

CREATE INDEX notifications_group_idx
  ON notifications(org_id, user_id, group_key, event_type, created_at DESC);
```

Backfill: on next notification creation, set `group_key` based on rules in §4. Old notifications without `group_key` show ungrouped (acceptable migration path).

`GET /api/v1/notifications/grouped` query:

```sql
SELECT
  group_key,
  event_type,
  COUNT(*) as count,
  MAX(created_at) as last_at,
  array_agg(...) as items
FROM notifications
WHERE user_id = $1 AND org_id = $2
  AND created_at > now() - interval '14 days'
GROUP BY group_key, event_type, date_trunc('day', created_at)
ORDER BY last_at DESC
LIMIT $3;
```

---

## 7. Bell + badge

Topbar bell icon shows unread count as badge (red dot for any unread, number when ≥ 1).

| State | Visual |
|---|---|
| 0 unread | Plain bell icon · no badge |
| 1–9 unread | Bell with circular badge showing number |
| 10–99 unread | Bell with badge "10+" |
| 100+ | Bell with badge "99+" |

Bell click → drawer slide-in from right. Esc or click-outside → drawer slide-out.

---

## 8. Tabs at top

| Tab | Filter |
|---|---|
| All | All notifications |
| Unread | `read_at IS NULL` |
| Mentions | `event_type = 'mention_in_note'` (always individual rows, never grouped) |

Per-org admins might add custom tabs (e.g. "AI activity only" — Phase 2).

---

## 9. Date headers

Rows grouped by relative date:
- **Today**
- **Yesterday**
- **This week**
- **Last week**
- **Earlier in May**
- **Older** (collapse by default, expand on click)

---

## 10. Settings ([⚙ Settings] button)

Opens preferences modal (or routes to Settings → How your team works → Notifications):

```
NOTIFICATION PREFERENCES

Email
☑ Critical alerts (panel feedback overdue, candidate ghost)
☐ Daily digest (one email summarizing pulse + pending items)
☑ Mentions in notes
☐ AI activity summaries

In-app (drawer)
☑ All event types
☐ Status changes (very noisy — currently off)
☑ AI activity grouped (recommended)

Quiet hours
   from [10 PM ▼]    to [7 AM ▼]    [Save]
```

These map to existing `notification_preferences` JSONB column on `users` (or `org_users`).

---

## 11. Components to build

| Component | Path | Notes |
|---|---|---|
| `<NotificationBell>` | `frontend/src/components/common/NotificationBell.jsx` | Refactor — already exists, gets new drawer trigger |
| `<NotificationDrawer>` | `Notifications/NotificationDrawer.jsx` | New — right-slide drawer |
| `<NotificationRow>` | `Notifications/NotificationRow.jsx` | New — single row (grouped or ungrouped) |
| `<NotificationGroupedRow>` | `Notifications/NotificationGroupedRow.jsx` | New — expandable grouped row |
| `<NotificationTabs>` | `Notifications/NotificationTabs.jsx` | New — All / Unread / Mentions filter |
| `<NotificationSettingsModal>` | `Notifications/NotificationSettingsModal.jsx` | New — opens from drawer |
| `<NotificationHistoryPage>` | `Notifications/NotificationHistoryPage.jsx` | New — full `/notifications` route for deep scroll |

---

## 12. Empty / loading / error states

| Condition | Display |
|---|---|
| No notifications ever | Drawer: "All caught up. 🎉 Notifications about your candidates and AI activity will show up here." |
| No unread | Tab "Unread" empty state: "No unread notifications." |
| Loading first time | Skeleton rows (3-5 placeholders) |
| Drawer error | "Couldn't load notifications. [Retry]" |
| Mark-all-read fails | Toast: "Couldn't mark all read · try again" |

---

## 13. Build notes

1. The bell already exists — focus on the drawer.
2. Add the `group_key` column + grouped endpoint first.
3. Add inline actions per event type (action mapping table lives in `NotificationRow` config).
4. After the drawer ships, add the `/notifications` deep-history route as a separate task.
5. Real-time push (WebSocket / SSE) is NOT a v3 ask — 30s polling is enough until the user base demands less latency.

---

## 14. Why grouping matters

Without it, in a busy week a recruiter at TechCorp gets:
- 50 `candidate_applied` notifications
- 30 `candidate_sourced` notifications
- 18 `interview_scheduled` events
- 25 outreach email sends
- 7 panel feedback completions

That's 130 raw rows. The bell becomes a stress object.

With grouping:
- "50 candidates applied · 6 positions"
- "AI sourced 30 candidates · 4 positions"
- "18 interviews scheduled this week"
- "Sent 25 outreach emails · 3 positions"
- 7 individual rows for panel completions (these stay individual — each is a separate decision)

= 11 rows. Manageable. The mental cost of "checking notifications" drops by 90%.
