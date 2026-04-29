"""
agents/streaming.py – Manages Server-Sent Events (SSE) formatting for the frontend chat.
Follows the exact event types specified in docs/BACKEND_PLAN.md §6.
"""
import json
import logging
from typing import Any, AsyncGenerator

logger = logging.getLogger(__name__)


def create_sse_event(event_type: str, data: Any) -> str:
    """
    Format a message as a Server-Sent Event block.

    Args:
        event_type: e.g., 'token', 'stage_change', 'card_internal', etc.
        data: The payload (dict, list, or primitive).
    """
    try:
        # If it's a dict or list, serialize to JSON string
        if isinstance(data, (dict, list)):
            data_str = json.dumps(data, ensure_ascii=False)
        else:
            data_str = str(data)

        # SSE spec: multi-line data must use separate "data:" lines
        lines = data_str.split('\n')
        data_block = '\n'.join(f"data: {line}" for line in lines)

        return f"event: {event_type}\n{data_block}\n\n"
    except Exception as e:
        logger.error(f"Error creating SSE event: {e}")
        return ""


async def stream_generator(session_id: str, async_iterable) -> AsyncGenerator[str, None]:
    """
    A generator that consumes an async iterable (which yields dicts of {event: str, data: any})
    and formats them as valid SSE string chunks.
    """
    try:
        async for item in async_iterable:
            event_type = item.get("event")
            data = item.get("data")

            if event_type and data is not None:
                yield create_sse_event(event_type, data)

    except Exception as e:
        logger.error(f"Streaming error in session {session_id}: {e}")
        yield create_sse_event("error", {
            "code": "STREAM_INTERRUPTED",
            "message": "Stream connection was unexpectedly interrupted",
            "details": str(e)
        })


class StreamHandler:
    """
    Helper class to emit formatted SSE events to an async queue or directly to response generators.
    """
    @staticmethod
    def emit_token(token: str) -> str:
        """Text generation tokens"""
        return create_sse_event("token", {"content": token})

    @staticmethod
    def emit_stage_change(stage: str) -> str:
        """Stage transitions (e.g. intake -> market_research)"""
        return create_sse_event("stage_change", {"stage": stage})

    @staticmethod
    def emit_card_internal(skills: list) -> str:
        """Internal Check card payload"""
        return create_sse_event("card_internal", {"skills": skills})

    @staticmethod
    def emit_card_market(skills: list, summary: str, competitors: list) -> str:
        """Market Research card payload"""
        return create_sse_event("card_market", {
            "skills": skills,
            "summary": summary,
            "competitors": competitors
        })

    @staticmethod
    def emit_card_variants(variants: list) -> str:
        """JD Variants card payload (3 variants)"""
        return create_sse_event("card_variants", {"variants": variants})

    @staticmethod
    def emit_jd_token(token: str) -> str:
        """Final JD generation tokens, streamed separately from chat token"""
        return create_sse_event("jd_token", {"content": token})

    @staticmethod
    def emit_card_bias(issues: list, is_clean: bool) -> str:
        """Bias and Inclusion check results payload"""
        return create_sse_event("card_bias", {
            "issues": issues,
            "clean": is_clean
        })

    @staticmethod
    def emit_metadata(data: dict) -> str:
        """Updated state or requirements"""
        return create_sse_event("metadata", data)

    @staticmethod
    def emit_done() -> str:
        """Stream completion marker"""
        return create_sse_event("done", {})

    @staticmethod
    def emit_error(code: str, message: str) -> str:
        """Stream error marker"""
        return create_sse_event("error", {
            "code": code,
            "message": message
        })

    @staticmethod
    def emit_title_update(title: str) -> str:
        """Title update marker"""
        return create_sse_event("title_update", {"title": title})

    @staticmethod
    def emit_stage_skipped(stage: str, reason: str) -> str:
        """Stage skipped marker"""
        return create_sse_event("stage_skipped", {"stage": stage, "reason": reason})
