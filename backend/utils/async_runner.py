"""
utils/async_runner.py – Helper for running async code synchronously in Celery tasks.
Prevents "Event loop is closed" errors by maintaining a persistent event loop
per worker process, allowing database connection pools to be reused.
"""
import asyncio

_loop = None

def get_or_create_loop():
    global _loop
    if _loop is not None and not _loop.is_closed():
        return _loop
        
    try:
        # Check if there is an existing event loop and it's not closed
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError("Event loop is closed")
        _loop = loop
    except RuntimeError:
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
