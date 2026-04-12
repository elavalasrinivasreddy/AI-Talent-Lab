# Page Design: Position Detail

> Deep-dive into a single position — pipeline board, candidate list, JD view, interview kit, and team collaboration.

---

## 1. Overview

| Aspect | Detail |
|--------|--------|
| Route | `/positions/:id` |
| Auth | Required (JWT) |
| Entry Point | Dashboard → click position card |
| Layout | Sidebar + Full-width detail page with tabs |

---

## 2. Page Layout

```
┌──────┬──────────────────────────────────────────────────────────┐
│      │  ┌─ Header ─────────────────────────────────────────┐   │
│      │  │ ← Dashboard                                      │   │
│      │  │                                                   │   │
│      │  │ Senior Python Developer          Status: [Open ▼] │   │
│      │  │ Engineering · Created Apr 5 · by Srinivas         │   │
│      │  │ Priority: 🔴 Urgent  ·  Headcount: 2             │   │
│      │  └──────────────────────────────────────────────────┘   │
│ S    │                                                          │
│ I    │  ┌─ Stats Row ──────────────────────────────────────┐   │
│ D    │  │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐     │   │
│ E    │  │ │ 👥 24  │ │ 📧 18  │ │ 📝 8   │ │ 🎙️ 3  │     │   │
│ B    │  │ │Sourced │ │Emailed │ │Applied │ │Interv. │     │   │
│ A    │  │ └────────┘ └────────┘ └────────┘ └────────┘     │   │
│ R    │  └──────────────────────────────────────────────────┘   │
│      │                                                          │
│      │  ┌─ Tabs ───────────────────────────────────────────┐   │
│      │  │ [Pipeline][Candidates][JD][Interview Kit][Activity][Settings]│
│      │  └──────────────────────────────────────────────────┘   │
│      │                                                          │
│      │  ┌─ Tab Content (Pipeline shown) ───────────────────┐   │
│      │  │                                                   │   │
│      │  │  (See section 3 for each tab's content)          │   │
│      │  │                                                   │   │
│      │  └──────────────────────────────────────────────────┘   │
└──────┴──────────────────────────────────────────────────────────┘
```

---

## 3. Tab Content

### 3.1 Pipeline Tab (Kanban Board)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Candidate Pipeline                            │
│                                                                  │
│ Sourced (8)  │ Emailed (6)  │ Applied (4)  │ Interview (2) │ ✅ │
│ ──────────── │ ──────────── │ ──────────── │ ────────────── │ ── │
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐  │   │
│ │ Rahul K  │ │ │ Priya S  │ │ │ Amit R   │ │ │ Sanya M  │  │   │
│ │ 85% match│ │ │ 78% match│ │ │ 92% match│ │ │ 88% match│  │   │
│ │ TechCorp │ │ │ InfoSys  │ │ │ Flipkart │ │ │ Google   │  │   │
│ │ 6 yrs    │ │ │ 4 yrs    │ │ │ 7 yrs    │ │ │ 5 yrs    │  │   │
│ └──────────┘ │ └──────────┘ │ └──────────┘ │ └──────────┘  │   │
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │              │   │
│ │ Neha P   │ │ │ Arjun T  │ │ │ Lisa W   │ │              │   │
│ │ 72% match│ │ │ 81% match│ │ │ 81% match│ │              │   │
│ │ Wipro    │ │ │ Amazon   │ │ │ Microsoft│ │              │   │
│ │ 3 yrs    │ │ │ 5 yrs    │ │ │ 8 yrs    │ │              │   │
│ └──────────┘ │ └──────────┘ │ └──────────┘ │              │   │
│              │              │              │              │   │
└──────────────┴──────────────┴──────────────┴──────────────┴───┘
```

**Interactions:**
- Each candidate card is clickable → opens Candidate Detail Page
- Drag & drop cards between columns to change status (future enhancement)
- Status change dropdown on each card (click "..." menu → move to...)
- Column header shows count
- Horizontal scroll if many columns don't fit screen
- Color-coded column borders matching stage colors

### 3.2 Candidates Tab (List View)

```
┌─────────────────────────────────────────────────────────────────┐
│  [Status ▼] [Score ▼] [Source ▼] [🔍 Search]     [📧 Email All] │
│                                                                  │
│  ☐ │ Name         │ Score │ Status    │ Source     │ Experience  │
│  ──┼──────────────┼───────┼───────────┼────────────┼────────────│
│  ☐ │ Amit R       │ 92%   │ 📝Applied│ simulation │ 7 years    │
│  ☐ │ Sanya M      │ 88%   │ 🎙️Interv│ simulation │ 5 years    │
│  ☐ │ Rahul K      │ 85%   │ 🔍Sourced│ simulation │ 6 years    │
│  ☐ │ Arjun T      │ 81%   │ 📧Emailed│ simulation │ 5 years    │
│  ☐ │ Lisa W       │ 81%   │ 📝Applied│ simulation │ 8 years    │
│                                                                  │
│  ☐ Select all  │  With selected: [📧 Email] [⏭️ Status ▼]       │
│                                                                  │
│  [← Prev]  Page 1 of 3  [Next →]                               │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Sortable columns (click header to sort)
- Checkbox column for bulk actions
- Bulk actions: send email, change status
- Click row → Candidate Detail Page
- Score column: color-coded (≥80 green, 60–79 yellow, <60 red)

### 3.3 JD Tab

```
┌─────────────────────────────────────────────────────────────────┐
│  📄 Job Description                      [✏️ Edit] [📥 Download]│
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  # Senior Python Developer                                      │
│                                                                  │
│  ## About {Organization}                                        │
│  We are a leading technology company...                          │
│                                                                  │
│  ## Role Overview                                               │
│  We are seeking an experienced Python developer...              │
│                                                                  │
│  ## Responsibilities                                            │
│  - Design and develop backend systems...                         │
│  - ...                                                          │
│                                                                  │
│  ## Requirements                                                │
│  **Must-Have:**                                                 │
│  - 5+ years of Python...                                        │
│  - ...                                                          │
│                                                                  │
│  (rendered markdown)                                             │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Read-only rendered markdown by default
- Edit mode: switch to textarea with raw markdown
- Download: PDF or Markdown
- JD shows the org-specific "About Us" section pulled from settings
- "View original chat" link → navigates to the chat session

### 3.5 Interview Kit Tab

```
┌─────────────────────────────────────────────────────────────────┐
│  🎯 Interview Kit           [🔄 Regenerate] [📤 Share Link]    │
│                                                                  │
│  ── Technical Questions (5) ─────────────────────────────────   │
│  1. Explain how Python's GIL affects multithreading...
│     Difficulty: Senior │ Expected: Memory management context...
│  2. Design a rate-limiting middleware in FastAPI...
│     Difficulty: Senior │ Expected: Token bucket algorithm...
│                                                                  │
│  ── Behavioral Questions (3) ────────────────────────────────   │
│  1. Describe a time you had to debug a production issue...
│     Expected: STAR format, shows ownership...
│                                                                  │
│  ── Scorecard Template ──────────────────────────────────────   │
│  Dimensions: Technical (40%), Problem Solving (25%),            │
│  Communication (20%), Culture Fit (15%)                         │
│  [✏️ Edit Dimensions]                                           │
└─────────────────────────────────────────────────────────────────┘
```

- **Generated by AI** after JD is finalized (or manually triggered)
- Questions grouped by: Technical, Behavioral, Situational, Culture Fit
- Each question has difficulty level and expected answer guidelines
- Scorecard template auto-generated from JD but editable
- **Share Link** — creates a token-based URL for interviewers who may not have full access

### 3.6 Activity Tab (Team Collaboration)

```
┌─────────────────────────────────────────────────────────────────┐
│  📜 Activity Feed                    [Filter: All ▼]            │
│                                                                  │
│  Apr 12, 15:30  💬 @Neha P commented on Priya Sharma           │
│                 "Strong technical skills, recommend round 2"    │
│                                                                  │
│  Apr 12, 14:00  📝 Raj K submitted scorecard for Priya S       │
│                 Overall: 4.2/5 │ Recommendation: Yes            │
│                                                                  │
│  Apr 11, 10:00  📅 Interview scheduled: Priya S — Technical    │
│                 Apr 12, 2PM │ With: Raj K, Neha P               │
│                                                                  │
│  Apr 10, 14:32  📝 Amit R applied via magic link               │
│                                                                  │
│  ── Add Comment ──────────────────────────────────────────────  │
│  ┌──────────────────────────────────────────────────────┐      │
│  │ Write a comment... @mention team members    [Post]  │      │
│  └──────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

- Shows ALL activity on this position: comments, status changes, emails, scorecards, interviews
- **@mention** support — type `@` to see team members, mention generates notification
- Filter by: All, Comments Only, Emails, Scorecards, Status Changes

### 3.7 Settings Tab

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚙️ Position Settings                                          │
│                                                                  │
│  ┌── Auto Search ──────────────────────────────────────────┐   │
│  │  🔄 Automatically search for new candidates             │   │
│  │  Frequency: [Every 72 hours ▼]                          │   │
│  │  Last searched: Apr 10, 2026 at 14:30                   │   │
│  │  [🔍 Search Now]  [⏸ Pause]                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌── ATS Threshold ────────────────────────────────────────┐   │
│  │  Minimum match score: [80] %                            │   │
│  │  Candidates below this will be flagged                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌── Position Details ─────────────────────────────────────┐   │
│  │  Headcount: [2]                                         │   │
│  │  Priority: [Urgent ▼]                                   │   │
│  │  Deadline: [2026-05-15]                                 │   │
│  │  Assigned to: [Srinivas ▼]                              │   │
│  │  Department: [Engineering ▼]                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  [💾 Save Changes]                                              │
│                                                                  │
│  ┌── Danger Zone ──────────────────────────────────────────┐   │
│  │  [🟡 Put on Hold]  [🔴 Close Position]  [🗑️ Archive]    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Backend Integration

| Action | API Endpoint | Method |
|--------|-------------|--------|
| Load position | `/api/positions/:id` | GET |
| Load pipeline | `/api/dashboard/pipeline/:id` | GET |
| Load candidates | `/api/candidates/position/:id` | GET |
| Update status | `/api/positions/:id` | PATCH |
| Update settings | `/api/positions/:id/search-config` | PATCH |
| Trigger search | `/api/positions/:id/search-now` | POST |
| Change candidate status | `/api/candidates/:id/status` | PATCH |
| Send messages | `/api/candidates/send-messages-async` | POST |
| Load interview kit | `/api/interview-kit/position/:id` | GET |
| Generate interview kit | `/api/interview-kit/position/:id/generate` | POST |
| Share interview kit | `/api/interview-kit/position/:id/share-link` | GET |
| Load comments | `/api/comments/position/:id` | GET |
| Add comment | `/api/comments/position/:id` | POST |
| Schedule interview | `/api/interviews/` | POST |
| Load interviews | `/api/interviews/position/:id` | GET |

---

## 5. Status Management

| Position Status | Color | Actions Available |
|----------------|-------|-------------------|
| Draft | Gray | Open, Delete |
| Open | Green | On Hold, Close, Search |
| On Hold | Yellow | Reopen, Close |
| Closed | Red | Archive, Reopen |
| Archived | Dark gray | Delete (admin only) |
