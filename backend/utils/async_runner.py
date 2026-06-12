"""
utils/async_runner.py – Helper for running async code synchronously in Celery tasks.
Prevents "Event loop is closed" errors by maintaining a persistent event loop
per worker process, allowing database connection pools to be reused.

Uses a threading.Lock to prevent races when multiple Celery threads initialize
concurrently, and never calls the deprecated asyncio.get_event_loop().
"""
import asyncio
import threading

_loop: asyncio.AbstractEventLoop | None = None
_loop_lock = threading.Lock()


def get_or_create_loop() -> asyncio.AbstractEventLoop:
    global _loop
    with _loop_lock:
        if _loop is not None and not _loop.is_closed():
            return _loop
        _loop = asyncio.new_event_loop()
        asyncio.set_event_loop(_loop)
        return _loop


def run_async(coro):
    """
    Run an async coroutine synchronously.
    Uses a persistent event loop so connection pools tied to the loop aren't destroyed.
    """
    loop = get_or_create_loop()
    return loop.run_until_complete(coro)
