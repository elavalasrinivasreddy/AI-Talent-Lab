"""
utils/security.py – Authentication utilities.
bcrypt password hashing (12 rounds), JWT encode/decode,
magic link token generation/verification.
See docs/BACKEND_PLAN.md §9.
"""
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional

from backend.config import settings
from backend.exceptions import TokenExpiredError, InvalidCredentialsError


# ── Password Hashing ───────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash a password using bcrypt with 12 rounds."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a bcrypt hash."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


# ── JWT Tokens ─────────────────────────────────────────────────────────────────

def create_access_token(
    user_id: int,
    org_id: int,
    role: str,
    department_id: Optional[int] = None,
    expires_hours: Optional[int] = None,
) -> str:
    """Create a JWT access token with user claims."""
    exp = datetime.now(timezone.utc) + timedelta(
        hours=expires_hours or settings.JWT_EXPIRY_HOURS
    )
    payload = {
        "sub": str(user_id),
        "org_id": org_id,
        "role": role,
        "exp": exp,
        "iat": datetime.now(timezone.utc),
    }
    if department_id is not None:
        payload["dept_id"] = department_id

    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT access token. Raises on expiry or invalid."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise TokenExpiredError("Access token has expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise InvalidCredentialsError("Invalid access token.")


# ── Magic Link Tokens ──────────────────────────────────────────────────────────

def create_magic_link_token(
    token_type: str,
    entity_id: int,
    expires_hours: int,
) -> str:
    """
    Create a signed JWT magic link token.
    token_type: "apply" | "panel_feedback" | "password_reset"
    entity_id: application_id | panel_member_id | user_id
    """
    exp = datetime.now(timezone.utc) + timedelta(hours=expires_hours)
    payload = {
        "type": token_type,
        "entity_id": entity_id,
        "exp": exp,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def verify_magic_link_token(token: str, expected_type: str) -> dict:
    """
    Verify a magic link token. Returns the decoded payload.
    Raises MagicLinkExpiredError or InvalidCredentialsError.
    """
    from backend.exceptions import MagicLinkExpiredError

    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise MagicLinkExpiredError("This link has expired.")
    except jwt.InvalidTokenError:
        raise InvalidCredentialsError("Invalid link.")

    if payload.get("type") != expected_type:
        raise InvalidCredentialsError("Invalid link type.")

    return payload
