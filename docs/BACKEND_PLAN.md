# AI Talent Lab — Backend Plan

> Backend architecture, tech stack, database schema, API design, and services for the AI Talent Lab platform.

---

## 1. Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| **Framework** | FastAPI (Python 3.11+) | Async-first, auto OpenAPI docs, Pydantic validation, SSE support |
| **Database (Dev)** | SQLite + WAL mode | Zero setup, file-based, good for prototyping |
| **Database (Prod)** | PostgreSQL 16+ | ACID, concurrent connections, row-level security, JSONB |
| **Vector Store** | ChromaDB (persistent) | Lightweight, cosine similarity, embedded mode |
| **LLM Framework** | LangChain + LangGraph | Multi-model support, agent orchestration, tool calling |
| **LLM Providers** | Groq (default), OpenAI, Google Gemini | Switchable via env var, cost-flexible |
| **Auth** | JWT (PyJWT) + bcrypt | Stateless, scalable, industry standard |
| **Search** | Tavily API | Structured web search for competitor JDs |
| **Email** | Resend / SMTP / Simulation | Adapter pattern, easy to switch providers |
| **Task Queue** | FastAPI BackgroundTasks → Celery (prod) | Start simple, scale to distributed workers |
| **Caching** | None → Redis (prod) | Session cache, rate limiting, LLM response cache |

---

## 2. Project Structure

> See `RESTRUCTURE_PLAN.md` for full migration details and rationale.

```
backend/
├── __init__.py
├── main.py                         # FastAPI app factory, middleware registration
├── config.py                       # Pydantic BaseSettings — validated config
├── dependencies.py                 # FastAPI Depends() — auth, db session, tenant context
├── exceptions.py                   # Custom exceptions + global exception handlers
│
├── models/                         # Pydantic request/response schemas
│   ├── auth.py                     # LoginRequest, RegisterRequest, UserResponse
│   ├── chat.py                     # MessageRequest, SessionResponse, StreamEvent
│   ├── positions.py                # PositionCreate, PositionUpdate, PositionResponse
│   ├── candidates.py               # CandidateResponse, CandidateStatusUpdate
│   ├── dashboard.py                # StatsResponse, FunnelResponse
│   ├── settings.py                 # OrgProfileUpdate, CompetitorCreate
│   └── notifications.py            # NotificationResponse
│
├── db/
│   ├── connection.py               # Connection factory, pool management
│   ├── migrations.py               # All CREATE TABLE statements
│   ├── repositories/               # Data access — one file per entity
│   │   ├── organizations.py
│   │   ├── users.py
│   │   ├── departments.py
│   │   ├── positions.py
│   │   ├── candidates.py
│   │   ├── applications.py
│   │   ├── notifications.py
│   │   ├── competitors.py
│   │   ├── sessions.py             # Merged session_store.py
│   │   └── audit.py
│   └── vector_store.py             # ChromaDB — similarity search
│
├── routers/                        # API endpoints — thin, delegates to services
│   ├── auth.py
│   ├── chat.py
│   ├── positions.py
│   ├── candidates.py
│   ├── dashboard.py
│   ├── settings.py
│   ├── notifications.py
│   └── apply.py                    # Public — no auth
│
├── services/                       # Business logic — the brain of each module
│   ├── auth_service.py
│   ├── position_service.py
│   ├── candidate_service.py
│   ├── dashboard_service.py
│   ├── notification_service.py
│   └── settings_service.py
│
├── agents/                         # AI agent system
│   ├── orchestrator.py             # HiringAgent state machine
│   ├── streaming.py                # SSE event formatting
│   ├── state.py                    # AgentState TypedDict
│   ├── nodes/                      # Individual agent nodes
│   │   ├── interviewer.py
│   │   ├── internal_analyst.py
│   │   ├── market_intelligence.py
│   │   ├── benchmarking.py
│   │   └── drafting.py
│   ├── prompts/                    # System prompts
│   │   ├── interviewer.md
│   │   ├── internal_analyst.md
│   │   ├── benchmarking.md
│   │   └── drafting.md
│   └── tools/
│       ├── search.py               # Web search (Tavily)
│       └── role_extractor.py
│
├── adapters/                       # External service adapters
│   ├── candidate_sources/
│   │   ├── base.py                 # CandidateSourceAdapter ABC
│   │   ├── simulation.py
│   │   ├── linkedin.py             # Stub
│   │   └── naukri.py               # Stub
│   ├── email/
│   │   ├── base.py                 # EmailProvider ABC
│   │   ├── simulation.py
│   │   ├── resend.py
│   │   └── smtp.py
│   └── llm/
│       └── factory.py              # get_llm() — Groq/OpenAI/Gemini
│
├── middleware/
│   ├── cors.py
│   ├── rate_limiter.py
│   ├── request_logger.py
│   └── tenant_context.py           # org_id + dept_id from JWT → request state
│
├── tasks/                          # Background workers
│   ├── candidate_pipeline.py
│   ├── email_outreach.py
│   └── scheduled_search.py
│
├── utils/
│   ├── security.py                 # JWT, bcrypt, magic links
│   ├── validators.py               # Email, phone, password validation
│   └── pagination.py
│
└── tests/
    ├── conftest.py                 # Fixtures: test DB, test client, mock auth
    ├── test_auth.py
    ├── test_chat.py
    ├── test_positions.py
    ├── test_candidates.py
    ├── test_dashboard.py
    └── test_settings.py

data/                               # Runtime data — GITIGNORED
├── talent_lab.db
├── chroma/
├── uploads/
└── logs/
```

---

## 3. Database Schema

### 3.1 Core Tables

```sql
-- ── Organizations (Tenants) ──────────────────────────────────────
organizations (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,           -- Immutable after registration
    segment         TEXT NOT NULL,                  -- Industry: "FinTech", "Healthcare", etc.
    size            TEXT NOT NULL,                  -- startup / smb / enterprise
    website         TEXT,
    about_us        TEXT,                           -- Included in generated JDs
    logo_url        TEXT,
    culture_keywords TEXT,                          -- e.g., "innovation, remote-first, diversity"
    benefits_text    TEXT,                          -- Standard benefits for all JDs
    headquarters     TEXT,                          -- City, Country
    linkedin_url     TEXT,
    glassdoor_url    TEXT,
    created_at       TIMESTAMP DEFAULT NOW()
);

-- ── Departments ──────────────────────────────────────────────────
departments (
    id              SERIAL PRIMARY KEY,
    org_id          INTEGER NOT NULL REFERENCES organizations(id),
    name            TEXT NOT NULL,                  -- "Engineering", "Marketing"
    description     TEXT,
    parent_dept_id  INTEGER REFERENCES departments(id), -- Hierarchy support
    head_user_id    INTEGER REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(org_id, name)
);

-- ── Users ────────────────────────────────────────────────────────
users (
    id              SERIAL PRIMARY KEY,
    org_id          INTEGER NOT NULL REFERENCES organizations(id),
    department_id   INTEGER REFERENCES departments(id),
    email           TEXT NOT NULL UNIQUE,           -- Immutable (primary login)
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'recruiter',  -- admin / recruiter / hiring_manager / interviewer
    name            TEXT NOT NULL,
    phone           TEXT,
    avatar_url      TEXT,
    is_active       BOOLEAN DEFAULT true,
    last_login_at   TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ── Competitors ──────────────────────────────────────────────────
competitors (
    id              SERIAL PRIMARY KEY,
    org_id          INTEGER NOT NULL REFERENCES organizations(id),
    competitor_name TEXT NOT NULL,
    website         TEXT,
    industry        TEXT,
    notes           TEXT,
    is_active       BOOLEAN DEFAULT true,
    UNIQUE(org_id, competitor_name)
);

-- ── Screening Questions (Dynamic Application Form) ───────────────
-- Admins configure which questions appear on the public apply page.
-- Can be set at org-level (dept_id = NULL) or per-department.
screening_questions (
    id              SERIAL PRIMARY KEY,
    org_id          INTEGER NOT NULL REFERENCES organizations(id),
    department_id   INTEGER REFERENCES departments(id), -- NULL = org-wide default
    field_key       TEXT NOT NULL,                  -- "notice_period", "expected_salary", etc.
    label           TEXT NOT NULL,                  -- Display label: "Notice Period"
    field_type      TEXT NOT NULL DEFAULT 'text',   -- text / textarea / select / number / date
    options         JSONB,                          -- For select: ["Immediate", "15 days", "30 days"]
    is_required     BOOLEAN DEFAULT false,
    sort_order      INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW()
);
```

### 3.2 Hiring Tables

```sql
-- ── Positions (Hiring Requests) ──────────────────────────────────
positions (
    id                  SERIAL PRIMARY KEY,
    org_id              INTEGER NOT NULL REFERENCES organizations(id),
    department_id       INTEGER REFERENCES departments(id),
    session_id          TEXT UNIQUE,                -- Links to chat session
    role_name           TEXT NOT NULL,
    jd_markdown         TEXT,
    status              TEXT DEFAULT 'draft',       -- draft/open/on_hold/closed/archived
    priority            TEXT DEFAULT 'normal',      -- urgent/high/normal/low
    headcount           INTEGER DEFAULT 1,
    location            TEXT,
    work_type           TEXT DEFAULT 'onsite',      -- remote/hybrid/onsite
    employment_type     TEXT DEFAULT 'full_time',   -- full_time/contract/intern
    experience_min      INTEGER,
    experience_max      INTEGER,
    salary_min          DECIMAL,
    salary_max          DECIMAL,
    currency            TEXT DEFAULT 'INR',
    ats_threshold       REAL DEFAULT 80.0,
    search_interval_hours INTEGER,                  -- Null = manual only
    last_search_at      TIMESTAMP,
    deadline            DATE,
    created_by          INTEGER REFERENCES users(id),
    assigned_to         INTEGER REFERENCES users(id),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    closed_at           TIMESTAMP
);

-- ── Candidates ───────────────────────────────────────────────────
candidates (
    id                  SERIAL PRIMARY KEY,
    org_id              INTEGER NOT NULL REFERENCES organizations(id),
    position_id         INTEGER REFERENCES positions(id),  -- NULL = talent pool only
    name                TEXT,
    email               TEXT,
    phone               TEXT,
    title               TEXT,                       -- Current job title
    company             TEXT,                       -- Current company
    experience_years    INTEGER,
    location            TEXT,
    resume_path         TEXT,
    resume_text         TEXT,
    resume_parsed       JSONB,                      -- Structured: {skills:[], education:[], companies:[]}
    source              TEXT DEFAULT 'manual',      -- linkedin/naukri/monster/upload/manual/simulation/talent_pool
    source_profile_url  TEXT,                       -- Original profile URL
    skill_match_score   REAL,
    status              TEXT DEFAULT 'sourced',     -- sourced/emailed/applied/screening/interview/selected/rejected/on_hold
    screening_data      JSONB,                      -- ATS breakdown: matched, missing, extra skills
    recruiter_notes     TEXT,
    in_talent_pool      BOOLEAN DEFAULT false,      -- Eligible for re-engagement
    talent_pool_reason  TEXT,                       -- Why they're in pool: "rejected", "position_closed", etc.
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    UNIQUE(org_id, email, position_id)
);

-- ── Candidate Emails ─────────────────────────────────────────────
candidate_emails (
    id              SERIAL PRIMARY KEY,
    candidate_id    INTEGER NOT NULL REFERENCES candidates(id),
    email_type      TEXT NOT NULL,                  -- outreach/reminder/rejection/offer/custom
    subject         TEXT,
    body            TEXT,
    sent_at         TIMESTAMP,
    magic_link      TEXT UNIQUE,
    link_clicked_at TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ── Applications (Candidate Response — Dynamic Form) ─────────────
-- Responses stored as JSONB to support dynamic screening questions.
applications (
    id                      SERIAL PRIMARY KEY,
    candidate_id            INTEGER NOT NULL REFERENCES candidates(id),
    position_id             INTEGER NOT NULL REFERENCES positions(id),
    applied_via             TEXT DEFAULT 'magic_link',
    form_responses          JSONB NOT NULL DEFAULT '{}',  -- Dynamic: {"notice_period": "30 days", ...}
    applied_at              TIMESTAMP DEFAULT NOW(),
    UNIQUE(candidate_id, position_id)
);
```

### 3.3 System Tables

```sql
-- ── Chat Sessions ────────────────────────────────────────────────
chat_sessions (
    id              TEXT PRIMARY KEY,
    org_id          INTEGER REFERENCES organizations(id),
    department_id   INTEGER REFERENCES departments(id),
    user_id         INTEGER REFERENCES users(id),
    title           TEXT NOT NULL DEFAULT 'New Hire',
    workflow_stage  TEXT DEFAULT 'intake',
    graph_state_json TEXT DEFAULT '{}',
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

chat_messages (
    id          SERIAL PRIMARY KEY,
    session_id  TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role        TEXT NOT NULL,                      -- user / assistant / system
    content     TEXT NOT NULL DEFAULT '',
    extras_json TEXT DEFAULT '{}',
    created_at  TIMESTAMP DEFAULT NOW()
);

-- ── Notifications ────────────────────────────────────────────────
notifications (
    id          SERIAL PRIMARY KEY,
    org_id      INTEGER NOT NULL REFERENCES organizations(id),
    user_id     INTEGER REFERENCES users(id),       -- Null = org-wide notification
    type        TEXT NOT NULL,
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    session_id  TEXT,
    action_url  TEXT,                               -- Deep link to relevant page
    is_read     BOOLEAN DEFAULT false,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- ── Audit Log ────────────────────────────────────────────────────
audit_log (
    id          SERIAL PRIMARY KEY,
    org_id      INTEGER NOT NULL,
    user_id     INTEGER,
    action      TEXT NOT NULL,                      -- login/logout/position_created/candidate_emailed/etc.
    entity_type TEXT,                               -- position/candidate/user/org
    entity_id   TEXT,
    details     JSONB,
    ip_address  TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- ── Skills Taxonomy ──────────────────────────────────────────────
skills (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,               -- "Python", "React", "AWS"
    category    TEXT,                               -- "language", "framework", "cloud", "soft_skill"
    aliases     TEXT[],                             -- ["Python3", "Py"] — for fuzzy matching
    parent_id   INTEGER REFERENCES skills(id)       -- Skill hierarchy: Python > FastAPI
);

position_skills (
    position_id INTEGER NOT NULL REFERENCES positions(id),
    skill_id    INTEGER NOT NULL REFERENCES skills(id),
    priority    TEXT DEFAULT 'required',            -- required / preferred / nice_to_have
    PRIMARY KEY (position_id, skill_id)
);
```

### 3.4 Interview Kit & Evaluation Tables

```sql
-- ── Interview Kits (AI-Generated) ───────────────────────────────────
interview_kits (
    id              SERIAL PRIMARY KEY,
    position_id     INTEGER NOT NULL REFERENCES positions(id),
    org_id          INTEGER NOT NULL REFERENCES organizations(id),
    questions       JSONB NOT NULL,                 -- [{category, question, difficulty, expected_answer}]
    scorecard_template JSONB,                       -- [{dimension, description, weight}]
    generated_at    TIMESTAMP DEFAULT NOW(),
    regenerated_count INTEGER DEFAULT 0
);

-- ── Interview Scorecards ────────────────────────────────────────
scorecards (
    id              SERIAL PRIMARY KEY,
    interview_id    INTEGER NOT NULL REFERENCES interviews(id),
    interviewer_id  INTEGER NOT NULL REFERENCES users(id),
    candidate_id    INTEGER NOT NULL REFERENCES candidates(id),
    position_id     INTEGER NOT NULL REFERENCES positions(id),
    ratings         JSONB NOT NULL,                 -- [{dimension, score(1-5), notes}]
    overall_score   REAL,                           -- Weighted average
    recommendation  TEXT,                           -- strong_yes / yes / neutral / no / strong_no
    comments        TEXT,
    submitted_at    TIMESTAMP DEFAULT NOW(),
    UNIQUE(interview_id, interviewer_id)
);
```

### 3.5 Interview Scheduling Tables

```sql
-- ── Interviews ─────────────────────────────────────────────────
interviews (
    id              SERIAL PRIMARY KEY,
    org_id          INTEGER NOT NULL REFERENCES organizations(id),
    position_id     INTEGER NOT NULL REFERENCES positions(id),
    candidate_id    INTEGER NOT NULL REFERENCES candidates(id),
    round_number    INTEGER NOT NULL DEFAULT 1,     -- 1, 2, 3...
    round_name      TEXT,                           -- "Technical", "Manager", "HR", "Final"
    interviewer_ids JSONB NOT NULL DEFAULT '[]',    -- [user_id, user_id]
    scheduled_at    TIMESTAMP,
    duration_minutes INTEGER DEFAULT 60,
    meeting_link    TEXT,                           -- Google Meet / Zoom link
    self_schedule_token TEXT UNIQUE,                -- Token for candidate self-scheduling
    self_schedule_slots JSONB,                      -- Available slots: [{start, end}]
    status          TEXT DEFAULT 'pending',         -- pending/scheduled/completed/cancelled/rescheduled
    feedback_status TEXT DEFAULT 'pending',         -- pending/partial/complete
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
```

### 3.6 Collaboration & Communication Tables

```sql
-- ── Comments (Team Collaboration) ───────────────────────────────
comments (
    id              SERIAL PRIMARY KEY,
    org_id          INTEGER NOT NULL REFERENCES organizations(id),
    user_id         INTEGER NOT NULL REFERENCES users(id),
    entity_type     TEXT NOT NULL,                  -- "candidate" / "position" / "interview"
    entity_id       INTEGER NOT NULL,               -- FK to candidate/position/interview
    content         TEXT NOT NULL,
    mentions        JSONB DEFAULT '[]',             -- [{user_id, name}] for @mentions
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- ── Candidate Tags (Talent Pool) ────────────────────────────────
candidate_tags (
    id              SERIAL PRIMARY KEY,
    org_id          INTEGER NOT NULL REFERENCES organizations(id),
    candidate_id    INTEGER NOT NULL REFERENCES candidates(id),
    tag             TEXT NOT NULL,                  -- "strong communicator", "relocation needed"
    created_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(org_id, candidate_id, tag)
);

-- ── Communication Log ─────────────────────────────────────────
-- Unified log for all communication: email, WhatsApp, SMS
communication_log (
    id              SERIAL PRIMARY KEY,
    org_id          INTEGER NOT NULL REFERENCES organizations(id),
    candidate_id    INTEGER NOT NULL REFERENCES candidates(id),
    channel         TEXT NOT NULL,                  -- email / whatsapp / sms
    direction       TEXT NOT NULL,                  -- outbound / inbound
    subject         TEXT,                           -- Email subject
    body            TEXT NOT NULL,
    template_id     INTEGER REFERENCES message_templates(id),
    status          TEXT DEFAULT 'queued',          -- queued / sent / delivered / read / failed / bounced
    magic_link      TEXT UNIQUE,
    link_clicked_at TIMESTAMP,
    sent_at         TIMESTAMP,
    delivered_at    TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ── Message Templates ─────────────────────────────────────────
message_templates (
    id              SERIAL PRIMARY KEY,
    org_id          INTEGER NOT NULL REFERENCES organizations(id),
    name            TEXT NOT NULL,                  -- "Initial Outreach", "Follow-up", "Rejection"
    channel         TEXT NOT NULL DEFAULT 'email',  -- email / whatsapp / sms
    category        TEXT NOT NULL,                  -- outreach / follow_up / rejection / offer / custom
    subject         TEXT,                           -- Email subject (supports {{variables}})
    body            TEXT NOT NULL,                  -- Body (supports {{candidate_name}}, {{role_name}}, etc.)
    is_default      BOOLEAN DEFAULT false,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ── Drip Sequences (Automated Follow-ups) ──────────────────────
drip_sequences (
    id              SERIAL PRIMARY KEY,
    org_id          INTEGER NOT NULL REFERENCES organizations(id),
    position_id     INTEGER REFERENCES positions(id),  -- NULL = org-wide
    name            TEXT NOT NULL,
    steps           JSONB NOT NULL,                 -- [{delay_hours, template_id, channel}]
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW()
);
```

---

## 4. API Design

### 4.1 Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/register` | Register org + admin user | None |
| POST | `/login` | Email/password login → JWT | None |
| GET | `/me` | Current user profile | JWT |
| GET | `/users` | List org users | JWT (admin) |
| POST | `/add-user` | Add team member | JWT (admin) |
| PATCH | `/users/{id}` | Update user role/status | JWT (admin) |
| POST | `/change-password` | Change own password | JWT |
| POST | `/forgot-password` | Request password reset | None |
| POST | `/reset-password` | Reset with token | None |

### 4.2 Chat (`/api/chat`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/stream` | SSE streaming message | JWT |
| POST | `/message` | Non-streaming (legacy) | JWT |
| GET | `/sessions` | List user's sessions | JWT |
| GET | `/sessions/{id}` | Full session with state | JWT |
| DELETE | `/sessions/{id}` | Delete session | JWT |
| PATCH | `/sessions/{id}/title` | Rename session | JWT |
| PUT | `/sessions/{id}/jd` | Save/update JD | JWT |
| POST | `/sessions/{id}/upload` | Upload reference JD | JWT |

### 4.3 Positions (`/api/positions`) [NEW]
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List all positions (filtered by dept) | JWT |
| GET | `/{id}` | Position detail with stats | JWT |
| PATCH | `/{id}` | Update position (status, settings) | JWT |
| PATCH | `/{id}/search-config` | Set auto-search interval | JWT |
| POST | `/{id}/search-now` | Trigger immediate search | JWT |
| DELETE | `/{id}` | Archive/delete position | JWT (admin) |

### 4.4 Candidates (`/api/candidates`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/position/{id}` | List candidates for position | JWT |
| GET | `/{id}` | Candidate detail + history | JWT |
| PATCH | `/{id}/status` | Update pipeline status | JWT |
| PATCH | `/{id}/notes` | Add recruiter notes | JWT |
| POST | `/search-async` | Trigger background search | JWT |
| POST | `/send-messages-async` | Send outreach via email/WhatsApp | JWT |
| POST | `/score` | Score a single resume | JWT |
| POST | `/{id}/upload-resume` | Upload resume PDF/DOCX | JWT |
| GET | `/{id}/communications` | Communication thread history | JWT |
| POST | `/{id}/tags` | Add tag to candidate | JWT |
| DELETE | `/{id}/tags/{tag}` | Remove tag | JWT |

### 4.5 Dashboard (`/api/dashboard`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/stats` | Aggregate stats (with trends) | JWT |
| GET | `/positions` | Positions with candidate counts | JWT |
| GET | `/pipeline/{position_id}` | Pipeline by stage | JWT |
| GET | `/funnel` | Hiring funnel data | JWT |
| GET | `/activity` | Recent activity timeline | JWT |
| GET | `/source-effectiveness` | Conversion rate by source channel | JWT |
| GET | `/time-in-stage` | Avg time per pipeline stage | JWT |
| GET | `/recruiter-performance` | Per-recruiter metrics | JWT (admin) |
| GET | `/reports/export` | Export CSV/PDF report | JWT |

### 4.6 Settings (`/api/settings`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/org` | Organization profile | JWT |
| PATCH | `/org` | Update org profile | JWT (admin) |
| GET | `/competitors` | List competitors | JWT |
| POST | `/competitors` | Add competitor | JWT (admin) |
| DELETE | `/competitors/{id}` | Remove competitor | JWT (admin) |
| GET | `/departments` | List departments | JWT |
| POST | `/departments` | Create department | JWT (admin) |
| PATCH | `/departments/{id}` | Update department | JWT (admin) |
| GET | `/screening-questions` | List screening questions (per dept) | JWT |
| POST | `/screening-questions` | Add screening question | JWT (admin) |
| PATCH | `/screening-questions/{id}` | Update question | JWT (admin) |
| DELETE | `/screening-questions/{id}` | Remove question | JWT (admin) |
| GET | `/message-templates` | List message templates | JWT |
| POST | `/message-templates` | Create template | JWT (admin) |
| PATCH | `/message-templates/{id}` | Update template | JWT (admin) |
| DELETE | `/message-templates/{id}` | Remove template | JWT (admin) |
| GET | `/scorecard-templates` | Default scorecard templates | JWT |
| POST | `/scorecard-templates` | Create scorecard template | JWT (admin) |

### 4.7 Notifications (`/api/notifications`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | Unread notifications | JWT |
| PATCH | `/{id}/read` | Mark as read | JWT |
| PATCH | `/session/{id}/read` | Mark session notifs read | JWT |

### 4.8 Apply (`/api/apply`) — Public
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/{token}` | Verify magic link, get position + screening form | None |
| POST | `/{token}` | Submit application (dynamic form responses) | None |

### 4.9 Interview Kit (`/api/interview-kit`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/position/{id}` | Get interview kit for position | JWT |
| POST | `/position/{id}/generate` | Generate/regenerate interview kit (AI) | JWT |
| PATCH | `/position/{id}` | Edit questions/scorecard | JWT |
| GET | `/position/{id}/share-link` | Get shareable link for interviewers | JWT |

### 4.10 Interviews & Scorecards (`/api/interviews`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/` | Create/schedule interview | JWT |
| GET | `/position/{id}` | List interviews for position | JWT |
| GET | `/candidate/{id}` | List interviews for candidate | JWT |
| GET | `/{id}` | Interview detail | JWT |
| PATCH | `/{id}` | Update interview (reschedule, cancel) | JWT |
| POST | `/{id}/self-schedule` | Generate self-scheduling link | JWT |
| PUT | `/self-schedule/{token}` | Candidate picks a slot (public) | None |
| POST | `/{id}/scorecards` | Submit scorecard | JWT |
| GET | `/{id}/scorecards` | Get all scorecards for interview | JWT |
| GET | `/candidate/{id}/scorecards` | Aggregate scores for candidate | JWT |

### 4.11 Talent Pool (`/api/talent-pool`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | Search talent pool (skills, tags, location) | JWT |
| POST | `/{candidate_id}/add` | Add candidate to talent pool | JWT |
| DELETE | `/{candidate_id}/remove` | Remove from talent pool | JWT |
| POST | `/suggest/{position_id}` | AI-suggest pool matches for position | JWT |
| POST | `/re-engage` | Send re-engagement campaign | JWT |
| POST | `/deduplicate` | Find and merge duplicate profiles | JWT |

### 4.12 Comments (`/api/comments`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/{entity_type}/{entity_id}` | List comments on entity | JWT |
| POST | `/{entity_type}/{entity_id}` | Add comment (supports @mentions) | JWT |
| PATCH | `/{id}` | Edit comment | JWT |
| DELETE | `/{id}` | Delete comment | JWT |

### 4.13 Communication (`/api/communications`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/send` | Send message (email/WhatsApp/SMS) | JWT |
| GET | `/candidate/{id}` | Communication thread for candidate | JWT |
| POST | `/drip-sequence` | Create automated drip sequence | JWT |
| GET | `/drip-sequences` | List drip sequences | JWT |
| PATCH | `/drip-sequences/{id}` | Update/pause drip sequence | JWT |

### 4.14 Career Page (`/api/careers`) — Public
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/{org_slug}` | Public career page with open positions | None |
| GET | `/{org_slug}/positions/{id}` | Public position detail | None |
| POST | `/{org_slug}/positions/{id}/apply` | Direct apply (no magic link) | None |

---

## 5. Agent Architecture

### 5.1 Multi-Agent Design
```
User Message
    │
    ▼
┌─────────────────────┐
│   HiringAgent       │ ← Orchestrator (agents/orchestrator.py)
│   (State Machine)   │
└─────────┬───────────┘
          │
    ┌─────┴──────┬──────────────┬────────────────┬──────────────┬──────────────┐
    ▼            ▼              ▼                ▼              ▼              ▼
┌────────┐ ┌──────────┐ ┌─────────────┐ ┌────────────┐ ┌──────────┐ ┌────────────┐
│Intake  │ │Internal  │ │Market       │ │Benchmarking│ │Drafting  │ │Interview   │
│Agent   │ │Analyst   │ │Intelligence │ │Agent       │ │Agent     │ │Kit Agent   │
└────────┘ └──────────┘ └─────────────┘ └────────────┘ └──────────┘ └────────────┘
    │            │              │                │              │              │
    │         ChromaDB       SQLite DB         Tavily         LLM         JD + Org
    │        (past JDs)    (competitors)     (web search)   (generate)   (context)
    ▼
  SSE tokens → Frontend
```

### 5.2 Agent State Machine
```
intake ──(requirements complete)──→ internal_review
                                         │
                              (user accepts/skips)
                                         │
                                         ▼
                                   market_review
                                         │
                              (user accepts/skips)
                                         │
                                         ▼
                                    jd_variants
                                         │
                                (user picks variant)
                                         │
                                         ▼
                                       done ──→ Position saved
```

### 5.3 Skills Matching Strategy
| Method | When to Use | Data Source |
|--------|-------------|------------|
| **Structured Match** | Exact skill comparison | `skills` + `position_skills` tables |
| **Semantic Search** | Find similar roles/skills | ChromaDB embeddings |
| **LLM Analysis** | Gap analysis, recommendations | GPT/Groq with structured prompts |

---

## 6. Security Plan

### 6.1 Authentication
- JWT tokens with `org_id` claim — every request is org-scoped
- bcrypt password hashing (10 rounds)
- Token expiry: 24 hours (configurable), with refresh mechanism
- Password rules: min 8 chars, 1 uppercase, 1 number, 1 special char
- Account lockout after 5 failed login attempts (15 min cooldown)

### 6.2 Authorization
- Role-based access control (admin / recruiter / hiring_manager)
- Department-scoped data filtering in middleware
- API endpoints validate `org_id` match before returning data

### 6.3 Data Protection
- HTTPS enforced in production
- PII fields (email, phone, salary) encrypted at rest
- SQL parameterized queries (already implemented)
- Request rate limiting (100 req/min per IP, 10 auth attempts/min)
- CORS whitelist (only frontend domain allowed)
- Magic link tokens expire after 72 hours

### 6.4 Audit Trail
- All auth events logged (login, logout, failed attempts)
- All data modifications logged (candidate status, position changes)
- Audit log includes: user, action, entity, timestamp, IP address

---

## 7. Background Tasks & Scheduling

### 7.1 Current: FastAPI BackgroundTasks
- Simple, in-process background execution
- Good for: candidate search, email sending
- Limitation: Lost if server restarts, no retry logic

### 7.2 Production: Celery + Redis
```
FastAPI → Celery Task Queue → Redis Broker → Celery Workers
                                                    │
                                               ┌────┴────┐
                                               │ Task 1  │ Candidate Search
                                               │ Task 2  │ ATS Scoring
                                               │ Task 3  │ Email Outreach
                                               │ Task 4  │ Scheduled Re-Search
                                               └─────────┘
```

### 7.3 Scheduled Tasks
| Task | Trigger | Description |
|------|---------|-------------|
| **Candidate Re-Search** | Configurable per position (e.g., every 72h) | Find new candidates for open positions |
| **Notification Cleanup** | Daily | Archive read notifications older than 30 days |
| **Session Cleanup** | Weekly | Remove abandoned sessions (no messages, > 7 days old) |
| **ATS Re-Score** | On JD update | Re-score all candidates when JD changes |

---

## 8. Error Handling & Monitoring

### Development
- Detailed stderr logging with emoji markers (✅ ❌ ⚠️ 🔍)
- Request/response logging middleware
- Validation error handler with body dumping

### Production
- **Sentry** for error tracking and alerting
- Structured JSON logging (with correlation IDs per request)
- Health check endpoint at `/` (already exists)
- Uptime monitoring (external service like UptimeRobot)
- Database connection pool monitoring
