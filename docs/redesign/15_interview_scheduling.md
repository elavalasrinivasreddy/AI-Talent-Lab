# Page 15 — Interview Scheduling

**Pattern:** *Calendar-first dashboard + structured scheduling modal* (variant A)
**Replaces:** `/interviews` redirects to `/positions` today · scheduling exists only as a modal triggered from candidate detail
**Why:** Recruiters live in calendars during interview-heavy weeks. They need a single surface that shows: today's interviews, this-week's load, schedule-conflicts, panelist availability, and quick scheduling without leaving the page. Currently scattered across position detail / candidate detail / individual calendar invites.

Preview reference: not yet in `/tmp/atl-design-preview-v3.html` — to be added.
Existing doc this supersedes: `docs/pages/10_interview_scheduling.md`.

---

## 1. Route & layout

| Aspect | Value |
|---|---|
| Route | `/interviews` (was redirect — now real page) · `/interviews/calendar` (default) · `/interviews/list` (alternate view) · `/interviews/:id` (detail) |
| Auth | Required (JWT) · admin / recruiter / hiring_manager (own dept) |
| Layout | App shell · header with view toggle + filters · main calendar/list · right rail with today's queue + panelist availability |

---

## 2. Backend tie-in

| Endpoint | Used for |
|---|---|
| `GET /api/v1/interviews/?from=&to=&owner=&dept=&status=` | List of interviews in range |
| `GET /api/v1/interviews/calendar?from=&to=` | Calendar-formatted events (one per interview) |
| `GET /api/v1/interviews/{id}` | Detail page |
| `POST /api/v1/interviews/` | Create — payload includes candidate_id, position_id, round, date, time, duration, panel[], meeting_link, notes |
| `PATCH /api/v1/interviews/{id}` | Reschedule / cancel |
| `POST /api/v1/interviews/{id}/regenerate-magic-links` | Re-send panelist magic links |
| `GET /api/v1/interviews/availability?user_ids=&date=` | **New** (or via calendar adapter) — return free/busy per panelist for chosen date |
| `POST /api/v1/interviews/{id}/generate-debrief` | AI debrief after all rounds complete |
| `GET /api/v1/positions/{id}/interview-kit` | Loaded into Interview Kit modal opened from interview detail |
| `POST /api/v1/positions/{id}/interview-kit/generate` | (Re)generate kit |

The current code has all of this; the redesign mostly reorganizes the UI on top.

### Phase 2 — Real Google Calendar OAuth

Per PRODUCT_IMPROVEMENTS §5.1, the calendar adapter is currently a mock (`MockCalendarAdapter`). Real `GoogleCalendarAdapter` ships in Phase 2 — when ready, this page is the **first place users see the integration light up** (real free/busy lookups, real meeting-link generation, real calendar invites). Settings → Integrations toggles connect; this page consumes.

---

## 3. Layout (calendar view, default)

```
[ topbar: "Interviews" · view toggle [Calendar | List] · period [Day | Week · on | Month] · [+ Schedule Interview] ]

[ FILTERS row ]
  [Department ▼] [Panelist ▼] [Round ▼] [Status: All ▼]      "8 interviews this week"

┌──────────── CALENDAR (main, ~70%) ────────────┬─── RIGHT RAIL (30%) ───┐
│                                                │ TODAY (May 19)         │
│  Time  Mon 19  Tue 20  Wed 21  Thu 22  Fri 23 │ 3 interviews · 1 ahead │
│  9 AM  ─────   ─────   [interview chip]        │                        │
│ 10 AM  [Alex   ─────   [Maya P. panel]         │ 10:00 AM · Tech round  │
│       Chen R1]                                 │ Alex Chen · ML Eng     │
│ 11 AM  ─────   [Joseph K. R2]   ─────          │ Ravi K. (interviewer)  │
│ 12 PM        ──── lunch ────                   │ Google Meet · [Join]   │
│  1 PM  ─────   ─────                           │ ── ── ── ── ── ── ──   │
│  2 PM  [Maya   [Sara K.  ─────                 │ 2:00 PM · Hiring Panel │
│       panel]   screen]                         │ Maya Patel · ML Eng    │
│  3 PM  ─────   ─────                           │ 4 panelists · OnSite   │
│  4 PM  [Sara K]                                │ ⚠ 1 panelist unconfirmed │
│  5 PM  ─────                                   │ [Resend magic links]   │
│                                                │ ── ── ── ── ── ── ──   │
│                                                │ 4:00 PM · Screening    │
│                                                │ Sara K. · phone        │
│                                                │ Priya S. · [Open]      │
│                                                │                        │
│                                                │ ─── ─── ─── ─── ─── ─── │
│                                                │ PANELIST LOAD this wk  │
│                                                │ Ravi K.    3 interviews│
│                                                │ Aditi S.   2 (1 pending│
│                                                │            scorecard)  │
│                                                │ Jordan N.  2           │
│                                                │ Priya S.   5 (heavy)   │
└────────────────────────────────────────────────┴────────────────────────┘
```

### Calendar grid mechanics

- **Week view default** · day/month views toggleable
- Each interview = a colored block sized to duration, anchored to its time slot
- Block colors map to **interview status**: confirmed (green), pending-candidate-confirm (amber), pending-panelist-confirm (purple), completed (gray), cancelled (red strike-through)
- Click block → open `<InterviewDetailDrawer>` (right-slide drawer from edge, no nav)
- Drag block → reschedule (PATCH endpoint); shows availability conflicts inline before commit

### Heatmap overlay

When `[Show panelist load]` toggle is on, each cell tints based on aggregate panelist count: light teal (1 interview) → deep teal (4+ overlapping). Helps spot scheduling fatigue.

---

## 4. List view (alternate)

```
[ list of interviews, grouped by date ]
  TODAY · May 19
  10:00 AM · Tech Round — Alex Chen for Senior ML Eng · Ravi K. · [confirmed] · Google Meet · [Join]
  2:00 PM · Hiring Panel — Maya Patel for Senior ML Eng · 4 panelists · ⚠ 1 unconfirmed · [Resend]
  4:00 PM · Screening — Sara Kim for Senior ML Eng · Priya S. · phone · [Open]

  TOMORROW · May 20
  11:00 AM · Manager Interview — Joseph K. · ...

  THIS WEEK
  ...
```

Same data, optimized for printing / sharing / reading on small screens.

---

## 5. Schedule Interview modal

Triggered by:
- Header `[+ Schedule Interview]` button (no pre-fill)
- Candidate Detail `[Schedule]` action (pre-fills candidate + position)
- Position Detail → Pipeline `[I]` keyboard shortcut (pre-fills both)
- Drag-empty-slot on calendar (pre-fills date + time)

```
┌── Schedule Interview ────────────────────────────────── [×] ──┐
│                                                                │
│  Candidate*    [Alex Chen · Senior ML Eng · ATS 94 ▼]         │
│                (autocomplete from active candidate pipelines)  │
│                                                                │
│  Round*        [Round 2 — Technical ▼]                         │
│                Options: R1 Recruiter Screen · R2 Tech · R3 Mgr │
│                · R4 Hiring Panel · Custom...                   │
│                                                                │
│  Date*         [May 22, 2026 📅]                               │
│  Time*         [10:00 AM ▼]    Duration [60 min ▼]            │
│                                                                │
│  Panel*        [🔍 Search team or enter external email...]     │
│                [Ravi K. ×] [Aditi S. ×] [+ Add]               │
│                                                                │
│  AVAILABILITY (live calendar lookup)                           │
│  Ravi K.    ✓ Free 10–11 AM                                   │
│  Aditi S.   ⚠ Busy until 10:30 AM (conflict 10:00–10:30)      │
│             [Suggest 10:30 AM]                                │
│                                                                │
│  Meeting     [Auto-generate Google Meet ▼]                    │
│              (options: Google Meet · Zoom · Phone · In-person │
│               · Custom URL)                                    │
│                                                                │
│  Notes       [Optional notes for panel members...]            │
│                                                                │
│  AI INTERVIEW KIT                                              │
│  ✓ Will auto-attach kit for "Senior ML Engineer" round 2      │
│    (10 questions + scorecard template)                        │
│  [Preview kit] [Regenerate]                                   │
│                                                                │
│  ☑ Send invitation to candidate                               │
│  ☑ Send feedback magic links to panel members                 │
│  ☑ Auto-remind 24h before (email)                             │
│                                                                │
│                       [Cancel]    [Schedule Interview →]      │
└────────────────────────────────────────────────────────────────┘
```

### Live availability is the key feature

When real Google Calendar OAuth ships:
- As panelists are added, the modal calls `GET /interviews/availability?user_ids=&date=` → returns each panelist's free/busy
- Conflicts shown inline with `[Suggest alternative]` button
- AI suggests the soonest slot when ALL panelists are free (within next 5 business days)

Until OAuth ships (Phase 2): availability rail is hidden; scheduling is best-effort.

---

## 6. Interview detail drawer

Right-slide drawer (≈420px wide) opened on calendar-block click or list-row click. **Doesn't navigate away** — keeps user in their context.

```
[ Drawer header ]
  Round 2 · Technical Interview                         [Reschedule] [Cancel]
  May 22 · 10:00 AM · 60 min · Google Meet

[ Candidate snapshot ]
  [Avatar] Alex Chen · ATS 94 · Senior ML Eng applicant       [Open profile →]

[ Panel ]
  Ravi K. ✓ confirmed       Magic link sent · clicked
  Aditi S. ⚠ pending confirm  [Resend link]

[ Tabs:  Details · Interview Kit · Scorecards (0/2) · Activity ]
  Details tab content (default):
    Meeting URL: meet.google.com/abc-defg-hij   [Copy] [Join]
    Calendar event: linked to Google Calendar
    Notes: "Focus on system design + LLM ft tradeoffs."

[ Bottom: AI debrief CTA (visible only when all rounds done) ]
  [Generate Interview Debrief →]
```

### Interview Kit tab inside drawer

Loaded from `GET /positions/{id}/interview-kit`. Reuses existing `interview_kits` table data.

```
[ Interview Kit · auto-generated from JD ]

TECHNICAL QUESTIONS (5)
1. Explain how Python's GIL affects multithreading.
   Difficulty: Senior · Expected: CPU-bound vs IO-bound nuance...
2. Design a rate-limiting middleware in FastAPI.
   ...

BEHAVIORAL (3)
1. Describe a time you debugged a critical prod issue.
   Expected: STAR format, ownership, systematic approach

SCORECARD TEMPLATE
Technical (40%) · Problem Solving (30%) · Communication (15%) · Culture (15%)

[Print prep packet]  [Regenerate]  [Share link to interviewers (no login)]
```

`[Print prep packet]` produces a PDF: JD + resume + 10 questions + scorecard template — per PRODUCT_IMPROVEMENTS §3.3 HM recommendation.

### Scorecards tab inside drawer

Shows submission status per panelist with quick-link to read-only scorecard summary.

### Interview Debrief

After all rounds complete (`all_rounds_finished=true`), the [Generate Debrief] CTA calls `POST /interviews/{id}/generate-debrief`. AI produces:

```
[Interview Debrief · auto-generated · review before sharing]

SUMMARY
Alex Chen · 4-round process · panel consensus: Strong Hire

PER-DIMENSION AGGREGATE
Technical: 4.5 avg (4.5 / 5 / 4 / 4.5) · "Strong production ML depth"
System Design: 4.2 avg · "Clear tradeoffs, K8s scope thinner than ideal"
Communication: 4.0 avg · "Structured, calibrated, handles disagreement well"
Leadership: 4.3 avg · "Already framing onboarding of juniors"

KEY MOMENTS (extracted from panel notes)
- "Walked through LoRA + caching tradeoffs better than anyone I've interviewed for this level."
- "Solid on cache+inference budget · wanted more depth on multi-region."

CONFLICTS / DISSENT
- 1 panelist scored Concern on K8s prod ownership; others rated Strong. Worth probing in offer conversation.

RECOMMENDATION
3 of 4 Strong Hire · 1 Hire · proceed to offer.

[Edit] [Send to hiring manager] [Copy]
```

Reviewable by recruiter before sharing with HM.

---

## 7. Right rail — Today's queue + Panelist load

### TODAY queue (top)
- Current/upcoming interviews of the logged-in user (or all visible interviews scoped to their permissions)
- Each row: time · type · candidate name · position · panelists · meeting type
- Inline action: `[Join]` if meeting URL ready · `[Open]` for detail drawer
- Warning chip if missing confirmations

### Panelist load (bottom)
- This-week count of interviews per active panelist
- Highlights overloaded panelists (>5/wk = `--warn`) and pending scorecards (chip on name)
- Click name → filter calendar to that panelist's schedule

---

## 8. Role-adaptive

| Element | Admin | Recruiter | HM | Panel |
|---|---|---|---|---|
| Calendar view | ✅ all dept | ✅ own dept | ✅ own assigned | ❌ (uses magic link only) |
| Schedule new | ✅ | ✅ | ✅ | ❌ |
| Reschedule | ✅ | ✅ | ❌ (request only) | ❌ |
| Cancel | ✅ | ✅ | ❌ | ❌ |
| Generate Debrief | ✅ | ✅ | ✅ | ❌ |
| Panelist load view | ✅ org-wide | ✅ own dept | ✅ assigned only | ❌ |
| One-click prep packet | ✅ | ✅ | ✅ | ✅ (via magic link in own scope) |

---

## 9. Components to build

| Component | Path | Notes |
|---|---|---|
| `<InterviewsPage>` | `frontend/src/components/Interviews/InterviewsPage.jsx` | **New** (current route redirects) |
| `<InterviewCalendar>` | `Interviews/InterviewCalendar.jsx` | New — week/day/month grid |
| `<InterviewBlock>` | `Interviews/InterviewBlock.jsx` | New — colored block on calendar |
| `<InterviewListView>` | `Interviews/InterviewListView.jsx` | New — grouped list |
| `<ScheduleInterviewModal>` | `Interviews/ScheduleInterviewModal.jsx` | **Refactor existing** (`Interviews/ScheduleInterviewModal.css` exists today) — add availability rail, AI kit attach, conflict detection |
| `<InterviewDetailDrawer>` | `Interviews/InterviewDetailDrawer.jsx` | New — right-slide drawer |
| `<InterviewKitPanel>` | `Interviews/InterviewKitPanel.jsx` | New — embeds inside drawer |
| `<InterviewDebriefModal>` | `Interviews/InterviewDebriefModal.jsx` | New — AI-generated debrief review |
| `<TodayInterviewQueue>` | `Interviews/TodayInterviewQueue.jsx` | New — right rail top |
| `<PanelistLoadList>` | `Interviews/PanelistLoadList.jsx` | New — right rail bottom |
| `<AvailabilityRail>` | `Interviews/AvailabilityRail.jsx` | New — shown in modal once OAuth live |
| `<PrintPrepPacket>` | `Interviews/PrintPrepPacket.jsx` | New — produces printable PDF |

Existing files to remove: `Candidates/tabs/InterviewsTab.css` consolidated into new patterns.

---

## 10. Empty / loading / error states

| Condition | Display |
|---|---|
| No interviews scheduled at all | Hero CTA: "Schedule your first interview · pick a candidate first" with quick-link to Pipeline |
| Calendar period has no events | Empty grid with "Quiet week. [Schedule new]" |
| Panelist availability API unavailable | Modal still functional; show banner "Availability lookup unavailable — schedule manually" |
| Meeting link generation fails | Modal shows fallback: paste a manual URL |
| Magic-link generation fails for panelist | Inline retry per panelist |
| All-rounds-complete but debrief not ready | "Generating debrief..." spinner with 30s timeout, then [Retry] |

---

## 11. Router change

```diff
- { path: '/interviews', element: <Navigate to="/positions" replace /> },
+ { path: '/interviews', element: <InterviewsPage /> },
+ { path: '/interviews/calendar', element: <InterviewsPage view="calendar" /> },
+ { path: '/interviews/list', element: <InterviewsPage view="list" /> },
+ { path: '/interviews/:id', element: <InterviewsPage detailId /> },
```

Sidebar: re-enable the `Interviews` nav item (currently hidden — see CLAUDE.md note about `/interviews` redirect cleanup).

---

## 12. Build notes

1. The Schedule Interview modal already exists and works. Focus first on enriching it (live availability, kit auto-attach) — that's the lowest-risk win.
2. Calendar view is the big new piece — use a simple CSS grid (no need for a calendar library). For ~80 interviews / week this is fine.
3. Debrief is a thin wrapper around the existing `interview_agents.generate_debrief()` agent.
4. Real Google Calendar OAuth ships in Phase 2 — this page must work BEFORE that (with mock adapter); just hide availability rail until OAuth is configured.
5. Interview Kit data is already populated for every position with a finalized JD — no new generation needed; just expose it in drawer.
