"""
db/repositories/users.py – UserRepository.
Full CRUD for users. All queries parameterized. All queries filter by org_id.
"""
from typing import Optional, List
from datetime import datetime, timezone
import asyncpg


class UserRepository:
    """Data access for the users table."""

    @staticmethod
    async def create(
        conn: asyncpg.Connection,
        org_id: int,
        email: str,
        password_hash: str,
        name: str,
        role: str = "recruiter",
        department_id: Optional[int] = None,
        phone: Optional[str] = None,
    ) -> dict:
        """Create a new user. Returns the created record."""
        row = await conn.fetchrow(
            """
            INSERT INTO users (org_id, email, password_hash, name, role, department_id, phone)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, org_id, email, name, role, phone, avatar_url, timezone,
                      is_active, department_id, created_at
            """,
            org_id, email, password_hash, name, role, department_id, phone,
        )
        return dict(row)

    @staticmethod
    async def get_by_id(conn: asyncpg.Connection, user_id: int, org_id: int) -> Optional[dict]:
        """Get user by ID, scoped to org."""
        row = await conn.fetchrow(
            """
            SELECT id, org_id, email, name, role, phone, avatar_url, timezone,
                   is_active, department_id, failed_login_attempts, locked_until,
                   last_login_at, created_at
            FROM users WHERE id = $1 AND org_id = $2
            """,
            user_id, org_id,
        )
        return dict(row) if row else None

    @staticmethod
    async def get_by_email(conn: asyncpg.Connection, email: str) -> Optional[dict]:
        """Get user by email (cross-org — used for login)."""
        row = await conn.fetchrow(
            """
            SELECT id, org_id, email, password_hash, name, role, phone, avatar_url,
                   timezone, is_active, department_id, failed_login_attempts,
                   locked_until, last_login_at, created_at
            FROM users WHERE email = $1
            """,
            email,
        )
        return dict(row) if row else None

    @staticmethod
    async def list_by_org(conn: asyncpg.Connection, org_id: int) -> List[dict]:
        """List all users in an org."""
        rows = await conn.fetch(
            """
            SELECT id, org_id, email, name, role, phone, avatar_url, timezone,
                   is_active, department_id, created_at
            FROM users WHERE org_id = $1 ORDER BY created_at DESC
            """,
            org_id,
        )
        return [dict(r) for r in rows]

    @staticmethod
    async def update(
        conn: asyncpg.Connection,
        user_id: int,
        org_id: int,
        **fields,
    ) -> Optional[dict]:
        """Update user fields dynamically, scoped to org."""
        if not fields:
            return await UserRepository.get_by_id(conn, user_id, org_id)

        set_clauses = []
        values = []
        for i, (key, val) in enumerate(fields.items(), start=1):
            set_clauses.append(f"{key} = ${i}")
            values.append(val)

        values.extend([user_id, org_id])
        query = f"""
            UPDATE users SET {', '.join(set_clauses)}
            WHERE id = ${len(values) - 1} AND org_id = ${len(values)}
            RETURNING id, org_id, email, name, role, phone, avatar_url, timezone,
                      is_active, department_id, created_at
        """
        row = await conn.fetchrow(query, *values)
        return dict(row) if row else None

    @staticmethod
    async def deactivate(conn: asyncpg.Connection, user_id: int, org_id: int) -> Optional[dict]:
        """Deactivate a user."""
        return await UserRepository.update(conn, user_id, org_id, is_active=False)

    @staticmethod
    async def update_failed_login_attempts(
        conn: asyncpg.Connection,
        user_id: int,
        attempts: int,
    ) -> None:
        """Update failed login attempt count."""
        await conn.execute(
            "UPDATE users SET failed_login_attempts = $1 WHERE id = $2",
            attempts, user_id,
        )

    @staticmethod
    async def lock_account(
        conn: asyncpg.Connection,
        user_id: int,
        locked_until: datetime,
    ) -> None:
        """Lock user account until specified time."""
        await conn.execute(
            "UPDATE users SET locked_until = $1, failed_login_attempts = 0 WHERE id = $2",
            locked_until, user_id,
        )

    @staticmethod
    async def reset_login_state(conn: asyncpg.Connection, user_id: int) -> None:
        """Reset failed attempts and locked_until on successful login."""
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        await conn.execute(
            """
            UPDATE users SET failed_login_attempts = 0, locked_until = NULL,
                            last_login_at = $1
            WHERE id = $2
            """,
            now, user_id,
        )

    @staticmethod
    async def update_password(
        conn: asyncpg.Connection,
        user_id: int,
        password_hash: str,
    ) -> None:
        """Update user password hash."""
        await conn.execute(
            "UPDATE users SET password_hash = $1 WHERE id = $2",
            password_hash, user_id,
        )
