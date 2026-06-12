"""
utils/redis_pool.py – Shared async Redis connection pool singleton.
Prevents creating a new connection per request (HIGH-01 fix).
"""
import redis.asyncio as redis
from typing import Optional

from backend.config import settings

_redis_pool: Optional[redis.Redis] = None


async def get_redis() -> redis.Redis:
    """Return a shared Redis client backed by a connection pool."""
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
        )
    return _redis_pool


async def close_redis() -> None:
    """Close the shared Redis connection pool. Called on app shutdown."""
    global _redis_pool
    if _redis_pool is not None:
        await _redis_pool.aclose()
        _redis_pool = None
