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
    """Set LLM call metadata for usage tracking."""
    t1 = _ctx_org_id.set(org_id)
    t2 = _ctx_operation.set(operation)
    t3 = _ctx_model.set(model)
    try:
        yield
    finally:
        _ctx_org_id.reset(t1)
        _ctx_operation.reset(t2)
        _ctx_model.reset(t3)


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
            return

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
