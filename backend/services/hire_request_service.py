"""
services/hire_request_service.py – Business logic for hire requests.

INTENTIONAL THIN FACADE (E6, verified 2026-06-13): the migration into
backend.services.hire_requests.* is complete. This class is the stable public
entry point — routers and tests call HireRequestService.method() exactly as
before; every method just delegates to a sub-module function and holds no logic
of its own. Add new behaviour to the relevant hire_requests/* module, not here.
"""
import asyncpg

from backend.services.hire_requests import (
    list_for_user,
    get_pending_count_for_user,
    get,
    create,
    update,
    cancel,
    link_session_to_position,
    approve_request,
    reject_request,
    accept,
    begin_review,
    release_review,
    approve_modified,
)
from backend.services.hire_requests.crud import _validate_payload


class HireRequestService:
    """All mutating + filtered-read operations for hire requests."""

    @staticmethod
    async def list_for_user(conn: asyncpg.Connection, **kwargs):
        return await list_for_user(conn, **kwargs)

    @staticmethod
    async def get_pending_count_for_user(conn: asyncpg.Connection, **kwargs):
        return await get_pending_count_for_user(conn, **kwargs)

    @staticmethod
    async def get(conn: asyncpg.Connection, *args, **kwargs):
        return await get(conn, *args, **kwargs)

    @staticmethod
    async def create(conn: asyncpg.Connection, **kwargs):
        return await create(conn, **kwargs)

    @staticmethod
    async def approve_request(conn: asyncpg.Connection, *args, **kwargs):
        return await approve_request(conn, *args, **kwargs)

    @staticmethod
    async def reject_request(conn: asyncpg.Connection, *args, **kwargs):
        return await reject_request(conn, *args, **kwargs)

    @staticmethod
    async def update(conn: asyncpg.Connection, *args, **kwargs):
        return await update(conn, *args, **kwargs)

    @staticmethod
    async def accept(conn: asyncpg.Connection, *args, **kwargs):
        return await accept(conn, *args, **kwargs)

    @staticmethod
    async def cancel(conn: asyncpg.Connection, *args, **kwargs):
        return await cancel(conn, *args, **kwargs)

    @staticmethod
    async def link_session_to_position(conn: asyncpg.Connection, *args, **kwargs):
        return await link_session_to_position(conn, *args, **kwargs)

    @staticmethod
    async def begin_review(conn: asyncpg.Connection, *args, **kwargs):
        return await begin_review(conn, *args, **kwargs)

    @staticmethod
    async def release_review(conn: asyncpg.Connection, *args, **kwargs):
        return await release_review(conn, *args, **kwargs)

    @staticmethod
    async def approve_modified(conn: asyncpg.Connection, *args, **kwargs):
        return await approve_modified(conn, *args, **kwargs)

    @staticmethod
    def _validate_payload(**kwargs):
        return _validate_payload(**kwargs)
