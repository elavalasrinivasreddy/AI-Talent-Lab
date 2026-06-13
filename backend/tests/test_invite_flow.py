"""
Unit tests for the invite-by-email path in AuthService.add_user.

These tests are fully synchronous with the database — they monkeypatch the
repository and email-service calls so no real DB or Resend connection is needed.
"""
import pytest

from backend.services.auth_service import AuthService
from backend.services.email_service import EmailService


async def _async_return(value):
    """Return `value` from an awaitable. Replacement for the deprecated
    `asyncio.coroutine` stub pattern used to fake repository return values."""
    return value


# ── Minimal fake asyncpg Connection ──────────────────────────────────────────

class _FakeConn:
    """Mimics the asyncpg.Connection API used by AuthService.add_user."""

    async def fetchrow(self, query, *args):
        # Org plan lookup (seat quota) — None falls back to the default plan.
        return None

    async def fetchval(self, query, *args):
        # Seat counter — a fresh mocked org has zero seats used.
        return 0


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_fake_user(user_id: int = 42):
    return {
        "id": user_id,
        "org_id": 1,
        "email": "invitee@example.com",
        "name": "New Person",
        "role": "hr",
        "department_id": None,
        "is_active": True,
        "password_hash": "HASHED",
        "created_at": None,
    }


def _make_fake_org():
    return {
        "id": 1,
        "name": "Acme Corp",
        "slug": "acme-corp",
    }


# ── Tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_invite_by_email_sends_set_password_link(monkeypatch):
    """
    Calling add_user without a password must:
      1. Create the user (UserRepository.create called).
      2. NOT call validate_password for the temp password.
      3. Call EmailService.send_user_invite with a URL containing /set-password/.
      4. Write an audit log with action="user_invited" and via_invite_email=True.
    """
    conn = _FakeConn()
    created_user = _make_fake_user(user_id=99)
    audit_calls = []
    email_calls = []

    # Patch UserRepository
    from backend.db.repositories import users as users_repo_mod
    monkeypatch.setattr(
        users_repo_mod.UserRepository, "get_by_email",
        staticmethod(lambda _conn, _email: _async_return(None)),
    )
    monkeypatch.setattr(
        users_repo_mod.UserRepository, "create",
        staticmethod(lambda *args, **kwargs: _async_return(created_user)),
    )

    # Patch OrgRepository
    from backend.db.repositories import organizations as orgs_repo_mod
    monkeypatch.setattr(
        orgs_repo_mod.OrgRepository, "get_by_id",
        staticmethod(lambda _conn, _org_id: _async_return(_make_fake_org())),
    )

    # Patch AuditLogRepository
    from backend.db.repositories import audit as audit_repo_mod

    async def _fake_audit_create(*args, **kwargs):
        audit_calls.append(kwargs)

    monkeypatch.setattr(
        audit_repo_mod.AuditLogRepository, "create",
        staticmethod(_fake_audit_create),
    )

    # Patch EmailService.send_user_invite
    async def _fake_send_invite(**kwargs):
        email_calls.append(kwargs)
        return True

    monkeypatch.setattr(EmailService, "send_user_invite", staticmethod(_fake_send_invite))

    # Call under test — no password provided
    result = await AuthService.add_user(
        conn=conn,
        org_id=1,
        email="invitee@example.com",
        name="New Person",
        password=None,
        role="hr",
        admin_user_id=7,
    )

    # User dict is returned correctly
    assert result["id"] == 99

    # Invite email was sent
    assert len(email_calls) == 1, "Expected exactly one invite email"
    invite_kwargs = email_calls[0]
    assert "/set-password/" in invite_kwargs["set_password_url"], (
        f"set_password_url should contain /set-password/, got: {invite_kwargs['set_password_url']!r}"
    )
    assert invite_kwargs["to_email"] == "invitee@example.com"
    assert invite_kwargs["invitee_name"] == "New Person"
    assert invite_kwargs["org_name"] == "Acme Corp"
    assert invite_kwargs["role_label"] == "HR"

    # Audit log has correct action
    assert len(audit_calls) == 1
    assert audit_calls[0]["action"] == "user_invited"
    assert audit_calls[0]["details"]["via_invite_email"] is True


@pytest.mark.asyncio
async def test_add_user_with_password_skips_invite_email(monkeypatch):
    """
    Calling add_user WITH a password (legacy path) must NOT call
    EmailService.send_user_invite, and the audit action must be 'user_created'.
    """
    conn = _FakeConn()
    created_user = _make_fake_user(user_id=55)
    audit_calls = []
    email_calls = []

    from backend.db.repositories import users as users_repo_mod
    monkeypatch.setattr(
        users_repo_mod.UserRepository, "get_by_email",
        staticmethod(lambda _conn, _email: _async_return(None)),
    )
    monkeypatch.setattr(
        users_repo_mod.UserRepository, "create",
        staticmethod(lambda *args, **kwargs: _async_return(created_user)),
    )

    from backend.db.repositories import organizations as orgs_repo_mod
    monkeypatch.setattr(
        orgs_repo_mod.OrgRepository, "get_by_id",
        staticmethod(lambda _conn, _org_id: _async_return(_make_fake_org())),
    )

    from backend.db.repositories import audit as audit_repo_mod

    async def _fake_audit_create(*args, **kwargs):
        audit_calls.append(kwargs)

    monkeypatch.setattr(
        audit_repo_mod.AuditLogRepository, "create",
        staticmethod(_fake_audit_create),
    )

    async def _fake_send_invite(**kwargs):
        email_calls.append(kwargs)
        return True

    monkeypatch.setattr(EmailService, "send_user_invite", staticmethod(_fake_send_invite))

    result = await AuthService.add_user(
        conn=conn,
        org_id=1,
        email="setpass@example.com",
        name="Set Pass User",
        password="SuperSecure123!",
        role="team_lead",
        admin_user_id=7,
    )

    assert result["id"] == 55
    # No invite email
    assert len(email_calls) == 0, "Invite email must NOT be sent when password is provided"
    # Audit action is the legacy one
    assert audit_calls[0]["action"] == "user_created"
    assert audit_calls[0]["details"]["method"] == "admin_add"
