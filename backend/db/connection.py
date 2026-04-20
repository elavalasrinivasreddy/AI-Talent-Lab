"""
db/connection.py – Async PostgreSQL connection pool using asyncpg.
Provides connection acquisition, health check, and transaction context manager.
Runs migrations on startup.
"""
import asyncpg
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

logger = logging.getLogger(__name__)

# Global connection pool
_pool: Optional[asyncpg.Pool] = None


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
    """Return the existing pool or raise if not initialized."""
    if _pool is None:
        raise RuntimeError("Database pool not initialized. Call create_pool() first.")
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
    """Acquire a connection from the pool."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


@asynccontextmanager
async def get_transaction() -> AsyncGenerator[asyncpg.Connection, None]:
    """Acquire a connection and start a transaction."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            yield conn


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
