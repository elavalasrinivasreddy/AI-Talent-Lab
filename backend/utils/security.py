"""
utils/security.py – Authentication utilities.
bcrypt password hashing (12 rounds), JWT encode/decode,
magic link token generation/verification (single-use enforced via DB jti).
See docs/architecture/03_backend.md §9.
"""
import bcrypt
import jwt
import secrets
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
        "jti": secrets.token_urlsafe(16),
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
#
# Supported token_types:
#   "auth_magic"     — passwordless sign-in (entity_id = user_id, 15 min)
#   "password_reset" — password reset link (entity_id = user_id, 24h)
#   "apply"          — candidate apply chat (entity_id = application_id, 72h)
#   "panel_feedback" — panelist feedback (entity_id = panel_member_id, 7d)
#
# Every token carries a random `jti` claim. Verification is split into two steps:
#   1. `verify_magic_link_token` — cryptographic validation only (signature + expiry + type)
#   2. caller checks `consumed_magic_links` row and INSERTs to consume it
# This separation lets the apply/panel flows replay-tolerant (multi-tap) while
# auth/password_reset enforce single-use via the consumed_magic_links table.

def create_magic_link_token(
    token_type: str,
    entity_id: int,
    expires_hours: Optional[float] = None,
    expires_minutes: Optional[int] = None,
) -> str:
    """
    Create a signed JWT magic-link token with a unique jti claim.

    Pass either `expires_hours` (float ok for sub-hour) or `expires_minutes`.
    """
    if expires_minutes is not None:
        delta = timedelta(minutes=expires_minutes)
    else:
        delta = timedelta(hours=expires_hours or 1)

    now = datetime.now(timezone.utc)
    payload = {
        "type": token_type,
        "entity_id": entity_id,
        "jti": secrets.token_urlsafe(16),
        "exp": now + delta,
        "iat": now,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def verify_magic_link_token(token: str, expected_type: str) -> dict:
    """
    Cryptographically verify a magic-link token. Returns the decoded payload.

    Does NOT check or consume the jti — callers that require single-use must
    insert the jti into `consumed_magic_links` themselves (see auth_service).
    Apply/panel flows that allow multi-tap can skip the jti check entirely.

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
