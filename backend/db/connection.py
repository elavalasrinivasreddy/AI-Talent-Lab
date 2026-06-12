"""
db/connection.py – Async PostgreSQL connection pools using asyncpg.

Two pools:
  _admin_pool  — superuser (DATABASE_URL). Bypasses RLS. Used for migrations,
                 platform_admin / dev_admin cross-org reads, and cross-org
                 Celery tasks (scheduled_search, followup_reminders, etc.).
  _pool        — non-privileged (APP_DATABASE_URL when set, else DATABASE_URL).
                 RLS enforced once APP_DATABASE_URL points at talentlab_app.
                 Used for all normal HTTP request traffic.

Per-request tenant context is set by the tenant middleware via set_org_context()
and consumed by get_connection() to apply app.current_org_id on every pooled
connection, auto-resetting on release to prevent cross-request leaks.
"""
import asyncpg
import logging
from contextvars import ContextVar
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

logger = logging.getLogger(__name__)

_admin_pool: Optional[asyncpg.Pool] = None  # superuser — bypasses RLS
_pool: Optional[asyncpg.Pool] = None        # talentlab_app — RLS enforced (when APP_DATABASE_URL set)

# Per-request/-task tenant context. Set by the tenant middleware (request scope)
# or explicitly by background tasks via set_org_context(). Drives PostgreSQL RLS:
# get_connection() applies it as `app.current_org_id` on the pooled connection and
# resets it on release so context never leaks to the next acquirer.
_current_org_id: ContextVar[Optional[int]] = ContextVar("current_org_id", default=None)


def set_org_context(org_id: Optional[int]):
    """Set the active org for RLS in the current async context. Returns a token;
    pass it to reset_org_context() to restore (use in middleware/task try-finally)."""
    return _current_org_id.set(org_id)


def reset_org_context(token) -> None:
    """Restore the org context to its previous value using a token from set_org_context()."""
    try:
        _current_org_id.reset(token)
    except (ValueError, LookupError):
        pass


def get_org_context() -> Optional[int]:
    """Current org_id in context, or None."""
    return _current_org_id.get()


async def _make_pool(dsn: str) -> asyncpg.Pool:
    return await asyncpg.create_pool(
        dsn=dsn,
        min_size=2,
        max_size=10,
        command_timeout=60,
    )


async def create_pool(database_url: str) -> asyncpg.Pool:
    """Create the admin (superuser) pool. Called once by init_db on startup."""
    global _admin_pool
    if _admin_pool is not None:
        return _admin_pool
    logger.info("Creating admin database connection pool...")
    _admin_pool = await _make_pool(database_url)
    logger.info("Admin database connection pool created.")
    return _admin_pool


async def get_pool() -> asyncpg.Pool:
    """Return the app pool (RLS-enforced when APP_DATABASE_URL set). Lazily created."""
    global _pool
    if _pool is None:
        from backend.config import settings
        dsn = settings.APP_DATABASE_URL or settings.DATABASE_URL
        label = "talentlab_app (RLS active)" if settings.APP_DATABASE_URL else "owner role (RLS inactive)"
        logger.info("Auto-initializing app database connection pool (%s)...", label)
        _pool = await _make_pool(dsn)
    return _pool


async def get_admin_pool() -> asyncpg.Pool:
    """Return the admin (superuser) pool. Lazily created if init_db hasn't run yet."""
    global _admin_pool
    if _admin_pool is None:
        from backend.config import settings
        logger.info("Auto-initializing admin database connection pool...")
        _admin_pool = await _make_pool(settings.DATABASE_URL)
    return _admin_pool


async def close_pool() -> None:
    """Close the app connection pool."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("App database connection pool closed.")


async def close_admin_pool() -> None:
    """Close the admin connection pool."""
    global _admin_pool
    if _admin_pool is not None:
        await _admin_pool.close()
        _admin_pool = None
        logger.info("Admin database connection pool closed.")


@asynccontextmanager
async def get_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    """Acquire an app-pool connection with RLS tenant context applied.

    Sets `app.current_org_id` (session-scoped) when an org is in context and
    resets it on release so pooled connections never leak tenant context.
    No-op under the superuser/owner role (when APP_DATABASE_URL is not set).
    """
    pool = await get_pool()
    org_id = _current_org_id.get()
    async with pool.acquire() as conn:
        if org_id is not None:
            await conn.execute("SELECT set_config('app.current_org_id', $1, false)", str(org_id))
        try:
            yield conn
        finally:
            if org_id is not None:
                # Reset to NULL so NULLIF-based policies see NULL (not empty string)
                # for the next no-org acquirer of this pooled connection.
                try:
                    await conn.execute("SELECT set_config('app.current_org_id', NULL, false)")
                except Exception:
                    pass


@asynccontextmanager
async def get_admin_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    """Acquire a superuser connection — RLS bypassed entirely.

    Use for: DB migrations, platform_admin cross-org reads, dev_admin tools,
    and Celery tasks that intentionally span multiple orgs (scheduled_search,
    followup_reminders, pre_eval batch, GDPR cleanup, etc.).
    """
    pool = await get_admin_pool()
    async with pool.acquire() as conn:
        yield conn


@asynccontextmanager
async def get_transaction() -> AsyncGenerator[asyncpg.Connection, None]:
    """Acquire an app-pool connection and start a transaction, with RLS org context."""
    pool = await get_pool()
    org_id = _current_org_id.get()
    async with pool.acquire() as conn:
        if org_id is not None:
            await conn.execute("SELECT set_config('app.current_org_id', $1, false)", str(org_id))
        try:
            async with conn.transaction():
                yield conn
        finally:
            if org_id is not None:
                try:
                    await conn.execute("SELECT set_config('app.current_org_id', NULL, false)")
                except Exception:
                    pass


async def health_check() -> bool:
    """Check database connectivity."""
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            result = await conn.fetchval("SELECT 1")
            return result == 1
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False


async def init_db(database_url: str) -> None:
    """Initialize database: create admin pool, run migrations."""
    from backend.db.migrations import run_migrations

    pool = await create_pool(database_url)
    async with pool.acquire() as conn:
        await run_migrations(conn)
    logger.info("Database initialized and migrations complete.")
