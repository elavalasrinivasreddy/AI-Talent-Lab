# Operations Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "System Health" tab to the Analytics page tracking: Celery task success/failure rates and candidate yield, LLM token usage and cost per operation, and JD lifecycle metrics (generation time, cost, success rate, position lifecycle by month).

**Architecture:** Two new DB tables (`llm_usage_log`, `task_run_log`) + one new column (`positions.jd_status`) + a LangChain callback-based LLM logger using Python `contextvars` for org/operation context propagation. LLM costs are configurable in `settings.py`. Frontend adds a tabbed layout to the existing Analytics page — Tab 1 stays "Agent ROI" (unchanged), Tab 2 is new "System Health".

**Tech Stack:** Python/asyncpg (DB), LangChain `BaseCallbackHandler` (LLM logging), Celery `try/finally` (task logging), React + vanilla CSS (frontend). No new npm or pip dependencies.

---

## Context (read before touching anything)

- **LLM factory:** `backend/adapters/llm/factory.py` — `get_llm()` returns a LangChain `BaseChatModel`. Provider set via `LLM_PROVIDER` env var (groq/openai/gemini). All agents call `get_llm()` — this is the single instrumentation point.
- **LangChain token counts:** After a `model.ainvoke()` call, token usage is in `response.usage_metadata` on the `AIMessage`, or in `llm_output['token_usage']` on the `LLMResult` passed to `on_llm_end`. Both paths are needed since providers report differently.
- **Celery tasks:** `backend/tasks/candidate_pipeline.py` has three tasks:
  - `run_candidate_search` (line 26) — full sourcing pipeline, calls `_run_pipeline()`
  - `source_candidates_for_position` (line 268) — lighter wrapper
  - `score_candidate_application` (line 299) — ATS scoring
- **Pipeline async pattern:** Celery tasks are sync wrappers; real logic is in `async def _run_pipeline()` and `async def _score_application()`. Add logging in the async functions, not the Celery task decorators.
- **Config:** `backend/config.py` has a `settings` object with `LLM_PROVIDER`, API keys, etc. New LLM price config goes here.
- **Migrations pattern:** `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='X' AND column_name='Y') THEN ...; END IF; END $$;` — idempotent, safe to re-run. Appended at end of `run_migrations()`.
- **Analytics page route:** `/analytics` renders `AnalyticsPage.jsx`. The tabs wrapper goes in that file — no router change needed.
- **`jd_status` column**: Does NOT exist yet on `positions` table. Add via migration.
- **No Anthropic SDK used directly** — only LangChain adapters. No `anthropic.messages.create()` calls to intercept.

---

## File Map

| File | Action |
|------|--------|
| `backend/db/migrations.py` | Add `llm_usage_log` table, `task_run_log` table, `positions.jd_status` column |
| `backend/config.py` | Add `LLM_PRICE_INPUT_PER_MTOK`, `LLM_PRICE_OUTPUT_PER_MTOK` config fields |
| `backend/services/llm_usage_logger.py` | **New** — LangChain callback + contextvars infrastructure |
| `backend/adapters/llm/factory.py` | Wire `LLMUsageCallback` into every `get_llm()` call |
| `backend/agents/nodes/` | Add `llm_context()` wrapper to key JD generation node |
| `backend/tasks/candidate_pipeline.py` | Add task run logging to `_run_pipeline()` and `_score_application()` |
| `backend/services/ops_service.py` | **New** — query methods for celery stats, LLM cost, JD metrics |
| `backend/routers/dashboard.py` | Add 3 new GET endpoints (`/ops/celery`, `/ops/llm`, `/ops/jd`) |
| `frontend/src/utils/api.js` | Add 3 new methods to `dashboardApi` |
| `frontend/src/components/Analytics/OpsTab.jsx` | **New** — System Health tab orchestrator |
| `frontend/src/components/Analytics/CeleryHealthCard.jsx` | **New** |
| `frontend/src/components/Analytics/LLMCostCard.jsx` | **New** |
| `frontend/src/components/Analytics/JDMetricsCard.jsx` | **New** |
| `frontend/src/components/Analytics/OpsTab.css` | **New** |
| `frontend/src/components/Analytics/AnalyticsPage.jsx` | Add tabs (Agent ROI / System Health) |
| `frontend/src/components/Analytics/AnalyticsPage.css` | Add tab styling |

---

## Task 1 — DB: Create `llm_usage_log` and `task_run_log` tables + `positions.jd_status`

**File:** `backend/db/migrations.py`

- [ ] **Step 1: Find `run_migrations(conn)` and append at the end, after all existing migrations**

```python
    # ── Ops Intelligence tables ─────────────────────────────────────────────
    ops_sql = """
    CREATE TABLE IF NOT EXISTS llm_usage_log (
        id          SERIAL PRIMARY KEY,
        org_id      INTEGER,
        operation   VARCHAR(60) NOT NULL DEFAULT 'unknown',
        model       VARCHAR(80) NOT NULL DEFAULT 'unknown',
        input_tokens  INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cost_usd    NUMERIC(12, 6) NOT NULL DEFAULT 0,
        duration_ms INTEGER,
        success     BOOLEAN NOT NULL DEFAULT true,
        error_code  VARCHAR(50),
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_llm_usage_org_op
        ON llm_usage_log(org_id, operation, created_at DESC);

    CREATE TABLE IF NOT EXISTS task_run_log (
        id              SERIAL PRIMARY KEY,
        org_id          INTEGER,
        task_type       VARCHAR(60) NOT NULL,
        position_id     INTEGER,
        status          VARCHAR(20) NOT NULL DEFAULT 'success',
        candidates_found INTEGER,
        candidates_processed INTEGER,
        duration_ms     INTEGER,
        error_message   TEXT,
        celery_task_id  VARCHAR(200),
        created_at      TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_task_run_org_type
        ON task_run_log(org_id, task_type, created_at DESC);
    """
    await conn.execute(ops_sql)
    logger.info("  llm_usage_log and task_run_log tables ensured.")

    # Add jd_status to positions
    await conn.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='positions' AND column_name='jd_status'
        ) THEN
            ALTER TABLE positions
                ADD COLUMN jd_status VARCHAR(20) NOT NULL DEFAULT 'na';
            COMMENT ON COLUMN positions.jd_status IS
                'na | draft | pending_review | approved | rejected';
        END IF;
    END $$;
    """)
    logger.info("  positions.jd_status column ensured.")
```

- [ ] **Step 2: Restart backend and verify in logs**

```bash
uvicorn backend.main:app --reload
# Expect:
#   llm_usage_log and task_run_log tables ensured.
#   positions.jd_status column ensured.
```

- [ ] **Step 3: Commit**

```bash
git add backend/db/migrations.py
git commit -m "feat(ops): add llm_usage_log, task_run_log tables and positions.jd_status"
```

---

## Task 2 — Config: Add LLM pricing fields

**File:** `backend/config.py`

LLM pricing is stored as configurable settings (per 1M tokens) so they can be updated without a code change when providers change prices.

- [ ] **Step 1: Open `backend/config.py` and find the `Settings` class**

It's a Pydantic `BaseSettings` model. Add these fields at the end of the class, before any `model_config` or `Config` inner class:

```python
    # LLM cost tracking (USD per 1M tokens, configurable per provider)
    # Defaults match Groq's llama-3.3-70b-versatile pricing (as of 2026-06)
    # Override in .env: LLM_PRICE_INPUT_PER_MTOK=0.59 LLM_PRICE_OUTPUT_PER_MTOK=0.79
    LLM_PRICE_INPUT_PER_MTOK: float = 0.59   # USD per 1M input tokens
    LLM_PRICE_OUTPUT_PER_MTOK: float = 0.79  # USD per 1M output tokens
```

- [ ] **Step 2: Commit**

```bash
git add backend/config.py
git commit -m "feat(ops): add LLM pricing fields to settings"
```

---

## Task 3 — Backend: `llm_usage_logger.py` service

**File:** `backend/services/llm_usage_logger.py` (new file)

This module provides:
1. Python `contextvars` to carry `org_id` and `operation` through async call chains
2. A LangChain `BaseCallbackHandler` that fires on every LLM response
3. A `llm_context()` context manager for callers to set the context

- [ ] **Step 1: Create `backend/services/llm_usage_logger.py`**

```python
"""
services/llm_usage_logger.py — LangChain callback-based LLM usage tracking.

Usage in agent nodes:
    from backend.services.llm_usage_logger import llm_context

    with llm_context(org_id=42, operation="jd_generation"):
        result = await llm.ainvoke(messages)
"""
import time
import logging
import contextvars
from contextlib import contextmanager
from typing import Any, Dict, List, Optional

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult

from backend.config import settings

logger = logging.getLogger(__name__)

# ── Context vars (propagate through async tasks automatically) ────────────────

_ctx_org_id    = contextvars.ContextVar('llm_org_id',    default=None)
_ctx_operation = contextvars.ContextVar('llm_operation', default='unknown')
_ctx_model     = contextvars.ContextVar('llm_model',     default='unknown')


@contextmanager
def llm_context(org_id: int, operation: str, model: str = 'unknown'):
    """
    Context manager to set LLM call metadata for usage tracking.

    with llm_context(org_id=org_id, operation='jd_generation', model='llama-3.3-70b'):
        result = await llm.ainvoke(...)
    """
    t1 = _ctx_org_id.set(org_id)
    t2 = _ctx_operation.set(operation)
    t3 = _ctx_model.set(model)
    try:
        yield
    finally:
        _ctx_org_id.reset(t1)
        _ctx_operation.reset(t2)
        _ctx_model.reset(t3)


# ── LangChain callback handler ────────────────────────────────────────────────

class LLMUsageCallback(BaseCallbackHandler):
    """
    Fires after every LLM call. Reads token counts from the LLMResult and
    writes a row to llm_usage_log. Safe to use as a singleton — all state
    is read from contextvars, which are per-async-task.
    """
    _start: Optional[float] = None

    def on_llm_start(
        self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any
    ) -> None:
        self._start = time.time()

    def on_chat_model_start(
        self, serialized: Dict[str, Any], messages: List[List[Any]], **kwargs: Any
    ) -> None:
        self._start = time.time()

    async def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        duration_ms = int((time.time() - (self._start or time.time())) * 1000)
        org_id    = _ctx_org_id.get()
        operation = _ctx_operation.get()
        model     = _ctx_model.get()

        # Extract token counts — providers report via different paths
        input_tokens  = 0
        output_tokens = 0

        # Path 1: llm_output (OpenAI / Groq style)
        lo = response.llm_output or {}
        tu = lo.get("token_usage") or lo.get("usage") or {}
        input_tokens  = tu.get("prompt_tokens", 0) or tu.get("input_tokens", 0)
        output_tokens = tu.get("completion_tokens", 0) or tu.get("output_tokens", 0)

        # Path 2: usage_metadata on AIMessage (Gemini / newer LangChain)
        if not input_tokens:
            for gens in response.generations:
                for gen in gens:
                    um = getattr(getattr(gen, "message", None), "usage_metadata", None) or {}
                    input_tokens  += um.get("input_tokens", 0)
                    output_tokens += um.get("output_tokens", 0)

        if not (input_tokens or output_tokens):
            return  # nothing to log

        cost_usd = (
            input_tokens  / 1_000_000 * settings.LLM_PRICE_INPUT_PER_MTOK +
            output_tokens / 1_000_000 * settings.LLM_PRICE_OUTPUT_PER_MTOK
        )

        try:
            from backend.db.connection import get_connection
            async with get_connection() as conn:
                await conn.execute(
                    """
                    INSERT INTO llm_usage_log
                        (org_id, operation, model, input_tokens, output_tokens,
                         cost_usd, duration_ms, success)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, true)
                    """,
                    org_id, operation, model,
                    input_tokens, output_tokens, cost_usd, duration_ms,
                )
        except Exception as exc:
            logger.warning(f"LLM usage logging failed (non-fatal): {exc}")

    async def on_llm_error(self, error: Exception, **kwargs: Any) -> None:
        duration_ms = int((time.time() - (self._start or time.time())) * 1000)
        org_id    = _ctx_org_id.get()
        operation = _ctx_operation.get()
        model     = _ctx_model.get()
        try:
            from backend.db.connection import get_connection
            async with get_connection() as conn:
                await conn.execute(
                    """
                    INSERT INTO llm_usage_log
                        (org_id, operation, model, input_tokens, output_tokens,
                         cost_usd, duration_ms, success, error_code)
                    VALUES ($1, $2, $3, 0, 0, 0, $4, false, $5)
                    """,
                    org_id, operation, model, duration_ms, type(error).__name__,
                )
        except Exception as exc:
            logger.warning(f"LLM error logging failed: {exc}")


# Singleton — attached to every LLM instance via get_llm()
llm_usage_callback = LLMUsageCallback()
```

- [ ] **Step 2: Commit**

```bash
git add backend/services/llm_usage_logger.py
git commit -m "feat(ops): add LLMUsageCallback + llm_context infrastructure"
```

---

## Task 4 — Wire LLM logging into `get_llm()` factory

**File:** `backend/adapters/llm/factory.py`

Add the callback to every LLM instance returned by `get_llm()`.

- [ ] **Step 1: Add the import at the top of `factory.py`**

After the existing imports, add:

```python
from backend.services.llm_usage_logger import llm_usage_callback
```

- [ ] **Step 2: Add `callbacks` to every provider instantiation**

For each `return ...` in `get_llm()`, add `callbacks=[llm_usage_callback]`:

```python
    if provider == "groq":
        from langchain_groq import ChatGroq
        return ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model_name=model or "llama-3.3-70b-versatile",
            callbacks=[llm_usage_callback],   # ADD THIS
            **common_kwargs,
        )

    elif provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            api_key=settings.OPENAI_API_KEY,
            model=model or "gpt-4o-mini",
            callbacks=[llm_usage_callback],   # ADD THIS
            **common_kwargs,
        )

    elif provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            google_api_key=settings.GEMINI_API_KEY,
            model=model or "gemini-2.0-flash",
            callbacks=[llm_usage_callback],   # ADD THIS
            **common_kwargs,
        )
```

- [ ] **Step 3: Instrument the JD generation agent node**

First, find the JD generation node:
```bash
grep -rn "jd_generation\|generate_jd\|drafting\|draft_jd\|jd_draft" backend/agents/nodes/ --include="*.py" | head -20
```

In the file that calls `llm.ainvoke()` or `llm.invoke()` for JD generation, add:

```python
from backend.services.llm_usage_logger import llm_context

# Wrap the LLM call — get org_id from state dict
org_id = state.get("org_id") or state.get("org", {}).get("id")
model_name = settings.LLM_PROVIDER + "-" + (model_override or "default")

with llm_context(org_id=org_id, operation="jd_generation", model=model_name):
    result = await llm.ainvoke(messages)
```

> **Note:** The `operation` string is what appears in the UI. Use these standard operation names:
> - `"jd_generation"` — JD drafting nodes
> - `"ats_scoring"` — ATS score computation
> - `"outreach_draft"` — outreach email drafting
> - `"candidate_evaluation"` — bias checker, feedback enricher
> - `"interview_kit"` — interview question generation
> - `"rejection_draft"` — rejection email drafting

- [ ] **Step 4: Commit**

```bash
git add backend/adapters/llm/factory.py backend/agents/
git commit -m "feat(ops): wire LLM usage callback into factory and key agent nodes"
```

---

## Task 5 — Instrument Celery tasks

**File:** `backend/tasks/candidate_pipeline.py`

Add `task_run_log` inserts to the two core async functions.

- [ ] **Step 1: Add import at top of `candidate_pipeline.py`**

```python
import time
```

- [ ] **Step 2: Wrap `_run_pipeline()` with try/finally logging**

Find `async def _run_pipeline(position_id, org_id, ...)`. Add a `start` timer at the top and a `try/finally` block to log completion:

```python
async def _run_pipeline(
    position_id: int, org_id: int, department_id: int, triggered_by: int = None
):
    _task_start = time.time()
    _sourced_count = 0

    try:
        logger.info(f"[Pipeline] Starting search for position {position_id} (org {org_id})")

        # ... ALL EXISTING CODE UNCHANGED ...
        # At the point where sourced_count is finalized, also set:
        #   _sourced_count = sourced_count

        # The existing code already sets `sourced_count` — just assign:
        # find the line `sourced_count += 1` and after the loop ends, add:
        _sourced_count = sourced_count

    except Exception as exc:
        _duration = int((time.time() - _task_start) * 1000)
        try:
            async with get_connection() as conn:
                await conn.execute(
                    """INSERT INTO task_run_log
                       (org_id, task_type, position_id, status, duration_ms, error_message)
                       VALUES ($1, 'candidate_search', $2, 'failed', $3, $4)""",
                    org_id, position_id, _duration, str(exc)[:500],
                )
        except Exception:
            pass
        raise

    finally:
        _duration = int((time.time() - _task_start) * 1000)
        if _sourced_count > 0:  # only log success if we made it through
            try:
                async with get_connection() as conn:
                    await conn.execute(
                        """INSERT INTO task_run_log
                           (org_id, task_type, position_id, status,
                            candidates_found, duration_ms)
                           VALUES ($1, 'candidate_search', $2, 'success', $3, $4)""",
                        org_id, position_id, _sourced_count, _duration,
                    )
            except Exception:
                pass
```

> **Important:** The `except` block only fires on genuine exceptions (task failure). The `finally` block fires always. The `if _sourced_count > 0` guard prevents double-logging success when an exception was raised. If you prefer cleaner logic, use a `_task_failed` boolean flag instead.

- [ ] **Step 3: Instrument `_score_application()`**

Find `async def _score_application(...)`. Add the same start/try/finally pattern:

```python
async def _score_application(candidate_id, application_id, position_id, org_id):
    _start = time.time()
    try:
        # ... ALL EXISTING CODE ...
        _duration = int((time.time() - _start) * 1000)
        async with get_connection() as conn:
            await conn.execute(
                """INSERT INTO task_run_log
                   (org_id, task_type, position_id, status,
                    candidates_processed, duration_ms)
                   VALUES ($1, 'ats_scoring', $2, 'success', 1, $3)""",
                org_id, position_id, _duration,
            )
    except Exception as exc:
        _duration = int((time.time() - _start) * 1000)
        try:
            async with get_connection() as conn:
                await conn.execute(
                    """INSERT INTO task_run_log
                       (org_id, task_type, position_id, status,
                        duration_ms, error_message)
                       VALUES ($1, 'ats_scoring', $2, 'failed', $3, $4)""",
                    org_id, position_id, _duration, str(exc)[:500],
                )
        except Exception:
            pass
        raise
```

- [ ] **Step 4: Commit**

```bash
git add backend/tasks/candidate_pipeline.py
git commit -m "feat(ops): instrument candidate_pipeline Celery tasks with task_run_log"
```

---

## Task 6 — Backend: `OpsService` query methods

**File:** `backend/services/ops_service.py` (new file)

```python
"""
services/ops_service.py — Operational intelligence queries.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from backend.db.connection import get_connection

logger = logging.getLogger(__name__)


class OpsService:

    @staticmethod
    async def get_celery_stats(org_id: int, period: str = "quarter") -> dict:
        """Celery task health: success/fail counts, yield, success rate."""
        _now = datetime.now(timezone.utc).replace(tzinfo=None)
        period_days = {"week": 7, "month": 30, "quarter": 90, "year": 365}.get(period, 90)
        cutoff = _now - timedelta(days=period_days)

        async with get_connection() as conn:
            rows = await conn.fetch(
                """
                SELECT
                    task_type,
                    COUNT(*) FILTER (WHERE status = 'success') AS successes,
                    COUNT(*) FILTER (WHERE status = 'failed')  AS failures,
                    COUNT(*)                                    AS total,
                    ROUND(AVG(candidates_found) FILTER (WHERE status='success' AND candidates_found IS NOT NULL), 1)
                        AS avg_candidates,
                    ROUND(AVG(duration_ms) FILTER (WHERE status='success'), 0)
                        AS avg_duration_ms
                FROM task_run_log
                WHERE org_id = $1 AND created_at >= $2
                GROUP BY task_type
                ORDER BY total DESC
                """,
                org_id, cutoff,
            )

        result = []
        for r in rows:
            total = r["total"] or 1
            result.append({
                "task_type": r["task_type"],
                "successes": r["successes"] or 0,
                "failures": r["failures"] or 0,
                "total": r["total"] or 0,
                "success_rate": round(100 * (r["successes"] or 0) / total, 1),
                "avg_candidates": float(r["avg_candidates"] or 0),
                "avg_duration_ms": int(r["avg_duration_ms"] or 0),
            })

        return {"tasks": result, "period": period}

    @staticmethod
    async def get_llm_stats(org_id: int, period: str = "quarter") -> dict:
        """LLM usage: tokens, cost, and per-operation breakdown."""
        _now = datetime.now(timezone.utc).replace(tzinfo=None)
        period_days = {"week": 7, "month": 30, "quarter": 90, "year": 365}.get(period, 90)
        cutoff = _now - timedelta(days=period_days)

        async with get_connection() as conn:
            totals = await conn.fetchrow(
                """
                SELECT
                    SUM(input_tokens)   AS total_input,
                    SUM(output_tokens)  AS total_output,
                    SUM(cost_usd)       AS total_cost,
                    COUNT(*)            AS total_calls,
                    COUNT(*) FILTER (WHERE NOT success) AS failed_calls,
                    ROUND(AVG(duration_ms) FILTER (WHERE success), 0) AS avg_duration_ms
                FROM llm_usage_log
                WHERE org_id = $1 AND created_at >= $2
                """,
                org_id, cutoff,
            )
            by_op = await conn.fetch(
                """
                SELECT
                    operation,
                    COUNT(*) AS calls,
                    SUM(input_tokens)  AS input_tokens,
                    SUM(output_tokens) AS output_tokens,
                    ROUND(SUM(cost_usd), 4) AS cost_usd,
                    ROUND(AVG(duration_ms) FILTER (WHERE success), 0) AS avg_ms
                FROM llm_usage_log
                WHERE org_id = $1 AND created_at >= $2
                GROUP BY operation
                ORDER BY cost_usd DESC
                """,
                org_id, cutoff,
            )

        return {
            "period": period,
            "total_input_tokens":  int(totals["total_input"]  or 0),
            "total_output_tokens": int(totals["total_output"] or 0),
            "total_cost_usd":      round(float(totals["total_cost"] or 0), 4),
            "total_calls":         int(totals["total_calls"]  or 0),
            "failed_calls":        int(totals["failed_calls"] or 0),
            "avg_duration_ms":     int(totals["avg_duration_ms"] or 0),
            "by_operation": [
                {
                    "operation":     r["operation"],
                    "calls":         r["calls"],
                    "input_tokens":  int(r["input_tokens"]  or 0),
                    "output_tokens": int(r["output_tokens"] or 0),
                    "cost_usd":      float(r["cost_usd"]    or 0),
                    "avg_ms":        int(r["avg_ms"]         or 0),
                }
                for r in by_op
            ],
        }

    @staticmethod
    async def get_jd_stats(org_id: int, period: str = "quarter") -> dict:
        """JD lifecycle: generation stats and position status distribution by month."""
        _now = datetime.now(timezone.utc).replace(tzinfo=None)
        period_days = {"week": 7, "month": 30, "quarter": 90, "year": 365}.get(period, 90)
        cutoff = _now - timedelta(days=period_days)

        async with get_connection() as conn:
            # JD generation performance from llm_usage_log
            jd_gen = await conn.fetchrow(
                """
                SELECT
                    COUNT(*)                              AS total_generations,
                    COUNT(*) FILTER (WHERE success)       AS successful,
                    COUNT(*) FILTER (WHERE NOT success)   AS failed,
                    ROUND(AVG(duration_ms) FILTER (WHERE success), 0)      AS avg_duration_ms,
                    ROUND(AVG(cost_usd)    FILTER (WHERE success), 6)      AS avg_cost_usd,
                    ROUND(SUM(cost_usd), 4)                                 AS total_cost_usd
                FROM llm_usage_log
                WHERE org_id = $1
                  AND operation = 'jd_generation'
                  AND created_at >= $2
                """,
                org_id, cutoff,
            )

            # Position lifecycle by current status
            status_dist = await conn.fetch(
                """
                SELECT status, COUNT(*) AS count
                FROM positions
                WHERE org_id = $1 AND created_at >= $2
                GROUP BY status
                """,
                org_id, cutoff,
            )

            # Monthly position opening trend (last 6 months regardless of period filter)
            monthly_trend = await conn.fetch(
                """
                SELECT
                    DATE_TRUNC('month', created_at) AS month,
                    COUNT(*) AS opened,
                    COUNT(*) FILTER (WHERE status = 'closed')   AS closed,
                    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
                    COUNT(*) FILTER (WHERE status = 'on_hold')  AS on_hold
                FROM positions
                WHERE org_id = $1
                  AND created_at >= NOW() - INTERVAL '6 months'
                GROUP BY month
                ORDER BY month
                """,
                org_id,
            )

            # JD status distribution
            jd_status_dist = await conn.fetch(
                """
                SELECT jd_status, COUNT(*) AS count
                FROM positions
                WHERE org_id = $1 AND created_at >= $2
                GROUP BY jd_status
                """,
                org_id, cutoff,
            )

        total_gen = jd_gen["total_generations"] or 0
        return {
            "period": period,
            "jd_generation": {
                "total":          total_gen,
                "successful":     int(jd_gen["successful"]     or 0),
                "failed":         int(jd_gen["failed"]         or 0),
                "success_rate":   round(100 * (jd_gen["successful"] or 0) / max(total_gen, 1), 1),
                "avg_duration_ms": int(jd_gen["avg_duration_ms"] or 0),
                "avg_cost_usd":   float(jd_gen["avg_cost_usd"]   or 0),
                "total_cost_usd": float(jd_gen["total_cost_usd"] or 0),
            },
            "status_distribution": {r["status"]: r["count"] for r in status_dist},
            "jd_status_distribution": {r["jd_status"]: r["count"] for r in jd_status_dist},
            "monthly_trend": [
                {
                    "month":     r["month"].isoformat() if r["month"] else None,
                    "opened":    r["opened"],
                    "closed":    r["closed"],
                    "cancelled": r["cancelled"],
                    "on_hold":   r["on_hold"],
                }
                for r in monthly_trend
            ],
        }
```

- [ ] **Step 1: Create the file with the above content**

- [ ] **Step 2: Commit**

```bash
git add backend/services/ops_service.py
git commit -m "feat(ops): add OpsService with celery, llm, and jd stats query methods"
```

---

## Task 7 — Backend: Add 3 ops endpoints to the router

**File:** `backend/routers/dashboard.py`

- [ ] **Step 1: Add import at the top of `dashboard.py`**

```python
from backend.services.ops_service import OpsService
```

- [ ] **Step 2: Add the three endpoints after the existing analytics endpoints**

```python
@router.get("/ops/celery")
async def get_celery_stats(
    period: str = Query("quarter", pattern="^(week|month|quarter|year)$"),
    current_user=Depends(get_current_user),
):
    """Celery task health: success rate, candidate yield, timing."""
    return await OpsService.get_celery_stats(
        org_id=current_user["org_id"],
        period=period,
    )


@router.get("/ops/llm")
async def get_llm_stats(
    period: str = Query("quarter", pattern="^(week|month|quarter|year)$"),
    current_user=Depends(get_current_user),
):
    """LLM token usage and cost breakdown by operation."""
    return await OpsService.get_llm_stats(
        org_id=current_user["org_id"],
        period=period,
    )


@router.get("/ops/jd")
async def get_jd_stats(
    period: str = Query("quarter", pattern="^(week|month|quarter|year)$"),
    current_user=Depends(get_current_user),
):
    """JD generation performance + position lifecycle stats."""
    return await OpsService.get_jd_stats(
        org_id=current_user["org_id"],
        period=period,
    )
```

- [ ] **Step 3: Verify routes exist**

```bash
curl -s http://localhost:8000/openapi.json | python3 -c "
import json,sys
paths = json.load(sys.stdin)['paths']
[print(p) for p in paths if 'ops' in p]
"
# Expected: 3 lines containing /ops/celery, /ops/llm, /ops/jd
```

- [ ] **Step 4: Commit**

```bash
git add backend/routers/dashboard.py
git commit -m "feat(ops): add /ops/celery, /ops/llm, /ops/jd router endpoints"
```

---

## Task 8 — Frontend: API client methods

**File:** `frontend/src/utils/api.js`

- [ ] **Step 1: Add 3 new methods to `dashboardApi`**

```js
  getCeleryStats: (period) =>
    api.get(`/api/v1/dashboard/ops/celery?period=${encodeURIComponent(period)}`),

  getLLMStats: (period) =>
    api.get(`/api/v1/dashboard/ops/llm?period=${encodeURIComponent(period)}`),

  getJDStats: (period) =>
    api.get(`/api/v1/dashboard/ops/jd?period=${encodeURIComponent(period)}`),
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/utils/api.js
git commit -m "feat(ops): add getCeleryStats, getLLMStats, getJDStats API methods"
```

---

## Task 9 — Frontend: `CeleryHealthCard` component

**File:** `frontend/src/components/Analytics/CeleryHealthCard.jsx`

```jsx
const TASK_LABELS = {
  candidate_search: 'Candidate Search',
  ats_scoring:      'ATS Scoring',
  outreach_send:    'Outreach',
}

function RateBar({ rate }) {
  const color = rate >= 90
    ? 'var(--color-success, #10B981)'
    : rate >= 70
    ? 'var(--color-warning, #D97706)'
    : 'var(--color-danger, #EF4444)'
  return (
    <div className="ops-rate-bar-wrap">
      <div className="ops-rate-bar">
        <div className="ops-rate-fill" style={{ width: `${rate}%`, background: color }} />
      </div>
      <span className="ops-rate-label" style={{ color }}>{rate}%</span>
    </div>
  )
}

export default function CeleryHealthCard({ data, loading }) {
  if (loading) {
    return (
      <div className="analytics-card ops-card">
        <h3 className="analytics-card-title">Background Tasks</h3>
        <div className="skeleton-block" style={{ height: 160, marginTop: 12, borderRadius: 8 }} />
      </div>
    )
  }

  const tasks = data?.tasks || []

  return (
    <div className="analytics-card ops-card">
      <h3 className="analytics-card-title">Background Tasks</h3>
      {tasks.length === 0 ? (
        <p className="analytics-empty">No task runs recorded yet. Tasks log after the first pipeline run.</p>
      ) : (
        <div className="ops-task-list">
          {tasks.map(t => (
            <div key={t.task_type} className="ops-task-row">
              <div className="ops-task-meta">
                <span className="ops-task-name">
                  {TASK_LABELS[t.task_type] || t.task_type}
                </span>
                <span className="ops-task-count">{t.total} runs</span>
              </div>
              <RateBar rate={t.success_rate} />
              <div className="ops-task-detail">
                {t.avg_candidates > 0 && (
                  <span>~{t.avg_candidates} candidates/run</span>
                )}
                {t.avg_duration_ms > 0 && (
                  <span>{(t.avg_duration_ms / 1000).toFixed(1)}s avg</span>
                )}
                <span className="ops-task-fail">
                  {t.failures} failed
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Commit after creating the file**

```bash
git add frontend/src/components/Analytics/CeleryHealthCard.jsx
git commit -m "feat(ops): add CeleryHealthCard component"
```

---

## Task 10 — Frontend: `LLMCostCard` component

**File:** `frontend/src/components/Analytics/LLMCostCard.jsx`

```jsx
const OP_LABELS = {
  jd_generation:       'JD Generation',
  ats_scoring:         'ATS Scoring',
  outreach_draft:      'Outreach Draft',
  candidate_evaluation: 'Candidate Eval',
  interview_kit:       'Interview Kit',
  rejection_draft:     'Rejection Draft',
  unknown:             'Other',
}

function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default function LLMCostCard({ data, loading }) {
  if (loading) {
    return (
      <div className="analytics-card ops-card">
        <h3 className="analytics-card-title">LLM Usage &amp; Cost</h3>
        <div className="skeleton-block" style={{ height: 200, marginTop: 12, borderRadius: 8 }} />
      </div>
    )
  }
  if (!data) return null

  const totalCost = data.total_cost_usd ?? 0
  const ops = data.by_operation || []
  const maxCost = Math.max(...ops.map(o => o.cost_usd), 0.0001)

  return (
    <div className="analytics-card ops-card">
      <h3 className="analytics-card-title">LLM Usage &amp; Cost</h3>

      {/* Summary row */}
      <div className="ops-llm-summary">
        <div className="ops-llm-stat">
          <span className="ops-llm-val">${totalCost < 0.01 ? totalCost.toFixed(4) : totalCost.toFixed(2)}</span>
          <span className="ops-llm-lbl">Total cost</span>
        </div>
        <div className="ops-llm-stat">
          <span className="ops-llm-val">{fmt(data.total_input_tokens + data.total_output_tokens)}</span>
          <span className="ops-llm-lbl">Total tokens</span>
        </div>
        <div className="ops-llm-stat">
          <span className="ops-llm-val">{data.total_calls}</span>
          <span className="ops-llm-lbl">Calls</span>
        </div>
      </div>

      {/* Token breakdown */}
      <div className="ops-token-row">
        <span className="ops-token-in">↓ {fmt(data.total_input_tokens)} in</span>
        <span className="ops-token-out">↑ {fmt(data.total_output_tokens)} out</span>
      </div>

      {/* Per-operation cost bars */}
      {ops.length > 0 && (
        <div className="ops-op-list">
          {ops.map(op => (
            <div key={op.operation} className="ops-op-row">
              <span className="ops-op-name">
                {OP_LABELS[op.operation] || op.operation}
              </span>
              <div className="ops-op-bar-wrap">
                <div className="ops-op-bar">
                  <div
                    className="ops-op-fill"
                    style={{ width: `${(op.cost_usd / maxCost) * 100}%` }}
                  />
                </div>
              </div>
              <span className="ops-op-cost">
                ${op.cost_usd < 0.01 ? op.cost_usd.toFixed(4) : op.cost_usd.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      )}

      {ops.length === 0 && (
        <p className="analytics-empty">No LLM calls logged yet. Calls are recorded automatically after Task 4 is deployed.</p>
      )}
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add frontend/src/components/Analytics/LLMCostCard.jsx
git commit -m "feat(ops): add LLMCostCard component"
```

---

## Task 11 — Frontend: `JDMetricsCard` component

**File:** `frontend/src/components/Analytics/JDMetricsCard.jsx`

```jsx
const STATUS_LABEL = {
  open:       'Open',
  closed:     'Closed',
  on_hold:    'On Hold',
  cancelled:  'Cancelled',
  draft:      'Draft',
  archived:   'Archived',
}

const JD_STATUS_LABEL = {
  approved:       'Approved',
  pending_review: 'Pending Review',
  rejected:       'Rejected',
  draft:          'Draft',
  na:             'N/A',
}

const JD_STATUS_COLOR = {
  approved:       'var(--color-success, #10B981)',
  pending_review: 'var(--color-warning, #D97706)',
  rejected:       'var(--color-danger, #EF4444)',
  draft:          'var(--color-text-secondary, #94A3B8)',
  na:             'var(--color-text-secondary, #94A3B8)',
}

export default function JDMetricsCard({ data, loading }) {
  if (loading) {
    return (
      <div className="analytics-card ops-card ops-jd-card">
        <h3 className="analytics-card-title">JD & Position Metrics</h3>
        <div className="skeleton-block" style={{ height: 260, marginTop: 12, borderRadius: 8 }} />
      </div>
    )
  }
  if (!data) return null

  const jd = data.jd_generation || {}
  const statusDist = data.status_distribution || {}
  const jdDist = data.jd_status_distribution || {}
  const monthly = data.monthly_trend || []

  const avgSec = jd.avg_duration_ms ? (jd.avg_duration_ms / 1000).toFixed(1) : '—'

  return (
    <div className="analytics-card ops-card ops-jd-card">
      <h3 className="analytics-card-title">JD &amp; Position Metrics</h3>

      {/* JD generation summary */}
      <div className="ops-jd-gen-row">
        <div className="ops-jd-stat">
          <span className="ops-jd-val">{jd.success_rate ?? '—'}%</span>
          <span className="ops-jd-lbl">JD success rate</span>
        </div>
        <div className="ops-jd-stat">
          <span className="ops-jd-val">{avgSec}s</span>
          <span className="ops-jd-lbl">Avg gen time</span>
        </div>
        <div className="ops-jd-stat">
          <span className="ops-jd-val">
            ${jd.avg_cost_usd < 0.001
              ? (jd.avg_cost_usd || 0).toFixed(5)
              : (jd.avg_cost_usd || 0).toFixed(3)}
          </span>
          <span className="ops-jd-lbl">Cost / JD</span>
        </div>
        <div className="ops-jd-stat">
          <span className="ops-jd-val">{jd.total ?? 0}</span>
          <span className="ops-jd-lbl">JDs generated</span>
        </div>
      </div>

      {/* JD review status */}
      {Object.keys(jdDist).length > 0 && (
        <div className="ops-jd-status-row">
          {Object.entries(jdDist).map(([status, count]) => (
            <div key={status} className="ops-jd-chip" style={{ borderColor: JD_STATUS_COLOR[status] }}>
              <span style={{ color: JD_STATUS_COLOR[status] }}>{JD_STATUS_LABEL[status] || status}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      )}

      {/* Position lifecycle */}
      <div className="ops-pos-section">
        <div className="ops-section-label">Position Status This Period</div>
        <div className="ops-pos-chips">
          {Object.entries(statusDist).map(([status, count]) => (
            <div key={status} className="ops-pos-chip">
              <span className="ops-pos-chip-label">{STATUS_LABEL[status] || status}</span>
              <span className="ops-pos-chip-count">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly trend (simple text table) */}
      {monthly.length > 0 && (
        <div className="ops-monthly-table">
          <div className="ops-section-label" style={{ marginBottom: 8 }}>Monthly Trend</div>
          <table className="ops-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Opened</th>
                <th>Closed</th>
                <th>On Hold</th>
                <th>Cancelled</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map(m => (
                <tr key={m.month}>
                  <td>{m.month ? new Date(m.month).toLocaleDateString('en', { month: 'short', year: '2-digit' }) : '—'}</td>
                  <td>{m.opened}</td>
                  <td>{m.closed}</td>
                  <td>{m.on_hold}</td>
                  <td>{m.cancelled}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add frontend/src/components/Analytics/JDMetricsCard.jsx
git commit -m "feat(ops): add JDMetricsCard component"
```

---

## Task 12 — Frontend: `OpsTab.jsx` orchestrator

**File:** `frontend/src/components/Analytics/OpsTab.jsx`

```jsx
import { useState, useEffect } from 'react'
import { dashboardApi } from '../../utils/api'
import CeleryHealthCard from './CeleryHealthCard'
import LLMCostCard      from './LLMCostCard'
import JDMetricsCard    from './JDMetricsCard'

function useOpsData(period) {
  const [celery,  setCelery]  = useState(null)
  const [llm,     setLLM]     = useState(null)
  const [jd,      setJD]      = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.allSettled([
      dashboardApi.getCeleryStats(period),
      dashboardApi.getLLMStats(period),
      dashboardApi.getJDStats(period),
    ]).then(([celeryRes, llmRes, jdRes]) => {
      if (celeryRes.status === 'fulfilled') setCelery(celeryRes.value)
      if (llmRes.status    === 'fulfilled') setLLM(llmRes.value)
      if (jdRes.status     === 'fulfilled') setJD(jdRes.value)
    }).finally(() => setLoading(false))
  }, [period])

  return { celery, llm, jd, loading }
}

export default function OpsTab({ period }) {
  const { celery, llm, jd, loading } = useOpsData(period)

  return (
    <div className="ops-tab">
      {/* Row 1: Task health + LLM cost side by side */}
      <div className="ops-row-2col">
        <CeleryHealthCard data={celery} loading={loading} />
        <LLMCostCard      data={llm}    loading={loading} />
      </div>

      {/* Row 2: JD metrics full width */}
      <JDMetricsCard data={jd} loading={loading} />
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add frontend/src/components/Analytics/OpsTab.jsx
git commit -m "feat(ops): add OpsTab orchestrator component"
```

---

## Task 13 — Frontend: Wire tabs into `AnalyticsPage.jsx` + CSS

**Files:** `frontend/src/components/Analytics/AnalyticsPage.jsx`, `AnalyticsPage.css`, new `OpsTab.css`

- [ ] **Step 1: Add tab state to `AnalyticsPage.jsx`**

In `AnalyticsPage.jsx` (from the analytics redesign plan), add tab state and the tab switcher:

```jsx
// At the top of the file, add import:
import OpsTab from './OpsTab'

// Inside the component, add tab state after period state:
const [tab, setTab] = useState('roi')

// In the JSX, replace the analytics-header section with:
<div className="analytics-header">
  <div>
    <h1 className="analytics-title">Analytics</h1>
    <p className="analytics-subtitle">
      {tab === 'roi'
        ? 'AI contribution, pipeline health, and team throughput'
        : 'Task health, LLM cost, and JD generation metrics'}
    </p>
  </div>
  <div className="analytics-header-right">
    {/* Tab switcher */}
    <div className="analytics-tabs">
      <button
        type="button"
        className={`analytics-tab${tab === 'roi' ? ' active' : ''}`}
        onClick={() => setTab('roi')}
      >
        Agent ROI
      </button>
      <button
        type="button"
        className={`analytics-tab${tab === 'ops' ? ' active' : ''}`}
        onClick={() => setTab('ops')}
      >
        System Health
      </button>
    </div>
    {/* Period switcher (shared between tabs) */}
    <div className="analytics-period-switcher">
      {PERIODS.map(p => (
        <button
          key={p.value}
          type="button"
          className={`analytics-period-btn${period === p.value ? ' active' : ''}`}
          onClick={() => setPeriod(p.value)}
        >
          {p.label}
        </button>
      ))}
    </div>
  </div>
</div>

{/* Tab content */}
{tab === 'roi' ? (
  <>
    {/* ... all existing Agent ROI content ... */}
  </>
) : (
  <OpsTab period={period} />
)}
```

> **Important:** Wrap ALL existing Agent ROI content (AgentROIHero through SourceQualityTable) in the `tab === 'roi'` branch. Move the `error` banner outside the conditional so it shows for both tabs.

- [ ] **Step 2: Create `OpsTab.css`**

```css
/* OpsTab.css */

.ops-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

.ops-row-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4, 16px);
}

@media (max-width: 900px) {
  .ops-row-2col { grid-template-columns: 1fr; }
}

/* Shared card base — uses .analytics-card from AnalyticsPage.css */

/* ── CeleryHealthCard ── */
.ops-task-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

.ops-task-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ops-task-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ops-task-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary, #F1F5F9);
}

.ops-task-count {
  font-size: 11px;
  color: var(--color-text-secondary, #94A3B8);
}

.ops-rate-bar-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ops-rate-bar {
  flex: 1;
  height: 8px;
  background: var(--color-bg-card, #111827);
  border-radius: 4px;
  overflow: hidden;
}

.ops-rate-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.ops-rate-label {
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  min-width: 38px;
  text-align: right;
}

.ops-task-detail {
  display: flex;
  gap: var(--space-3, 12px);
  font-size: 11px;
  color: var(--color-text-secondary, #94A3B8);
}

.ops-task-fail {
  color: var(--color-danger, #EF4444);
}

/* ── LLMCostCard ── */
.ops-llm-summary {
  display: flex;
  gap: var(--space-6, 24px);
  margin-bottom: var(--space-3, 12px);
}

.ops-llm-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ops-llm-val {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-text-primary, #F1F5F9);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.ops-llm-lbl {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary, #94A3B8);
}

.ops-token-row {
  display: flex;
  gap: var(--space-4, 16px);
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--color-text-secondary, #94A3B8);
  margin-bottom: var(--space-4, 16px);
  padding-bottom: var(--space-4, 16px);
  border-bottom: 1px solid var(--color-border, #1E3047);
}

.ops-token-in  { color: var(--color-primary, #0D9488); }
.ops-token-out { color: var(--color-text-secondary, #94A3B8); }

.ops-op-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ops-op-row {
  display: grid;
  grid-template-columns: 140px 1fr auto;
  align-items: center;
  gap: 8px;
}

.ops-op-name {
  font-size: 12px;
  color: var(--color-text-secondary, #94A3B8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ops-op-bar-wrap {
  flex: 1;
}

.ops-op-bar {
  height: 6px;
  background: var(--color-bg-card, #111827);
  border-radius: 3px;
  overflow: hidden;
}

.ops-op-fill {
  height: 100%;
  background: var(--color-primary, #0D9488);
  border-radius: 3px;
  transition: width 0.5s ease;
  opacity: 0.8;
}

.ops-op-cost {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-primary, #F1F5F9);
  font-variant-numeric: tabular-nums;
  font-family: var(--font-mono);
  min-width: 52px;
  text-align: right;
}

/* ── JDMetricsCard ── */
.ops-jd-gen-row {
  display: flex;
  gap: var(--space-6, 24px);
  flex-wrap: wrap;
  margin-bottom: var(--space-4, 16px);
  padding-bottom: var(--space-4, 16px);
  border-bottom: 1px solid var(--color-border, #1E3047);
}

.ops-jd-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ops-jd-val {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-text-primary, #F1F5F9);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.ops-jd-lbl {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary, #94A3B8);
}

.ops-jd-status-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: var(--space-4, 16px);
}

.ops-jd-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid;
  border-radius: 9999px;
  font-size: 12px;
}

.ops-jd-chip strong {
  font-weight: 700;
  color: var(--color-text-primary, #F1F5F9);
}

.ops-section-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-secondary, #94A3B8);
  margin-bottom: var(--space-3, 12px);
}

.ops-pos-section {
  margin-bottom: var(--space-4, 16px);
}

.ops-pos-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ops-pos-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: var(--color-bg-card, #111827);
  border: 1px solid var(--color-border, #1E3047);
  border-radius: var(--radius-md, 10px);
  font-size: 12px;
}

.ops-pos-chip-label {
  color: var(--color-text-secondary, #94A3B8);
}

.ops-pos-chip-count {
  font-weight: 700;
  color: var(--color-text-primary, #F1F5F9);
  font-variant-numeric: tabular-nums;
}

/* ── Shared table ── */
.ops-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.ops-table th {
  text-align: left;
  padding: 6px 8px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-secondary, #94A3B8);
  border-bottom: 1px solid var(--color-border, #1E3047);
}

.ops-table td {
  padding: 8px;
  color: var(--color-text-primary, #F1F5F9);
  border-bottom: 1px solid var(--color-border-light, #182238);
  font-variant-numeric: tabular-nums;
}

.ops-table tr:last-child td {
  border-bottom: none;
}

/* ── Analytics tab switcher (add to AnalyticsPage.css) ── */
.analytics-header-right {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  flex-wrap: wrap;
}

.analytics-tabs {
  display: flex;
  gap: 2px;
  background: var(--color-bg-secondary, #0F1524);
  border: 1px solid var(--color-border, #1E3047);
  border-radius: var(--radius-lg, 14px);
  padding: 3px;
}

.analytics-tab {
  padding: 5px 16px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary, #94A3B8);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  border-radius: calc(var(--radius-lg, 14px) - 2px);
  cursor: pointer;
  transition: background var(--transition-fast, 120ms ease),
              color var(--transition-fast, 120ms ease);
}

.analytics-tab:hover:not(.active) {
  color: var(--color-text-primary, #F1F5F9);
}

.analytics-tab.active {
  background: var(--color-bg-card, #111827);
  color: var(--color-text-primary, #F1F5F9);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.32);
}
```

- [ ] **Step 3: Add OpsTab.css import to OpsTab.jsx**

At the top of `OpsTab.jsx`, add:

```jsx
import './OpsTab.css'
```

- [ ] **Step 4: Add tab CSS to `AnalyticsPage.css`**

Copy the `.analytics-header-right`, `.analytics-tabs`, and `.analytics-tab` rules from the CSS above into `AnalyticsPage.css`. Replace the existing `.analytics-header` flex rule to use `analytics-header-right` for the right side:

```css
/* UPDATE .analytics-header */
.analytics-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: var(--space-4, 16px);
}
/* This is unchanged — the right side is now .analytics-header-right */
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Analytics/OpsTab.jsx \
         frontend/src/components/Analytics/OpsTab.css \
         frontend/src/components/Analytics/AnalyticsPage.jsx \
         frontend/src/components/Analytics/AnalyticsPage.css
git commit -m "feat(ops): add System Health tab with Celery, LLM, and JD metrics"
```

---

## Task 14 — Smoke test

- [ ] **Step 1: Start the backend and verify migrations**

```bash
uvicorn backend.main:app --reload
# Check logs for:
#   llm_usage_log and task_run_log tables ensured.
#   positions.jd_status column ensured.
```

- [ ] **Step 2: Trigger a candidate search to generate task_run_log data**

Via the UI, open a position and click "Run Search Now" (or trigger via API). Check the DB:

```sql
SELECT * FROM task_run_log ORDER BY created_at DESC LIMIT 5;
```

- [ ] **Step 3: Check LLM usage logging**

Trigger a JD generation. Check:

```sql
SELECT operation, model, input_tokens, output_tokens, cost_usd FROM llm_usage_log ORDER BY created_at DESC LIMIT 5;
```

If `input_tokens = 0`, the callback token extraction path didn't match your provider. Check `llm_output` structure by adding a temporary `print(response.llm_output)` in `on_llm_end`.

- [ ] **Step 4: Visit `/analytics` in browser**

- System Health tab should appear next to Agent ROI
- With no data yet: all three cards show their empty state messages
- With data: CeleryHealthCard shows task type rows + success rate bars, LLMCostCard shows cost summary + per-operation bars, JDMetricsCard shows JD generation stats + position table

- [ ] **Step 5: Verify no console errors**

DevTools → Console should be clean. Specifically check that `OpsTab.css` loaded and `analytics-tab.active` styling applies when switching tabs.

- [ ] **Step 6: Commit any cleanup**

```bash
git add -p
git commit -m "fix(ops): smoke test cleanup"
```

---

## Self-Review Checklist

- [x] **New tables:** `llm_usage_log` ✅ (Task 1), `task_run_log` ✅ (Task 1), `positions.jd_status` ✅ (Task 1)
- [x] **LLM logging:** Callback handles both `llm_output['token_usage']` (Groq/OpenAI path) and `usage_metadata` (Gemini/newer path) ✅
- [x] **Context propagation:** `contextvars` used (not threading.local) — async-safe ✅
- [x] **Cost formula:** `tokens / 1_000_000 * price_per_mtok` — correct unit ✅
- [x] **Non-fatal logging:** All DB inserts in `try/except Exception: pass` — never breaks the main flow ✅
- [x] **Celery tasks:** `_run_pipeline` (candidate_search) and `_score_application` (ats_scoring) instrumented ✅
- [x] **JD metrics:** Generation time + cost from `llm_usage_log`, position lifecycle from `positions` table ✅
- [x] **Monthly trend:** Uses 6-month window independent of period filter (intentional — trend needs fixed window) ✅
- [x] **Tab state:** Period switcher shared between Agent ROI and System Health tabs ✅
- [x] **No transition:all** anywhere in OpsTab.css ✅
- [x] **No icon-in-colored-circle** anywhere ✅
- [x] **No left-border accent stripe** anywhere ✅
- [x] **Empty states:** All three cards have meaningful empty state messages (not just blank) ✅

## Known Limitations / Future Work

- **LLM context**: `llm_context()` must be manually added to each agent node that calls LLM. Only JD generation is covered in Task 4. Add to other nodes (`rejection_drafter.py`, `outreach_draft`, etc.) using the same pattern.
- **JD status tracking**: `positions.jd_status` is added but only updated manually by the JD review flow. When the JD chat state machine approves/rejects a JD, it must call `UPDATE positions SET jd_status='approved' WHERE id=$1`.
- **Embedding cost**: `get_embedding_model()` calls are not tracked (embeddings have different pricing). Add a separate `embedding_usage_log` table if needed.
- **Multi-org pricing**: All orgs share the same price config. Per-org custom pricing can be added via `organizations.llm_price_input` column.
