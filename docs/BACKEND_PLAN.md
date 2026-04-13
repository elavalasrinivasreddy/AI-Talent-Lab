# AI Talent Lab — Backend Plan
> **Version 2.1 — Corrected & Complete**
> Aligned with RESTRUCTURE_PLAN.md. 3-layer architecture: Routers → Services → Repositories.
> All routes versioned under `/api/v1/`. Department isolation on every table. Production-grade from day one.

---

## 1. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Framework** | FastAPI (Python 3.11+) | Async-first, SSE support, Pydantic v2 validation |
| **Database (Dev)** | SQLite + WAL mode | File stored in `data/talent_lab.db` (gitignored) |
| **Database (Prod)** | PostgreSQL 16+ | Swap via `DATABASE_URL` env var — no code changes |
| **Vector Store** | ChromaDB (persistent) | Stored in `data/chroma/` — JD similarity for internal check |
| **LLM Framework** | LangChain + LangGraph | Multi-agent state machine |
| **LLM Providers** | Groq (default) / OpenAI / Gemini | Switchable via `LLM_PROVIDER` env var |
| **Auth** | JWT (PyJWT) + bcrypt | Stateless, org_id + dept_id + role in token claims |
| **Web Search** | Tavily API | Market research, competitor JD analysis |
| **Email** | Resend / SMTP / Simulation | Adapter pattern — swap without code changes |
| **Candidate Sourcing** | Simulation (MVP) → LinkedIn/Naukri (Phase 3) | Adapter pattern |
| **Background Tasks** | FastAPI BackgroundTasks → Celery + Redis (prod) | Async for search, email, scoring |
| **Streaming** | SSE (Server-Sent Events) | Token-by-token chat streaming |

---

## 2. Project Structure

> Follows RESTRUCTURE_PLAN.md exactly. Every new file goes into the correct layer.
> Key fixes from original: added `agents/tools/`, `agents/nodes/benchmarking.py`,
> `db/repositories/audit.py`, correct `tasks/` naming, full `models/` coverage,
> `/api/v1/` prefix on all routes, `data/` directory for runtime files.

```
backend/
├── __init__.py
├── main.py                          # FastAPI app factory, middleware + router registration
├── config.py                        # Pydantic BaseSettings — all env vars validated on startup
├── dependencies.py                  # FastAPI Depends() — auth, db session, tenant context
├── exceptions.py                    # Custom exceptions + global exception handlers
│
├── models/                          # Pydantic schemas (request/response validation)
│   ├── __init__.py
│   ├── auth.py                      # LoginRequest, RegisterRequest, UserResponse, TokenResponse
│   ├── chat.py                      # MessageRequest, SessionResponse, StreamEvent, SavePositionRequest
│   ├── positions.py                 # PositionCreate, PositionUpdate, PositionResponse, SetupRequest
│   ├── candidates.py                # CandidateResponse, StatusUpdate, BulkUploadResponse, OutreachRequest
│   ├── interviews.py                # InterviewCreate, InterviewUpdate, InterviewResponse
│   ├── scorecards.py                # ScorecardSubmit, EnrichRequest, ScorecardResponse
│   ├── dashboard.py                 # StatsResponse, FunnelResponse, ActivityResponse
│   ├── settings.py                  # OrgProfileUpdate, CompetitorCreate, DepartmentCreate, TemplateCreate
│   ├── notifications.py             # NotificationResponse
│   ├── talent_pool.py               # PoolCandidateResponse, SuggestRequest, AddToPositionRequest
│   └── apply.py                     # ApplyVerifyResponse, CandidateMessageRequest, CompleteRequest
│
├── db/
│   ├── __init__.py
│   ├── connection.py                # Connection factory, WAL mode setup, context manager
│   ├── migrations.py                # ALL CREATE TABLE statements — runs on app startup
│   ├── vector_store.py              # ChromaDB init, embed_jd(), search_similar()
│   └── repositories/                # Data access — one class per entity, pure SQL, no logic
│       ├── __init__.py
│       ├── organizations.py         # OrgRepository
│       ├── users.py                 # UserRepository
│       ├── departments.py           # DeptRepository
│       ├── positions.py             # PositionRepository
│       ├── candidates.py            # CandidateRepository
│       ├── applications.py          # ApplicationRepository (candidate ↔ position)
│       ├── interviews.py            # InterviewRepository
│       ├── scorecards.py            # ScorecardRepository
│       ├── pipeline_events.py       # PipelineEventRepository (immutable log)
│       ├── notifications.py         # NotificationRepository
│       ├── competitors.py           # CompetitorRepository
│       ├── screening_questions.py   # ScreeningQuestionRepository
│       ├── message_templates.py     # MessageTemplateRepository
│       ├── sessions.py              # ChatSessionRepository + CandidateSessionRepository
│       ├── talent_pool.py           # TalentPoolRepository + SuggestionRepository
│       └── audit.py                 # AuditLogRepository
│
├── routers/                         # HTTP endpoints — thin, validates input, calls services
│   ├── __init__.py
│   ├── auth.py                      # /api/v1/auth/*
│   ├── chat.py                      # /api/v1/chat/*
│   ├── positions.py                 # /api/v1/positions/*
│   ├── candidates.py                # /api/v1/candidates/*
│   ├── interviews.py                # /api/v1/interviews/*
│   ├── dashboard.py                 # /api/v1/dashboard/*
│   ├── settings.py                  # /api/v1/settings/*
│   ├── notifications.py             # /api/v1/notifications/*
│   ├── talent_pool.py               # /api/v1/talent-pool/*
│   ├── apply.py                     # /api/v1/apply/* (public, token-auth only)
│   ├── panel.py                     # /api/v1/panel/* (public, magic link token only)
│   └── careers.py                   # /api/v1/careers/* (public, no auth)
│
├── services/                        # Business logic — no HTTP, no SQL
│   ├── __init__.py
│   ├── auth_service.py
│   ├── position_service.py
│   ├── candidate_service.py
│   ├── interview_service.py
│   ├── scorecard_service.py
│   ├── dashboard_service.py
│   ├── notification_service.py
│   ├── settings_service.py
│   ├── talent_pool_service.py
│   └── email_service.py
│
├── agents/                          # AI agent system — LangGraph state machine
│   ├── __init__.py
│   ├── orchestrator.py              # HiringAgent — LangGraph graph definition + runner
│   ├── streaming.py                 # SSE event formatting + async generator
│   ├── state.py                     # AgentState TypedDict
│   ├── bias_checker.py              # JD bias detection (runs post final_jd stage)
│   ├── interview_kit.py             # Interview question + scorecard template generation
│   ├── debrief_generator.py         # Post-interview debrief document generation
│   ├── rejection_drafter.py         # AI drafts rejection emails from feedback data
│   ├── feedback_enricher.py         # AI enriches rough panel notes → professional feedback
│   ├── candidate_chat.py            # Candidate magic link chat controller (linear flow)
│   ├── resume_parser.py             # AI extracts structured data, trajectory analysis, red flags
│   ├── nodes/                       # Individual LangGraph agent nodes
│   │   ├── __init__.py
│   │   ├── interviewer.py           # Intake — gathers requirements from recruiter
│   │   ├── internal_analyst.py      # Internal skills check — queries ChromaDB
│   │   ├── market_intelligence.py   # Market research — Tavily web search
│   │   ├── benchmarking.py          # Benchmarking — ranks competitor skills against JD
│   │   └── drafting.py              # JD drafting — generates 3 variants + final JD
│   ├── prompts/                     # System prompt files (markdown)
│   │   ├── interviewer.md
│   │   ├── internal_analyst.md
│   │   ├── market_intelligence.md
│   │   ├── benchmarking.md
│   │   ├── drafting.md
│   │   ├── bias_checker.md
│   │   ├── interview_kit.md
│   │   ├── rejection_drafter.md
│   │   ├── feedback_enricher.md
│   │   ├── candidate_chat.md
│   │   └── resume_parser.md
│   └── tools/                       # Agent tool functions
│       ├── __init__.py
│       ├── search.py                # Tavily API wrapper
│       └── role_extractor.py        # Extract role title from free-text messages
│
├── adapters/                        # External service adapters
│   ├── __init__.py
│   ├── candidate_sources/
│   │   ├── __init__.py
│   │   ├── base.py                  # CandidateSourceAdapter ABC
│   │   ├── simulation.py            # LLM-based realistic simulation (MVP default)
│   │   ├── linkedin.py              # LinkedIn API stub (Phase 3)
│   │   └── naukri.py                # Naukri API stub (Phase 3)
│   ├── email/
│   │   ├── __init__.py
│   │   ├── base.py                  # EmailProvider ABC
│   │   ├── simulation.py            # Console + file log output (dev/demo)
│   │   ├── resend.py                # Resend API
│   │   └── smtp.py                  # Generic SMTP
│   └── llm/
│       ├── __init__.py
│       └── factory.py               # get_llm() — returns LLM from LLM_PROVIDER env var
│
├── middleware/
│   ├── __init__.py
│   ├── cors.py                      # CORS — whitelist FRONTEND_URL only
│   ├── rate_limiter.py              # 100 req/min per IP, 10 auth attempts/min
│   ├── request_logger.py            # Correlation ID per request, response time
│   └── tenant_context.py            # Extracts org_id + dept_id from JWT → request.state
│
├── tasks/                           # Background workers
│   ├── __init__.py
│   ├── candidate_pipeline.py        # Source → ATS score → notify (matches RESTRUCTURE_PLAN)
│   ├── email_outreach.py            # Bulk personalized email with magic links
│   └── scheduled_search.py          # Periodic re-search for open positions
│
├── utils/
│   ├── __init__.py
│   ├── security.py                  # JWT encode/decode, bcrypt, magic link generation
│   ├── validators.py                # Email, phone, password validation
│   ├── pagination.py                # Cursor-based pagination helpers
│   └── events.py                    # PipelineEvent creation helpers — call from services
│
└── tests/
    ├── __init__.py
    ├── conftest.py                   # Fixtures: test DB, test client, mock auth, mock LLM
    ├── test_auth.py
    ├── test_chat.py
    ├── test_positions.py
    ├── test_candidates.py
    ├── test_interviews.py
    ├── test_dashboard.py
    ├── test_settings.py
    └── test_talent_pool.py

data/                                # Runtime data — GITIGNORED
├── talent_lab.db                     # SQLite database
├── chroma/                           # ChromaDB vector store
├── uploads/                          # Uploaded files: resumes, reference JDs
└── logs/                             # Application logs

# .gitignore additions:
# data/
# *.db
# *.sqlite
```

---

## 3. Three-Layer Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Routers (HTTP Layer)               │
│  routers/*.py                                       │
│  Validate input via Pydantic models                 │
│  Call services, return HTTP responses               │
│  NEVER query DB, NEVER contain business logic       │
├─────────────────────────────────────────────────────┤
│                Services (Business Layer)             │
│  services/*.py                                      │
│  All business logic and decisions                   │
│  Orchestrates repositories + adapters               │
│  No HTTP, no SQL, no external API calls directly    │
├─────────────────────────────────────────────────────┤
│        Repositories + Adapters (Data Layer)          │
│  db/repositories/*.py + adapters/                  │
│  SQL queries, external API calls                    │
│  Returns clean data objects, makes no decisions     │
└─────────────────────────────────────────────────────┘
RULE: Each layer calls ONLY the layer directly below it.
```

---

## 4. Database Schema

### Absolute Rule
**Every business data table must have `org_id INTEGER NOT NULL`. Tables scoped to a department also have `department_id INTEGER NOT NULL`. Every repository query filters by `org_id` without exception.**

---

### 4.1 Foundation Tables

```sql
-- Organizations (Tenants)
CREATE TABLE organizations (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT NOT NULL UNIQUE,           -- Immutable after registration
    slug             TEXT NOT NULL UNIQUE,           -- Auto-generated from name: "TechCorp" → "techcorp"
    segment          TEXT NOT NULL,                  -- Technology / Healthcare / Finance / etc.
    size             TEXT NOT NULL,                  -- startup / smb / enterprise
    website          TEXT,
    about_us         TEXT,                           -- Inserted into every generated JD
    logo_url         TEXT,
    culture_keywords TEXT,                           -- "innovation, remote-first, diversity"
    benefits_text    TEXT,                           -- Standard benefits appended to all JDs
    headquarters     TEXT,
    linkedin_url     TEXT,
    glassdoor_url    TEXT,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Departments
CREATE TABLE departments (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id           INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    description      TEXT,
    parent_dept_id   INTEGER REFERENCES departments(id),
    head_user_id     INTEGER,                        -- FK to users (set after user created)
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, name)
);

-- Users (platform users only — candidates and panel members are NOT users)
CREATE TABLE users (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id           INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    department_id    INTEGER REFERENCES departments(id),
    email            TEXT NOT NULL UNIQUE,           -- Immutable, primary login
    password_hash    TEXT NOT NULL,
    role             TEXT NOT NULL DEFAULT 'recruiter', -- admin / recruiter / hiring_manager
    name             TEXT NOT NULL,
    phone            TEXT,
    avatar_url       TEXT,
    timezone         TEXT DEFAULT 'Asia/Kolkata',
    is_active        BOOLEAN DEFAULT 1,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until     TIMESTAMP,                      -- Account lockout after 5 failures
    last_login_at    TIMESTAMP,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Competitors (drive market research step in JD generation)
CREATE TABLE competitors (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id           INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    website          TEXT,
    industry         TEXT,
    notes            TEXT,
    is_active        BOOLEAN DEFAULT 1,
    UNIQUE(org_id, name)
);

-- Screening Questions (dynamic questions in candidate apply chat)
CREATE TABLE screening_questions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id           INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    department_id    INTEGER REFERENCES departments(id), -- NULL = org-wide default
    field_key        TEXT NOT NULL,                  -- "notice_period", "expected_ctc"
    label            TEXT NOT NULL,
    field_type       TEXT NOT NULL DEFAULT 'text',   -- text / number / select / date / boolean
    options          TEXT,                           -- JSON array for select type
    is_required      BOOLEAN DEFAULT 0,
    sort_order       INTEGER DEFAULT 0,
    is_active        BOOLEAN DEFAULT 1,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message / Email Templates
CREATE TABLE message_templates (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id           INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    category         TEXT NOT NULL,
    -- outreach / rejection / interview_invite / interview_process_overview / follow_up / custom
    subject          TEXT,
    body             TEXT NOT NULL,                  -- Supports {{candidate_name}}, {{role_name}}, {{magic_link}}
    is_default       BOOLEAN DEFAULT 0,
    is_active        BOOLEAN DEFAULT 1,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Interview Scorecard Dimension Templates
CREATE TABLE scorecard_templates (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id           INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    dimensions       TEXT NOT NULL,
    -- JSON: [{key, label, description, weight}]
    -- Default: technical(0.40), problem_solving(0.30), communication(0.15), culture_fit(0.15)
    is_default       BOOLEAN DEFAULT 0,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 Hiring Tables

```sql
-- Positions (hiring requisitions — created from recruiter chat)
CREATE TABLE positions (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id                INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    department_id         INTEGER NOT NULL REFERENCES departments(id),
    session_id            TEXT REFERENCES chat_sessions(id),
    role_name             TEXT NOT NULL,
    jd_markdown           TEXT,
    jd_variant_selected   TEXT,                       -- skill_focused / outcome_focused / hybrid
    status                TEXT DEFAULT 'draft',        -- draft/open/on_hold/closed/archived
    priority              TEXT DEFAULT 'normal',       -- urgent/high/normal/low
    headcount             INTEGER DEFAULT 1,
    location              TEXT,
    work_type             TEXT DEFAULT 'onsite',       -- remote/hybrid/onsite
    employment_type       TEXT DEFAULT 'full_time',    -- full_time/contract/intern
    experience_min        INTEGER,
    experience_max        INTEGER,
    salary_min            REAL,
    salary_max            REAL,
    currency              TEXT DEFAULT 'INR',
    ats_threshold         REAL DEFAULT 80.0,
    search_interval_hours INTEGER DEFAULT 24,          -- NULL = manual only
    last_search_at        TIMESTAMP,
    next_search_at        TIMESTAMP,
    deadline              TEXT,
    is_on_career_page     BOOLEAN DEFAULT 1,           -- Auto-publish to career page when open
    created_by            INTEGER REFERENCES users(id),
    assigned_to           INTEGER REFERENCES users(id),
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at             TIMESTAMP
);

-- JD Variants (3 per position, one marked selected)
CREATE TABLE jd_variants (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    position_id      INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    variant_type     TEXT NOT NULL,                  -- skill_focused/outcome_focused/hybrid
    summary          TEXT NOT NULL,                  -- Short summary for comparison cards
    content          TEXT NOT NULL,                  -- Full JD markdown
    is_selected      BOOLEAN DEFAULT 0,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Candidates (org-scoped — NEVER cross-org)
CREATE TABLE candidates (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id               INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                 TEXT,
    email                TEXT,
    phone                TEXT,
    current_title        TEXT,
    current_company      TEXT,
    experience_years     INTEGER,
    location             TEXT,
    resume_url           TEXT,                       -- Path in data/uploads/
    resume_text          TEXT,                       -- Parsed text
    resume_parsed        TEXT,                       -- JSON: {skills[], education[], companies[]}
    source               TEXT DEFAULT 'manual',
    -- linkedin/naukri/career_page/upload/manual/simulation
    source_profile_url   TEXT,
    in_talent_pool       BOOLEAN DEFAULT 0,
    talent_pool_reason   TEXT,                       -- rejected/position_closed/position_archived/manual
    talent_pool_added_at TIMESTAMP,
    notes                TEXT,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, email)                            -- Dedup within org only
);

-- Candidate ↔ Position link (one record per candidate per position)
CREATE TABLE candidate_applications (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id          INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    position_id           INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    org_id                INTEGER NOT NULL REFERENCES organizations(id),
    department_id         INTEGER NOT NULL REFERENCES departments(id),
    skill_match_score     REAL,
    skill_match_data      TEXT,                       -- JSON: {matched[], missing[], extra[], summary}
    status                TEXT DEFAULT 'sourced',
    -- sourced/emailed/applied/screening/interview/selected/rejected/on_hold
    applied_at            TIMESTAMP,
    screening_responses   TEXT,                       -- JSON: {field_key: value, ...}
    magic_link_token      TEXT UNIQUE,
    magic_link_sent_at    TIMESTAMP,
    magic_link_clicked_at TIMESTAMP,
    magic_link_expires_at TIMESTAMP,
    rejection_draft       TEXT,                       -- AI-drafted rejection email body
    rejection_sent_at     TIMESTAMP,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(candidate_id, position_id)
);
```

### 4.3 Interview & Feedback Tables

```sql
-- Interview Rounds
CREATE TABLE interviews (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id           INTEGER NOT NULL REFERENCES organizations(id),
    department_id    INTEGER NOT NULL REFERENCES departments(id),
    position_id      INTEGER NOT NULL REFERENCES positions(id),
    candidate_id     INTEGER NOT NULL REFERENCES candidates(id),
    application_id   INTEGER NOT NULL REFERENCES candidate_applications(id),
    round_number     INTEGER NOT NULL DEFAULT 1,
    round_name       TEXT,                           -- "Technical", "HR", "Manager", "Final"
    round_type       TEXT DEFAULT 'technical',       -- technical/hr/managerial/final/other
    scheduled_at     TIMESTAMP,
    duration_minutes INTEGER DEFAULT 60,
    meeting_link     TEXT,
    status           TEXT DEFAULT 'pending',
    -- pending/scheduled/completed/cancelled/rescheduled
    overall_result   TEXT,                           -- passed/rejected/pending
    invite_sent_at   TIMESTAMP,
    notes            TEXT,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Panel members per interview (each gets own magic link)
CREATE TABLE interview_panel (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id         INTEGER NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    user_id              INTEGER REFERENCES users(id),  -- NULL if external panelist
    panelist_name        TEXT NOT NULL,
    panelist_email       TEXT NOT NULL,
    magic_link_token     TEXT UNIQUE,
    magic_link_expires_at TIMESTAMP,                    -- 7 days from interview date
    feedback_submitted   BOOLEAN DEFAULT 0,
    not_attended         BOOLEAN DEFAULT 0,
    invite_sent_at       TIMESTAMP,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scorecards (one per panel member per interview)
CREATE TABLE scorecards (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id     INTEGER NOT NULL REFERENCES interviews(id),
    panel_member_id  INTEGER NOT NULL REFERENCES interview_panel(id),
    candidate_id     INTEGER NOT NULL REFERENCES candidates(id),
    position_id      INTEGER NOT NULL REFERENCES positions(id),
    org_id           INTEGER NOT NULL REFERENCES organizations(id),
    is_draft         BOOLEAN DEFAULT 0,
    ratings          TEXT NOT NULL,
    -- JSON: [{dimension, score(1-5), notes}]
    overall_score    REAL,
    recommendation   TEXT,                           -- strong_yes/yes/neutral/no/strong_no
    strengths        TEXT,
    concerns         TEXT,
    additional_comments TEXT,
    raw_notes_strengths TEXT,                        -- Original rough notes — always kept
    raw_notes_concerns TEXT,
    submitted_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(interview_id, panel_member_id)
);

-- AI-generated Interview Kit per position
CREATE TABLE interview_kits (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    position_id         INTEGER NOT NULL UNIQUE REFERENCES positions(id),
    org_id              INTEGER NOT NULL REFERENCES organizations(id),
    questions           TEXT NOT NULL,
    -- JSON: [{category, question, difficulty, expected_answer}]
    scorecard_template  TEXT,
    -- JSON: [{dimension, label, description, weight}]
    generated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    regenerated_count   INTEGER DEFAULT 0
);
```

### 4.4 Event Log & System Tables

```sql
-- Immutable Pipeline Event Log (powers Timeline, audit trail, analytics)
CREATE TABLE pipeline_events (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id           INTEGER NOT NULL REFERENCES organizations(id),
    candidate_id     INTEGER REFERENCES candidates(id),
    position_id      INTEGER REFERENCES positions(id),
    application_id   INTEGER REFERENCES candidate_applications(id),
    interview_id     INTEGER REFERENCES interviews(id),
    user_id          INTEGER REFERENCES users(id),   -- NULL = system-generated
    event_type       TEXT NOT NULL,
    -- sourced / emailed / link_clicked / applied / status_changed /
    -- interview_scheduled / interview_completed / feedback_submitted /
    -- rejection_drafted / rejection_sent / selected / added_to_pool /
    -- comment_added / jd_generated / search_completed
    event_data       TEXT,                           -- JSON event-specific metadata
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log (auth + admin actions — separate from pipeline events)
CREATE TABLE audit_log (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id           INTEGER NOT NULL,
    user_id          INTEGER,
    action           TEXT NOT NULL,
    -- login / logout / login_failed / user_created / user_deactivated /
    -- position_created / position_closed / etc.
    entity_type      TEXT,                           -- position/candidate/user/org
    entity_id        TEXT,
    details          TEXT,                           -- JSON
    ip_address       TEXT,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- In-app Notifications
CREATE TABLE notifications (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id           INTEGER NOT NULL REFERENCES organizations(id),
    user_id          INTEGER REFERENCES users(id),   -- NULL = broadcast to all org users
    type             TEXT NOT NULL,
    -- search_complete / feedback_received / candidate_applied /
    -- interview_today / rejection_to_review / candidate_selected /
    -- pool_match_found
    title            TEXT NOT NULL,
    message          TEXT NOT NULL,
    action_url       TEXT,                           -- e.g., /positions/42?tab=pipeline
    is_read          BOOLEAN DEFAULT 0,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Talent Pool Suggestions (AI-generated per position)
CREATE TABLE talent_pool_suggestions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id           INTEGER NOT NULL REFERENCES organizations(id),
    position_id      INTEGER NOT NULL REFERENCES positions(id),
    candidate_id     INTEGER NOT NULL REFERENCES candidates(id),
    match_score      REAL,
    suggested_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actioned         BOOLEAN DEFAULT 0,
    UNIQUE(position_id, candidate_id)
);

-- Candidate Tags (free-form labels for talent pool management)
-- Used to tag candidates with recruiter observations for future re-engagement
-- Examples: "strong communicator", "relocation needed", "overqualified", "great culture fit"
CREATE TABLE candidate_tags (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id           INTEGER NOT NULL REFERENCES organizations(id),
    candidate_id     INTEGER NOT NULL REFERENCES candidates(id),
    tag              TEXT NOT NULL,                   -- Free-form label (lowercase, trimmed)
    created_by       INTEGER REFERENCES users(id),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, candidate_id, tag)                -- No duplicate tags per candidate per org
);
```

### 4.5 Chat Session Tables

```sql
-- Recruiter JD creation sessions
CREATE TABLE chat_sessions (
    id               TEXT PRIMARY KEY,               -- UUID
    org_id           INTEGER REFERENCES organizations(id),
    department_id    INTEGER REFERENCES departments(id),
    user_id          INTEGER REFERENCES users(id),
    position_id      INTEGER REFERENCES positions(id), -- Set when JD saved
    title            TEXT NOT NULL DEFAULT 'New Hire',
    workflow_stage   TEXT DEFAULT 'intake',
    -- intake/internal_check/market_research/jd_variants/final_jd/bias_check/complete
    graph_state      TEXT DEFAULT '{}',              -- LangGraph AgentState JSON
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_messages (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id       TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role             TEXT NOT NULL,                  -- user/assistant/system
    content          TEXT NOT NULL DEFAULT '',
    extras           TEXT DEFAULT '{}',              -- JSON: {card_type, card_data}
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Candidate magic link sessions
CREATE TABLE candidate_sessions (
    id               TEXT PRIMARY KEY,               -- UUID
    application_id   INTEGER REFERENCES candidate_applications(id),
    position_id      INTEGER REFERENCES positions(id),
    org_id           INTEGER REFERENCES organizations(id),
    magic_link_token TEXT UNIQUE NOT NULL,
    status           TEXT DEFAULT 'active',          -- active/completed/expired
    expires_at       TIMESTAMP NOT NULL,
    completed_at     TIMESTAMP,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE candidate_session_messages (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id       TEXT NOT NULL REFERENCES candidate_sessions(id) ON DELETE CASCADE,
    role             TEXT NOT NULL,                  -- user/assistant
    content          TEXT NOT NULL,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. API Design — All Routes Under `/api/v1/`

> API versioning from day one. Old clients on v1 still work when v2 ships.

### Health

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | None | Root — `{status: ok}` |
| GET | `/api/v1/health` | None | `{status, db, version, timestamp}` |

### Auth — `/api/v1/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/register` | None | Register org + admin. Auto-generates org slug. |
| POST | `/login` | None | Email/password → JWT |
| GET | `/me` | JWT | Current user + org info |
| GET | `/users` | JWT (admin) | List all org users |
| POST | `/add-user` | JWT (admin) | Add team member |
| PATCH | `/users/{id}` | JWT (admin) | Update role, department, active status |
| PATCH | `/profile` | JWT | Update own name, phone, avatar |
| POST | `/change-password` | JWT | Change own password |
| POST | `/forgot-password` | None | Send reset email |
| POST | `/reset-password` | None | Reset via token |

### Chat — `/api/v1/chat`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/stream` | JWT | SSE streaming — all workflow stages |
| GET | `/sessions` | JWT | List user's sessions (sidebar) |
| GET | `/sessions/{id}` | JWT | Full session with messages + state |
| DELETE | `/sessions/{id}` | JWT | Delete session |
| PATCH | `/sessions/{id}/title` | JWT | Rename |
| POST | `/sessions/{id}/upload` | JWT | Upload reference JD |
| POST | `/sessions/{id}/save-position` | JWT | Save position + trigger background search |

### Positions — `/api/v1/positions`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | JWT | List positions (dept-scoped, filterable) |
| GET | `/{id}` | JWT | Position detail with pipeline stats |
| PATCH | `/{id}` | JWT | Update settings |
| PATCH | `/{id}/status` | JWT | Change status |
| POST | `/{id}/search-now` | JWT | Trigger immediate search |
| GET | `/{id}/interview-kit` | JWT | Get AI interview kit |
| POST | `/{id}/interview-kit/generate` | JWT | Generate/regenerate interview kit |

### Candidates — `/api/v1/candidates`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/position/{position_id}` | JWT | List candidates for position |
| GET | `/{id}` | JWT | Candidate detail |
| GET | `/{id}/timeline` | JWT | Full pipeline event timeline |
| PATCH | `/{id}/status` | JWT | Update pipeline status |
| PATCH | `/{id}/notes` | JWT | Add/update recruiter notes |
| POST | `/bulk-upload` | JWT | Bulk offline resume upload with dedup |
| POST | `/send-outreach` | JWT | Send outreach emails with magic links |
| POST | `/{id}/draft-rejection` | JWT | AI drafts rejection email |
| POST | `/{id}/send-rejection` | JWT | Send drafted rejection |
| POST | `/{id}/mark-selected` | JWT | Mark as selected (final HR action) |
| GET | `/{id}/tags` | JWT | List tags for candidate |
| POST | `/{id}/tags` | JWT | Add tag to candidate (`{ tag: "string" }`) |
| DELETE | `/{id}/tags/{tag}` | JWT | Remove a specific tag |

### Interviews — `/api/v1/interviews`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/` | JWT | Create interview round |
| GET | `/position/{position_id}` | JWT | All rounds for position |
| GET | `/candidate/{candidate_id}` | JWT | All rounds for candidate |
| GET | `/{id}` | JWT | Interview detail + scorecards |
| PATCH | `/{id}` | JWT | Update (reschedule, cancel, set result) |
| POST | `/{id}/send-invites` | JWT | Send invites: candidate + panel magic links |
| POST | `/{id}/generate-debrief` | JWT | AI generates debrief (after all rounds complete) |

### Panel Feedback — `/api/v1/panel` (magic link token, no JWT)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/{token}` | Token | Verify token, get interview + candidate + scorecard template |
| POST | `/{token}/enrich` | Token | AI enriches rough notes → professional feedback |
| POST | `/{token}/submit` | Token | Submit scorecard (`is_draft: bool`) |

### Apply — `/api/v1/apply` (magic link token, no JWT)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/{token}` | Token | Verify link, get position + org + screening questions |
| POST | `/{token}/message` | Token | Send message in candidate chat |
| POST | `/{token}/upload-resume` | Token | Upload resume (multipart) |
| POST | `/{token}/complete` | Token | Finalize application |

### Dashboard — `/api/v1/dashboard`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/stats` | JWT | Stats cards + trends (`?period=today\|week\|month`) |
| GET | `/positions` | JWT | Positions with candidate counts |
| GET | `/pipeline/{position_id}` | JWT | Candidates by stage (Kanban data) |
| GET | `/funnel` | JWT | Hiring funnel data |
| GET | `/activity` | JWT | Recent pipeline events (activity feed) |

### Talent Pool — `/api/v1/talent-pool`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | JWT | Search pool (`?q=&location=&source=&reason=&page=`) |
| POST | `/suggest/{position_id}` | JWT | AI suggests pool matches for position |
| POST | `/{candidate_id}/add` | JWT | Manually add to pool |
| DELETE | `/{candidate_id}/remove` | JWT | Remove from pool |
| POST | `/{candidate_id}/add-to-position` | JWT | Add pool candidate to position pipeline |

### Settings — `/api/v1/settings`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/org` | JWT | Organization profile |
| PATCH | `/org` | JWT (admin) | Update org profile |
| GET/POST/PATCH/DELETE | `/departments/{id?}` | JWT (admin) | Department CRUD |
| GET/POST/PATCH/DELETE | `/competitors/{id?}` | JWT | Competitor CRUD |
| GET/POST/PATCH/DELETE | `/screening-questions/{id?}` | JWT (admin) | Screening question CRUD |
| PATCH | `/screening-questions/reorder` | JWT (admin) | Update sort_order |
| GET/POST/PATCH/DELETE | `/message-templates/{id?}` | JWT (admin) | Email template CRUD |
| GET/POST/PATCH | `/scorecard-templates/{id?}` | JWT (admin) | Scorecard template CRUD |

### Notifications — `/api/v1/notifications`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | JWT | Unread notifications (limit 20) |
| PATCH | `/{id}/read` | JWT | Mark one as read |
| PATCH | `/read-all` | JWT | Mark all as read |

### Career Page — `/api/v1/careers` (public, no auth)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/{org_slug}` | None | Org info + open positions |
| GET | `/{org_slug}/positions/{id}` | None | Position detail + full JD |
| POST | `/{org_slug}/positions/{id}/apply` | None | Start candidate chat (career page flow) |

---

## 6. Agent Architecture

### LangGraph State Machine (Recruiter Chat)

```
INTAKE → INTERNAL_CHECK → MARKET_RESEARCH → JD_VARIANTS → FINAL_JD → BIAS_CHECK → COMPLETE

Nodes:
  interviewer.py       → Gather requirements via NLU conversation
  internal_analyst.py  → Query ChromaDB for similar past JDs
  market_intelligence.py → Tavily web search for competitor JDs
  benchmarking.py      → Rank + compare skills vs competitors
  drafting.py          → Generate 3 variants → generate final JD

Tools:
  search.py            → Tavily API wrapper used by market_intelligence
  role_extractor.py    → Extract job title from free-text
```

### SSE Event Stream Format

```
data: {"event": "token", "content": "Senior"}
data: {"event": "stage_change", "stage": "internal_check", "label": "Checking past roles..."}
data: {"event": "card_internal", "data": {"skills": [{"skill":"Redis","source":"Sr Backend Dev","year":2024}]}}
data: {"event": "card_market", "data": {"competitors":["Google","Flipkart"], "skills":[...]}}
data: {"event": "card_variants", "data": {"variants": [{"type":"skill_focused","summary":"...","content":"..."}]}}
data: {"event": "card_bias", "data": {"issues": [{"phrase":"rockstar","suggestion":"exceptional developer"}]}}
data: {"event": "jd_token", "content": "# Senior Python Developer\n"}
data: {"event": "metadata", "session_id": "uuid", "title": "Senior Python Developer"}
data: {"event": "done"}
data: {"event": "error", "message": "LLM timeout — please retry"}
```

### Candidate Chat (Linear Controller)

```python
# agents/candidate_chat.py — NOT LangGraph, simple linear flow
steps = [
    "greeting",          # Hi {name}, interested in {role} at {org}?
    "interest_check",    # Yes/No → if No: close politely
    "current_role",      # Confirm/update current role + company
    "experience",        # Total + relevant years
    "compensation",      # Current CTC + expected CTC
    "notice_period",     # Notice period / availability
    "resume_upload",     # Upload PDF/DOCX
    "custom_questions",  # Dynamic from screening_questions table
    "completion"         # Thank you + what happens next email sent
]
```

---

## 7. Magic Link System

```python
# Token payload (signed JWT)
{
    "type": "apply" | "panel_feedback" | "password_reset",
    "entity_id": application_id | panel_member_id | user_id,
    "exp": utcnow() + timedelta(hours=expiry)
}

# Expiry
apply:          72 hours from sending
panel_feedback: 168 hours (7 days) from interview date
password_reset: 24 hours from request

# Single-use enforcement
apply:          Multiple sessions OK, only one completion (candidate_sessions.status)
panel_feedback: One-time — interview_panel.feedback_submitted = True on submit
```

---

## 8. Background Tasks

```python
# tasks/candidate_pipeline.py
async def run_candidate_search(position_id, org_id, dept_id):
    """Source → Dedup → ATS Score → Notify"""
    # 1. Load position + JD
    # 2. Run CandidateSourceAdapter.search()
    # 3. For each candidate:
    #    a. check_duplicate(org_id, email, phone)  ← within org only
    #    b. If duplicate + updated ≤ 7 days: skip
    #    c. If duplicate + updated > 7 days: update profile
    #    d. If new: create candidate + application records
    #    e. ATS score (semantic)
    # 4. Update position.last_search_at / next_search_at
    # 5. Create pipeline_events
    # 6. Create notification for recruiter

# tasks/scheduled_search.py  
async def run_scheduled_searches():
    """Find positions with next_search_at <= NOW() → queue pipeline tasks"""

# tasks/email_outreach.py
async def send_outreach_batch(application_ids):
    """Generate magic links → render templates → send → update records → create events"""
```

---

## 9. Security

| Concern | Implementation |
|---|---|
| Password hashing | bcrypt (12 rounds) |
| JWT claims | `user_id`, `org_id`, `department_id`, `role`, `exp` |
| Token expiry | 24 hours |
| Account lockout | 5 failed attempts → 15 min (`locked_until` field) |
| SQL injection | Parameterized queries only — no string formatting |
| CORS | Whitelist `FRONTEND_URL` env var only |
| Rate limiting | 100 req/min per IP, 10 auth attempts/min |
| PII protection | CTC fields encrypted at rest (AES-256) |
| Magic links | Time-limited signed JWT, single-use for panel feedback |
| Audit trail | `audit_log` table for all auth + admin actions |
| Tenant isolation | Every query filtered by `org_id` (enforced in `tenant_context.py`) |

---

## 10. Config

```python
class Settings(BaseSettings):
    APP_VERSION: str = "1.0.0"
    FRONTEND_URL: str = "http://localhost:5173"
    MAGIC_LINK_BASE_URL: str = "http://localhost:5173"
    DATABASE_URL: str = "sqlite:///data/talent_lab.db"
    JWT_SECRET: str                        # REQUIRED — no default, app fails without it
    JWT_EXPIRY_HOURS: int = 24
    LLM_PROVIDER: str = "groq"             # groq / openai / gemini
    GROQ_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    TAVILY_API_KEY: str = ""
    EMAIL_PROVIDER: str = "simulation"     # simulation / resend / smtp
    RESEND_API_KEY: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "hiring@aitalentlab.com"
    FROM_NAME: str = "AI Talent Lab"
    CANDIDATE_SOURCE_ADAPTER: str = "simulation"
    APPLY_LINK_EXPIRY_HOURS: int = 72
    PANEL_LINK_EXPIRY_HOURS: int = 168
    RESET_LINK_EXPIRY_HOURS: int = 24
    ENCRYPTION_KEY: str = ""               # Required in prod for CTC encryption

    class Config:
        env_file = ".env"

settings = Settings()  # Fails on startup if JWT_SECRET missing
```

---

## 11. Standard Error Response

```json
{
  "error": {
    "code": "POSITION_NOT_FOUND",
    "message": "Position with ID 42 not found in your organization",
    "details": null
  }
}
```

---

## 12. Automated Follow-up System

One of the core value propositions — eliminates candidate ghosting. Runs as a scheduled background task.

### How It Works

```python
# tasks/email_outreach.py (extended)

async def send_followup_reminders():
    """
    Runs every hour via scheduled task.
    
    Finds all candidate_applications where:
        status = 'emailed'                       -- outreach sent but no response yet
        magic_link_sent_at IS NOT NULL           -- outreach was actually sent
        magic_link_clicked_at IS NULL            -- link NOT yet clicked
        magic_link_sent_at <= NOW() - 48h        -- 48 hours have passed
        rejection_sent_at IS NULL                -- not already rejected
        followup_sent_at IS NULL                 -- not already followed up
    
    For each match:
    1. Load candidate + position + org
    2. Check position.status = 'open' (skip if closed)
    3. Render follow-up email from message_templates (category: 'follow_up')
    4. Send via EmailAdapter
    5. Update: candidate_applications.followup_sent_at = NOW()
    6. Create PipelineEvent: event_type = 'followup_sent'
    """
```

### Schema Addition for Follow-up Tracking

Add `followup_sent_at TIMESTAMP` column to `candidate_applications` table. This prevents double-sending and allows the timeline to show when a follow-up was sent.

```sql
-- Add to candidate_applications table:
followup_sent_at      TIMESTAMP,   -- When 48h follow-up email was sent (NULL = not sent)
```

### Configurable Per Position

The follow-up delay (default 48h) is configurable. Add `followup_delay_hours INTEGER DEFAULT 48` to the `positions` table so recruiters can set different delays per role:

```sql
-- Add to positions table:
followup_delay_hours  INTEGER DEFAULT 48,  -- Hours to wait before auto follow-up (0 = disabled)
```

### Where This Is Visible

- **04_position_detail.md → Settings Tab:** "Auto follow-up" toggle with delay selector (24h / 48h / 72h / Disabled)
- **06_settings.md → Message Templates:** "Follow-up" template category — recruiter customizes the email body
- **05_candidate_detail.md → Timeline:** Shows as `📧 Follow-up email sent` event when triggered
- **04_position_detail.md → Activity Tab:** Shows as team activity event when triggered for any candidate

---

## 13. Resume Intelligence — Structured Parsing, Trajectory & Red Flags

```python
# agents/resume_parser.py

async def parse_and_analyze_resume(resume_text: str, position_jd: str) -> dict:
    """
    Called after resume upload (bulk upload, apply chat, or manual upload).
    Uses LLM to extract structured data AND perform trajectory analysis.
    
    Returns:
    {
        "structured": {
            "name": str,
            "email": str,
            "phone": str,
            "skills": ["Python", "FastAPI", ...],
            "education": [{"degree": "B.Tech", "institution": "IIT Delhi", "year": 2018}],
            "companies": [
                {
                    "name": "TechCorp",
                    "title": "Senior Developer",
                    "start": "2022-01",
                    "end": null,          # null = current
                    "duration_months": 26
                }
            ],
            "certifications": ["AWS Solutions Architect"],
            "total_experience_years": 6
        },
        "trajectory": {
            "pattern": "steady_growth" | "job_hopper" | "career_pivot" | "specialist",
            "avg_tenure_months": 24,
            "progression_note": "Clear upward progression from Junior → Senior → Lead roles",
        },
        "red_flags": [
            {
                "type": "short_tenure",        # or "employment_gap" | "title_regression" | "frequent_switches"
                "description": "3 roles in 2 years (2020–2022)",
                "severity": "low" | "medium" | "high"
            }
        ],
        "summary": "6-year backend engineer with steady growth trajectory at established companies..."
    }
    """
```

### Where This Appears in the UI

**Candidate Detail → Skills Match Tab (extended):**

```
┌── AI Analysis ──────────────────────────────────────────────────┐
│                                                                 │
│  📈 Career Trajectory: Steady Growth                           │
│  "Clear upward progression: Junior → Senior → Lead.           │
│   Average tenure 26 months — well above industry average."    │
│                                                                 │
│  ⚠️ Red Flags: None detected                                   │
│  (or if found):                                                │
│  ⚠️ Short tenure detected: 3 roles in 2 years (2020–2022)     │
│     Severity: Medium — worth discussing in screening call      │
│                                                                 │
│  💬 Overall: Strong backend developer with consistent growth.  │
│   Main gaps are Kubernetes and Terraform...                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Trigger points:**
- Bulk upload to talent pool → auto-parsed on ingest
- Candidate applies via magic link chat → parsed on resume upload
- Manual resume upload on candidate detail → parsed immediately
- Stored in `candidates.resume_parsed` (JSON) — never re-parsed unless new resume uploaded
