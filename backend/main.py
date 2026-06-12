"""
main.py – FastAPI app factory.
Registers all middleware, auth router, startup/shutdown events.
Health check at /api/v1/health, root at /.
Build: 2026-05-07T00:00:00 (migrations: status column, dashboard fix)
"""
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from backend.config import settings
from backend.db.connection import init_db, close_pool, close_admin_pool, health_check
from backend.utils.redis_pool import close_redis
from backend.db.vector_store import startup_probe as chroma_probe
from backend.exceptions import register_exception_handlers
from backend.middleware.cors import setup_cors
from backend.middleware.rate_limiter import setup_rate_limiter
from backend.middleware.request_logger import setup_request_logger
from backend.middleware.tenant_context import setup_tenant_context
from backend.routers import auth as auth_router
from backend.routers import settings as settings_router
from backend.routers import chat as chat_router
from backend.routers import positions as positions_router
from backend.routers import candidates as candidates_router
from backend.routers import dashboard as dashboard_router
from backend.routers import notifications as notifications_router
from backend.routers import apply as apply_router
from backend.routers import interviews as interviews_router
from backend.routers import panel as panel_router
from backend.routers import talent_pool as talent_pool_router
from backend.routers import careers as careers_router
from backend.routers import dev_admin as dev_admin_router
from backend.routers import gdpr as gdpr_router
from backend.routers import status as status_router
from backend.routers import copilot as copilot_router
from backend.routers import notes as notes_router
from backend.routers import platform as platform_router
from backend.routers import hire_requests as hire_requests_router
from backend.routers import candidate_portal as candidate_portal_router
from backend.routers import pre_evaluations as pre_evaluations_router

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ── Error monitoring (Sentry) ───────────────────────────────────────────────────
# No-op unless SENTRY_DSN is set, so dev/local stays untouched. Captures unhandled
# exceptions across API + Celery so silent task failures surface on a dashboard.
if settings.SENTRY_DSN:
    try:
        import sentry_sdk
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            traces_sample_rate=0.1,
            send_default_pii=False,
        )
        logger.info("Sentry error monitoring enabled (env=%s).", settings.ENVIRONMENT)
    except Exception as e:
        logger.warning("Sentry init skipped: %s", e)


# ── Lifespan ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB + run migrations. Shutdown: close pool."""
    logger.info("Starting AI Talent Lab API...")
    await init_db(settings.DATABASE_URL)
    chroma_probe()
    logger.info("API ready.")
    yield
    logger.info("Shutting down...")
    await close_pool()
    await close_admin_pool()
    await close_redis()


# ── App Factory ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="AI Talent Lab API",
    description="AI-powered hiring assistant backend",
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# Register exception handlers
register_exception_handlers(app)

# Ensure uploads directory exists for local dev
os.makedirs("uploads/videos", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Register middleware
setup_cors(app)
setup_rate_limiter(app)
setup_request_logger(app)
setup_tenant_context(app)

# Register routers — each router defines its own full /api/v1/xxx prefix internally.
# DO NOT add prefix here or routes will double-register as /api/v1/api/v1/xxx.
app.include_router(auth_router.router)
app.include_router(settings_router.router)
app.include_router(chat_router.router)
app.include_router(positions_router.router)
app.include_router(candidates_router.router)
app.include_router(dashboard_router.router)
app.include_router(notifications_router.router)
app.include_router(apply_router.router)   # Public — no auth (magic link)
app.include_router(interviews_router.router)
app.include_router(panel_router.router)   # Public — no auth (magic link)
app.include_router(talent_pool_router.router)
app.include_router(careers_router.router)  # Public — no auth (career page)
app.include_router(dev_admin_router.router)  # Dev tools — guarded by DEV_MODE
app.include_router(gdpr_router.router)        # GDPR/DPDP compliance (mixed public + admin)
app.include_router(status_router.router)      # Public — candidate application status portal
app.include_router(copilot_router.router)     # AI Copilot suggestions
app.include_router(notes_router.router)       # Collaborative hiring notes
app.include_router(platform_router.router)    # Platform admin — cross-org SaaS analytics
app.include_router(hire_requests_router.router)  # Hire requests (dedicated CRUD)
app.include_router(candidate_portal_router.router)  # Candidate portal — login + timeline + consent
app.include_router(pre_evaluations_router.router)   # Public — pre-evaluation written test (token)

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
