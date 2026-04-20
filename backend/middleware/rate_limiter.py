"""
middleware/rate_limiter.py – Rate limiting using slowapi.
100 req/min per IP globally, 10 auth attempts/min.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

limiter = Limiter(key_func=get_remote_address)

# Decorators to use on specific routes:
# @limiter.limit("10/minute")  — for auth routes
# @limiter.limit("100/minute") — for general routes


def setup_rate_limiter(app: FastAPI) -> None:
    """Register the rate limiter and its error handler."""
    app.state.limiter = limiter

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
        return JSONResponse(
            status_code=429,
            content={
                "error": {
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": "Too many requests. Please try again later.",
                    "details": None,
                }
            },
        )
