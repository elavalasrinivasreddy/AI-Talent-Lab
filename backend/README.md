# Backend — AI Talent Lab

Python FastAPI backend powering the multi-agent JD automation system.

## Architecture

The backend uses a **node-based multi-agent architecture** where each agent is a focused specialist:

| Module | Purpose |
|--------|---------|
| `agent.py` | **Orchestrator** — routes requests to the correct agent based on `workflow_stage` |
| `nodes.py` | **Agent functions** — one function per agent (interviewer, internal analyst, benchmarking, drafting) |
| `state.py` | **State schema** — TypedDict defining the complete agent state |
| `config.py` | **LLM config** — supports Groq, OpenAI, Gemini via `.env` |
| `session_store.py` | **Memory** — in-memory session + state persistence |
| `tools.py` | **Utilities** — role name extraction |

## Prompts

All prompts are stored as `.md` files in `prompts/` for easy iteration:

| File | Agent | Output Format |
|------|-------|--------------|
| `interviewer_agent.md` | Intake Specialist | Conversational text + `[INTAKE_COMPLETE]` |
| `internal_agent.md` | Internal Analyst | JSON `{summary, skills[]}` |
| `benchmarking_agent.md` | Market Analyst | JSON `{summary, missing_skills[], differential_skills[]}` |
| `drafting_agent.md` | JD Writer | Markdown JD |

## Data Layer (`db/`)

| File | Technology | Purpose |
|------|-----------|---------|
| `database.py` | SQLite | Competitors table, positions tracking |
| `vector_store.py` | ChromaDB | Historical JD storage + semantic search |
| `search_tool.py` | Tavily API | Live web search for competitor JDs |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/chat/message` | Send user message, receive agent response |
| `GET` | `/api/chat/sessions` | List all sessions |
| `GET` | `/api/chat/sessions/{id}` | Get session history |
| `DELETE` | `/api/chat/sessions/{id}` | Delete session |
| `POST` | `/api/chat/sessions/{id}/upload` | Upload reference JD |

## Running

```bash
# From project root
python -m uvicorn backend.main:app --port 8000 --reload
```
