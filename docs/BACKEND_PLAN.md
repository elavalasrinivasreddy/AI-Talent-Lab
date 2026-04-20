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
| **Background Tasks** | Celery + Redis | From day one. Never FastAPI BackgroundTasks in any environment. |
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
| PostgreSQL RLS | Row-Level Security as second defense — DB blocks leakage even if app code has a bug |

### PostgreSQL Row-Level Security

Applied to every tenant-scoped table. Application-level `org_id` filtering is the first layer. RLS is the second — the database itself enforces isolation.

```sql
-- Enable on every business table
ALTER TABLE positions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates              ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_applications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews              ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorecards              ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE talent_pool_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_tags          ENABLE ROW LEVEL SECURITY;
ALTER TABLE jd_variants             ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE screening_questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates       ENABLE ROW LEVEL SECURITY;

-- Policy template (repeat for each table):
CREATE POLICY tenant_isolation ON positions
    USING (org_id = current_setting('app.current_org_id', true)::int);

-- In middleware/tenant_context.py, set per-request before any query:
-- await db.execute("SET LOCAL app.current_org_id = :org_id", {"org_id": user.org_id})
-- SET LOCAL is scoped to current transaction only — safe for connection pools
```

**Dev note:** RLS is PostgreSQL-only. It does not apply to SQLite in dev. Since we use PostgreSQL in dev via Docker (see docker-compose.yml), RLS applies in dev too. This means you catch RLS errors in dev, not in production.

---

## 10. Config

```python
class Settings(BaseSettings):
    APP_VERSION: str = "1.0.0"
    FRONTEND_URL: str = "http://localhost:5173"
    MAGIC_LINK_BASE_URL: str = "http://localhost:5173"
    DATABASE_URL: str = "postgresql://talentlab:talentlab@localhost:5432/talentlab_dev"  # Docker local
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

---

## 14. Agent Error Recovery — Chat Window Resilience

### Failure Philosophy

Every LangGraph node can fail. The system must handle failures gracefully — the recruiter should never see a blank screen, a crash, or lose their progress. Two categories of failure:

**Hard stop (cannot continue without this):** intake, JD variants, final JD generation
**Soft skip (optional data, can proceed without):** internal check, market research, bias check

### Per-Node Error Strategy

```python
# ── INTAKE (interviewer.py) ── HARD STOP
# Cannot generate a JD without requirements.
# Failure mode: LLM returns garbage, fails to extract role/skills, times out.
#
# On failure:
#   → SSE event: {"event": "error", "code": "INTAKE_FAILED", "recoverable": true}
#   → Chat message: "I had trouble processing that. Could you rephrase your requirements?"
#   → Stage stays at INTAKE — do not advance
#   → Session state preserved — user can retry from same point
#   → Max 3 consecutive LLM failures → hard error message + "Start Over" button
#
# Never advance to INTERNAL_CHECK with incomplete intake data.

# ── INTERNAL CHECK (internal_analyst.py) ── SOFT SKIP
# ChromaDB query for past JD similarity. Completely optional — new orgs have no data.
# Failure mode: ChromaDB unavailable, query timeout, no results.
#
# On failure:
#   → Log error server-side (do not surface to user)
#   → SSE event: {"event": "stage_change", "stage": "market_research", ...}
#   → Chat message: "No past role data found. Moving to market research..."
#   → Advance to MARKET_RESEARCH automatically
#   → No user action required
#
# AgentState: set internal_skills_found = [] and internal_skipped = True

# ── MARKET RESEARCH (market_intelligence.py + benchmarking.py) ── SOFT SKIP
# Tavily web search for competitor JDs. Optional — adds value but not required.
# Failure mode: Tavily API down, rate limited, no competitors configured, timeout.
#
# On failure:
#   → Log error server-side
#   → If no competitors configured: message explains why and offers link to Settings
#   → If Tavily failed: "Market research unavailable right now. Continuing with what we have."
#   → Advance to JD_VARIANTS automatically
#   → Do not expose Tavily error details to user
#
# AgentState: set market_skills_found = [] and market_skipped = True
# The drafting node must handle empty market_skills_found gracefully.

# ── JD VARIANTS (drafting.py — first call) ── HARD STOP with retry
# Must generate 3 variants. Without variants the recruiter cannot select a style.
# Failure mode: LLM timeout, malformed JSON response, empty content.
#
# On failure attempt 1:
#   → Retry automatically (same prompt, immediately)
#   → Show "Generating..." indicator — user does not see the retry
#
# On failure attempt 2 (retry also failed):
#   → SSE event: {"event": "error", "code": "VARIANTS_FAILED", "recoverable": true}
#   → Chat message: "I had trouble generating the JD variants. Click Retry to try again."
#   → Show [Retry] button in chat
#   → Session state preserved at JD_VARIANTS stage
#   → User clicks Retry → orchestrator re-runs drafting node only (not full pipeline)
#
# On 3rd failure:
#   → "There seems to be a persistent issue. Please try again in a few minutes."
#   → Session saved, user can return later

# ── FINAL JD (drafting.py — second call) ── HARD STOP with retry
# Must generate the final complete JD. Same retry logic as variants.
# Failure mode: LLM timeout during streaming, connection dropped mid-stream.
#
# On stream interrupted mid-generation:
#   → Chat shows partial JD with "[Connection lost]" at the end
#   → Show [Regenerate JD] button
#   → User clicks → re-run final JD generation only, full re-stream
#   → Do NOT re-run intake/internal/market/variants
#
# On failure before any tokens arrive:
#   → Same as variants failure — retry once automatically, then show Retry button

# ── BIAS CHECK (bias_checker.py) ── SOFT SKIP
# Completely optional post-processing. Never blocks saving the JD.
# Failure mode: LLM timeout, API error.
#
# On failure:
#   → Silently skip — show no bias card at all
#   → Log server-side only
#   → JD save button remains enabled

# ── POSITION SETUP (save) ── HARD STOP
# Must succeed to create the position.
# Failure mode: DB write error, validation error.
#
# On failure:
#   → Close modal, show toast: "Failed to save position. Please try again."
#   → Modal can be reopened, data is not lost
#   → Retry is user-triggered (click Save again)
```

### AgentState Error Fields

```python
class AgentState(TypedDict):
    # ... existing fields ...

    # Error tracking
    error_stage: Optional[str]         # Which stage failed: "intake"|"variants"|"final_jd"
    error_code: Optional[str]          # Machine-readable code for frontend handling
    error_message: Optional[str]       # Human-readable message shown in chat
    retry_count: int                   # How many retries have been attempted
    
    # Skip tracking (soft skips don't set error fields)
    internal_skipped: bool             # True if internal check was skipped
    market_skipped: bool               # True if market research was skipped
    bias_skipped: bool                 # True if bias check was skipped
```

### SSE Error Events

```
# Recoverable error — show retry button
data: {"event": "error", "code": "VARIANTS_FAILED", "recoverable": true,
       "message": "Trouble generating JD variants. Click Retry to try again."}

# Non-recoverable — show start over button
data: {"event": "error", "code": "INTAKE_FAILED", "recoverable": false,
       "message": "Session error. Please start a new hire chat."}

# Soft skip — informational only, no user action needed
data: {"event": "stage_skipped", "stage": "market_research",
       "message": "Market research unavailable. Continuing..."}

# Stream interrupted mid-JD
data: {"event": "stream_interrupted", "partial_content_saved": true,
       "message": "Connection interrupted. Click Regenerate to continue."}
```

### Frontend Response to Errors

| SSE Event | UI Action |
|---|---|
| `error` + `recoverable: true` | Show [Retry] button below last message. Input stays disabled. |
| `error` + `recoverable: false` | Show [Start New Chat] button. Disable input permanently. |
| `stage_skipped` | Show muted system message. Auto-advance. No user action. |
| `stream_interrupted` | Show partial JD with "[Interrupted]" marker. Show [Regenerate] button. |
| 3 consecutive `error` events | Show "Persistent issue — try again later." Preserve session. |

### Session State Preservation Rule

**The session state (graph_state JSON in chat_sessions table) must be saved after every successful node completion.** This means if the server restarts or the user closes the browser mid-way through, they can return to the same session and continue from the last successful stage — not from the beginning.

```python
# In orchestrator.py, after each node completes successfully:
async def save_state_checkpoint(session_id: str, state: AgentState, db):
    await db.execute(
        "UPDATE chat_sessions SET graph_state = :state, workflow_stage = :stage, updated_at = NOW() WHERE id = :id",
        {"state": json.dumps(state), "stage": state["stage"], "id": session_id}
    )
# Called after: intake ✓, internal_check ✓, market_research ✓, jd_variants ✓, final_jd ✓
```

---

## 15. Semantic ATS Scoring — Full Strategy

### Why Not Keyword Matching

Keyword matching fails because:
- Candidate writes "Postgres" → JD says "PostgreSQL" → no match
- Candidate has 8 years of Python but lists it once → low score
- JD says "AWS preferred" → keyword matcher treats it same as "AWS required"

Semantic scoring understands meaning, not just strings.

### Architecture: Two-Step Scoring

**Step 1 — Embedding similarity (fast, cheap, runs for every candidate)**
**Step 2 — LLM structured analysis (deeper, runs only above embedding threshold)**

```python
# services/candidate_service.py

async def compute_ats_score(
    candidate_id: int,
    application_id: int,
    position_id: int,
    db,
    llm
) -> dict:
    """
    Two-step semantic ATS scoring.
    Returns: {score, matched_skills, missing_skills, extra_skills, summary, method}
    """

    # ── Step 1: Load pre-computed embeddings ──────────────────────
    position = await PositionRepository.get(position_id, db)
    candidate = await CandidateRepository.get(candidate_id, db)

    # JD embedding — computed once when position is created, stored in positions.jd_embedding
    jd_embedding = json.loads(position.jd_embedding)  # list[float]

    # Resume embedding — computed once on resume upload/parse, stored in candidates.resume_embedding
    resume_embedding = json.loads(candidate.resume_embedding)  # list[float]

    if not jd_embedding or not resume_embedding:
        # Fall back to LLM-only scoring if embeddings missing
        return await llm_only_scoring(candidate, position, llm)

    # Cosine similarity
    embedding_score = cosine_similarity(jd_embedding, resume_embedding)  # 0.0–1.0

    # If embedding score is very low — skip expensive LLM call, mark as poor match
    if embedding_score < 0.35:
        return {
            "score": round(embedding_score * 100, 1),
            "matched_skills": [],
            "missing_skills": [],
            "extra_skills": [],
            "summary": "Embedding similarity too low for detailed analysis.",
            "method": "embedding_only"
        }

    # ── Step 2: LLM structured analysis ──────────────────────────
    # Only runs for candidates who pass the embedding threshold
    prompt = f"""
    Analyze this candidate's fit for the role.

    JD Requirements:
    {position.jd_markdown[:2000]}

    Candidate Resume:
    {candidate.resume_text[:2000]}

    Return ONLY valid JSON:
    {{
      "matched_skills": ["Python", "FastAPI", ...],
      "missing_skills": ["Kubernetes", ...],
      "extra_skills": ["GraphQL", ...],
      "experience_match": 0.0-1.0,
      "skills_match": 0.0-1.0,
      "summary": "One paragraph AI analysis"
    }}
    """

    llm_result = await llm.invoke(prompt)
    parsed = json.loads(llm_result.content)

    # Final weighted score
    final_score = (
        embedding_score * 0.40 +
        parsed["skills_match"] * 0.40 +
        parsed["experience_match"] * 0.20
    ) * 100

    return {
        "score": round(final_score, 1),
        "matched_skills": parsed["matched_skills"],
        "missing_skills": parsed["missing_skills"],
        "extra_skills": parsed["extra_skills"],
        "summary": parsed["summary"],
        "method": "semantic_full"
    }
```

### Embedding Storage

**Where embeddings live:**

| Embedding | When generated | Where stored | How long |
|---|---|---|---|
| JD embedding | When position created / JD saved | `positions.jd_embedding` TEXT (JSON float array) | Lifetime of position |
| Resume embedding | When resume text parsed | `candidates.resume_embedding` TEXT (JSON float array) | Lifetime of candidate |

**Schema additions:**
```sql
-- Add to positions table:
jd_embedding         TEXT,  -- JSON float array, NULL until JD saved

-- Add to candidates table:
resume_embedding     TEXT,  -- JSON float array, NULL until resume parsed
```

**Why not ChromaDB for ATS embeddings?**
ChromaDB in this project is used for one specific job: finding *similar past JDs* during the internal check stage of JD generation. That's a vector similarity search across a collection of documents. ATS scoring is a different operation: pairwise cosine similarity between exactly two vectors (JD vs resume). For pairwise comparison, storing as a JSON float array in PostgreSQL and computing in Python is simpler, faster, and requires no separate service. ChromaDB stays focused on its own job.

**Why not pgvector?**
pgvector is ideal for large-scale nearest-neighbor search across millions of vectors. For ATS scoring, you always know exactly which JD you're comparing against. It's a direct lookup, not a search. pgvector adds operational complexity with no benefit here. Add it later if you need semantic candidate search across the full pool.

### Embedding Model

Use the same LLM provider's embedding model for consistency:
```python
# adapters/llm/factory.py

def get_embedding_model():
    provider = settings.LLM_PROVIDER
    if provider == "groq":
        # Groq does not offer embeddings — use OpenAI text-embedding-3-small
        return OpenAIEmbeddings(model="text-embedding-3-small")
    elif provider == "openai":
        return OpenAIEmbeddings(model="text-embedding-3-small")
    elif provider == "gemini":
        return GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")
```

`text-embedding-3-small` produces 1536-dimension vectors. At ~2KB per vector stored as JSON, 100,000 candidates = ~200MB. Perfectly fine in PostgreSQL.

### JD Embedding Generation

Called once when recruiter saves position from chat:

```python
# services/position_service.py

async def save_position_with_jd(session_id, setup_data, db, embedding_model):
    # ... create position record ...

    # Generate and store JD embedding immediately
    jd_text = f"{position.role_name} {position.jd_markdown}"
    embedding = await embedding_model.aembed_query(jd_text)
    
    await PositionRepository.update(
        position_id,
        {"jd_embedding": json.dumps(embedding)},
        db
    )
    # This embedding is now reused for every candidate scored against this position
    # Never regenerated unless JD is edited (editing triggers re-embedding)
```

### Resume Embedding Generation

Called once when resume text is extracted (bulk upload, apply chat, manual upload):

```python
# agents/resume_parser.py (extended)

async def parse_and_embed_resume(resume_text: str, embedding_model) -> dict:
    # ... existing parse logic ...

    # Generate embedding from resume text
    embedding = await embedding_model.aembed_query(resume_text[:8000])  # cap at 8k chars

    return {
        "structured": { ... },     # existing parse output
        "trajectory": { ... },
        "red_flags": [ ... ],
        "embedding": embedding     # stored in candidates.resume_embedding
    }
```

---

## 16. Database Setup — Dev and Prod Strategy

### One Database Engine: PostgreSQL Everywhere

No SQLite in any environment. Use PostgreSQL via Docker locally. This eliminates the class of bugs that only appear in production because SQLite and PostgreSQL behave differently (type handling, JSON operators, date functions, concurrent writes, RLS).

### docker-compose.yml (Local Dev)

Place in project root:

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: talentlab_dev
      POSTGRES_USER: talentlab
      POSTGRES_PASSWORD: talentlab
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U talentlab"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

**Developer workflow:**
```bash
docker compose up -d        # start Postgres + Redis in background
cd backend
python main.py              # FastAPI starts, connects to local Postgres
# When done:
docker compose down         # stop (data persists in volumes)
docker compose down -v      # stop + wipe all data (full reset)
```

### .env File Strategy — Zero Rework When Switching Dev → Prod

```bash
# .env.development (used locally)
DATABASE_URL=postgresql://talentlab:talentlab@localhost:5432/talentlab_dev
REDIS_URL=redis://localhost:6379/0
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_key
TAVILY_API_KEY=your_tavily_key
EMAIL_PROVIDER=simulation
CANDIDATE_SOURCE_ADAPTER=simulation
JWT_SECRET=dev_secret_change_in_prod_32chars_min
FRONTEND_URL=http://localhost:5173
MAGIC_LINK_BASE_URL=http://localhost:5173
ENCRYPTION_KEY=                          # empty = encryption disabled in dev

# .env.production (server)
DATABASE_URL=postgresql://user:pass@your-postgres-host:5432/talentlab_prod
REDIS_URL=redis://your-redis-host:6379/0
LLM_PROVIDER=groq
GROQ_API_KEY=prod_groq_key
TAVILY_API_KEY=prod_tavily_key
EMAIL_PROVIDER=resend
RESEND_API_KEY=prod_resend_key
CANDIDATE_SOURCE_ADAPTER=simulation      # still simulation until real APIs integrated
JWT_SECRET=cryptographically_random_64_char_string
FRONTEND_URL=https://app.aitalentlab.com
MAGIC_LINK_BASE_URL=https://app.aitalentlab.com
ENCRYPTION_KEY=base64_encoded_32_byte_aes_key
```

The application code reads `DATABASE_URL` — it doesn't know or care whether it points to a Docker container or a managed cloud PostgreSQL instance. Switching from dev to prod is a single `.env` file swap.

### Celery Configuration

```python
# config.py (addition to Settings)
REDIS_URL: str = "redis://localhost:6379/0"
CELERY_BROKER_URL: str = ""    # defaults to REDIS_URL if empty

# celery_app.py (new file in backend root)
from celery import Celery
from config import settings

celery_app = Celery(
    "talentlab",
    broker=settings.CELERY_BROKER_URL or settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "tasks.candidate_pipeline",
        "tasks.email_outreach",
        "tasks.scheduled_search",
    ]
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    timezone="Asia/Kolkata",
    task_acks_late=True,              # re-queue if worker dies mid-task
    task_reject_on_worker_lost=True,  # re-queue if worker crashes
    task_max_retries=3,               # retry failed tasks 3 times
    task_default_retry_delay=60,      # wait 60s before retry
)

# Beat schedule (replaces cron) — runs scheduled_search every hour
celery_app.conf.beat_schedule = {
    "run-scheduled-searches": {
        "task": "tasks.scheduled_search.run_scheduled_searches",
        "schedule": 3600.0,  # every hour
    },
    "send-followup-reminders": {
        "task": "tasks.email_outreach.send_followup_reminders",
        "schedule": 3600.0,  # every hour
    },
}
```

**Running in dev:**
```bash
# Terminal 1: FastAPI
uvicorn main:app --reload

# Terminal 2: Celery worker
celery -A celery_app worker --loglevel=info

# Terminal 3: Celery beat (scheduler)
celery -A celery_app beat --loglevel=info
```

**Why Celery and not alternatives:**
- Tasks survive server restarts (persisted in Redis)
- Built-in retry with exponential backoff
- Task result storage for debugging
- Beat scheduler replaces cron — no separate cron setup needed
- Works identically in dev and prod

---

## 17. Resume Content Storage — Text Only, No File Storage

### Decision: Store Text, Not Files

When a candidate uploads a resume (PDF or DOCX):
1. Extract full text immediately on upload
2. Parse structured data (skills, companies, education) via `resume_parser` agent
3. Generate embedding for ATS scoring
4. Store all three in the database
5. Discard the original file — it is not kept

**This means:**
- No file storage service needed (no S3, no R2, no local uploads directory)
- No resume download feature (candidates/recruiters cannot download the original PDF)
- All AI features work from the stored text — ATS scoring, trajectory analysis, red flag detection
- If a candidate re-uploads, new text overwrites old text and all downstream data is regenerated

### Schema (already in BACKEND_PLAN, confirmed correct)

```sql
-- candidates table:
resume_text      TEXT,   -- Full extracted text (stored forever, used for all AI)
resume_parsed    TEXT,   -- JSON: {skills[], education[], companies[], certifications[]}
resume_embedding TEXT,   -- JSON float array for ATS cosine similarity
```

### When to Re-extract

`resume_text`, `resume_parsed`, and `resume_embedding` are regenerated only when:
- Candidate uploads a new resume file
- Recruiter manually pastes updated resume text

They are never regenerated automatically.

### What About Resume Download?

If in a future phase the team wants to let recruiters download candidate resumes:
- Add `resume_storage_key TEXT` column to candidates table
- Store files in S3/R2 with a signed URL pattern
- Add download endpoint: `GET /api/v1/candidates/:id/resume-download` → redirects to signed URL (valid 5 min)

This is a clean Phase 2 addition that doesn't require any schema redesign.

### Text Extraction Libraries

```python
# requirements.txt additions:
pdfplumber>=0.9.0       # PDF text extraction — handles multi-column, tables
python-docx>=0.8.11     # DOCX text extraction

# In resume_parser.py:
async def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    if filename.lower().endswith(".pdf"):
        return extract_from_pdf(file_bytes)
    elif filename.lower().endswith((".docx", ".doc")):
        return extract_from_docx(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: {filename}")

def extract_from_pdf(file_bytes: bytes) -> str:
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
        return "\n".join(pages).strip()

def extract_from_docx(file_bytes: bytes) -> str:
    doc = docx.Document(io.BytesIO(file_bytes))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs).strip()
```
