"""
middleware/request_logger.py – Log every request with correlation ID,
user_id if authed, endpoint, method, status code, response time.
"""
import time
import uuid
import logging
from fastapi import FastAPI, Request

logger = logging.getLogger("request_logger")


def setup_request_logger(app: FastAPI) -> None:
    """Add request logging middleware."""

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        correlation_id = str(uuid.uuid4())[:8]
        request.state.correlation_id = correlation_id

        start_time = time.time()
        response = await call_next(request)
        duration_ms = round((time.time() - start_time) * 1000, 2)

        user_id = getattr(request.state, "user_id", None)
        logger.info(
            f"[{correlation_id}] {request.method} {request.url.path} "
            f"→ {response.status_code} ({duration_ms}ms) "
            f"user={user_id or 'anon'}"
        )

        response.headers["X-Correlation-ID"] = correlation_id
        return response
