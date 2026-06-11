"""
db/connection.py – Async PostgreSQL connection pool using asyncpg.
Provides connection acquisition, health check, and transaction context manager.
Runs migrations on startup.
"""
import asyncpg
import logging
from contextvars import ContextVar
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

logger = logging.getLogger(__name__)

# Global connection pool
_pool: Optional[asyncpg.Pool] = None

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


async def create_pool(database_url: str) -> asyncpg.Pool:
    """Create and return the connection pool."""
    global _pool
    if _pool is not None:
        return _pool

    logger.info("Creating database connection pool...")
    _pool = await asyncpg.create_pool(
        dsn=database_url,
        min_size=2,
        max_size=10,
        command_timeout=60,
    )
    logger.info("Database connection pool created.")
    return _pool


async def get_pool() -> asyncpg.Pool:
    """Return the existing pool, initializing it automatically if needed."""
    global _pool
    if _pool is None:
        from backend.config import settings
        logger.info("Auto-initializing database connection pool...")
        _pool = await asyncpg.create_pool(
            dsn=settings.DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=60,
        )
    return _pool


async def close_pool() -> None:
    """Close the connection pool."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("Database connection pool closed.")


@asynccontextmanager
async def get_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    """Acquire a connection from the pool, applying the active org as RLS context.

    Sets `app.current_org_id` (session-scoped) on the connection when an org is in
    context, and resets it on release so pooled connections never leak tenant
    context to the next acquirer. No-op (harmless) under the superuser/owner role,
    which bypasses RLS — it only enforces once DATABASE_URL points at APP_DB_ROLE.
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
                # Reset to NULL (not '') so current_setting(...,true) returns NULL
                # for the next no-org acquirer, keeping NULLIF-based policies happy.
                try:
                    await conn.execute("SELECT set_config('app.current_org_id', NULL, false)")
                except Exception:
                    pass


@asynccontextmanager
async def get_transaction() -> AsyncGenerator[asyncpg.Connection, None]:
    """Acquire a connection and start a transaction, applying RLS org context."""
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
    """Initialize database: create pool, run migrations."""
    from backend.db.migrations import run_migrations

    pool = await create_pool(database_url)
    async with pool.acquire() as conn:
        await run_migrations(conn)
    logger.info("Database initialized and migrations complete.")
