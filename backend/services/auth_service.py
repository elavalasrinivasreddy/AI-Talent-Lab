"""
services/auth_service.py – Auth business logic.
Register, login, password management. No HTTP, no SQL — uses repositories.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import asyncpg

from backend.db.repositories.users import UserRepository
from backend.db.repositories.organizations import OrgRepository
from backend.db.repositories.audit import AuditLogRepository
from backend.utils.security import hash_password, verify_password, create_access_token, create_magic_link_token
from backend.utils.validators import validate_password, validate_email, generate_slug
from backend.exceptions import (
    InvalidCredentialsError,
    AlreadyExistsError,
    AccountLockedError,
    NotFoundError,
    ValidationError,
)
from backend.config import settings

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


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
        """
        # Validate inputs
        email = validate_email(email)
        validate_password(password)

        # Check if email already exists
        existing_user = await UserRepository.get_by_email(conn, email)
        if existing_user:
            raise AlreadyExistsError("This email is already registered")

        # Check if org name already exists
        existing_org = await OrgRepository.get_by_name(conn, org_name)
        if existing_org:
            raise AlreadyExistsError("This organization name is taken")

        # Generate unique slug
        base_slug = generate_slug(org_name)
        slug = base_slug
        counter = 2
        while await OrgRepository.slug_exists(conn, slug):
            slug = f"{base_slug}-{counter}"
            counter += 1

        # Create org
        org = await OrgRepository.create(
            conn,
            name=org_name.strip(),
            slug=slug,
            segment=segment,
            size=size,
            website=website,
        )

        # Create admin user
        password_hash = hash_password(password)
        user = await UserRepository.create(
            conn,
            org_id=org["id"],
            email=email,
            password_hash=password_hash,
            name=name.strip(),
            role="admin",
        )

        # Audit log
        await AuditLogRepository.create(
            conn,
            org_id=org["id"],
            user_id=user["id"],
            action="user_created",
            entity_type="user",
            entity_id=str(user["id"]),
            details={"role": "admin", "method": "registration"},
            ip_address=ip_address,
        )

        # Seed defaults for the new org (department, screening questions,
        # message templates, scorecard template)
        from backend.services.settings_service import SettingsService
        await SettingsService.seed_defaults(conn, org["id"])

        # Create JWT
        token = create_access_token(
            user_id=user["id"],
            org_id=org["id"],
            role="admin",
        )

        return {
            "token": token,
            "user": user,
            "org": org,
        }

    @staticmethod
    async def login(
        conn: asyncpg.Connection,
        email: str,
        password: str,
        ip_address: Optional[str] = None,
    ) -> dict:
        """
        Authenticate user. Returns JWT + user.
        Enforces account lockout after 5 failed attempts (15 min).
        """
        email = email.strip().lower()

        # Get user by email
        user = await UserRepository.get_by_email(conn, email)
        if not user:
            raise InvalidCredentialsError()

        if not user["is_active"]:
            raise InvalidCredentialsError("Account is deactivated")

        # Check lockout
        if user["locked_until"]:
            locked_until = user["locked_until"]
            if locked_until.tzinfo is None:
                locked_until = locked_until.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            if now < locked_until:
                remaining = int((locked_until - now).total_seconds() / 60) + 1
                raise AccountLockedError(
                    f"Account locked. Try again in {remaining} minutes."
                )

        # Verify password
        if not verify_password(password, user["password_hash"]):
            attempts = user["failed_login_attempts"] + 1
            await UserRepository.update_failed_login_attempts(conn, user["id"], attempts)

            # Audit failed login
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
                locked_until = (datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)).replace(tzinfo=None)
                await UserRepository.lock_account(conn, user["id"], locked_until)
                raise AccountLockedError(
                    f"Account locked after {MAX_FAILED_ATTEMPTS} failed attempts. "
                    f"Try again in {LOCKOUT_MINUTES} minutes."
                )

            raise InvalidCredentialsError()

        # Success — reset login state
        await UserRepository.reset_login_state(conn, user["id"])

        # Audit successful login
        await AuditLogRepository.create(
            conn,
            org_id=user["org_id"],
            user_id=user["id"],
            action="login",
            entity_type="user",
            entity_id=str(user["id"]),
            ip_address=ip_address,
        )

        # Create JWT
        token = create_access_token(
            user_id=user["id"],
            org_id=user["org_id"],
            role=user["role"],
            department_id=user.get("department_id"),
        )

        return {"token": token, "user": user}

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
        password: str,
        role: str = "recruiter",
        department_id: Optional[int] = None,
        admin_user_id: Optional[int] = None,
        ip_address: Optional[str] = None,
    ) -> dict:
        """Add a new team member (admin only)."""
        email = validate_email(email)
        validate_password(password)

        existing = await UserRepository.get_by_email(conn, email)
        if existing:
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

    @staticmethod
    async def forgot_password(
        conn: asyncpg.Connection,
        email: str,
    ) -> None:
        """
        Send password reset email.
        Always succeeds (never leak whether email exists).
        """
        email = email.strip().lower()
        user = await UserRepository.get_by_email(conn, email)

        if user:
            token = create_magic_link_token(
                token_type="password_reset",
                entity_id=user["id"],
                expires_hours=settings.RESET_LINK_EXPIRY_HOURS,
            )
            reset_url = f"{settings.MAGIC_LINK_BASE_URL}/reset-password/{token}"
            # TODO: Send email via email adapter (simulation in dev)
            logger.info(f"[EMAIL SIMULATION] Password reset link for {email}: {reset_url}")
        else:
            # Don't leak that email doesn't exist
            logger.info(f"Forgot password for non-existent email: {email}")

    @staticmethod
    async def reset_password(
        conn: asyncpg.Connection,
        token: str,
        new_password: str,
    ) -> None:
        """Reset password using magic link token."""
        from backend.utils.security import verify_magic_link_token

        payload = verify_magic_link_token(token, "password_reset")
        user_id = payload["entity_id"]

        validate_password(new_password)
        new_hash = hash_password(new_password)
        await UserRepository.update_password(conn, user_id, new_hash)
