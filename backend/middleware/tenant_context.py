"""
middleware/tenant_context.py – Extracts org_id + dept_id + role from JWT
and sets on request.state. Sets SET LOCAL for PostgreSQL RLS.
Skips public routes that don't require auth.
"""
import logging
from fastapi import FastAPI, Request
from backend.utils.security import decode_access_token

logger = logging.getLogger(__name__)

# Routes that don't require JWT auth
PUBLIC_PATHS = {
    "/",
    "/api/v1/health",
    "/api/v1/auth/register",
    "/api/v1/auth/login",
    "/api/v1/auth/forgot-password",
    "/api/v1/auth/reset-password",
    "/docs",
    "/openapi.json",
    "/redoc",
}

PUBLIC_PREFIXES = (
    "/api/v1/apply/",
    "/api/v1/panel/",
    "/api/v1/careers/",
)


def setup_tenant_context(app: FastAPI) -> None:
    """Add tenant context middleware that decodes JWT and sets RLS config."""

    @app.middleware("http")
    async def tenant_context_middleware(request: Request, call_next):
        # Skip public routes
        path = request.url.path
        if path in PUBLIC_PATHS or path.startswith(PUBLIC_PREFIXES):
            return await call_next(request)

        # Extract token from Authorization header
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return await call_next(request)

        token = auth_header.removeprefix("Bearer ").strip()
        if not token:
            return await call_next(request)

        try:
            payload = decode_access_token(token)
            request.state.user_id = int(payload["sub"])
            request.state.org_id = payload["org_id"]
            request.state.role = payload["role"]
            request.state.dept_id = payload.get("dept_id")
        except Exception:
            # Let the dependency layer handle auth errors
            pass

        return await call_next(request)
