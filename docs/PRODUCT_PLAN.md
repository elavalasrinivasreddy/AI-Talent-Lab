# AI Talent Lab — Product Plan

> **AI-powered SaaS recruitment platform that helps organizations generate intelligent JDs, source candidates, and manage hiring pipelines through conversational AI.**

---

## 1. Product Vision

AI Talent Lab reimagines how companies hire. Instead of juggling spreadsheets, job portals, and disconnected tools, recruiters open a single chat interface and the AI walks them through the entire hiring journey — from defining what they need, to finding who fits, to managing pipelines and extending offers.

**Core belief**: Hiring should be an intelligent, guided conversation — not a tedious manual process.

---

## 2. Target Market

| Segment | Description | Why They Need Us |
|---------|-------------|------------------|
| **Startups (5–50 people)** | Small HR team, often founder-led hiring | No dedicated ATS, need AI to fill the gap |
| **SMBs (50–500 people)** | Growing fast, 1–5 recruiters | Existing tools expensive, need efficiency |
| **Mid-Market (500–2000)** | Multiple departments, structured hiring | Need department isolation, audit trails |
| **Enterprises (2000+)** | Large teams, compliance requirements | Phase 2 target — enterprise features later |

**Primary persona**: Recruiters and Hiring Managers who write JDs, source candidates, and manage interview pipelines.

---

## 3. Multi-Tenancy & Data Isolation

This is a **SaaS product** — every organization is a tenant.

```
Organization (Tenant)
├── Departments (org sub-units)
│   ├── Team Members (users scoped to department)
│   ├── Positions (hiring requests)
│   │   ├── Candidates (linked to position)
│   │   └── Chat Sessions (JD generation history)
│   └── Department-level settings
├── Org-level Settings (About Us, competitors, integrations)
└── Shared Resources (skills taxonomy, email templates)
```

**Role Hierarchy & Isolation Rules**:
- **Org Admin (Manager / Director of HR)**: Has global access across the entire organization. Can see all departments, positions, and analytics. Responsible for creating departments and adding **Sub-Managers (Department Leads)**.
- **Sub-Manager (Department Lead)**: Has full access *only within their assigned department*. Can invite/deactivate their own team members (basic email, name, role) within their department. Cannot see data from other departments.
- **Team Member (Recruiter)**: Users see positions they created or are assigned to, within their department.

---

## 4. Core Features & Modules

### Module 1: Chat-Based JD Generation
The heart of the product. A conversational AI interface where the recruiter provides requirements and the system generates a production-ready JD.

**Flow**:
1. **Requirements Intake** — AI interviewer gathers role details through natural conversation
2. **Reference JD Upload** — Optional: upload an existing JD and AI extracts requirements
3. **Internal Skills Check** — System searches past JDs within the same org for similar roles, finds missing skills
4. **Market Benchmarking** — AI searches competitor JDs and industry trends, suggests differential skills
5. **JD Variant Selection** — System generates 3 JD style variants (Skill-Focused, Outcome-Focused, Hybrid)
6. **Final JD Generation** — AI drafts the complete JD with org's "About Us" section
7. **Save & Open Position** — JD is saved, position is created, candidate sourcing begins

**Key Design Decisions**:
- Chat is the primary input method — no complex forms
- Each stage requires user confirmation before proceeding (human-in-the-loop)
- JD includes org-specific branding (About Us, culture, benefits) pulled from settings
- Multiple AI agents specialize in different stages (not one monolithic agent)

### Module 2: Candidate Sourcing & Scoring
After JD is finalized, the system finds matching candidates.

**Flow**:
1. **Background Search** — System searches job portals (LinkedIn, Naukri, Monster) for candidates matching JD requirements
2. **ATS Scoring** — AI scores each candidate's resume against JD (matched skills, missing skills, score percentage)
3. **Candidate List** — Results appear under the position with filters (score, source, experience)
4. **Email Outreach** — Send personalized outreach emails with magic links to interested candidates
5. **Application Collection** — Candidates click magic link, see JD, fill screening form (notice period, salary expectations, etc.)

**Key Design Decisions**:
- Candidate search is a background task (takes 3–10 minutes)
- Notification when search completes
- Auto-search can be scheduled (e.g., every 72 hours) to find new candidates
- Candidate data is linked to position, not globally shared (privacy)
- Simulation adapter for development/demo; real API adapters for production

### Module 3: Hiring Pipeline Management
Track candidates through the hiring process with team collaboration.

**Pipeline Stages**:
```
Sourced → Emailed → Applied → Screening → Interview → Selected / Rejected / On Hold
```

**Features**:
- Kanban board view per position
- Drag-and-drop status changes
- Candidate detail page with full profile, skills match, application data, activity history
- Bulk actions (email, status change)
- **Team collaboration**: comments on candidates, @mentions, shared evaluation notes
- **Activity feed**: who did what, when — visible to all team members on the position

### Module 4: Dashboard & Analytics
The home screen for recruiters with advanced analytics.

**Sections**:
- **Summary Cards** — Open positions, total candidates, emails sent, applications received
- **Hiring Funnel** — Visual funnel chart showing conversion at each stage
- **Activity Timeline** — Recent events (new applications, search completions, status changes)
- **Positions List** — Filterable table of all positions with stats
- **Quick Actions** — New Hire, Recent Drafts
- **Source Effectiveness** — Which portal yields highest quality candidates
- **Time-in-Stage** — Where candidates get stuck in the pipeline
- **Recruiter Performance** — Positions filled, average time-to-fill (admin only)

### Module 5: Settings & Administration
Organization and user management.

**Tabs**:
- **Profile** — User's personal info, password change
- **Organization** — Name (read-only after registration), About Us, website, logo, industry, size, culture keywords, benefits template, social links
- **Team Members** — Add/deactivate users, assign roles and departments (admin only)
- **Departments** — Department CRUD with hierarchy
- **Competitors** — Manage competitor list (user chooses top 3 per search)
- **Screening Questions** — Configure dynamic application form fields (per department)
- **Email Templates** — Customize outreach, follow-up, rejection, offer email templates
- **Interview Templates** — Scorecard templates for structured evaluation
- **Integrations** — API keys for job portals, WhatsApp Business, calendar
- **Appearance** — Theme (dark/light/system)
- **Security** — Password policy, session management, 2FA (future)

### Module 6: Public Application Page
Where candidates land after clicking the magic link in their outreach email.

**Features**:
- No authentication required (public page, secured via signed token)
- Shows role title, JD, org info
- **Dynamic screening form** — Questions configured by admin/team at department level from settings
- Confirmation after submission
- Link expires after 72 hours

### Module 7: AI Interview Kit
Auto-generate interview content from the finalized JD — our **killer differentiator**.

**Features**:
- **AI-generated interview questions** grouped by category:
  - Technical screening (from JD skill requirements)
  - Behavioral questions (mapped to soft skills)
  - Situational questions (based on role responsibilities)
  - Culture fit questions (from org culture keywords in settings)
- **Difficulty levels** — Junior / Mid / Senior calibration
- **Expected answer guidelines** — What a good answer looks like
- **Interview scorecards** — Structured evaluation templates auto-generated from JD
  - Rating dimensions: technical, communication, problem-solving, culture fit (1-5)
  - Per-interviewer scorecards (independent submission, avoid groupthink)
  - Aggregate score view for comparison
- **Export/share** — Share interview kit with hiring managers and interviewers

**Key Design Decision**: This flows directly from JD generation — nearly zero additional data needed. Just another LLM prompt chain.

### Module 8: Communication Hub
Upgrade from one-shot emails to a full communication platform.

**Features**:
- **Email thread view** — Full conversation history per candidate
- **Automated follow-ups** — Configurable drip sequence (e.g., no click in 48h → reminder)
- **Email template library** — Outreach, follow-up, rejection, offer, custom
- **WhatsApp integration** — Send outreach via WhatsApp Business API (critical for Indian market)
- **SMS fallback** — For candidates without WhatsApp
- **Communication preferences** — Let candidates choose: email, WhatsApp, or phone
- **Scheduled sends** — Send at optimal time (e.g., 10 AM IST on weekdays)

### Module 9: Talent Pool / CRM
Never lose a good candidate — build a reusable talent database.

**Features**:
- **Talent Pool** — Candidates who were rejected, passed-over, or pipeline-completed are saved
- **Auto-suggest from pool** — When a new position opens, AI suggests matching candidates from pool before sourcing new ones
- **Candidate re-engagement** — "We have a new opening that might fit" campaigns
- **Tags & notes** — Free-form tags ("strong communicator", "relocation needed")
- **Deduplication** — Same candidate from multiple sources or positions → merge profiles
- **Search & filter** — Search across all historical candidates by skills, location, experience

**Key Design Decision**: Talent pool candidates are org-level (not position-level). A candidate rejected for Position A might be perfect for Position B.

### Module 10: Interview Scheduling
Built-in scheduling — no external Calendly needed.

**Features**:
- **Calendar sync** — Google Calendar / Outlook integration
- **Self-scheduling links** — Send candidate a link, they pick an available slot
- **Multi-round scheduling** — Round 1 (Technical) → Round 2 (Manager) → HR → Final
- **Interviewer availability** — Show free/busy for internal team members
- **Automated reminders** — 24h and 1h before (both candidate + interviewer)
- **Video call links** — Auto-generate Google Meet / Zoom link per interview
- **Reschedule/cancel** — Self-service for candidates with notification to team

### Module 11: Career Page & Job Board
Public-facing page showing all open positions for organic applications.

**Features**:
- **Public career page** — `aitalentlab.com/{org}/careers` (or custom domain later)
- **All open positions** with filters (department, location, work type)
- **Direct apply** — Candidates submit resume + screening form without outreach
- **SEO optimized** — Each position is a shareable URL with meta tags
- **Embed widget** — Code snippet orgs can put on their own website
- **Branded** — Org logo, colors, About Us section

---

## 5. Information Architecture

### 5.1 Immutable Fields (set at registration, cannot change)
- Organization Name (unique tenant identifier)
- Primary Admin Email
- Organization ID (internal)

### 5.2 Position Data Model
| Field | Type | Description |
|-------|------|-------------|
| `role_name` | string | Job title |
| `jd_markdown` | text | Full JD content |
| `status` | enum | draft / open / on_hold / closed / archived |
| `priority` | enum | urgent / high / normal / low |
| `headcount` | int | Number of openings |
| `location` | string | Work location |
| `work_type` | enum | remote / hybrid / onsite |
| `experience_min/max` | int | Years range |
| `salary_min/max` | decimal | Compensation range |
| `currency` | string | INR, USD, EUR, etc. |
| `employment_type` | enum | full_time / contract / intern |
| `ats_threshold` | float | Minimum match score (default 80) |
| `search_interval_hours` | int | Auto-search frequency (null = manual only) |
| `deadline` | date | Target fill date |
| `department_id` | FK | Department this position belongs to |
| `created_by` | FK | User who created it |
| `assigned_to` | FK | Recruiter handling this position |

### 5.3 Candidate Data Model
| Field | Type | Description |
|-------|------|-------------|
| `name, email, phone` | string | Contact info |
| `resume_text` | text | Parsed resume content |
| `source` | enum | linkedin / naukri / monster / upload / manual |
| `skill_match_score` | float | ATS score (0–100) |
| `status` | enum | sourced / emailed / applied / screening / interview / selected / rejected / on_hold |
| `screening_data` | JSON | Full ATS breakdown (matched, missing, extra skills) |
| `position_id` | FK | Which position they're linked to |

---

## 6. User Roles & Permissions

| Action | Admin | Recruiter | Hiring Manager | Interviewer |
|--------|-------|-----------|----------------|-------------|
| View all org data | ✅ | ❌ (dept only) | ❌ (dept only) | ❌ |
| Create positions | ✅ | ✅ | ❌ | ❌ |
| Generate JDs | ✅ | ✅ | ✅ (request only) | ❌ |
| Source candidates | ✅ | ✅ | ❌ | ❌ |
| Send emails/messages | ✅ | ✅ | ❌ | ❌ |
| Change candidate status | ✅ | ✅ | ✅ (assigned only) | ❌ |
| Submit scorecards | ✅ | ✅ | ✅ | ✅ (assigned) |
| View interview kit | ✅ | ✅ | ✅ | ✅ (assigned) |
| Comment on candidates | ✅ | ✅ | ✅ | ✅ (assigned) |
| Schedule interviews | ✅ | ✅ | ✅ | ❌ |
| Manage talent pool | ✅ | ✅ | ❌ | ❌ |
| Manage team | ✅ | ❌ | ❌ | ❌ |
| Edit org settings | ✅ | ❌ | ❌ | ❌ |
| View dashboard | ✅ (full) | ✅ (dept) | ✅ (assigned) | ❌ |

---

## 7. Build Order (Production-Level — No MVP)

Every step is built to **production quality**. No shortcuts, no "later" cleanup. Department isolation, team collaboration, and security are baked in from Step 1.

### Step 1: Codebase Restructure
Restructure existing code into production-grade 3-layer architecture (routers → services → repositories). See `RESTRUCTURE_PLAN.md` for full details.
- Split `database.py` monolith into individual repositories
- Split `agent.py` into orchestrator + individual nodes
- Add Pydantic models, middleware, error handling, config validation
- Move DB files to `data/` directory
- Split 39KB CSS into page-scoped stylesheets
- All new tables (scorecards, talent pool, scheduling, screening questions) created from day one
- Department isolation columns in every table

### Step 2: Auth & Security
Production-grade authentication, authorization, and role management.
- Password validation (8+ chars, uppercase, number, special)
- CORS whitelist, rate limiting, request logging
- Role-based permissions (admin, recruiter, hiring_manager, interviewer)
- Department-scoped access control
- Audit logging for all auth events
- Password change and reset flows

### Step 3: Settings & Organization Profile
Complete settings page — this feeds into every other module.
- Organization profile (About Us, culture, benefits, logo, industry)
- Department CRUD with hierarchy
- User management with department & role assignment
- Competitor management
- **Screening questions config** (dynamic application form, per department)
- **Email template library** (outreach, follow-up, rejection, offer)
- **Interview scorecard templates** (configurable rating dimensions)
- Theme and appearance

### Step 4: Chat, JD Generation & Interview Kit
Refine chat workflow + add AI Interview Kit generation.
- Pull org "About Us" and benefits from settings into JD
- Pull competitors from settings for market research
- Department-scoped chat sessions
- Proper session lifecycle (create → active → completed)
- File upload improvements
- **AI Interview Kit**: After JD finalization, generate tailored interview questions + scorecard
- Interview kit stored and linked to position

### Step 5: Position Management & Team Collaboration
Full position lifecycle with collaboration features.
- "Save & Open Position" flow from final JD
- Position CRUD with department assignment
- Position detail page with tabs (Pipeline, Candidates, JD, Interview Kit, Settings)
- Auto-search configuration per position
- Status management (draft → open → on_hold → closed → archived)
- **Comments & @mentions** on positions and candidates
- **Activity feed** — team-wide visibility of all actions

### Step 6: Candidate Pipeline & Talent Pool
Sourcing, scoring, pipeline management, and talent pool.
- Background candidate search with notifications
- ATS scoring with full skill breakdown
- Candidate detail page (profile, skills match, resume, history, comments)
- Pipeline Kanban board with status changes
- Bulk actions (email, status change)
- **Talent pool**: Rejected/passed candidates saved to org-wide searchable pool
- **Auto-suggest**: AI suggests pool candidates when similar position opens
- **Deduplication**: Merge duplicate candidate profiles
- **Structured resume parsing** — AI extracts skills, companies, education into JSON

### Step 7: Communication Hub & Applications
Full communication platform + public application collection.
- **Email threads** — Full conversation history per candidate
- **Automated follow-ups** — Configurable drip sequences
- Email template customization from settings
- Magic link generation and delivery
- Public application page with dynamic screening form
- Application review in candidate detail
- Link expiry and security
- **WhatsApp integration** (Business API) — crucial for Indian market

### Step 8: Interview Scheduling & Scorecards
Built-in scheduling and structured evaluation.
- **Calendar integration** — Google Calendar / Outlook sync
- **Self-scheduling links** — Candidate picks available slot
- **Multi-round scheduling** — Technical → Manager → HR → Final
- **Interviewer availability** — Free/busy from calendar
- **Automated reminders** — 24h and 1h before (candidate + interviewer)
- **Video call links** — Auto-generate Meet/Zoom link
- **Scorecard submission** — Each interviewer submits independently
- **Aggregate scores** — Side-by-side comparison of all interviewers' ratings

### Step 9: Dashboard & Advanced Analytics
Comprehensive dashboard with advanced insights.
- Stats cards with trend indicators
- Hiring funnel visualization
- Activity timeline (real-time)
- Positions table with filters, search, pagination
- Navigation: dashboard → position → candidate → back
- **Source effectiveness** — Which portal yields best candidates
- **Time-in-stage analysis** — Where candidates get stuck
- **Recruiter performance** — Positions filled, avg time-to-fill
- **Exportable reports** — PDF/CSV for leadership

### Step 10: Career Page & Public Job Board
Organic candidate acquisition channel.
- **Public career page** — `aitalentlab.com/{org}/careers`
- Open positions with filters (department, location, type)
- Direct apply (resume + screening form, no outreach needed)
- SEO-optimized position pages
- Embeddable widget for org websites

### Step 11: Real-World Integrations
Production APIs and third-party connections.
- LinkedIn API adapter (sourcing + posting)
- Naukri API adapter (sourcing + posting)
- SMTP/Resend email delivery
- WhatsApp Business API
- HRIS sync (BambooHR, Zoho People)
- Slack/Teams notifications ("New application in #hiring")
- Zapier/Webhooks for custom integrations

### Step 12: Predictive AI & Agentic Features
Intelligence layer that makes the platform proactive.
- **Time-to-fill prediction** — Based on role, location, salary, history
- **Candidate success probability** — Predict job performance
- **Attrition risk score** — Flag likely short-tenure candidates
- **Salary benchmarking** — Market rate from aggregated data
- **Proactive alerts** — "Pipeline stale", "Pool matches found", "Threshold too restrictive"
- **Weekly AI digest** — Auto-generated summary of hiring activity
- **Natural language queries** — "Show uncontacted candidates above 80% match"
- **API for third-party integrations**

---

## 8. Business Model (SaaS)

| Plan | Target | Limits | Price Point (indicative) |
|------|--------|--------|-------------------------|
| **Free** | Freelance recruiters | 1 user, 3 active positions, 10 candidates/position | Free |
| **Starter** | Startups | 5 users, 10 positions, 50 candidates/position, basic analytics | $49/mo |
| **Growth** | SMBs | 25 users, unlimited positions, department isolation, priority search | $199/mo |
| **Enterprise** | Large orgs | Unlimited users, SSO, API access, dedicated support, SLA | Custom |

---

## 9. Success Metrics (KPIs)

- **Time to JD**: Average minutes from starting chat to final JD (target: < 10 min)
- **JD Quality Score**: User satisfaction rating on generated JDs
- **Interview Kit Adoption**: % of positions using AI-generated interview questions
- **Candidate Match Rate**: % of scored candidates above ATS threshold
- **Pipeline Velocity**: Average days from sourced → interview
- **Response Rate**: % of emailed/messaged candidates who engage
- **Application Rate**: % of link-clickers who submit application
- **Talent Pool Reuse**: % of hires sourced from talent pool (vs. fresh search)
- **Scorecard Completion**: % of interviews with submitted scorecards
- **Source Effectiveness**: Conversion rate by sourcing channel
- **Time-to-Fill**: Days from position opened → candidate selected
- **Monthly Active Organizations**: Growth in paying tenants

---

## 10. Technical Principles

1. **API-First**: Every feature is exposed as a REST API before UI
2. **Multi-Tenant by Default**: Every query is scoped by `org_id` + `department_id`
3. **Agent Specialization**: Each AI agent has one job (interviewer, analyst, drafter, interview kit) — not one monolith
4. **Adapter Pattern**: External integrations (job portals, email, WhatsApp, LLMs) use pluggable adapters
5. **Background Processing**: Long tasks (candidate search, email blasts) run async with notifications
6. **Progressive Enhancement**: Start with simulation adapters, swap in real APIs without code changes
7. **Security First**: HTTPS, parameterized queries, encrypted PII, rate limiting, audit trails
8. **Collaboration by Default**: Every entity supports comments, activity feeds, and multi-user access
9. **AI Proactivity**: The system suggests actions, not just responds to requests
10. **Data Reusability**: Candidates, skills, and interview data are reusable across positions (talent pool)
