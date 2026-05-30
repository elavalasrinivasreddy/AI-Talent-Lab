# Architecture: Stack, Structure & Config

> Part of the consolidated docs. Start at [`docs/README.md`](../README.md) for the map.
> Siblings: [`02_data_model.md`](02_data_model.md) · [`03_backend.md`](03_backend.md) ·
> [`04_ai_agents.md`](04_ai_agents.md) · [`05_frontend.md`](05_frontend.md)

---

## 1. Tech stack

| Layer | Tech | Notes |
|---|---|---|
| Frontend | React 18 + Vite 5 | Vanilla CSS custom properties, React Router v6, Context API |
| Backend | FastAPI (Python 3.11+) | Async-first, SSE, Pydantic v2 |
| Relational DB | PostgreSQL 16 | Dev + prod via Docker Compose. asyncpg. Never SQLite in app code. |
| Vector store | ChromaDB | One job: finding similar past JDs in the internal-check stage. Lives at `backend/data/chroma/`. |
| ATS embeddings | Postgres JSON columns | Pairwise cosine in Python (`positions.jd_embedding`, `candidates.resume_embedding`) — not ChromaDB |
| Cache / broker | Redis 7 | Celery broker + rate limiting |
| Background jobs | Celery + beat | Candidate search, email blasts, follow-ups, GDPR cleanup |
| LLM | Groq (default) / OpenAI / Gemini | Switchable via `LLM_PROVIDER`; adapter in `backend/adapters/llm/factory.py` |
| LLM framework | LangChain + LangGraph | Multi-agent state machine for JD generation |
| Web search | Tavily | Market research step + default candidate sourcing adapter |
| Email | Resend / SMTP / simulation | Adapter pattern — never hardcode |
| Candidate sourcing | Tavily (default) / simulation / LinkedIn+Naukri (Phase 3) | Adapter pattern |
| Streaming | SSE | Chat token streaming |
| Auth | PyJWT (HS256) + bcrypt | Stateless JWT with `org_id` + `department_id` + `role` claims |

> **Note on the two "vector" stories.** Two different jobs, two different stores:
> ChromaDB for *search across many JDs* (internal-check), Postgres JSON + Python
> cosine for *pairwise JD↔resume* (ATS scoring). Earlier docs claimed "no ChromaDB" —
> that was wrong; `backend/data/chroma/chroma.sqlite3` is live.

---

## 2. Three-layer architecture

```
Routers (HTTP)        backend/routers/*.py
  validate input (Pydantic), call services, return responses
  NEVER query DB, NEVER hold business logic
Services (business)   backend/services/*.py
  all logic + decisions, orchestrate repos + adapters
  no HTTP, no SQL, no direct external calls
Repositories+Adapters backend/db/repositories/*.py + backend/adapters/*
  SQL + external API calls, return clean data, make no decisions
```

Rule: each layer calls only the layer directly below it.

---

## 3. Backend project structure

```
backend/
├── main.py              # app factory, middleware + router registration
├── config.py            # Pydantic BaseSettings — env vars validated on startup
├── dependencies.py      # FastAPI Depends() — auth, db session, tenant context
├── exceptions.py        # custom exceptions + global handlers
├── models/              # Pydantic request/response schemas (auth.py defines VALID_ORG_ROLES)
├── db/
│   ├── connection.py
│   ├── migrations.py    # ALL CREATE TABLE — runs on startup. SOURCE OF TRUTH for schema.
│   ├── vector_store.py  # ChromaDB init, embed_jd(), search_similar()
│   └── repositories/    # one class per entity, pure SQL
├── routers/             # 20 routers — see 03_backend.md
├── services/            # business logic
├── agents/              # LangGraph state machine + standalone agents — see 04_ai_agents.md
├── adapters/            # candidate_sources/ · email/ · llm/ · calendar/
├── middleware/          # cors, rate_limiter, request_logger, tenant_context
├── tasks/               # Celery workers (candidate_pipeline, email_outreach, scheduled_search)
├── utils/               # security, validators, pagination, events
└── tests/

backend/data/            # runtime, gitignored except chroma index
├── chroma/              # ChromaDB vector store
└── uploads/             # transient resume files (text is extracted then file discarded)
```

---

## 4. Frontend project structure (high level)

```
frontend/src/
├── router.jsx           # all routes (see 05_frontend.md for the live route list)
├── api/                 # client.js (axios) + stream.js (SSE) + endpoints/
├── context/             # AuthContext, ChatContext, NotificationContext, ThemeContext
├── hooks/
├── styles/              # globals.css = design tokens (SOURCE OF TRUTH). Per-page CSS files.
├── components/
│   ├── common/          # shared primitives
│   └── <Feature>/       # one folder per surface (Chat, Dashboard, Positions, ...)
└── utils/               # formatters, validators, constants.js (PIPELINE_STAGES), permissions
```

Full design-system tokens live in [`design/00_design_system.md`](../design/00_design_system.md).

---

## 5. Config (`backend/config.py` Settings)

Env-driven; app fails on startup if `JWT_SECRET` is missing.

| Var | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://talentlab:talentlab@localhost:5432/talentlab_dev` | Postgres DSN |
| `REDIS_URL` | `redis://localhost:6379/0` | Celery broker + cache |
| `JWT_SECRET` | *(required)* | JWT signing |
| `JWT_EXPIRY_HOURS` | 24 | Token lifetime |
| `LLM_PROVIDER` | `groq` | `groq` / `openai` / `gemini` |
| `GROQ_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` | "" | per-provider keys |
| `TAVILY_API_KEY` | "" | market research + sourcing |
| `EMAIL_PROVIDER` | `simulation` | `simulation` / `resend` / `smtp` |
| `RESEND_API_KEY` / `SMTP_*` | "" | email transport |
| `CANDIDATE_SOURCE_ADAPTER` | `tavily` | sourcing adapter (was `simulation`) |
| `APPLY_LINK_EXPIRY_HOURS` | 72 | apply magic link |
| `PANEL_LINK_EXPIRY_HOURS` | 168 | panel magic link (7 days) |
| `RESET_LINK_EXPIRY_HOURS` | 24 | password reset link |
| `ENCRYPTION_KEY` | "" | AES-256 for CTC fields (required in prod) |
| `FRONTEND_URL` / `MAGIC_LINK_BASE_URL` | localhost:5173 | links + CORS whitelist |

Switching dev → prod is a single `.env` swap; app code only reads `DATABASE_URL`.

---

## 6. Local dev

```bash
docker compose up -d        # Postgres + Redis
# backend (env from .env via Settings):
./.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
# celery worker + beat:
celery -A backend.celery_app worker --loglevel=info
celery -A backend.celery_app beat --loglevel=info
# frontend (proxies /api → :8000 per vite.config.js):
cd frontend && npm run dev   # :5173
```

Celery beat schedule: `scheduled_search` hourly, `send_followup_reminders` hourly.
Config (`task_acks_late`, `task_reject_on_worker_lost`, retries=3) makes tasks survive
worker crashes.
