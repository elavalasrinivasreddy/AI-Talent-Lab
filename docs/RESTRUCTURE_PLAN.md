# AI Talent Lab — Folder Restructure Plan

> From prototype to production-grade architecture. No MVP — built for scale from day one.

---

## Problems With Current Structure

| # | Problem | Impact |
|---|---------|--------|
| 1 | **`database.py` is a 420-line monolith** — all 8 table schemas + 30+ query functions in one file | Unmaintainable, impossible to test individual modules |
| 2 | **No models/schemas layer** — no Pydantic models for request/response validation | No input validation, no API documentation, no type safety |
| 3 | **DB files (`*.db`, `*.sqlite`) live inside code directory** | Get accidentally committed, no separation of data from code |
| 4 | **`agent.py` is 700 lines** — orchestrator, SSE streaming, all stages in one file | Hard to extend, debug, or modify individual stages |
| 5 | **No middleware** — no rate limiting, no request logging, no tenant context | Security gaps, no observability |
| 6 | **No error handling layer** — exceptions handled ad-hoc in each router | Inconsistent error responses, information leaks |
| 7 | **No config validation** — env vars read with fallbacks, no Pydantic Settings | Silent misconfiguration, hard to debug |
| 8 | **No tests at all** | No confidence in changes, no regression protection |
| 9 | **Single 39KB CSS file** — all styles in one `index.css` | Hard to find/modify styles, naming collisions |
| 10 | **No `__init__.py` files** in some packages | Import issues, unclear package boundaries |
| 11 | **`session_store.py` uses raw SQLite** separately from main DB | Two database connection patterns, inconsistent |
| 12 | **No department isolation** — `org_id` exists but no `dept_id` anywhere | Can't add scoping later without touching every query |

---

## Proposed Structure — Production-Grade

### Backend

```
backend/
├── __init__.py
├── main.py                         # FastAPI app factory, middleware registration
├── config.py                       # Pydantic BaseSettings — validated config
├── dependencies.py                 # FastAPI Depends() — auth, db session, tenant context
├── exceptions.py                   # Custom exceptions + global exception handlers
│
├── models/                         # Pydantic models (request/response schemas)
│   ├── __init__.py
│   ├── auth.py                     # LoginRequest, RegisterRequest, UserResponse, TokenResponse
│   ├── chat.py                     # MessageRequest, SessionResponse, StreamEvent
│   ├── positions.py                # PositionCreate, PositionUpdate, PositionResponse
│   ├── candidates.py               # CandidateResponse, CandidateStatusUpdate, SearchRequest
│   ├── dashboard.py                # StatsResponse, FunnelResponse, ActivityResponse
│   ├── settings.py                 # OrgProfileUpdate, CompetitorCreate, DepartmentCreate
│   └── notifications.py            # NotificationResponse
│
├── db/                             # Database layer
│   ├── __init__.py
│   ├── connection.py               # Connection factory, pool (SQLite now → PostgreSQL later)
│   ├── migrations.py               # Schema creation/migration (all CREATE TABLE statements)
│   ├── repositories/               # Data access layer — one file per entity
│   │   ├── __init__.py
│   │   ├── organizations.py        # OrgRepository — CRUD for orgs
│   │   ├── users.py                # UserRepository — CRUD for users
│   │   ├── departments.py          # DeptRepository — CRUD for departments
│   │   ├── positions.py            # PositionRepository — CRUD for positions
│   │   ├── candidates.py           # CandidateRepository — CRUD + filtering
│   │   ├── applications.py         # ApplicationRepository
│   │   ├── notifications.py        # NotificationRepository
│   │   ├── competitors.py          # CompetitorRepository
│   │   ├── sessions.py             # ChatSessionRepository (merge session_store here)
│   │   └── audit.py                # AuditLogRepository
│   └── vector_store.py             # ChromaDB — stays as-is
│
├── routers/                        # API endpoints — thin layer, delegates to services
│   ├── __init__.py
│   ├── auth.py                     # /api/auth/*
│   ├── chat.py                     # /api/chat/*
│   ├── positions.py                # /api/positions/*
│   ├── candidates.py               # /api/candidates/*
│   ├── dashboard.py                # /api/dashboard/*
│   ├── settings.py                 # /api/settings/*
│   ├── notifications.py            # /api/notifications/*
│   └── apply.py                    # /api/apply/* (public, no auth)
│
├── services/                       # Business logic — the "brain" of each module
│   ├── __init__.py
│   ├── auth_service.py             # Login, register, password hashing, JWT
│   ├── position_service.py         # Position lifecycle, search scheduling
│   ├── candidate_service.py        # Sourcing orchestration, ATS scoring, email
│   ├── dashboard_service.py        # Stats aggregation, funnel computation
│   ├── notification_service.py     # Create/read notifications
│   └── settings_service.py         # Org profile, competitors, departments
│
├── agents/                         # AI agent system (was agent.py + nodes.py)
│   ├── __init__.py
│   ├── orchestrator.py             # HiringAgent — state machine (was agent.py core)
│   ├── streaming.py                # SSE event formatting + streaming logic
│   ├── state.py                    # AgentState TypedDict
│   ├── nodes/                      # Individual agent nodes
│   │   ├── __init__.py
│   │   ├── interviewer.py          # Intake agent
│   │   ├── internal_analyst.py     # Internal skills check (ChromaDB)
│   │   ├── market_intelligence.py  # Market research (Tavily)
│   │   ├── benchmarking.py         # Benchmarking agent
│   │   └── drafting.py             # JD drafting agent
│   ├── prompts/                    # System prompts
│   │   ├── interviewer.md
│   │   ├── internal_analyst.md
│   │   ├── benchmarking.md
│   │   └── drafting.md
│   └── tools/                      # Agent tools
│       ├── search.py               # Web search (Tavily)
│       └── role_extractor.py       # Title extraction from messages
│
├── adapters/                       # External service adapters
│   ├── __init__.py
│   ├── candidate_sources/          # Job portal adapters
│   │   ├── __init__.py
│   │   ├── base.py                 # CandidateSourceAdapter ABC
│   │   ├── simulation.py           # LLM-based simulation
│   │   ├── linkedin.py             # LinkedIn API (stub)
│   │   └── naukri.py               # Naukri API (stub)
│   ├── email/                      # Email providers
│   │   ├── __init__.py
│   │   ├── base.py                 # EmailProvider ABC
│   │   ├── simulation.py           # Console logging
│   │   ├── resend.py               # Resend API
│   │   └── smtp.py                 # SMTP provider
│   └── llm/                        # LLM providers
│       ├── __init__.py
│       └── factory.py              # get_llm() — Groq/OpenAI/Gemini
│
├── middleware/                     # Request processing middleware
│   ├── __init__.py
│   ├── cors.py                     # CORS configuration
│   ├── rate_limiter.py             # Rate limiting
│   ├── request_logger.py           # Request/response logging with correlation IDs
│   └── tenant_context.py           # Extracts org_id + dept_id from JWT → request state
│
├── tasks/                          # Background workers
│   ├── __init__.py
│   ├── candidate_pipeline.py       # Source + score + notify
│   ├── email_outreach.py           # Mass email sending
│   └── scheduled_search.py         # Periodic candidate re-search
│
├── utils/                          # Shared utilities
│   ├── __init__.py
│   ├── security.py                 # Password hashing, JWT encode/decode, magic links
│   ├── validators.py               # Email, phone, password validation
│   └── pagination.py               # Pagination helpers
│
└── tests/                          # Test suite
    ├── __init__.py
    ├── conftest.py                  # Fixtures: test DB, test client, mock auth
    ├── test_auth.py
    ├── test_chat.py
    ├── test_positions.py
    ├── test_candidates.py
    ├── test_dashboard.py
    └── test_settings.py
```

### Frontend

```
frontend/src/
├── App.jsx                         # Root — router setup, providers
├── main.jsx                        # Vite entry
│
├── api/
│   └── client.js                   # Axios instance, SSE, all API functions
│
├── hooks/                          # Custom React hooks [NEW]
│   ├── useAuth.js                  # Auth context hook (extract from context)
│   ├── useChat.js                  # Chat context hook
│   ├── useNotifications.js         # Notification context hook
│   └── useDebounce.js              # Debounce hook for search inputs
│
├── context/
│   ├── AuthContext.jsx
│   ├── ChatContext.jsx
│   └── NotificationContext.jsx
│
├── styles/                         # Split CSS [NEW — replace single 39KB index.css]
│   ├── globals.css                 # CSS custom properties, resets, typography
│   ├── layout.css                  # Sidebar, main container, responsive breakpoints
│   ├── components.css              # Buttons, inputs, cards, badges — reusable tokens
│   ├── auth.css                    # Login, register pages
│   ├── chat.css                    # Chat window, messages, streaming
│   ├── dashboard.css               # Dashboard, stats, funnel
│   ├── positions.css               # Position detail, pipeline board
│   ├── candidates.css              # Candidate detail, skills match
│   ├── settings.css                # Settings page tabs
│   ├── apply.css                   # Public application page
│   └── notifications.css           # Notification bell, dropdown
│
├── components/
│   ├── common/                     # Shared UI components [NEW]
│   │   ├── StatusBadge.jsx
│   │   ├── SkillChip.jsx
│   │   ├── EmptyState.jsx
│   │   ├── LoadingSpinner.jsx
│   │   ├── ConfirmDialog.jsx
│   │   ├── Pagination.jsx
│   │   └── PageHeader.jsx
│   │
│   ├── Auth/
│   │   ├── LoginPage.jsx
│   │   └── RegisterPage.jsx
│   │
│   ├── Sidebar/
│   │   ├── Sidebar.jsx
│   │   ├── ProductBrand.jsx
│   │   ├── NewHireButton.jsx
│   │   ├── ActiveRoles.jsx
│   │   ├── AnalyticsLink.jsx
│   │   └── UserProfile.jsx
│   │
│   ├── Chat/
│   │   ├── ChatWindow.jsx
│   │   ├── ChatTopBar.jsx
│   │   ├── MessageList.jsx
│   │   ├── MessageBubble.jsx
│   │   ├── MessageInput.jsx
│   │   ├── StreamedText.jsx
│   │   ├── FileUploader.jsx
│   │   ├── AgentRecommendations.jsx
│   │   ├── JDOverviewCards.jsx
│   │   ├── JDFullView.jsx
│   │   └── CandidatesPanel.jsx
│   │
│   ├── Dashboard/
│   │   ├── DashboardPage.jsx
│   │   ├── StatsCards.jsx          # Extract from DashboardPage [NEW]
│   │   ├── HiringFunnel.jsx        # Extract from DashboardPage [NEW]
│   │   ├── ActivityTimeline.jsx     # [NEW]
│   │   └── PositionsTable.jsx       # Extract from DashboardPage [NEW]
│   │
│   ├── Positions/                  # [NEW]
│   │   ├── PositionDetailPage.jsx
│   │   ├── PipelineBoard.jsx
│   │   ├── PositionJDTab.jsx
│   │   └── PositionSettingsTab.jsx
│   │
│   ├── Candidates/                 # [NEW]
│   │   ├── CandidateDetailPage.jsx
│   │   ├── SkillsMatchCard.jsx
│   │   └── CandidateHistory.jsx
│   │
│   ├── Settings/                   # Move from Dashboard/ [RESTRUCTURE]
│   │   └── SettingsPage.jsx
│   │
│   ├── Notifications/
│   │   └── NotificationBell.jsx
│   │
│   └── Apply/
│       └── ApplyPage.jsx
│
└── utils/                          # Frontend utilities [NEW]
    ├── formatters.js               # Date, currency, number formatting
    ├── validators.js               # Form validation helpers
    └── constants.js                # Pipeline stages, status colors, etc.
```

---

## Key Changes Explained

### Backend

| Change | Why |
|--------|-----|
| **`database.py` → `db/repositories/`** | Split 420-line monolith into ~10 focused files. Each entity gets its own repository with CRUD operations. |
| **Add `models/`** | Pydantic request/response schemas. Every API endpoint gets type-safe validation. No more `dict` → DB writes. |
| **`agent.py` → `agents/`** | Split 700-line orchestrator into: `orchestrator.py` (state machine), `streaming.py` (SSE), individual nodes in `nodes/`. |
| **`services/` → actual business logic** | Currently services are mixed concerns. Each service encapsulates one domain (positions, candidates, auth). Routers call services, services call repositories. |
| **Add `adapters/`** | Candidate sources, email providers, LLM providers — each with a base ABC + implementations. Clean adapter pattern. |
| **Add `middleware/`** | CORS, rate limiting, request logging, tenant context injection. Applied in `main.py`. |
| **`session_store.py` → `db/repositories/sessions.py`** | Merge into the repository pattern. One connection factory, one pattern. |
| **Add `utils/`** | Security (JWT, bcrypt, magic links), validators, pagination — shared across modules. |
| **Add `dependencies.py`** | FastAPI `Depends()` for auth, DB session, tenant context. Keeps routers thin. |
| **Add `exceptions.py`** | Custom exceptions (NotFound, Unauthorized, Forbidden, ValidationError) + global handler. Consistent error responses. |
| **DB files → `data/` directory** | SQLite/ChromaDB files stored in `data/` (gitignored), not inside code. |
| **Add `tests/`** | Pytest test suite with fixtures for test DB, mock auth, test client. |

### Frontend

| Change | Why |
|--------|-----|
| **`index.css` → `styles/` folder** | Split 39KB CSS into ~11 focused files. Each page/component group gets its own stylesheet. |
| **Add `hooks/`** | Extract `useAuth`, `useChat`, `useNotifications` as proper custom hooks. |
| **Add `utils/`** | Formatters, validators, constants shared across components. |
| **Add `common/` components** | Reusable UI primitives: StatusBadge, SkillChip, EmptyState, Pagination, etc. |
| **Dashboard sub-components** | Break DashboardPage into StatsCards, HiringFunnel, ActivityTimeline, PositionsTable. |
| **Move SettingsPage** | From `Dashboard/` to its own `Settings/` folder. It's a separate page, not a dashboard sub-page. |

---

## Data Directory (Gitignored)

```
data/                               # All runtime data — GITIGNORED
├── talent_lab.db                    # SQLite database
├── chroma/                          # ChromaDB vector store
├── uploads/                         # Uploaded files (resumes, reference JDs)
└── logs/                            # Application logs
```

Add to `.gitignore`:
```
data/
*.db
*.sqlite
```

---

## The 3-Layer Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Routers (API Layer)                │
│  Thin controllers — validate input, call services   │
│  Uses: Pydantic models, FastAPI Depends()           │
├─────────────────────────────────────────────────────┤
│                Services (Business Logic)             │
│  Core logic — orchestrates repositories + adapters   │
│  No HTTP knowledge, no DB queries                    │
├─────────────────────────────────────────────────────┤
│          Repositories / Adapters (Data Layer)        │
│  Data access — SQL queries, API calls, LLM calls     │
│  Returns clean data, no business decisions           │
└─────────────────────────────────────────────────────┘
```

**Rule**: Each layer only calls the layer below it. Never skip layers.

---

## Migration Strategy

Since we want production-level from day one, we restructure **before** building new features:

### Step 1: Create the new folder structure (empty files)
### Step 2: Move existing code into new locations
- `database.py` → split into `db/connection.py` + `db/migrations.py` + individual repositories
- `agent.py` → split into `agents/orchestrator.py` + `agents/streaming.py`
- `nodes.py` → split into individual files under `agents/nodes/`
- `session_store.py` → merge into `db/repositories/sessions.py`
- `config.py` → convert to Pydantic `BaseSettings`
- `services/` → refactor into proper domain services

### Step 3: Add the missing layers
- `models/` — Pydantic schemas for every endpoint
- `middleware/` — CORS, rate limiter, logger
- `dependencies.py` — FastAPI Depends
- `exceptions.py` — global error handling
- `utils/` — security, validators

### Step 4: Frontend parallel restructure
- Split `index.css` into `styles/` folder
- Add `hooks/`, `utils/`, `common/`
- Move SettingsPage to its own folder

### Step 5: Verify everything still works
- Run backend, test all existing endpoints
- Run frontend, test all existing pages
- No new features — just restructure

---

## Product Improvements (As Owner)

Beyond structure, here's what I'd add to the product plan:

### 1. Department Isolation — From Day One
Every query function in repositories will accept `org_id` + `department_id`. Even if department features aren't built yet, the data model and query patterns support it.

### 2. Proper Error Responses
```json
{
  "error": {
    "code": "POSITION_NOT_FOUND",
    "message": "Position with ID 42 not found",
    "details": null
  }
}
```
Not just `{"detail": "Not found"}`.

### 3. Request/Response Logging
Every API call logged with:
- Correlation ID (for tracing)
- User ID, Org ID
- Endpoint, method, status code
- Response time

### 4. Proper Config Management
```python
class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "sqlite:///data/talent_lab.db"
    
    # Auth
    JWT_SECRET: str  # No default — must be set
    JWT_EXPIRY_HOURS: int = 24
    
    # LLM
    LLM_PROVIDER: str = "groq"
    GROQ_API_KEY: str = ""
    
    class Config:
        env_file = ".env"
```
App crashes on startup if required vars are missing — no silent failures.

### 5. Health Check Endpoint
```
GET /health → { "status": "ok", "db": "connected", "version": "1.0.0" }
```

### 6. API Versioning
Prefix all routes with `/api/v1/` from the start. When v2 comes, old clients still work.
