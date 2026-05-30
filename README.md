# AI Talent Lab 🤖

**Production-grade conversational AI hiring SaaS platform.**  
Recruiters create Job Descriptions through AI chat. Candidates apply via magic-link chat. Panel members submit feedback without needing an account. Everything is multi-tenant, org-scoped, and AI-powered end to end.

---

## ✨ What It Does

| Feature | Description |
|---|---|
| **AI JD Generation** | Recruiter chats with AI → 5-stage flow (role extraction → internal check → market benchmark → 3 JD variants → final streamed JD) |
| **Candidate Sourcing** | Background Celery job searches candidates, ATS-scores resumes via cosine similarity, sends magic-link email outreach |
| **Apply Chat** | Candidates apply through a conversational interface — no account, no forms, just a magic link |
| **Kanban Pipeline** | Drag-and-drop candidate pipeline with status history and timeline events |
| **Interview Scheduling** | Schedule rounds, manage panel members, send signed magic-link invitations |
| **Panel Feedback** | Panelists submit 4-dimension scorecards via public magic link — AI enriches raw notes, AI debrief synthesizes all feedback |
| **Talent Pool** | Org-wide reusable candidate database — bulk resume upload, AI match suggestions, auto-pool on reject/close |
| **Career Page** | Public, SEO-optimized job board per organization. Candidates apply directly from the career page |
| **Interview Kit** | AI generates tailored questions + scorecard template from the JD |
| **Dashboard** | Stats, pipeline funnel, activity feed, open positions overview |
| **Settings** | 11-tab org configuration — departments, users, email templates, screening questions, and more |
| **Notifications** | Real-time notification bell polling for application, interview, and feedback events |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React 18 + Vite)                   │
│                                                                 │
│  Auth  │  Dashboard  │  Chat/JD  │  Positions  │  Candidates   │
│  Talent Pool  │  Panel (public)  │  Apply (public)  │  Careers  │
└────────────────────────┬────────────────────────────────────────┘
                         │  REST + SSE
┌────────────────────────┴────────────────────────────────────────┐
│                    BACKEND (FastAPI)                            │
│                                                                 │
│  Routers (HTTP)  →  Services (business logic)  →  Repositories │
│                                                                 │
│  auth · chat · positions · candidates · interviews · panel      │
│  apply · talent_pool · careers · dashboard · notifications      │
│  settings                                                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              AI Agents (LangChain + Groq)               │   │
│  │  JD Generator · ATS Scorer · Candidate Chat             │   │
│  │  Feedback Enricher · Debrief Generator · Interview Kit  │   │
│  │  Role Extractor · Rejection Drafter                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌───────────────────┐   │
│  │  PostgreSQL  │   │    Redis     │   │  Celery Workers   │   │
│  │  (primary DB)│   │  (broker)    │   │  (background jobs)│   │
│  └──────────────┘   └──────────────┘   └───────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Three-Layer Backend Pattern (Never Skipped)
```
Router  →  Service  →  Repository
  ↑            ↑             ↑
HTTP layer  Business      SQL queries
            logic         (asyncpg)
```

---

## 🔄 Core Flows

### JD Generation (Recruiter Chat)
```
Recruiter sends message
  → role_extractor agent (identifies role, requirements)
  → internal_check (searches past JDs via embeddings)
  → market_benchmark (Tavily web search)
  → 3 JD variants generated (side-by-side editable cards)
  → Recruiter selects → bias check → Final JD (streamed)
  → [Launch Sourcing] → saves position + triggers background sourcing
```

### Candidate Sourcing (Background Job)
```
Celery task triggered
  → Source candidates (simulation/LinkedIn/Naukri adapter)
  → Parse resumes → generate embeddings
  → ATS score via cosine similarity vs JD embedding
  → Store scores + pipeline events
  → Email outreach with magic links (72h expiry, signed JWT)
```

### Candidate Apply (Magic Link Chat)
```
Candidate clicks link (email or career page)
  → verify JWT → load position context
  → Conversational chat: greeting → current role → resume upload → screening Qs
  → Application marked 'applied' → recruiter notified
```

### Panel Feedback Flow
```
Interview scheduled → panel magic links generated (7-day JWT, single-use)
  → Panelist opens link → submits 4-dimension scorecard + notes
  → [AI Enrich] → AI refines raw notes into professional summary
  → All panels submitted → [Generate Debrief] → AI synthesis report
  → Rejection path: rejection_drafter agent creates email draft
```

---

## 🚀 Quick Start

### Prerequisites
- Docker + Docker Compose
- Python 3.11+
- Node.js 18+

### 1 — Start Infrastructure
```bash
docker compose up -d
# Starts PostgreSQL 16 on :5432 and Redis 7 on :6379
```

### 2 — Backend
```bash
# From project root
cp .env.example .env
# Fill in: GROQ_API_KEY, TAVILY_API_KEY, JWT_SECRET (at minimum)

python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt

uvicorn backend.main:app --reload
# API available at http://localhost:8000
# Swagger docs at http://localhost:8000/docs
```

### 3 — Frontend
```bash
cd frontend
npm install
npm run dev
# App available at http://localhost:5173
```

### 4 — (Optional) Celery Worker
```bash
source .venv/bin/activate
celery -A backend.celery_app worker --loglevel=info
```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and set these:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `JWT_SECRET` | ✅ | Strong random secret (≥ 32 chars) |
| `LLM_PROVIDER` | ✅ | `groq` / `openai` / `gemini` |
| `GROQ_API_KEY` | If using Groq | Groq cloud API key |
| `OPENAI_API_KEY` | If using OpenAI | OpenAI API key |
| `GEMINI_API_KEY` | If using Gemini | Google Gemini API key |
| `TAVILY_API_KEY` | ✅ | Web search for market benchmark step |
| `EMAIL_PROVIDER` | No | `simulation` (default) / `resend` / `smtp` |
| `RESEND_API_KEY` | If using Resend | Resend.com API key |
| `CANDIDATE_SOURCE_ADAPTER` | No | `simulation` (default) / `linkedin` / `naukri` |
| `FRONTEND_URL` | No | CORS origin (default: `http://localhost:5173`) |
| `MAGIC_LINK_BASE_URL` | No | Base URL for magic links in emails |
| `APPLY_LINK_EXPIRY_HOURS` | No | Apply link lifetime in hours (default: 72) |
| `PANEL_LINK_EXPIRY_HOURS` | No | Panel feedback link lifetime in hours (default: 168) |
| `ENCRYPTION_KEY` | Prod only | AES-256 key for PII encryption |

Generate secrets:
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

---

## 📡 API Reference

All endpoints are versioned under `/api/v1/`. Full interactive docs at `/docs`.

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Public | Register org + first admin user |
| `POST` | `/api/v1/auth/login` | Public | Login, returns JWT |
| `GET` | `/api/v1/auth/me` | JWT | Current user profile |
| `POST` | `/api/v1/auth/users` | Admin | Add recruiter/manager to org |
| `POST` | `/api/v1/auth/forgot-password` | Public | Request password reset email |
| `POST` | `/api/v1/auth/reset-password` | Public | Complete password reset |

### Chat (JD Generation)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/chat/stream` | JWT | SSE streaming chat message |
| `GET` | `/api/v1/chat/sessions` | JWT | List chat sessions |
| `GET` | `/api/v1/chat/sessions/{id}` | JWT | Get session with message history |
| `DELETE` | `/api/v1/chat/sessions/{id}` | JWT | Discard session |

### Positions
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/positions/` | JWT | List positions (filter by dept/status) |
| `GET` | `/api/v1/positions/{id}` | JWT | Position detail + pipeline stats |
| `PATCH` | `/api/v1/positions/{id}` | JWT | Update position status/settings |
| `POST` | `/api/v1/positions/{id}/search-candidates` | JWT | Trigger candidate sourcing job |
| `GET` | `/api/v1/positions/{id}/interview-kit` | JWT | Get generated interview kit |
| `POST` | `/api/v1/positions/{id}/interview-kit/generate` | JWT | Generate/regenerate interview kit |

### Candidates
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/candidates/{id}` | JWT | Candidate profile + skill match |
| `GET` | `/api/v1/candidates/{id}/timeline` | JWT | Pipeline event timeline |
| `PATCH` | `/api/v1/candidates/{id}/status` | JWT | Move pipeline stage |
| `POST` | `/api/v1/candidates/{id}/select` | JWT | Mark candidate as selected |
| `POST` | `/api/v1/candidates/bulk-upload` | JWT | Upload resume files (text extracted, not stored) |

### Talent Pool
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/talent-pool/` | JWT | List pool (search, filter, paginate) |
| `POST` | `/api/v1/talent-pool/bulk-upload` | JWT | Upload up to 50 resumes |
| `POST` | `/api/v1/talent-pool/suggest/{position_id}` | JWT | AI match suggestions by JD embedding |
| `POST` | `/api/v1/talent-pool/{id}/add-to-position` | JWT | Move pool candidate to pipeline |
| `POST` | `/api/v1/talent-pool/{id}/add` | JWT | Manually add to pool |
| `DELETE` | `/api/v1/talent-pool/{id}/remove` | JWT | Remove from pool |

### Interviews & Panel
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/interviews/` | JWT | Schedule interview round |
| `GET` | `/api/v1/interviews/candidate/{id}` | JWT | List interviews for candidate |
| `GET` | `/api/v1/interviews/position/{id}` | JWT | List interviews for position |
| `PATCH` | `/api/v1/interviews/{id}` | JWT | Update interview round |
| `POST` | `/api/v1/interviews/{id}/send-invites` | JWT | Send panel magic link emails |
| `POST` | `/api/v1/interviews/{id}/generate-debrief` | JWT | AI debrief from all scorecards |
| `GET` | `/api/v1/panel/verify/{token}` | Public | Verify panel magic link |
| `POST` | `/api/v1/panel/{token}/enrich` | Public | AI enrich raw notes |
| `POST` | `/api/v1/panel/{token}/submit` | Public | Submit/draft scorecard |

### Apply (Public — Magic Link)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/apply/{token}` | Public | Verify apply token + load context |
| `POST` | `/api/v1/apply/{token}/message` | Public | Send chat message |
| `POST` | `/api/v1/apply/{token}/resume` | Public | Upload resume (text extracted) |
| `POST` | `/api/v1/apply/{token}/complete` | Public | Mark application complete |

### Career Page (Public — SEO)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/careers/{orgSlug}` | Public | Org career page + open positions |
| `GET` | `/api/v1/careers/{orgSlug}/positions/{id}` | Public | Position detail + full JD |
| `POST` | `/api/v1/careers/{orgSlug}/positions/{id}/apply` | Public | Start application from career page |

### Dashboard & Notifications
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/dashboard/stats` | JWT | Aggregate stats + period selector |
| `GET` | `/api/v1/dashboard/funnel` | JWT | Hiring funnel by stage |
| `GET` | `/api/v1/dashboard/positions` | JWT | Open positions with candidate counts |
| `GET` | `/api/v1/dashboard/activity` | JWT | Recent activity feed |
| `GET` | `/api/v1/notifications/` | JWT | Notification list |
| `PATCH` | `/api/v1/notifications/{id}/read` | JWT | Mark notification read |
| `PATCH` | `/api/v1/notifications/read-all` | JWT | Mark all read |

### Settings (11 tabs)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET/PATCH` | `/api/v1/settings/organization` | Admin | Org profile, branding, career page |
| `GET/POST` | `/api/v1/settings/departments` | Admin | Department management |
| `GET/POST` | `/api/v1/settings/users` | Admin | User management + roles |
| `GET/PATCH` | `/api/v1/settings/email-templates` | Admin | Outreach email templates |
| `GET/POST` | `/api/v1/settings/screening-questions` | Admin | Custom screening questions |
| `GET/PATCH` | `/api/v1/settings/pipeline` | Admin | Pipeline stage configuration |

---

## 🗂 Project Structure

```
AI Talent Lab/
├── backend/
│   ├── main.py                    # FastAPI app factory + router registration
│   ├── config.py                  # Settings (Pydantic BaseSettings)
│   ├── dependencies.py            # Auth dependency (get_current_user)
│   ├── celery_app.py              # Celery configuration
│   ├── adapters/
│   │   ├── llm/                   # LLM factory (Groq/OpenAI/Gemini)
│   │   ├── email/                 # Email adapters (Simulation/Resend/SMTP)
│   │   └── sourcing/              # Candidate sourcing adapters
│   ├── agents/
│   │   ├── orchestrator.py        # JD generation (5-stage LangGraph state machine)
│   │   ├── resume_parser.py       # Resume parsing, embedding, ATS scoring
│   │   ├── bias_checker.py        # JD bias detection agent
│   │   ├── candidate_chat.py      # Candidate apply chat controller
│   │   ├── interview_agents.py    # Feedback enricher, debrief, rejection drafter
│   │   ├── interview_kit.py       # Interview questions + scorecard generator
│   │   ├── streaming.py           # SSE streaming helpers
│   │   ├── state.py               # LangGraph shared state types
│   │   ├── nodes/                 # Individual LangGraph node functions
│   │   └── tools/                 # role_extractor.py, search.py (Tavily)
│   ├── db/
│   │   ├── connection.py          # asyncpg connection pool
│   │   ├── migrations.py          # CREATE TABLE IF NOT EXISTS migrations
│   │   └── repositories/          # SQL query layer (one file per domain)
│   ├── routers/                   # HTTP route handlers (thin layer)
│   ├── services/                  # Business logic layer
│   └── tasks/                     # Celery background tasks
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Auth/              # Login, Register, ForgotPassword
│       │   ├── Chat/              # Chat window, JD generation flow, cards
│       │   ├── Dashboard/         # Stats, funnel, positions, activity, AI copilot bar
│       │   ├── Analytics/         # Dedicated analytics page (time-to-fill, funnel, sources)
│       │   ├── Positions/         # Position list + detail (6 tabs)
│       │   │   └── tabs/          # Pipeline (grid+kanban), Candidates, JD, InterviewKit, Activity, Settings
│       │   ├── Candidates/        # Candidate detail (5 tabs)
│       │   │   └── tabs/          # Overview, Skills, Timeline, Resume, Interviews
│       │   ├── TalentPool/        # Bulk upload, AI suggest, candidate grid with contact status
│       │   ├── Careers/           # Public career page + position detail
│       │   ├── Apply/             # Candidate magic-link chat (consent → chat → resume → video → screening)
│       │   ├── Panel/             # Panelist feedback form (public)
│       │   ├── Interviews/        # Schedule interview modal with calendar availability
│       │   ├── Settings/          # Settings page (12 tabs including Privacy, Security, Integrations)
│       │   ├── Status/            # Candidate application status portal (public, permanent URL)
│       │   ├── GDPR/              # Delete my data + privacy page (public)
│       │   ├── DevAdmin/          # Dev-only admin tools (seed data, reset)
│       │   ├── Sidebar/           # App sidebar navigation
│       │   └── common/            # StatusBadge, ScoreCircle, NotificationBell, shared UI
│       ├── utils/
│       │   ├── api.js             # Centralised API client (typed helpers)
│       │   └── constants.js       # PIPELINE_STAGES, STATUS colors, icons
│       ├── contexts/              # AuthContext, NotificationContext
│       ├── styles/
│       │   └── globals.css        # CSS custom properties (design tokens)
│       └── router.jsx             # React Router v6 route config
│
├── docs/                          # Consolidated documentation (see docs/README.md)
│   ├── README.md                  # Master index
│   ├── STATUS.md                  # Redesign build-status tracker
│   ├── product/                   # Overview, features, roadmap
│   ├── architecture/              # Stack, data model, backend, AI agents, frontend
│   ├── design/                    # Design system + per-page specs (design/pages/)
│   ├── integrations/              # Calendar guide
│   └── TECH_DEBT.md
├── docker-compose.yml             # PostgreSQL 16 + Redis 7
└── .env.example                   # All environment variable documentation
```

---

## 🛡 Security Design

| Concern | Implementation |
|---|---|
| **Tenant isolation** | Every DB query filters by `org_id`. No cross-org data leakage possible |
| **Authentication** | bcrypt password hashing, signed JWT (HS256), configurable expiry |
| **Magic links** | Signed JWTs — apply links expire in 72h, panel links in 7 days |
| **Panel links** | Single-use — marked submitted on first use |
| **PII encryption** | AES-256 for CTC/compensation fields (via `ENCRYPTION_KEY`) |
| **Error responses** | Never expose stack traces — standard `{"error": {"code": "...", "message": "..."}}` format |
| **API versioning** | All routes under `/api/v1/` — never `/api/` without version |
| **Magic link tokens** | Never logged (token value excluded from request logging) |

---

## 🧱 Architecture Rules

These rules are enforced across the entire codebase:

1. **Three-layer architecture** — Routers → Services → Repositories. No layer skipped.
2. **Tenant isolation** — Every business data table has `org_id`. Every query filters by it.
3. **Background tasks via Celery** — No `FastAPI.BackgroundTasks`. Redis broker only.
4. **PostgreSQL everywhere** — Dev and prod. Docker Compose provides local Postgres. Never SQLite.
5. **Session persistence** — LangGraph state saved to DB after every agent node. Users can resume after refresh/restart.
6. **Resume as text** — Files extracted on upload, text stored in DB, file discarded. No disk/object storage.
7. **Embeddings stored once** — JD embedding on position create, resume embedding on parse. Reused — never regenerated.
8. **Status colors** — `StatusBadge` is the only place pipeline status color logic lives. No inline status colors.

---

## 🤖 AI Agents

| Agent | Purpose |
|---|---|
| `orchestrator.py` | 5-stage JD generation with LangGraph state machine (intake → internal → market → variants → final) |
| `resume_parser.py` | Resume text extraction, embedding generation, ATS cosine similarity scoring |
| `bias_checker.py` | Post-generation JD bias scan — non-blocking, highlights gendered or exclusionary language |
| `candidate_chat.py` | Multi-turn candidate apply conversation controller |
| `interview_kit.py` | 8–10 questions + 5-dimension scorecard from JD |
| `interview_agents.py` | Feedback enrichment, debrief synthesis, rejection email draft |
| `tools/role_extractor.py` | Extract role name + requirements from recruiter's first message |
| `tools/search.py` | Tavily web search for market benchmark step |

---

## 🖥 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, React Router v6, Vanilla CSS (custom properties) |
| **Backend** | FastAPI (Python 3.11+), asyncpg |
| **AI / LLM** | LangChain, LangGraph, Groq (default), switchable to OpenAI / Gemini |
| **Web Search** | Tavily API |
| **Database** | PostgreSQL 16 |
| **Cache / Broker** | Redis 7 |
| **Background Jobs** | Celery |
| **Auth** | PyJWT (HS256), bcrypt |
| **Email** | Simulation (dev), Resend, SMTP (adapter pattern) |
| **Candidate Source** | Simulation adapter (swap to LinkedIn / Naukri) |
| **Vector Search** | Embedding cosine similarity (stored in PostgreSQL JSON column) |

---

## 📋 Development Notes

- **Database migrations** run automatically on startup — `db/migrations.py` uses `CREATE TABLE IF NOT EXISTS`
- **First user** registered becomes org admin. Additional users added via Settings → Users
- **Career page URL** format: `/careers/{org-slug}` — slug auto-generated at registration
- **Panel feedback** magic links can only be submitted once — link is marked used on first successful submit
- **Resume files** are never stored — only extracted text + embedding go into the database
- **Org slug** is immutable after registration — used in career page URLs

---

## 📚 Documentation

All planning and architectural decisions live in `docs/`. Start at **[`docs/README.md`](docs/README.md)** — the master index. Quick map:

| Area | Where |
|---|---|
| Product overview, features (w/ build status), roadmap | `docs/product/` |
| Stack, data model, backend, AI agents, frontend | `docs/architecture/` |
| Design system + per-page specs | `docs/design/` (`docs/design/pages/NN_*.md`) |
| Redesign build status (what's done vs pending) | `docs/STATUS.md` |
| Calendar OAuth guide | `docs/integrations/calendar.md` |
| Production hardening tracker | `docs/TECH_DEBT.md` |

Each per-page spec in `docs/design/pages/` carries a **Build status** banner and merges
the v3 redesign spec with the pre-v3 behavioral spec (appendix).

---

*Built with ❤️ — AI Talent Lab*
