"""
main.py – FastAPI app factory.
Registers all middleware, auth router, startup/shutdown events.
Health check at /api/v1/health, root at /.
"""
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI

from backend.config import settings
from backend.db.connection import init_db, close_pool, health_check
from backend.exceptions import register_exception_handlers
from backend.middleware.cors import setup_cors
from backend.middleware.rate_limiter import setup_rate_limiter
from backend.middleware.request_logger import setup_request_logger
from backend.middleware.tenant_context import setup_tenant_context
from backend.routers import auth as auth_router
from backend.routers import settings as settings_router

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB + run migrations. Shutdown: close pool."""
    logger.info("Starting AI Talent Lab API...")
    await init_db(settings.DATABASE_URL)
    logger.info("API ready.")
    yield
    logger.info("Shutting down...")
    await close_pool()


# ── App Factory ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="AI Talent Lab API",
    description="AI-powered hiring assistant backend",
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# Register exception handlers
register_exception_handlers(app)

# Register middleware (order matters — outermost first)
setup_cors(app)
setup_rate_limiter(app)
setup_request_logger(app)
setup_tenant_context(app)

# Register routers
app.include_router(auth_router.router)
app.include_router(settings_router.router)


# ── Root & Health ──────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    """Root — basic status."""
    return {"status": "ok"}


@app.get("/api/v1/health")
async def health():
    """Health check — returns DB status, version, timestamp."""
    db_connected = await health_check()
    return {
        "status": "ok" if db_connected else "degraded",
        "db": "connected" if db_connected else "disconnected",
        "version": settings.APP_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
