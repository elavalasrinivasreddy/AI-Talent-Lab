# Page Design: Position Detail
> **Version 2.1 — Updated**
> Deep-dive into a single hiring position. Tabs: Pipeline, Candidates, JD, Interview Kit, Activity, Settings.
> All candidate navigation is context-aware. API endpoints updated to /api/v1/ prefix.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Route | `/positions/:id` · `/positions/:id/:tab` |
| Auth | Required (JWT) |
| Entry Points | Dashboard → click position row · Sidebar → active sessions |
| Layout | Sidebar + full-width detail with tabs |

---

## 2. Page Layout

```
┌──────┬──────────────────────────────────────────────────────────┐
│      │  ← Dashboard                                            │
│      │                                                          │
│      │  ┌── POSITION HEADER ─────────────────────────────────┐ │
│ S    │  │  Senior Python Developer        Status: [Open ▼]   │ │
│ I    │  │  Engineering · Created Apr 5 · by Srinivas R        │ │
│ D    │  │  Priority: 🔴 Urgent  ·  Headcount: 2  ·  Deadline: May 15 │
│ E    │  └────────────────────────────────────────────────────┘ │
│ B    │                                                          │
│ A    │  ┌── STATS ROW ───────────────────────────────────────┐ │
│ R    │  │  👥 24 Sourced  │ 📧 18 Emailed  │ 📝 8 Applied  │ 🎙️ 3 Interview │
│      │  └────────────────────────────────────────────────────┘ │
│      │                                                          │
│      │  ┌── TABS ────────────────────────────────────────────┐ │
│      │  │ [Pipeline][Candidates][JD][Interview Kit][Activity][Settings] │
│      │  └────────────────────────────────────────────────────┘ │
│      │                                                          │
│      │  ┌── TAB CONTENT ─────────────────────────────────────┐ │
│      │  │  (see sections below)                              │ │
│      │  └────────────────────────────────────────────────────┘ │
└──────┴──────────────────────────────────────────────────────────┘
```

---

## 3. Tab Content

### 3.1 Pipeline Tab (Kanban Board)

```
Sourced (8)   │ Emailed (6)  │ Applied (4)  │ Screening (2) │ Interview (3) │ ✅(1) │ ❌(4)
──────────────┼──────────────┼──────────────┼───────────────┼───────────────┼──────┼──────
┌──────────┐  │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐  │ ┌──────────┐  │      │
│ Rahul K  │  │ │ Priya S  │ │ │ Amit R   │ │ │ Neha P   │  │ │ Sanya M  │  │      │
│ 85% ●    │  │ │ 78% ●    │ │ │ 92% ●    │ │ │ 74% ●    │  │ │ 88% ●    │  │      │
│ TechCorp │  │ │ InfoSys  │ │ │ Flipkart │ │ │ Wipro    │  │ │ Google   │  │      │
│ 6 yrs    │  │ │ 4 yrs    │ │ │ 7 yrs    │ │ │ 3 yrs    │  │ │ 5 yrs    │  │      │
│ [...]    │  │ │ [...]    │ │ │ [...]    │ │ │ [...]    │  │ │ [...]    │  │      │
└──────────┘  │ └──────────┘ │ └──────────┘ │ └──────────┘  │ └──────────┘  │      │
```

**Card interactions:**
- Click card → navigate to `/candidates/:id` (with position context in location.state)
- Click `[...]` menu → "Move to..." status submenu, "Schedule Interview", "Draft Rejection"
- Horizontal scroll when columns overflow
- Column header shows count

**"..." menu options:**
```
Move to: Emailed | Applied | Screening | Interview | On Hold
Schedule Interview
Draft Rejection Email
Add to Talent Pool
```

---

### 3.2 Candidates Tab (List View)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Status ▼] [Score ▼] [Source ▼] [🔍 Search...]      [📧 Bulk Email] │
│                                                                      │
│ ☐ │ Name          │ Score    │ Status      │ Source      │ Exp      │
│ ──┼───────────────┼──────────┼─────────────┼─────────────┼──────────│
│ ☐ │ Amit R        │ ●92%     │ Applied     │ Simulation  │ 7 yrs   │
│ ☐ │ Sanya M       │ ●88%     │ Interview   │ Simulation  │ 5 yrs   │
│ ☐ │ Rahul K       │ ●85%     │ Sourced     │ Simulation  │ 6 yrs   │
│ ☐ │ Arjun T       │ ○81%     │ Emailed     │ Simulation  │ 5 yrs   │
│ ☐ │ Lisa W        │ ○72%     │ Screening   │ Career Page │ 8 yrs   │
│                                                                      │
│ Bulk: [Select all]  With selected: [📧 Send Email] [⏭ Status ▼]    │
│ ← Prev  Page 1 of 3  Next →                                         │
└──────────────────────────────────────────────────────────────────────┘
```

- Score dots: ● green (≥80%), ● amber (60–79%), ○ red (<60%)
- Click row → `/candidates/:id` with position + tab context
- Sortable columns (click header)
- Bulk actions: send outreach email, change status

---

### 3.3 JD Tab

```
┌──────────────────────────────────────────────────────────────────────┐
│  📄 Job Description         [✏️ Edit]  [📥 PDF]  [📥 Markdown]       │
│  ────────────────────────────────────────────────────────────────    │
│                                                                      │
│  # Senior Python Developer                                           │
│                                                                      │
│  ## About TechCorp                                                   │
│  {org.about_us content from settings — pulled automatically}        │
│                                                                      │
│  ## Role Overview  ...                                               │
│  ## Responsibilities  ...                                            │
│  ## Requirements  ...                                                │
│  ## Benefits  ...                                                    │
│                                                                      │
│  (rendered markdown)                                                 │
│                                                                      │
│  [View original chat session →]                                     │
│  [🌐 Showing on career page]  ·  [Hide from career page]            │
└──────────────────────────────────────────────────────────────────────┘
```

**Edit mode:** Click Edit → textarea with raw markdown. Click Save → re-renders.
**Career page toggle:** Shows whether position is visible on public career page. Toggle hides/shows it without changing position status.

---

### 3.4 Interview Kit Tab

```
┌──────────────────────────────────────────────────────────────────────┐
│  🎯 Interview Kit      [🔄 Regenerate]  [📤 Share Link to Interviewers] │
│                                                                      │
│  ── Technical Questions (5) ─────────────────────────────────────   │
│  1. Explain how Python's GIL affects multithreading performance.    │
│     Difficulty: Senior | Expected: CPU-bound vs IO-bound...         │
│  2. Design a rate-limiting middleware in FastAPI.                   │
│     Difficulty: Senior | Expected: Redis, token bucket...           │
│                                                                      │
│  ── Behavioral Questions (3) ────────────────────────────────────   │
│  1. Describe a time you had to debug a critical production issue.   │
│     Expected: STAR format, shows ownership and systematic approach  │
│                                                                      │
│  ── Situational Questions (2) ───────────────────────────────────   │
│  1. If you inherited a poorly documented codebase, what would...    │
│                                                                      │
│  ── Culture Fit Questions (2) ───────────────────────────────────   │
│  1. What does remote-first collaboration look like to you?          │
│     (Based on org culture keyword: "remote-first")                  │
│                                                                      │
│  ── Scorecard Template ──────────────────────────────────────────   │
│  Technical Skills (40%) │ Problem Solving (30%) │                   │
│  Communication (15%)    │ Culture Fit (15%)                         │
│  [✏️ Edit Dimensions]                                                │
└──────────────────────────────────────────────────────────────────────┘
```

- Generated by AI after JD is finalized (auto-triggered or manually via button)
- Share Link generates a shareable URL for interviewers (no platform account needed)
- Questions categorized: Technical, Behavioral, Situational, Culture Fit
- Culture Fit questions derive from org's `culture_keywords` in settings
- Scorecard template pulled from Settings → Interview Templates (or org default)

---

### 3.5 Activity Tab

```
┌──────────────────────────────────────────────────────────────────────┐
│  📜 Team Activity                           [Filter: All ▼]         │
│                                                                      │
│  Apr 12, 15:30  💬 Neha P commented on Priya Sharma                 │
│                 "Strong technical skills, let's go to round 2"      │
│                                                                      │
│  Apr 12, 14:00  📋 Raj K submitted scorecard for Priya S            │
│                 Overall: 4.2/5 · Recommendation: Yes                │
│                                                                      │
│  Apr 11, 10:00  📅 Interview scheduled: Priya S — Round 1 Technical │
│                 Apr 12 · 2:00 PM · Raj K, Neha P                   │
│                                                                      │
│  Apr 10, 14:32  📝 Amit R applied via magic link                    │
│                                                                      │
│  Apr 9, 11:00   🤖 AI search completed: 24 candidates found         │
│                 8 above 80% threshold, 16 below                     │
│                                                                      │
│  ── Comment ─────────────────────────────────────────────────────   │
│  [SR]  Write a comment... @mention team members         [Post]      │
└──────────────────────────────────────────────────────────────────────┘
```

- Shows ALL activity on this position: candidate events, comments, interviews, scorecards
- @mention support: type `@` to see team members → mention creates notification for that person
- Filter options: All, Comments, Emails, Scorecards, Status Changes, Interviews

---

### 3.6 Settings Tab

```
┌──────────────────────────────────────────────────────────────────────┐
│  ⚙️ Position Settings                                               │
│                                                                      │
│  ── Auto Candidate Search ──────────────────────────────────────    │
│  Frequency:  [Daily ▼]  (Manual / Daily / Every 2 days / Weekly)    │
│  Last run:   Apr 12, 2026 at 10:30 AM                               │
│  Next run:   Apr 13, 2026 at 10:30 AM                               │
│  [🔍 Run Now]     [⏸ Pause Search]                                  │
│                                                                      │
│  ── ATS Threshold ──────────────────────────────────────────────    │
│  Minimum match score:  [80%  ▼]                                     │
│  (60% / 70% / 75% / 80% / 85% / 90%)                               │
│                                                                      │
│  ── Position Details ───────────────────────────────────────────    │
│  Headcount:    [2]                                                   │
│  Priority:     [Urgent ▼]                                           │
│  Deadline:     [2026-05-15]                                         │
│  Assigned to:  [Srinivas R ▼]                                       │
│  Department:   [Engineering ▼]                                       │
│                                                                      │
│  ── Career Page ────────────────────────────────────────────────    │
│  [🌐 Visible on career page]  Toggle to hide from public page       │
│  Career URL: aitalentlab.com/techcorp/careers (view ↗)             │
│                                                                      │
│  [💾 Save Changes]                                                  │
│                                                                      │
│  ── Danger Zone ────────────────────────────────────────────────    │
│  [🟡 Put on Hold]  [🔴 Close Position]  [🗑️ Archive]               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Position Status Rules

| Status | Color | Actions Available |
|---|---|---|
| Draft | Gray | Open, Delete |
| Open | Green | On Hold, Close, Run Search, Edit Settings |
| On Hold | Amber | Reopen, Close |
| Closed | Red | Archive, Reopen |
| Archived | Dark Gray | Delete (admin only) |

Auto-pool rule: When position closed/archived, all non-selected candidates auto-added to talent pool.

---

## 5. API Endpoints

| Action | Endpoint | Method |
|---|---|---|
| Load position | `GET /api/v1/positions/:id` | GET |
| Load pipeline (Kanban) | `GET /api/v1/dashboard/pipeline/:id` | GET |
| Load candidates (list) | `GET /api/v1/candidates/position/:id` | GET |
| Update status | `PATCH /api/v1/positions/:id/status` | PATCH |
| Update settings | `PATCH /api/v1/positions/:id` | PATCH |
| Trigger search | `POST /api/v1/positions/:id/search-now` | POST |
| Change candidate status | `PATCH /api/v1/candidates/:id/status` | PATCH |
| Send outreach emails | `POST /api/v1/candidates/send-outreach` | POST |
| Load interview kit | `GET /api/v1/positions/:id/interview-kit` | GET |
| Generate interview kit | `POST /api/v1/positions/:id/interview-kit/generate` | POST |
| Load interviews | `GET /api/v1/interviews/position/:id` | GET |
| Schedule interview | `POST /api/v1/interviews/` | POST |
| Load activity | `GET /api/v1/dashboard/activity?position_id=:id` | GET |
| Add comment | `POST /api/v1/pipeline-events` (comment type) | POST |
