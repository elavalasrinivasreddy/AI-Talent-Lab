# Page Design: Candidate Detail

> Full profile of a single candidate — skills match, scorecards, communication thread, and interview history.

---

## 1. Overview

| Aspect | Detail |
|--------|--------|
| Route | `/candidates/:id` |
| Auth | Required (JWT) |
| Entry Point | Position Detail → click candidate card/row |
| Layout | Sidebar + Full-width detail page |

---

## 2. Page Layout

```
┌──────┬──────────────────────────────────────────────────────────┐
│      │  ┌─ Header ─────────────────────────────────────────┐    │
│      │  │ ← Sr Python Developer Pipeline                   │    │
│      │  └──────────────────────────────────────────────────┘    │
│      │                                                          │
│ S    │  ┌─ Profile Card ───────────────────────────────────┐    │
│ I    │  │                                                  │    │
│ D    │  │  👤  Rahul Kumar                   Match: 92%    │    │
│ E    │  │      Senior Python Developer at TechCorp         │    │
│ B    │  │                                                  │    │
│ A    │  │  📧 rahul.kumar@example.com                      │    │
│ R    │  │  📱 +91-98765-43210                              │    │
│      │  │  📍 Bangalore, India                             │    │
│      │  │  💼 6 years experience                           │    │
│      │  │  🔗 linkedin.com/in/rahulk (if available)        │    │
│      │  │                                                  │    │
│      │  │  Status: [Applied ▼]                             │    │
│      │  │                                                  │    │
│      │  │  [📧 Send Email] [🗒️ Add Note] [⏭️ Move to Next] │    │
│      │  │                                                  │    │
│      │  └──────────────────────────────────────────────────┘    │
│      │                                                          │
│      │  ┌─ Tabs ───────────────────────────────────────────┐    │
│      │  │ [Skills][Application][Resume][Interviews][Comms][History]│
│      │  └──────────────────────────────────────────────────┘    │
│      │                                                          │
│      │  ┌─ Tab Content ───────────────────────────────────┐     │
│      │  │  (see section 3 for each tab)                   │     │
│      │  └─────────────────────────────────────────────────┘     │
└──────┴──────────────────────────────────────────────────────────┘
```

---

## 3. Tab Content

### 3.1 Skills Match Tab

```
┌─────────────────────────────────────────────────────────────────┐
│  🎯 Skills Assessment                     Score: 92%            │
│                                                                 │
│  ┌── Score Visualization ──────────────────────────────────┐    │
│  │  ████████████████████████████████████░░░░  92/100       │    │
│  │  Recommendation: ✅ Strong Match                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ✅ Matched Skills (8)                                          │
│  ┌─────────────────────────────────────────────┐                │
│  │ Python · FastAPI · Docker · AWS · React ·   │                │
│  │ PostgreSQL · Redis · CI/CD                   │               │
│  └─────────────────────────────────────────────┘                │
│                                                                 │
│  ❌ Missing Skills (2)                                          │
│  ┌─────────────────────────────────────────────┐                │
│  │ Kubernetes · Terraform                       │               │
│  └─────────────────────────────────────────────┘                │
│                                                                 │
│  ➕ Additional Skills (3)                                       │
│  ┌─────────────────────────────────────────────┐                │
│  │ GraphQL · MongoDB · Kafka                    │               │
│  └─────────────────────────────────────────────┘                │
│                                                                 │
│  💬 Experience Analysis                                         │
│  "6 years of backend development with strong Python expertise.  │
│   Experience with microservices architecture at TechCorp.       │
│   Well-suited for senior-level independent work."               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Design:**
- Large score circle or progress bar at top
- Matched skills: green chips
- Missing skills: red chips
- Additional skills: blue chips
- Experience analysis: LLM-generated paragraph from ATS scorer
- Recommendation badge: "Strong Match" (green), "Good Match" (yellow), "Partial Match" (orange), "Weak Match" (red)

### 3.2 Application Tab

```
┌─────────────────────────────────────────────────────────────────┐
│  📝 Application Details              Applied: Apr 10, 2026      │
│                                                                 │
│  Previous Company       TechCorp Pvt Ltd                        │
│  Notice Period          30 days                                 │
│  Total Experience       6 years                                 │
│  Relevant Experience    4 years                                 │
│  Current Salary         ₹18,00,000 per annum                    │
│  Expected Salary        ₹24,00,000 per annum                    │
│  Availability           Immediate after notice                  │
│  Interview Availability Mon–Fri, 10am–6pm                       │
│  Additional Info        "Open to relocation to Hyderabad"       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Shows only if candidate has submitted an application
- If not applied yet, show: "No application submitted. Candidate was sourced but hasn't applied yet."
- Fields are read-only

### 3.3 Resume Tab

```
┌─────────────────────────────────────────────────────────────────┐
│  📄 Resume                              [📥 Download Original]  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  (Rendered resume_text as formatted content)                    │
│                                                                 │
│  Experienced Python developer with 6 years of backend           │
│  development experience. Currently working as Senior            │
│  Developer at TechCorp, building microservices with FastAPI     │
│  and deploying on AWS ECS. Skilled in database design,          │
│  API development, and DevOps practices...                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Renders `resume_text` field as formatted text
- If resume file was uploaded, show download link
- If sourced candidate (no resume file), show the `resume_summary` from sourcing

### 3.4 History Tab

```
┌─────────────────────────────────────────────────────────────────┐
│  📜 Activity History                                            │
│                                                                 │
│  Also applied for:                                              │
│  • Backend Developer (Engineering) — Score: 78%                 │
│                                                                 │
│  Timeline:                                                      │
│  ──────────────────────────────────────────────────────────     │
│                                                                 │
│  Apr 10, 14:32  📝 Applied via magic link                       │
│                 Submitted screening form                        │
│                                                                 │
│  Apr 09, 11:15  📧 Outreach email sent                          │
│                 "Exciting opportunity: Sr Python Dev at..."     │
│                                                                 │
│  Apr 09, 11:00  🤖 ATS Score: 92% (Strong Match)                │
│                 Matched 8/10 required skills                    │
│                                                                 │
│  Apr 09, 10:45  🔍 Sourced via simulation                       │
│                 Found by background candidate search            │
│                                                                 │
│  ── Notes ──────────────────────────────────────────────────    │
│  No recruiter notes yet.                                        │
│  ┌──────────────────────────────────────────────────────┐       │
│  │ Add a note...                               [Save]   │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Cross-position tracking: shows all positions this candidate has been linked to
- Reverse-chronological activity timeline
- Each event: timestamp, icon, description, detail
- Notes section: add free-text notes (recruiter observations)
- Email log: shows all emails sent to this candidate

### 3.5 Interviews Tab

```
┌─────────────────────────────────────────────────────────────────┐
│  🎙️ Interview Rounds                  [+ Schedule Interview]   │
│                                                                 │
│  ── Round 1: Technical ─────────────────────────────────────    │
│  📅 Apr 12, 2:00 PM │ 60 min │ Google Meet                     │
│  Interviewers: Raj K, Neha P                                    │
│  Status: ✅ Completed │ Feedback: Complete                      │
│                                                                 │
│  Scorecards:                                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Raj K:    Technical: 4 │ Problem: 5 │ Comm: 4 │ Fit: 3 │    │
│  │           Overall: 4.2/5 │ Rec: ✅ Yes                  │    │
│  │ Neha P:   Technical: 4 │ Problem: 4 │ Comm: 5 │ Fit: 4 │    │
│  │           Overall: 4.2/5 │ Rec: ✅ Yes                  │    │
│  │           Avg: 4.2/5                                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ── Round 2: Manager ───────────────────────────────────────    │
│  📅 Apr 15, 11:00 AM │ 45 min │ Google Meet                    │
│  Interviewer: VP Engineering                                    │
│  Status: 📅 Scheduled │ Feedback: Pending                      │
│                                                                 │
│  ── Round 3: HR ──────────────────────── (not scheduled) ──     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Shows all interview rounds chronologically
- Each round: date/time, interviewers, meeting link, scorecard summary
- Scorecards expand to show per-interviewer ratings
- "Schedule Interview" opens modal with calendar integration
- Visually highlight current/upcoming round

### 3.6 Communication Tab

```
┌─────────────────────────────────────────────────────────────────┐
│  💬 Communication Thread          Channel: [All ▼]              │
│                                                                 │
│  📧 Apr 9, 11:15  ───────────────────────── OUTBOUND ────────  │
│  Subject: Exciting opportunity at {Org}                         │
│  Hi Rahul, we found your profile impressive for our Senior      │
│  Python Developer role...                                       │
│  Status: ✅ Delivered · Opened Apr 9 at 14:20                   │
│                                                                 │
│  📧 Apr 11, 10:00  ──────────────────────── OUTBOUND ────────  │
│  Subject: Re: Following up — Sr Python Dev role                 │
│  Just checking in, Rahul. We'd love to hear back...             │
│  Status: ✅ Delivered · Link clicked Apr 11 at 14:32            │
│                                                                 │
│  📱 Apr 12, 09:00  ──────────────────────── OUTBOUND ────────  │
│  WhatsApp: "Hi Rahul! Your technical round is scheduled for     │
│  tomorrow at 2 PM. Here's the Meet link: ..."                   │
│  Status: ✅ Read                                                │
│                                                                 │
│  ── Compose ────────────────────────────────────────────────    │
│  Channel: [Email ▼]  Template: [Custom ▼]                       │
│  ┌──────────────────────────────────────────────────────┐       │
│  │ Type a message...                          [Send]     │       │
│  └──────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

- Unified thread view: all emails, WhatsApp messages, SMS in one timeline
- Filter by channel (email, WhatsApp, All)
- Shows delivery status per message (queued → sent → delivered → read)
- Compose new message with template selection
- Magic link click timestamps visible

---

## 4. Quick Actions (Header)

| Action | Behavior |
|--------|----------|
| **📧 Send Message** | Opens compose modal (email or WhatsApp) |
| **🗒️ Add Note** | Scrolls to notes section in History tab |
| **⏭️ Move to Next** | Status dropdown → move to next stage |
| **📅 Schedule Interview** | Opens interview scheduling modal |
| **🏊 Add to Talent Pool** | Saves candidate to org-wide talent pool |
| **Status dropdown** | Change status: sourced → emailed → applied → screening → interview → selected/rejected |

---

## 5. Backend Integration

| Action | API Endpoint | Method |
|--------|-------------|--------|
| Load candidate | `/api/candidates/:id` | GET |
| Update status | `/api/candidates/:id/status` | PATCH |
| Add note | `/api/candidates/:id/notes` | PATCH |
| Send message | `/api/communications/send` | POST |
| Get communications | `/api/communications/candidate/:id` | GET |
| Get activity | `/api/candidates/:id/history` | GET |
| Get tags | `/api/candidates/:id/tags` | GET |
| Add tag | `/api/candidates/:id/tags` | POST |
| Add to talent pool | `/api/talent-pool/:id/add` | POST |
| Schedule interview | `/api/interviews` | POST |
| Get interviews | `/api/interviews/candidate/:id` | GET |
| Get scorecards | `/api/interviews/candidate/:id/scorecards` | GET |
| Add comment | `/api/comments/candidate/:id` | POST |
