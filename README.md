# AI Talent Lab 🤖

**AI-Powered Hiring SaaS Platform** — End-to-end recruitment automation from JD generation to candidate pipeline management.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  FRONTEND (React + Vite)                 │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐   │
│  │  Login  │ │Dashboard │ │ Chat/JD  │ │ Apply Page  │   │
│  └────┬────┘ └────┬─────┘ └────┬─────┘ └──────┬──────┘   │
│       └───────────┴────────────┴───────────────┘         │
│                         │  SSE + REST                    │
└─────────────────────────┼────────────────────────────────┘
                          │
┌─────────────────────────┼─────────────────────────────────┐
│                 BACKEND (FastAPI)                         │
│  ┌────────┐ ┌────────┐ ┌──────────┐ ┌────────────────┐    │
│  │  Auth  │ │  Chat  │ │Candidates│ │   Dashboard    │    │
│  │Router  │ │Router  │ │  Router  │ │    Router      │    │
│  └───┬────┘ └───┬────┘ └────┬─────┘ └───────┬────────┘    │
│      │          │           │                │            │
│  ┌───┴──────────┴───────────┴────────────────┴────────┐   │
│  │              Services Layer                        │   │
│  │  HiringAgent │ ATS Scorer │ Email Service │ Auth   │   │
│  └──────────────────────────┬─────────────────────────┘   │
│                             │                             │
│  ┌──────────┐  ┌────────────┼─────────────┐               │
│  │ ChromaDB │  │       SQLite (WAL)       │               │
│  │ (vectors)│  │  sessions, users, orgs,  │               │
│  │          │  │  positions, candidates,  │               │
│  │          │  │  emails, applications    │               │
│  └──────────┘  └──────────────────────────┘               │
└───────────────────────────────────────────────────────────┘
```

## Flow

```
Login/Register → Chat (JD Intake)
                     │
                     ▼
          Interviewer Agent (streaming)
                     │
                     ▼
          Internal JD Check (ChromaDB)
                     │
                     ▼
          Market Benchmark (Web Search)
                     │
                     ▼
          3 JD Variants → User picks one
                     │
                     ▼
          Final JD (streamed from LLM)
                     │
                     ▼
          Source Candidates (Adapter Pattern)
                     │
                     ▼
          ATS Score → Email Outreach (Magic Link)
                     │
                     ▼
          Candidate Applies → Dashboard View
```

## Quick Start

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env  # Configure API keys
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 → Register an account → Start creating JDs.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `LLM_PROVIDER` | `groq` / `openai` / `gemini` | Yes |
| `GROQ_API_KEY` | Groq API key | If using groq |
| `OPENAI_API_KEY` | OpenAI API key | If using openai |
| `GEMINI_API_KEY` | Google Gemini API key | If using gemini |
| `TAVILY_API_KEY` | Tavily web search API key | Yes |
| `JWT_SECRET` | Secret for JWT signing | Set in production |
| `EMAIL_PROVIDER` | `simulation` / `resend` / `smtp` | No (default: simulation) |
| `RESEND_API_KEY` | Resend.com API key | If using resend |

## API Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register org + admin |
| POST | `/api/auth/login` | No | Login, returns JWT |
| POST | `/api/auth/add-user` | Admin | Add recruiter/manager |
| GET  | `/api/auth/me` | Yes | Current user profile |

### Chat (SSE Streaming)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/chat/stream` | Yes | SSE streaming chat |
| POST | `/api/chat/message` | Yes | Non-streaming (legacy) |
| GET  | `/api/chat/sessions` | Yes | List sessions |
| GET  | `/api/chat/sessions/{id}` | Yes | Get session history |
| DELETE | `/api/chat/sessions/{id}` | Yes | Delete session |

### Candidates
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/candidates/search` | Yes | Source candidates (adapter) |
| GET  | `/api/candidates/position/{id}` | Yes | List candidates for position |
| POST | `/api/candidates/score` | Yes | ATS resume scoring |
| POST | `/api/candidates/send-emails` | Yes | Email outreach w/ magic links |
| PATCH | `/api/candidates/{id}/status` | Yes | Update pipeline status |

### Dashboard
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/dashboard/stats` | Yes | Aggregate stats |
| GET | `/api/dashboard/positions` | Yes | Positions + candidate counts |
| GET | `/api/dashboard/pipeline/{id}` | Yes | Candidates by stage |
| GET | `/api/dashboard/funnel` | Yes | Hiring funnel data |

### Application (Public)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET  | `/api/apply/{token}` | No | Verify magic link |
| POST | `/api/apply/{token}` | No | Submit application |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Backend | FastAPI + LangChain + LangGraph |
| LLM | Groq / OpenAI / Gemini (configurable) |
| Database | SQLite (WAL) — PostgreSQL-ready via repository pattern |
| Vector DB | ChromaDB (historical JD similarity) |
| Auth | bcrypt + PyJWT |
| Email | Resend / SMTP / Simulation (adapter pattern) |
| Candidate Sourcing | Adapter pattern (Simulation → LinkedIn/Naukri swap) |
