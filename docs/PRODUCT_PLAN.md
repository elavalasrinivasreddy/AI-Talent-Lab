# AI Talent Lab — Product Plan
> **Version 2.1 — Finalized**
> Single source of truth for all team members. Read this before building anything.

---

## 1. What We Are Building

AI Talent Lab is a **conversational AI hiring platform**. The primary interface is a chat window — recruiters talk to the system, the system does the work. The dashboard is secondary — a visibility and management layer, not the work layer.

**One-line pitch:**
> "An AI hiring copilot that creates job descriptions through conversation, finds matching candidates, manages outreach, and tracks the full hiring pipeline — with humans in control of every decision."

---

## 2. Core Philosophy

| Principle | What It Means |
|---|---|
| **Chat is the work layer** | Recruiters interact via conversation, not forms |
| **AI assists, humans decide** | AI drafts, suggests, enriches — never auto-rejects or auto-hires |
| **Company-first** | Candidate data belongs to the org — no global candidate identity |
| **Magic links over logins** | Candidates and panel members use time-limited links — no accounts |
| **Department isolation always** | Every record and query scoped to org + department |
| **Transparency via communication** | Candidates receive status updates at every stage — no ghosting |

---

## 3. The Problem We Solve

- Recruiters spend 60–70% of time on repetitive tasks: writing JDs, searching portals, sending emails
- Candidates experience silence — no updates, no feedback, no closure
- Panel members give inconsistent feedback with no structure
- Hiring managers have no pipeline visibility until too late
- Existing ATS tools manage data but don't do the work

**We do the work.**

---

## 4. Who Uses This Platform

### Platform Users (authenticated)
| Role | What They Do |
|---|---|
| **Org Admin** | Manages org settings, departments, team. Full visibility across all departments. |
| **Recruiter / HR** | Uses chat to create JDs, sources candidates, manages pipeline, tracks interviews |
| **Hiring Manager** | Views positions and candidates in their department. Changes status on assigned positions. |

### External Users (magic link only — no login)
| Role | What They Do |
|---|---|
| **Panel Member** | Clicks magic link in interview invitation. Views candidate resume + JD. Submits structured feedback. |
| **Candidate** | Clicks magic link in outreach email. Chat-based application. Receives status update emails. |

---

## 5. Three Interface Layers

```
1. RECRUITER CHAT         — Where JDs are created and hiring workflow is initiated
2. RECRUITER DASHBOARD    — Pipeline tracking, candidate management, analytics
3. CANDIDATE CHAT         — Magic link chat for application and updates
```

Panel members have their own dedicated page (`/panel/:token`) — not one of these three.

---

## 6. End-to-End Workflow

### Phase 1 — JD Creation (Chat)
```
Recruiter opens chat
  → Types role requirements (or uploads existing JD)
  → System validates, asks clarifying questions if needed
  → Internal Skills Check: AI searches past org JDs via ChromaDB
    → Shows additional skills as selectable chips (user accepts or skips)
  → Market Research: AI searches competitor JDs via Tavily
    → Shows market skills as selectable chips (user accepts or skips)
  → System generates 3 JD variants side-by-side (editable inline)
    → User selects one
  → Final JD generated (streamed token-by-token)
  → JD Bias Check: AI scans for biased language (non-blocking)
  → User reviews, can edit or ask AI to refine
  → User clicks "Save & Find Candidates"
  → Position Setup Modal: headcount, search frequency, ATS threshold, priority
  → Position saved → background candidate search triggered
  → Recruiter redirected to Position Detail page
```

### Phase 2 — Candidate Sourcing (Background)
```
Background job (daily by default, configurable):
  → Check talent pool first (pool candidates matching JD)
  → Query candidate source adapter (simulation MVP → real APIs Phase 3)
  → For each candidate found:
      • Check for duplicate within org (email/phone match)
      • If duplicate + updated ≤ 7 days: skip
      • If duplicate + older: update profile
      • If new: create candidate + application records
      • Run semantic ATS scoring (not keyword matching)
  → Categorize: above/below ATS threshold
  → Notify recruiter with results
  → Recruiter decides who to contact
  → Outreach emails sent with magic links
```

### Phase 3 — Candidate Application (Magic Link Chat)
```
Candidate clicks link in outreach email (or finds position on career page)
  → Opens candidate chat interface (no login needed)
  → AI greets by name, confirms interest
  → If not interested: polite close, session ends
  → If interested:
      • Current role/company confirmation
      • Total + relevant experience
      • Current + expected CTC
      • Notice period / availability
      • Resume upload (PDF/DOCX)
      • Dynamic screening questions from org settings
  → Application saved
  → System auto-sends "interview process overview" email
  → Candidate status → Applied
  → Recruiter notified
```

### Phase 4 — Interview Pipeline (Dashboard)
```
Recruiter reviews candidates in Position Detail
  → Views candidate profile (skills match, application, resume)
  → Schedules interview rounds (date, time, panel members, meeting link)
  → System sends invites: candidate (email) + panel members (magic link email)
  → Auto-reminder sent 24h before interview if not already sent
  → Panel members submit feedback via their magic link
  → After all feedback in: recruiter sets round result (passed/rejected)
  → If rejected: system drafts rejection email → recruiter reviews and sends
  → If all rounds passed: recruiter clicks "Mark as Selected"
```

### Phase 5 — Talent Pool (Always Running)
```
When candidate rejected or position closed/archived:
  → Candidate auto-added to org talent pool
When new position created:
  → AI checks pool for matches and suggests them
  → Recruiter can add pool candidates to new pipeline without sourcing
```

---

## 7. Feature List

### Phase 1 (MVP — Build Now)
| # | Feature | Notes |
|---|---|---|
| 1 | Auth & multi-tenancy | org_id + department_id on every table |
| 2 | Organization settings | About Us, culture, benefits — feeds JD generation |
| 3 | Competitor management | Feeds market research step |
| 4 | Screening questions config | Dynamic questions in candidate apply chat |
| 5 | Department + team management | |
| 6 | Recruiter chat — JD generation | 5-stage: intake → internal → market → variants → final |
| 7 | JD Bias Checker | Post-generation, non-blocking |
| 8 | Position Setup Modal | Headcount, search freq, ATS threshold, priority |
| 9 | Background candidate search | Daily (configurable), simulation adapter in MVP |
| 10 | Semantic ATS scoring | Not keyword matching — uses LLM for semantic comparison |
| 11 | Duplicate candidate detection | Email/phone match within org only |
| 12 | Email outreach with magic links | Personalized, tracked |
| 13 | Candidate magic link chat | Chat-based application — NOT a form |
| 14 | Candidate pipeline management | Status tracking, Kanban board, list view |
| 15 | Interview scheduling | Create rounds, assign panels, date/time, meeting link |
| 16 | Panel magic link feedback | Structured form + AI enrichment of rough notes |
| 17 | AI-drafted rejection emails | System drafts, recruiter reviews and sends |
| 18 | Candidate timeline | Unified chronological event feed per candidate |
| 19 | Talent pool | Auto-add on reject/close, bulk upload, AI suggestions |
| 20 | Dashboard & analytics | Stats, funnel, positions list, activity feed |
| 21 | Notifications | In-app alerts for key events |
| 22 | AI Interview Kit | Questions + scorecard template from JD |
| 23 | Career page | Public job board, auto-publishes open positions |
| 24 | Interview debrief generator | AI summary after all rounds complete |

### Phase 2
- Time-to-fill prediction (needs historical data first)
- Candidate-facing status page (email status updates are MVP)
- WhatsApp integration (critical for Indian market)
- Calendar integration (Google/Outlook)
- Self-scheduling links for candidates
- Source effectiveness analytics
- Time-in-stage analysis

### Phase 3
- LinkedIn / Naukri real API integration
- HRIS sync (BambooHR, Zoho People)
- Slack / Teams notifications
- Offer letter generation
- Document checklist / pre-offer collection
- Chrome extension for LinkedIn sourcing
- API & Webhooks for custom integrations

---

## 8. Out of Scope (MVP)

| Feature | Reason |
|---|---|
| Offer letter generation | Legally sensitive, org-specific T&C |
| Document checklist | Complex, org-specific |
| Background verification | Third-party integration complexity |
| Voice/phone AI screening | Replaced by chat via magic link |
| LinkedIn/Naukri real API | ToS complexity — use simulation adapter |
| Calendar integration | Phase 2 |
| WhatsApp | Phase 2 |
| Candidate self-scheduling | Phase 2 |

---

## 9. Data Model — Key Entities

### The Golden Rule
**Every business table has `org_id`. Tables scoped to a department also have `department_id`. Every query filters by both. No exceptions.**

| Entity | Key Points |
|---|---|
| **Organization** | Tenant boundary. `name` and `slug` immutable after registration. |
| **Department** | Sub-unit of org. Users, positions, candidates scoped to dept. |
| **User** | Platform users only. Roles: admin / recruiter / hiring_manager. |
| **Position** | Created via chat. Links to JD, department, assigned recruiter. |
| **JDVariant** | 3 variants per position. One marked selected. |
| **Candidate** | Org-scoped. `UNIQUE(org_id, email)`. Never cross-org. |
| **CandidateApplication** | Candidate ↔ Position link. One per candidate per position. Tracks status + ATS score. |
| **Interview** | Round per candidate per position. Links to panel members. |
| **InterviewPanel** | Panel member per interview. Each gets own magic link token. |
| **Scorecard** | One per panel member per interview. Raw notes + AI-enriched version. |
| **PipelineEvent** | Immutable log of every action. Powers Timeline, analytics, audit. |
| **TalentPool** | Managed via `candidates.in_talent_pool` flag + reason. |
| **ChatSession** | Recruiter's JD creation conversation. Links to position on save. |
| **CandidateSession** | Candidate's magic link chat. Time-limited token. |
| **Notification** | In-app alerts. Linked to user + org. |

---

## 10. Candidate Status State Machine

```
Sourced → Emailed → Applied → Screening → Interview (R1, R2...) → Selected
                                                                 → Rejected
```

**Rules:**
- Any round result = Rejected → system drafts rejection email → recruiter sends
- All rounds passed → recruiter clicks "Mark as Selected" → status = Selected  
- Recruiter can manually reject at any stage (pre-screen, budget mismatch, withdrawal)
- System drafts, human sends — never auto-send rejections

---

## 11. Role Permissions

| Action | Admin | Recruiter | Hiring Manager | Panel (link) | Candidate (link) |
|---|---|---|---|---|---|
| Create positions | ✅ | ✅ | ❌ | ❌ | ❌ |
| Generate JDs via chat | ✅ | ✅ | ❌ | ❌ | ❌ |
| View all dept positions | ✅ | ✅ | ✅ (assigned) | ❌ | ❌ |
| View all org positions | ✅ | ❌ | ❌ | ❌ | ❌ |
| Source + outreach | ✅ | ✅ | ❌ | ❌ | ❌ |
| Change candidate status | ✅ | ✅ | ✅ (assigned) | ❌ | ❌ |
| Schedule interviews | ✅ | ✅ | ✅ | ❌ | ❌ |
| Submit scorecard | ❌ | ❌ | ❌ | ✅ (via link) | ❌ |
| Mark as selected | ✅ | ✅ | ✅ | ❌ | ❌ |
| Send rejection email | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage team | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit org settings | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage talent pool | ✅ | ✅ | ❌ | ❌ | ❌ |
| View dashboard | ✅ (full org) | ✅ (own dept) | ✅ (assigned) | ❌ | ❌ |
| Submit application | ❌ | ❌ | ❌ | ❌ | ✅ (via link) |

---

## 12. Build Order

### Step 1 — Foundation (do first, never skip)
- Multi-tenant architecture with `org_id` + `department_id` on every table
- JWT auth, role middleware, tenant context injection
- Org settings, departments, team management
- API versioning: all routes under `/api/v1/`

### Step 2 — Settings & Configuration
- Organization profile (About Us, culture, benefits — feeds JD gen)
- Competitor management (feeds market research)
- Screening questions (feeds candidate apply chat)
- Message/email templates

### Step 3 — Recruiter Chat + JD Generation
- Full 5-stage agent pipeline (intake → internal check → market → variants → final JD)
- JD bias checker
- Position Setup Modal
- Save position → trigger background search

### Step 4 — Candidate Sourcing + Pipeline
- Background search (simulation adapter)
- Semantic ATS scoring
- Duplicate detection
- Email outreach with magic links
- Candidate pipeline management

### Step 5 — Candidate Apply Chat
- Magic link verification
- Chat-based application flow
- Resume upload
- Auto-send interview process overview email

### Step 6 — Interview + Feedback
- Interview scheduling
- Panel magic link generation + email
- Panel feedback form + AI enrichment
- Scorecard storage
- Round result setting
- Rejection email drafting + sending
- Mark as Selected flow

### Step 7 — Talent Pool
- Auto-add to pool on rejection/close
- Bulk offline resume upload
- AI pool match suggestions
- Add pool candidate to position pipeline

### Step 8 — Dashboard + Analytics
- Stats cards (period selector)
- Hiring funnel
- Positions list
- Activity feed
- Candidate timeline (PipelineEvent based)

### Step 9 — Interview Kit + Career Page + Notifications
- AI interview question generation
- Scorecard template
- Interview debrief generation
- Public career page (auto-publish)
- In-app notification system

---

## 13. Technical Stack

| Layer | Tech | Notes |
|---|---|---|
| Frontend | React 18 + Vite | Split CSS, React Router v6, Context API |
| Backend | FastAPI Python 3.11+ | 3-layer: routers → services → repositories |
| Database (dev) | SQLite + WAL | In `data/` directory (gitignored) |
| Database (prod) | PostgreSQL 16+ | Swap via DATABASE_URL |
| Vector Store | ChromaDB | In `data/chroma/` (gitignored) |
| LLM | Groq / OpenAI / Gemini | Switchable via LLM_PROVIDER env var |
| Web Search | Tavily API | Market research in JD generation |
| Email | Resend / SMTP / Simulation | Adapter pattern |
| Streaming | SSE | Chat token streaming |

---

## 14. Key Developer Rules

1. **Every DB query filters by `org_id`** — if it doesn't, it's a security bug
2. **Never auto-send rejection emails** — system drafts, human sends
3. **Magic links are time-limited and single-use** (panel feedback)
4. **AI enriches, humans decide** — AI output always shown to user before acting
5. **Adapter pattern for all external services** — never hardcode a provider
6. **Background tasks for long operations** — search, scoring, email blasts
7. **PipelineEvent for every meaningful action** — this powers Timeline + analytics
8. **Department isolation from day one** — adding it later requires touching everything
9. **API versioning** — all routes under `/api/v1/` from day one
