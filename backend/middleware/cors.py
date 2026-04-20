"""
middleware/cors.py – CORS configuration.
Whitelists FRONTEND_URL from config.
"""
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI


def setup_cors(app: FastAPI) -> None:
    """Add CORS middleware with FRONTEND_URL whitelist."""
    from backend.config import settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.FRONTEND_URL],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
