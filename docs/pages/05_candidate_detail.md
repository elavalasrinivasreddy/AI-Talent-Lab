# Page Design: Candidate Detail
> **Version 2.1 — Updated**
> Full candidate profile. Communication Hub tab REMOVED. Replaced with unified Timeline tab.
> Candidate profile opens from ANY section — context-aware back navigation.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Route | `/candidates/:id` · `/candidates/:id/:tab` |
| Auth | Required (JWT) |
| Entry Points | Position Detail (Pipeline + Candidates tabs) · Talent Pool · Dashboard activity · Notification click |
| Back Button | Context-aware — returns to where user came from |
| Tabs | Skills Match · Application · Resume · Interviews · Timeline |

---

## 2. Context-Aware Back Navigation

```javascript
// Always pass context when navigating TO candidate detail:
navigate(`/candidates/${id}`, {
  state: {
    from: '/positions/42',
    fromLabel: 'Back to Senior Python Developer',
    fromTab: 'pipeline'      // restores correct tab on position
  }
});

// From talent pool:
navigate(`/candidates/${id}`, {
  state: { from: '/talent-pool', fromLabel: 'Back to Talent Pool' }
});
```

**Reachable from:**
- Position Detail → Pipeline tab (Kanban card click)
- Position Detail → Candidates tab (list row click)
- Talent Pool → candidate card click
- Dashboard → activity feed candidate name link
- Notification → `action_url` deep link

---

## 3. Page Layout

```
┌──────┬────────────────────────────────────────────────────────────┐
│      │  ← Back to Senior Python Developer                        │
│      │                                                            │
│ S    │  ┌── CANDIDATE HEADER ──────────────────────────────────┐  │
│ I    │  │                                                      │  │
│ D    │  │  [RK]  Rahul Kumar                      ATS: 92%     │  │
│ E    │  │        Senior Developer @ TechCorp Pvt Ltd           │  │
│ B    │  │        ✉ rahul@email.com  ·  📍 Bangalore            │  │
│ A    │  │        💼 6 years experience  ·  🔗 LinkedIn          │  │
│ R    │  │                                                      │  │
│      │  │  Status: [Sourced ▼]                                 │  │
│      │  │  [📅 Schedule Interview]  [🏊 Add to Pool]           │  │
│      │  │  [Draft Rejection Email]  [✅ Mark as Selected]      │  │
│      │  └──────────────────────────────────────────────────────┘  │
│      │                                                            │
│      │  ┌── TABS ─────────────────────────────────────────────┐  │
│      │  │ [Skills Match][Application][Resume][Interviews][Timeline]│
│      │  └──────────────────────────────────────────────────────┘  │
│      │                                                            │
│      │  (tab content below)                                       │
└──────┴────────────────────────────────────────────────────────────┘
```

---

## 4. Candidate Header

**ATS Score circle:**
- ≥80%: green, "Strong Match"
- 60–79%: amber, "Good Match"
- 40–59%: orange, "Partial Match"
- <60%: red, "Weak Match"

**Status dropdown:** Changes pipeline status. Options: Sourced / Emailed / Applied / Screening / Interview / On Hold. Cannot manually set to Selected or Rejected — use dedicated buttons.

**"Draft Rejection Email":** Triggers AI to draft a professional rejection email based on the candidate's profile and rejection reason. Opens review modal → recruiter edits if needed → clicks Send. Appears on timeline as "Rejection email sent." Button disabled if already rejected.

**"Mark as Selected":**
- Only visible when recruiter manually enables (all rounds reviewed)
- Confirmation: "Mark Rahul Kumar as Selected for Senior Python Developer?"
- On confirm: status → Selected, notification sent, candidate appears in selected list
- Irreversible — requires deliberate action

---

## 5. Tab: Skills Match

```
┌── 🎯 ATS Score: 92% ────────────────────────────────────────────────┐
│                                                                      │
│  ████████████████████████████████████░░░░  92 / 100                 │
│  ✅ Strong Match                                                      │
│                                                                      │
│  Matched Skills (8)                                                  │
│  [Python] [FastAPI] [PostgreSQL] [Docker] [AWS] [Redis] [CI/CD] [REST]│
│                                                                      │
│  Missing Skills (2)                                                  │
│  [Kubernetes] [Terraform]                                            │
│                                                                      │
│  Additional Skills — not in JD but candidate has (3)                 │
│  [GraphQL] [MongoDB] [Kafka]                                         │
│                                                                      │
│  AI Analysis                                                         │
│  "Strong backend developer with 6 years building high-throughput     │
│   Python APIs. Direct experience at TechCorp is highly relevant.    │
│   Main gaps are in infrastructure tooling (Kubernetes, Terraform)   │
│   which are preferred but not required. Overall: strong candidate." │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

Chip colors: Matched = green · Missing = red · Additional = blue (info).

---

## 6. Tab: Application

Shows if `status ≥ applied`. Otherwise: `"Candidate sourced/emailed but hasn't applied yet."`

```
┌── Application Details ──────────────────── Applied: Apr 10, 2026 ───┐
│                                                                      │
│  Current Role         Senior Developer at TechCorp Pvt Ltd          │
│  Total Experience     6 years                                        │
│  Relevant Experience  4 years                                        │
│  Notice Period        30 days                                        │
│  Current CTC          ₹18,00,000 per annum    [HR-only 👁]           │
│  Expected CTC         ₹24,00,000 per annum    [HR-only 👁]           │
│  Availability         After 30 days notice                           │
│                                                                      │
│  ── Additional Screening Responses ────────────────────────────     │
│  Office availability   Yes, 3 days/week from Bangalore               │
│  Active offers?        No current offers                             │
│  Interview timing      Mon–Fri, 10am–6pm IST                        │
└──────────────────────────────────────────────────────────────────────┘
```

CTC fields marked HR-only — not visible to panel members.

---

## 7. Tab: Resume

```
┌── 📄 Resume ──────────────────────────────────────── [📥 Download] ──┐
│                                                                       │
│  (resume_text rendered as formatted content)                          │
│                                                                       │
│  RAHUL KUMAR · Senior Python Developer                                │
│  Bangalore · rahul@email.com                                          │
│                                                                       │
│  EXPERIENCE                                                           │
│  Senior Developer — TechCorp Pvt Ltd (2022–Present)                   │
│  • Built microservices architecture serving 2M+ daily users           │
│  • Led migration from monolith to FastAPI + PostgreSQL                │
│  ...                                                                  │
└───────────────────────────────────────────────────────────────────────┘
```

No resume: `"No resume uploaded. Candidate was sourced — upload one manually if available."`

---

## 8. Tab: Interviews

```
┌── 🎙️ Interview Rounds ──────────────────────────── [+ Schedule] ───┐
│                                                                      │
│  Round 1: Technical Interview               ✅ Completed             │
│  Apr 12 · 2:00 PM · 60 min · Google Meet                           │
│  Panel: Raj K., Neha P.    Scorecards: 2/2                         │
│                                                                      │
│  ┌── Scores ────────────────────────────────────────────────────┐  │
│  │  Dimension        Raj K.   Neha P.   Average                 │  │
│  │  Technical        4/5      4/5       4.0                     │  │
│  │  Problem Solving  5/5      4/5       4.5                     │  │
│  │  Communication    4/5      3/5       3.5                     │  │
│  │  Culture Fit      3/5      4/5       3.5                     │  │
│  │  Overall          4.0      3.75      3.88                    │  │
│  │                                                              │  │
│  │  Raj K.:   👍 Yes — "Solid, proceed"                        │  │
│  │  Neha P.:  👍 Yes — "Good skills, proceed"                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  Result: [Passed ▼]                                                  │
│                                                                      │
│  ────────────────────────────────────────────────────────────────   │
│                                                                      │
│  Round 2: Manager Interview                 📅 Scheduled             │
│  Apr 16 · 11:00 AM · 45 min                                         │
│  Panel: Amit S.    Scorecards: 0/1 pending                          │
│  [Reschedule]  [Cancel Round]                                       │
│                                                                      │
│  ────────────────────────────────────────────────────────────────   │
│                                                                      │
│  Round 3: HR Interview                      ⏳ Not Scheduled         │
│  [+ Schedule This Round]                                            │
│                                                                      │
│  ────────────────────────────────────────────────────────────────   │
│                                                                      │
│  [Generate Interview Debrief]  ← appears when all rounds done       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 9. Tab: Timeline (Replaces Communication Hub)

**All events for this candidate in one reverse-chronological feed.** No separate Communication Hub tab.

```
┌── 📜 Activity Timeline ──────────────────────────────────────────────┐
│                                                                       │
│  TODAY                                                                │
│  ──────────────────────────────────────────────────────────         │
│  📋  2:45 PM   Raj K. submitted scorecard — Round 1                  │
│                Overall: 4.0/5 · Rec: Yes  [View ▾]                  │
│                                                                       │
│  📋  11:30 AM  Neha P. submitted scorecard — Round 1                 │
│                Overall: 3.75/5 · Rec: Yes  [View ▾]                 │
│                                                                       │
│  Apr 12                                                               │
│  ──────────────────────────────────────────────────────────         │
│  📅  10:00 AM  Interview scheduled — Round 1 Technical               │
│                Apr 12 · 2:00 PM · Raj K., Neha P.                  │
│                Invite sent to candidate + panel                      │
│                                                                       │
│  Apr 10                                                               │
│  ──────────────────────────────────────────────────────────         │
│  📝  2:32 PM   Applied via magic link  [View Application ▾]          │
│  🔄  2:33 PM   Status changed to Applied                             │
│                                                                       │
│  Apr 9                                                                │
│  ──────────────────────────────────────────────────────────         │
│  👁  2:20 PM   Magic link clicked                                     │
│  📧  11:15 AM  Outreach email sent  [Preview ▾]                      │
│  📊  11:00 AM  ATS scored: 92% (Strong Match)                        │
│                8 matched · 2 missing                                  │
│  🔍  10:45 AM  Sourced via AI candidate search                        │
│                                                                       │
│  ── Comments ──────────────────────────────────────────────────     │
│  [SR]  Write a comment... @mention team members           [Post]    │
└───────────────────────────────────────────────────────────────────────┘
```

**Event icon reference:**
| Icon | Event |
|---|---|
| 🔍 | Sourced (search or upload) |
| 📊 | ATS scored |
| 📧 | Outreach email sent |
| 👁 | Magic link clicked |
| 📝 | Application submitted |
| 🔄 | Status changed |
| 📅 | Interview scheduled/rescheduled |
| 📋 | Scorecard submitted |
| 💬 | Team comment |
| 📤 | Rejection email sent |
| ⭐ | Marked as selected |
| 🏊 | Added to talent pool |

Expandable events: email preview ▾, application responses ▾, scorecard summary ▾.

---

## 10. Schedule Interview Modal

Opens from header "Schedule Interview" button or Interviews tab "+ Schedule":

```
┌── 📅 Schedule Interview ───────────────────────────────── [✕] ──┐
│                                                                  │
│  Candidate:  Rahul Kumar  (Sr Python Dev · Round 1)             │
│                                                                  │
│  Round *         [Round 1 — Technical ▼]                        │
│  Panel *         [🔍 Search team or enter email...]              │
│                  [Raj K.  ✕]  [Neha P.  ✕]  [+ Add]            │
│  Date *          [Apr 15, 2026  📅]                              │
│  Time *          [10:00 AM ▼]    Duration [60 min ▼]            │
│  Meeting Link    [Auto-generate Google Meet ▼]                  │
│  Notes           [Optional notes for panel members...]          │
│                                                                  │
│  ☑ Send interview invitation to candidate                       │
│  ☑ Send feedback magic links to panel members                   │
│  ☑ Auto-remind 24h before (email)                               │
│                                                                  │
│               [Cancel]      [Schedule Interview]               │
└──────────────────────────────────────────────────────────────────┘
```

---

## 11. API Endpoints

| Action | Endpoint | Method |
|---|---|---|
| Load candidate | `GET /api/v1/candidates/:id` | GET |
| Get timeline | `GET /api/v1/candidates/:id/timeline` | GET |
| Update status | `PATCH /api/v1/candidates/:id/status` | PATCH |
| Add to pool | `POST /api/v1/talent-pool/:id/add` | POST |
| Draft rejection | `POST /api/v1/candidates/:id/draft-rejection` | POST |
| Send rejection | `POST /api/v1/candidates/:id/send-rejection` | POST |
| Mark selected | `POST /api/v1/candidates/:id/mark-selected` | POST |
| Get interviews | `GET /api/v1/interviews/candidate/:id` | GET |
| Schedule interview | `POST /api/v1/interviews/` | POST |
| Generate debrief | `POST /api/v1/interviews/:id/generate-debrief` | POST |
| Add comment | timeline event via `POST /api/v1/pipeline-events` | POST |
