"""
services/auth_service.py – Auth business logic.
Register, login, magic-link sign-in, password management.
No HTTP, no SQL — uses repositories.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import asyncpg

from backend.db.repositories.users import UserRepository
from backend.db.repositories.organizations import OrgRepository
from backend.db.repositories.audit import AuditLogRepository
from backend.utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_magic_link_token,
    verify_magic_link_token,
)
from backend.utils.validators import validate_password, validate_email, generate_slug
from backend.exceptions import (
    InvalidCredentialsError,
    AlreadyExistsError,
    AccountLockedError,
    NotFoundError,
    ValidationError,
    MagicLinkExpiredError,
    MagicLinkUsedError,
)
from backend.services.email_service import EmailService
from backend.config import settings

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
MAGIC_LINK_EXPIRES_MINUTES = 15


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _consume_magic_link_jti(
    conn: asyncpg.Connection,
    jti: str,
    token_type: str,
    entity_id: Optional[int] = None,
) -> None:
    """
    Mark a magic-link JWT as consumed. Raises MagicLinkUsedError on replay.

    The UNIQUE constraint on (jti) is the source of truth — we don't pre-check,
    we just INSERT and let asyncpg raise UniqueViolationError on conflict.
    """
    try:
        await conn.execute(
            """
            INSERT INTO consumed_magic_links (jti, token_type, entity_id)
            VALUES ($1, $2, $3)
            """,
            jti, token_type, entity_id,
        )
    except asyncpg.UniqueViolationError:
        raise MagicLinkUsedError("This link has already been used.")


def _account_locked_remaining(locked_until) -> Optional[int]:
    """Return minutes remaining in lockout, or None if not locked."""
    if not locked_until:
        return None
    if locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    if now >= locked_until:
        return None
    return int((locked_until - now).total_seconds() / 60) + 1


# ── AuthService ───────────────────────────────────────────────────────────────

class AuthService:
    """Auth business logic — stateless, operates on connection passed in."""

    @staticmethod
    async def register(
        conn: asyncpg.Connection,
        org_name: str,
        segment: str,
        size: str,
        name: str,
        email: str,
        password: str,
        website: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> dict:
        """
        Register a new organization + admin user in one transaction.
        Auto-generates org slug from name, ensuring uniqueness.
        Returns {token, user, org}.
        """
        email = validate_email(email)
        validate_password(password)

        if await UserRepository.get_by_email(conn, email):
            raise AlreadyExistsError("This email is already registered")

        if await OrgRepository.get_by_name(conn, org_name):
            raise AlreadyExistsError("This organization name is taken")

        # Generate unique slug
        base_slug = generate_slug(org_name)
        slug = base_slug
        counter = 2
        while await OrgRepository.slug_exists(conn, slug):
            slug = f"{base_slug}-{counter}"
            counter += 1

        org = await OrgRepository.create(
            conn,
            name=org_name.strip(),
            slug=slug,
            segment=segment,
            size=size,
            website=website,
        )

        password_hash = hash_password(password)
        user = await UserRepository.create(
            conn,
            org_id=org["id"],
            email=email,
            password_hash=password_hash,
            name=name.strip(),
            role="org_head",
        )

        await AuditLogRepository.create(
            conn,
            org_id=org["id"],
            user_id=user["id"],
            action="user_created",
            entity_type="user",
            entity_id=str(user["id"]),
            details={"role": "org_head", "method": "registration"},
            ip_address=ip_address,
        )

        # Seed defaults for the new org (department, screening questions,
        # message templates, scorecard template)
        from backend.services.settings_service import SettingsService
        await SettingsService.seed_defaults(conn, org["id"])

        token = create_access_token(
            user_id=user["id"],
            org_id=org["id"],
            role="org_head",
        )

        return {"token": token, "user": user, "org": org}

    @staticmethod
    async def login(
        conn: asyncpg.Connection,
        email: str,
        password: str,
        ip_address: Optional[str] = None,
    ) -> dict:
        """
        Authenticate user. Returns {token, user, org}.
        Enforces account lockout after 5 failed attempts (15 min).
        """
        email = validate_email(email)

        user = await UserRepository.get_by_email(conn, email)
        if not user:
            raise InvalidCredentialsError()

        if not user["is_active"]:
            raise InvalidCredentialsError("Account is deactivated")

        remaining = _account_locked_remaining(user["locked_until"])
        if remaining is not None:
            raise AccountLockedError(
                f"Account locked. Try again in {remaining} minute(s), "
                f"or use the magic-link option."
            )

        if not verify_password(password, user["password_hash"]):
            attempts = user["failed_login_attempts"] + 1
            await UserRepository.update_failed_login_attempts(conn, user["id"], attempts)

            await AuditLogRepository.create(
                conn,
                org_id=user["org_id"],
                user_id=user["id"],
                action="login_failed",
                entity_type="user",
                entity_id=str(user["id"]),
                ip_address=ip_address,
            )

            if attempts >= MAX_FAILED_ATTEMPTS:
                locked_until = (
                    datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
                ).replace(tzinfo=None)
                await UserRepository.lock_account(conn, user["id"], locked_until)
                raise AccountLockedError(
                    f"Account locked after {MAX_FAILED_ATTEMPTS} failed attempts. "
                    f"Try again in {LOCKOUT_MINUTES} minutes or use the magic-link option."
                )

            raise InvalidCredentialsError()

        # Success — reset login state
        await UserRepository.reset_login_state(conn, user["id"])

        await AuditLogRepository.create(
            conn,
            org_id=user["org_id"],
            user_id=user["id"],
            action="login",
            entity_type="user",
            entity_id=str(user["id"]),
            ip_address=ip_address,
        )

        token = create_access_token(
            user_id=user["id"],
            org_id=user["org_id"],
            role=user["role"],
            department_id=user.get("department_id"),
        )

        org = await OrgRepository.get_by_id(conn, user["org_id"])
        return {"token": token, "user": user, "org": org}

    # ── Magic-link sign-in ───────────────────────────────────────────────────

    @staticmethod
    async def request_magic_link(
        conn: asyncpg.Connection,
        email: str,
        ip_address: Optional[str] = None,
    ) -> None:
        """
        Issue a magic-link sign-in email for an existing account.
        Always succeeds publicly (never leak whether the email exists).
        """
        try:
            email = validate_email(email)
        except ValidationError:
            # Surface validation errors to the client — the form should catch
            # this client-side, but if it doesn't we want a clear 422.
            raise

        user = await UserRepository.get_by_email(conn, email)
        if not user or not user["is_active"]:
            logger.info(
                f"[magic-link] no-op for {email} (user missing or deactivated)"
            )
            return

        token = create_magic_link_token(
            token_type="auth_magic",
            entity_id=user["id"],
            expires_minutes=MAGIC_LINK_EXPIRES_MINUTES,
        )
        magic_url = f"{settings.MAGIC_LINK_BASE_URL}/auth/verify?token={token}"

        org = await OrgRepository.get_by_id(conn, user["org_id"])
        await EmailService.send_magic_link(
            to_email=user["email"],
            magic_link_url=magic_url,
            user_name=user.get("name"),
            org_name=org.get("name") if org else None,
            expires_minutes=MAGIC_LINK_EXPIRES_MINUTES,
        )

        await AuditLogRepository.create(
            conn,
            org_id=user["org_id"],
            user_id=user["id"],
            action="magic_link_requested",
            entity_type="user",
            entity_id=str(user["id"]),
            ip_address=ip_address,
        )

    @staticmethod
    async def verify_magic_link(
        conn: asyncpg.Connection,
        token: str,
        ip_address: Optional[str] = None,
    ) -> dict:
        """
        Exchange a magic-link token for a session JWT.
        Single-use: rejects on replay. Returns {token, user, org}.
        """
        payload = verify_magic_link_token(token, "auth_magic")
        jti = payload.get("jti")
        user_id = payload.get("entity_id")
        if not jti or not user_id:
            raise InvalidCredentialsError("Malformed magic link.")

        # Atomically claim the jti before issuing a session — INSERT will
        # raise UniqueViolation on replay.
        await _consume_magic_link_jti(
            conn, jti=jti, token_type="auth_magic", entity_id=user_id
        )

        # Look up via cross-org email path because we don't know org_id yet
        user_row = await conn.fetchrow(
            """
            SELECT id, org_id, email, name, role, phone, avatar_url, timezone,
                   is_active, department_id, created_at
            FROM users WHERE id = $1
            """,
            user_id,
        )
        if not user_row:
            raise NotFoundError("User not found")
        user = dict(user_row)

        if not user["is_active"]:
            raise InvalidCredentialsError("Account is deactivated")

        # Magic-link login clears the password-lockout state too
        await UserRepository.reset_login_state(conn, user["id"])

        await AuditLogRepository.create(
            conn,
            org_id=user["org_id"],
            user_id=user["id"],
            action="login_magic_link",
            entity_type="user",
            entity_id=str(user["id"]),
            ip_address=ip_address,
        )

        session_token = create_access_token(
            user_id=user["id"],
            org_id=user["org_id"],
            role=user["role"],
            department_id=user.get("department_id"),
        )
        org = await OrgRepository.get_by_id(conn, user["org_id"])
        return {"token": session_token, "user": user, "org": org}

    # ── Profile / me ─────────────────────────────────────────────────────────

    @staticmethod
    async def get_me(conn: asyncpg.Connection, user_id: int, org_id: int) -> dict:
        """Get current user + org data."""
        user = await UserRepository.get_by_id(conn, user_id, org_id)
        if not user:
            raise NotFoundError("User not found")

        org = await OrgRepository.get_by_id(conn, org_id)
        if not org:
            raise NotFoundError("Organization not found")

        return {"user": user, "org": org}

    @staticmethod
    async def list_users(conn: asyncpg.Connection, org_id: int) -> list:
        """List all users in an org (admin only)."""
        return await UserRepository.list_by_org(conn, org_id)

    @staticmethod
    async def add_user(
        conn: asyncpg.Connection,
        org_id: int,
        email: str,
        name: str,
        password: Optional[str] = None,
        role: str = "hr",
        department_id: Optional[int] = None,
        admin_user_id: Optional[int] = None,
        ip_address: Optional[str] = None,
    ) -> dict:
        """Add a new team member (admin only)."""
        email = validate_email(email)
        validate_password(password)

        if await UserRepository.get_by_email(conn, email):
            raise AlreadyExistsError("This email is already registered")

        password_hash = hash_password(password)
        user = await UserRepository.create(
            conn,
            org_id=org_id,
            email=email,
            password_hash=password_hash,
            name=name.strip(),
            role=role,
            department_id=department_id,
        )

        await AuditLogRepository.create(
            conn,
            org_id=org_id,
            user_id=admin_user_id,
            action="user_created",
            entity_type="user",
            entity_id=str(user["id"]),
            details={"role": role, "method": "admin_add"},
            ip_address=ip_address,
        )

        return user

    @staticmethod
    async def update_user(
        conn: asyncpg.Connection,
        user_id: int,
        org_id: int,
        admin_user_id: Optional[int] = None,
        ip_address: Optional[str] = None,
        **fields,
    ) -> dict:
        """Update a user (admin only)."""
        user = await UserRepository.update(conn, user_id, org_id, **fields)
        if not user:
            raise NotFoundError("User not found")

        await AuditLogRepository.create(
            conn,
            org_id=org_id,
            user_id=admin_user_id,
            action="user_updated",
            entity_type="user",
            entity_id=str(user_id),
            details=fields,
            ip_address=ip_address,
        )

        return user

    @staticmethod
    async def update_profile(
        conn: asyncpg.Connection,
        user_id: int,
        org_id: int,
        **fields,
    ) -> dict:
        """Update own profile (name, phone, avatar)."""
        user = await UserRepository.update(conn, user_id, org_id, **fields)
        if not user:
            raise NotFoundError("User not found")
        return user

    @staticmethod
    async def change_password(
        conn: asyncpg.Connection,
        user_id: int,
        current_password: str,
        new_password: str,
    ) -> None:
        """Change password — verifies current password first."""
        user = await conn.fetchrow(
            "SELECT id, password_hash FROM users WHERE id = $1", user_id
        )
        if not user:
            raise NotFoundError("User not found")

        if not verify_password(current_password, user["password_hash"]):
            raise InvalidCredentialsError("Current password is incorrect")

        validate_password(new_password)
        new_hash = hash_password(new_password)
        await UserRepository.update_password(conn, user_id, new_hash)

    # ── Forgot / reset password ──────────────────────────────────────────────

    @staticmethod
    async def forgot_password(
        conn: asyncpg.Connection,
        email: str,
    ) -> None:
        """
        Send password reset email.
        Always succeeds publicly (never leak whether email exists).
        """
        try:
            email = validate_email(email)
        except ValidationError:
            raise

        user = await UserRepository.get_by_email(conn, email)
        if not user:
            logger.info(f"[forgot-password] no-op for {email} (user missing)")
            return

        token = create_magic_link_token(
            token_type="password_reset",
            entity_id=user["id"],
            expires_hours=settings.RESET_LINK_EXPIRY_HOURS,
        )
        reset_url = f"{settings.MAGIC_LINK_BASE_URL}/reset-password/{token}"

        await EmailService.send_password_reset(
            to_email=user["email"],
            reset_url=reset_url,
            user_name=user.get("name"),
            expires_hours=settings.RESET_LINK_EXPIRY_HOURS,
        )

    @staticmethod
    async def reset_password(
        conn: asyncpg.Connection,
        token: str,
        new_password: str,
    ) -> None:
        """Reset password using a single-use magic-link token. Also clears lockout state."""
        payload = verify_magic_link_token(token, "password_reset")
        jti = payload.get("jti")
        user_id = payload.get("entity_id")
        if not jti or not user_id:
            raise InvalidCredentialsError("Malformed reset link.")

        validate_password(new_password)
        new_hash = hash_password(new_password)

        # Single-use: consume the jti before mutating the password
        await _consume_magic_link_jti(
            conn, jti=jti, token_type="password_reset", entity_id=user_id
        )

        await UserRepository.update_password(conn, user_id, new_hash)
        # Clear lockout / failed-attempt counters so the user can sign in immediately
        await UserRepository.reset_login_state(conn, user_id)
