# Page Design: Interview Scheduling
> **Version 2.1 — Updated**
> Interview scheduling lives across Position Detail and Candidate Detail, not as a standalone page.
> Panel members access via magic link ONLY — no platform login.
> Self-scheduling and calendar integration are Phase 2 features.

---

## 1. Where Scheduling Lives

This is not a standalone page. Interview scheduling surfaces appear on:

| Surface | What It Does |
|---|---|
| **Candidate Detail → Interviews tab** | View all rounds, schedule new rounds, see scorecards |
| **Position Detail → Pipeline tab** | "Schedule Interview" on candidate card `[...]` menu |
| **Schedule Interview Modal** | Create/edit interview round (modal overlay) |
| **Panel Feedback Page** (`/panel/:token`) | Panel member submits feedback — separate doc: `11_panel_feedback.md` |

---

## 2. Schedule Interview Modal

**Triggered from:**
- Pipeline Kanban card → `[...]` → "Schedule Interview"
- Candidate Detail → Interviews tab → "+ Schedule Interview"
- Candidate Detail → Interviews tab → round that shows "Schedule This Round"

```
┌── 📅 Schedule Interview ────────────────────────────── [✕] ──┐
│                                                              │
│  Candidate:  Priya Sharma                                    │
│  Position:   Senior Python Developer (#42)                   │
│                                                              │
│  Round *          [Round 1 — Technical ▼]                    │
│                   Round 1 — Technical                        │
│                   Round 2 — Manager                          │
│                   Round 3 — HR                               │
│                   Round 4 — Final                            │
│                   Custom name...                             │
│                                                              │
│  Panel Members *                                             │
│  [🔍 Type name to search team members, or enter email]       │
│  ┌───────────────────┐  ┌───────────────────┐               │
│  │ 👤 Raj K.         │  │ 👤 Neha P.         │  [+ Add]      │
│  │ Tech Lead         │  │ Sr Engineer        │               │
│  │             [✕]  │  │              [✕]  │               │
│  └───────────────────┘  └───────────────────┘               │
│  Note: Each panel member gets a unique feedback magic link   │
│                                                              │
│  Date *          [Apr 15, 2026     📅]                       │
│  Time *          [10:00 AM ▼]  Duration [60 min ▼]           │
│                                                              │
│  Meeting Link    [Auto-generate Google Meet ▼]               │
│                  Auto-generate Google Meet                   │
│                  Auto-generate Zoom link                     │
│                  Enter custom URL                            │
│                  [https://meet.google.com/...        ]       │
│                                                              │
│  Notes for panel [Optional — visible to panel members]       │
│  [                                              ]            │
│                                                              │
│  ☑ Send interview invitation to candidate                    │
│    (includes date, time, meeting link, round details)        │
│  ☑ Send feedback magic links to panel members                │
│    (each panelist gets unique link for feedback submission)  │
│  ☑ Auto-send reminders 24h before interview                  │
│    (email only — no calendar integration in MVP)             │
│                                                              │
│               [Cancel]    [Schedule Interview]              │
└──────────────────────────────────────────────────────────────┘
```

**Panel member input:** Search existing org users by name. Can also type an external email address to add an outside panelist — they still get a magic link.

**Auto-send invite rule:** If recruiter saves the interview but doesn't click "Send Invite" before the interview date - 24h, system auto-sends. Once invite sent, `invite_sent_at` is set and "Send Invites" button is disabled.

**Reschedule flow:** Edit interview → date/time change → "Send Invites" button re-enables automatically → recruiter sends updated invites.

---

## 3. Interview Rounds Display (Candidate Detail → Interviews Tab)

```
┌── 🎙️ Interview Rounds ─────────────────────── [+ Schedule] ──┐
│                                                               │
│  Round 1: Technical Interview               ✅ Completed      │
│  Apr 12, 2:00 PM  ·  60 min  ·  Google Meet                  │
│  Panel: Raj K., Neha P.                                       │
│  Scorecards: 2/2 submitted                                    │
│                                                               │
│  ┌── Aggregate Scores ─────────────────────────────────────┐  │
│  │  Dimension         Raj K.  Neha P.  Average             │  │
│  │  Technical Skills   4/5     4/5      4.0               │  │
│  │  Problem Solving    5/5     4/5      4.5               │  │
│  │  Communication      4/5     3/5      3.5               │  │
│  │  Culture Fit        3/5     4/5      3.5               │  │
│  │  ─────────────────────────────────────────────────      │  │
│  │  Overall            4.0     3.75     3.88              │  │
│  │                                                         │  │
│  │  Raj K.:   👍 Yes — "Solid candidate, proceed to R2"   │  │
│  │  Neha P.:  👍 Yes — "Good skills, some concerns on K8s"│  │
│  │  Consensus: ✅ Proceed to Round 2                       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  Result: [Passed ▼]    (Passed / Rejected / Pending)          │
│                                                               │
│  ─────────────────────────────────────────────────────────   │
│                                                               │
│  Round 2: Manager Interview                 📅 Scheduled      │
│  Apr 16, 11:00 AM  ·  45 min  ·  Google Meet                 │
│  Panel: Amit S. (Engineering Manager)                         │
│  Scorecards: 0/1 pending                                      │
│  [Reschedule]   [Cancel Round]                               │
│                                                               │
│  ─────────────────────────────────────────────────────────   │
│                                                               │
│  Round 3: HR Interview                      ⏳ Not Scheduled  │
│                                                               │
│  [+ Schedule This Round]                                      │
│                                                               │
│  ─────────────────────────────────────────────────────────   │
│                                                               │
│  [Generate Interview Debrief]  ← appears only after ALL rounds│
│                                   complete + all scorecards in│
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**Round status indicators:**
- ⏳ Not Scheduled — gray, shows "Schedule This Round" button
- 📅 Scheduled — blue, shows "Reschedule" + "Cancel Round"
- ✅ Completed — green, shows scorecards + result selector
- ❌ Cancelled — red, shows "Reschedule" option

**Setting round result:** After interview is marked completed, recruiter sets overall result:
```
Result: [Passed ▼]    → candidate moves toward Selected path
        [Rejected]    → system drafts rejection email, recruiter sends
        [Pending]     → awaiting decision
```

---

## 4. Interview Debrief Generation

Appears after ALL rounds are marked complete AND all scorecards submitted:

```
┌─────────────────────────────────────────────────────────────────┐
│  🎯 All rounds complete. All feedback received.                  │
│                                                                  │
│  [Generate Interview Debrief]                                   │
│                                                                  │
│  AI will summarize all feedback, highlight agreements and       │
│  disagreements between interviewers, and provide a hiring       │
│  recommendation to support your final decision.                 │
└─────────────────────────────────────────────────────────────────┘
```

**After generation, debrief appears below:**
```
┌── 📋 Interview Debrief ─────────────────────────────────────────┐
│                                                                  │
│  Candidate: Priya Sharma | Role: Senior Python Developer        │
│  Rounds completed: 2 | Total interviewers: 3                   │
│                                                                  │
│  Aggregate Score: 3.92 / 5.0                                    │
│  Overall Recommendation: ✅ Proceed (2 Yes, 0 No, 1 Neutral)    │
│                                                                  │
│  Strengths (consensus):                                         │
│  All interviewers noted strong Python proficiency and clear     │
│  technical communication. Problem-solving approach received     │
│  the highest ratings across all rounds.                         │
│                                                                  │
│  Areas of Concern (varied):                                     │
│  Infrastructure experience (Kubernetes) was flagged by Raj K.  │
│  and Neha P. but not considered a blocker. Amit S. noted       │
│  strong ownership mindset which offsets this concern.           │
│                                                                  │
│  Key Disagreement:                                              │
│  Culture Fit: Raj K. rated 3/5, Neha P. rated 4/5, Amit S.    │
│  rated 4/5. Recommend discussing team fit briefly in offer     │
│  conversation.                                                  │
│                                                                  │
│  AI Suggestion: Strong candidate overall. Recommended for       │
│  selection with note on K8s ramp-up plan during onboarding.    │
│                                                                  │
│  [📥 Download Debrief]  [Mark as Selected]  [Reject Candidate] │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. What's NOT in MVP (Phase 2)

| Feature | Phase |
|---|---|
| Candidate self-scheduling (picks own slot) | Phase 2 |
| Google Calendar / Outlook sync | Phase 2 |
| Free/busy availability from calendar | Phase 2 |
| Automated 1-hour reminders | Phase 2 (email-based 24h reminder is MVP) |
| Video call auto-generation (Meet/Zoom API) | Phase 2 — for now recruiter enters URL manually |

---

## 6. Notifications Triggered

| Event | Who Notified | How |
|---|---|---|
| Interview scheduled | Candidate | Email (interview_invite template) |
| Interview scheduled | Panel members | Email with magic link for feedback |
| Invite not sent within 24h of interview | System auto-sends | Email |
| Interview rescheduled | Candidate + Panel | Email |
| Interview cancelled | Candidate + Panel | Email |
| 24h before interview | Candidate + Panel | Email (MVP — no calendar) |
| All scorecards submitted | Recruiter | In-app notification |
| Panel submits feedback | Recruiter | In-app notification |
| Interview debrief generated | Recruiter | In-app notification |

---

## 7. API Endpoints

| Action | Endpoint | Method |
|---|---|---|
| Create interview | `POST /api/v1/interviews/` | POST |
| List interviews for position | `GET /api/v1/interviews/position/:id` | GET |
| List interviews for candidate | `GET /api/v1/interviews/candidate/:id` | GET |
| Get interview detail | `GET /api/v1/interviews/:id` | GET |
| Update interview | `PATCH /api/v1/interviews/:id` | PATCH |
| Send invites | `POST /api/v1/interviews/:id/send-invites` | POST |
| Generate debrief | `POST /api/v1/interviews/:id/generate-debrief` | POST |
