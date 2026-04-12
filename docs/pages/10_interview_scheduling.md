# Page Design: Interview Scheduling & Scorecards

> Built-in interview scheduling with calendar integration, self-scheduling links, and structured evaluation scorecards.

---

## 1. Page Purpose

This isn't a standalone page — scheduling and scorecards live across multiple surfaces:
- **Position Detail → Pipeline tab**: Schedule interviews for candidates
- **Candidate Detail → Interviews tab**: View all interviews for a candidate
- **Schedule Modal**: Create/edit interview (modal overlay)
- **Self-Schedule Page**: Public page where candidates pick a time slot
- **Scorecard Form**: Interviewer submits evaluation after interview

---

## 2. Schedule Interview Modal

Triggered from: Pipeline board → candidate card → "Schedule Interview"

```
┌─────────────────────────────────────────────────────────┐
│  📅 Schedule Interview                           [✕]    │
│                                                         │
│  Candidate:  Priya Sharma (Sr Python Dev)               │
│  Position:   Senior Python Developer (#42)              │
│                                                         │
│  Round *     [Round 1 - Technical ▼]                    │
│              Round 1 - Technical                        │
│              Round 2 - Manager                          │
│              Round 3 - HR                               │
│              Round 4 - Final                            │
│              Custom...                                  │
│                                                         │
│  Interviewers *                                         │
│  [🔍 Search team members...]                            │
│  ┌──────────────┐ ┌──────────────┐                      │
│  │ 👤 Raj K.    │ │ 👤 Neha P.   │  [+ Add]             │
│  │ Tech Lead    │ │ Sr Engineer  │                      │
│  └──────────────┘ └──────────────┘                      │
│                                                         │
│  ── Scheduling Method ──────────────────────────────     │
│  (○) Manual — Pick date & time                          │
│  (●) Self-schedule — Candidate picks from slots         │
│                                                         │
│  ── If Manual ──────────────────────────────────────     │
│  Date *        [Apr 15, 2026]                           │
│  Time *        [10:00 AM ▼]  Duration [60 min ▼]        │
│                                                         │
│  ── If Self-Schedule ───────────────────────────────     │
│  Available Slots:                                       │
│  [+ Add Slot]                                           │
│  ┌────────────────────────────────────────────────┐     │
│  │ Apr 15 │ 10:00 AM - 11:00 AM    [✕]            │     │
│  │ Apr 15 │ 2:00 PM - 3:00 PM     [✕]            │     │
│  │ Apr 16 │ 11:00 AM - 12:00 PM   [✕]            │     │
│  └────────────────────────────────────────────────┘     │
│                                                         │
│  Meeting Link  [Auto-generate ▼]                        │
│                Google Meet / Zoom / Custom URL           │
│                                                         │
│  Notes         [Optional notes for interviewers...]     │
│                                                         │
│  ☑ Send calendar invite to interviewers                 │
│  ☑ Send reminder 24h before interview                   │
│  ☑ Send reminder 1h before interview                    │
│                                                         │
│              [Cancel]  [Schedule Interview]              │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Interview Timeline (on Candidate Detail)

Shows all interview rounds for a candidate in a visual timeline:

```
┌─ Interviews ──────────────────────────────────────────────┐
│                                                           │
│  Round 1: Technical           ✅ Completed                │
│  Apr 12, 10:00 AM │ 60 min │ Google Meet                 │
│  Interviewers: Raj K., Neha P.                           │
│  Scorecards: 2/2 submitted │ Avg: 4.2/5                 │
│  Recommendation: ✅ Yes (2)                               │
│  [View Scorecards]                                       │
│  ─────────────────────────────────────────────────────    │
│                                                           │
│  Round 2: Manager             📅 Scheduled               │
│  Apr 16, 2:00 PM │ 45 min │ Google Meet                  │
│  Interviewers: Amit S. (Engineering Manager)             │
│  Scorecards: 0/1 pending                                 │
│  [Reschedule] [Cancel]                                   │
│  ─────────────────────────────────────────────────────    │
│                                                           │
│  Round 3: HR                  ⏳ Pending                  │
│  Not yet scheduled                                       │
│  [Schedule Now]                                          │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## 4. Self-Schedule Page (Public)

URL: `/schedule/{token}` — Candidate receives this link via email/WhatsApp

```
┌────────────────────────────────────────────────────────────────┐
│  ┌─ Header ────────────────────────────────────────────────┐   │
│  │  [Logo]  TechCorp                                        │   │
│  │  Interview Scheduling                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─ Info ──────────────────────────────────────────────────┐   │
│  │  Hi Priya! 👋                                            │   │
│  │                                                          │   │
│  │  You've been invited to an interview for:                 │   │
│  │  📋 Senior Python Developer at TechCorp                  │   │
│  │  🔄 Round 1: Technical Interview                         │   │
│  │  ⏱ Duration: 60 minutes                                  │   │
│  │  👥 With: Raj K. (Tech Lead), Neha P. (Sr Engineer)      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─ Pick a Time Slot ─────────────────────────────────────┐    │
│  │                                                         │    │
│  │  📅 Tuesday, April 15                                   │    │
│  │  ┌─────────────────────────┐                            │    │
│  │  │ ○ 10:00 AM - 11:00 AM  │                            │    │
│  │  │ ● 2:00 PM - 3:00 PM   │  ← selected                │    │
│  │  └─────────────────────────┘                            │    │
│  │                                                         │    │
│  │  📅 Wednesday, April 16                                 │    │
│  │  ┌─────────────────────────┐                            │    │
│  │  │ ○ 11:00 AM - 12:00 PM  │                            │    │
│  │  └─────────────────────────┘                            │    │
│  │                                                         │    │
│  │                       [Confirm: Apr 15, 2:00 PM]        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─ After Confirmation ───────────────────────────────────┐    │
│  │  ✅ Interview scheduled!                                │    │
│  │                                                         │    │
│  │  📅 April 15, 2026 │ 2:00 PM - 3:00 PM IST            │    │
│  │  🔗 Google Meet: https://meet.google.com/xxx-xxx-xxx   │    │
│  │                                                         │    │
│  │  📧 Calendar invite sent to priya@email.com            │    │
│  │  You'll receive a reminder 24 hours before.             │    │
│  └─────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────┘
```

---

## 5. Scorecard Form (Interviewer)

URL: `/interview-kit/{token}` or from Position Detail → Interview Kit tab

After an interview is completed, each interviewer sees a scorecard form:

```
┌─────────────────────────────────────────────────────────────┐
│  📝 Interview Scorecard                                      │
│                                                              │
│  Candidate: Priya Sharma │ Role: Sr Python Developer        │
│  Round: Technical │ Date: Apr 15, 2026                      │
│                                                              │
│  ── Rating Dimensions ──────────────────────────────────     │
│                                                              │
│  Technical Skills           ☆ ☆ ☆ ★ ★   [4/5]              │
│  Notes: [Strong Python, needs work on system design___]     │
│                                                              │
│  Problem Solving            ☆ ☆ ☆ ☆ ★   [5/5]              │
│  Notes: [Excellent approach to optimization problem___]     │
│                                                              │
│  Communication              ☆ ☆ ☆ ★ ★   [4/5]              │
│  Notes: [Clear explanations, good whiteboard skills__]      │
│                                                              │
│  Culture Fit                ☆ ☆ ★ ★ ★   [3/5]              │
│  Notes: [Seems more individual contributor oriented__]      │
│                                                              │
│  ── Overall ────────────────────────────────────────────     │
│                                                              │
│  Overall Score:     4.0/5  (weighted avg)                    │
│                                                              │
│  Recommendation:                                             │
│  (○) Strong Yes  (●) Yes  (○) Neutral  (○) No  (○) Strong No│
│                                                              │
│  Additional Comments:                                        │
│  [________________________________________________________]  │
│  [________________________________________________________]  │
│                                                              │
│                [Save Draft]  [Submit Scorecard]              │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Aggregate Scorecards View (on Candidate Detail)

After all interviewers submit, an aggregate view is shown:

```
┌─ Scorecard Summary ───────────────────────────────────────────┐
│                                                                │
│  Round 1: Technical │ 2 scorecards submitted                  │
│                                                                │
│  Dimension        │ Raj K.  │ Neha P. │ Average               │
│  ─────────────────┼─────────┼─────────┼───────                │
│  Technical Skills │ 4/5     │ 4/5     │ 4.0                   │
│  Problem Solving  │ 5/5     │ 4/5     │ 4.5                   │
│  Communication    │ 4/5     │ 3/5     │ 3.5                   │
│  Culture Fit      │ 3/5     │ 4/5     │ 3.5                   │
│  ─────────────────┼─────────┼─────────┼───────                │
│  Overall          │ 4.0     │ 3.75    │ 3.88                  │
│                                                                │
│  Recommendations:                                              │
│  Raj K.:  ✅ Yes — "Solid candidate, move forward"            │
│  Neha P.: ✅ Yes — "Good technical skills, schedule round 2"  │
│                                                                │
│  Consensus: ✅ Proceed to Round 2                              │
└────────────────────────────────────────────────────────────────┘
```

---

## 7. Backend APIs Used

| Action | Endpoint | Method |
|--------|----------|--------|
| Schedule interview | `/api/interviews/` | POST |
| List interviews for position | `/api/interviews/position/{id}` | GET |
| List interviews for candidate | `/api/interviews/candidate/{id}` | GET |
| Update interview (reschedule) | `/api/interviews/{id}` | PATCH |
| Generate self-schedule link | `/api/interviews/{id}/self-schedule` | POST |
| Candidate picks slot (public) | `/api/interviews/self-schedule/{token}` | PUT |
| Submit scorecard | `/api/interviews/{id}/scorecards` | POST |
| Get scorecards for interview | `/api/interviews/{id}/scorecards` | GET |
| Aggregate scores for candidate | `/api/interviews/candidate/{id}/scorecards` | GET |

---

## 8. Notifications Triggered

| Event | Notified | Channel |
|-------|----------|---------|
| Interview scheduled | Candidate + interviewers | Email + calendar invite |
| Self-schedule link sent | Candidate | Email / WhatsApp |
| Candidate picks slot | Interviewers | Notification + email |
| 24h reminder | Candidate + interviewers | Email |
| 1h reminder | Candidate + interviewers | Email |
| Interview completed | Interviewers | Notification ("Submit scorecard") |
| All scorecards submitted | Recruiter/HM | Notification ("Review scorecards") |
| Interview cancelled | Candidate + interviewers | Email + notification |
