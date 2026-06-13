"""
test_hire_request_approval.py – Unit tests for the dept_admin approval workflow.

Uses in-memory mocks: no real DB or email provider required.
Tests:
  1. approve_request: pending → approved, emails fired
  2. reject_request:  pending → rejected, email with reason
  3. accept blocked on pending (must be approved first)
  4. dept_admin of wrong dept can't approve
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from backend.exceptions import InsufficientPermissionsError
from backend.services.hire_request_service import HireRequestService
from backend.services.hire_requests.crud import _BadTransitionError


# ── Helpers ──────────────────────────────────────────────────────────────────


def _make_conn(request_row: dict):
    """Return a mock asyncpg connection that returns `request_row` for
    HireRequestRepository.get_by_id calls and stubs writes."""
    conn = AsyncMock()

    # Minimal audit log row that AuditLogRepository.create can dict() safely
    _audit_row = {
        "id": 1, "org_id": 1, "user_id": 1, "action": "ok",
        "entity_type": "hire_request", "entity_id": "1",
        "details": None, "ip_address": None, "created_at": "2026-05-28T10:00:00",
    }

    # conn.fetchrow used by AuditLogRepository.create + email user lookups
    async def _fetchrow(sql, *args):
        # Audit log INSERT RETURNING — must return a dict-like row
        if "INSERT INTO audit_log" in sql:
            return _audit_row
        if "FROM hire_requests" in sql or "WHERE hr.id" in sql:
            return request_row
        if "FROM users WHERE id" in sql:
            return {"name": "Test Approver"}
        return None

    conn.fetchrow = _fetchrow

    # conn.fetch used for HR email list / approver list
    async def _fetch(sql, *args):
        return []

    conn.fetch = _fetch

    # conn.execute for UPDATE + INSERT notifications
    conn.execute = AsyncMock(return_value=None)

    # conn.fetchval
    conn.fetchval = AsyncMock(return_value=0)

    # transaction context manager
    _txn = AsyncMock()
    _txn.__aenter__ = AsyncMock(return_value=None)
    _txn.__aexit__ = AsyncMock(return_value=False)
    conn.transaction = MagicMock(return_value=_txn)

    return conn


def _pending_request(dept_id=10, requested_by=99):
    return {
        "id": 1,
        "org_id": 1,
        "role_name": "Senior Engineer",
        "status": "pending",
        "department_id": dept_id,
        "requested_by": requested_by,
        "requested_by_name": "Alice",
        "requested_by_email": "alice@example.com",
        "department_name": "Engineering",
        "accepted_by": None,
        "accepted_by_name": None,
        "approved_by": None,
        "approved_by_name": None,
        "rejection_reason": None,
        "headcount": 1,
        "work_type": "onsite",
        "position_id": None,
        "position_role_name": None,
        "position_status": None,
        "position_approval_status": None,
        "candidate_count": 0,
        "interview_count": 0,
        "comp_min": None,
        "comp_max": None,
        "location": None,
        "experience_min": None,
        "experience_max": None,
        "target_start": None,
        "requirements": None,
        "chat_session_id": None,
        "created_at": "2026-05-28T10:00:00",
        "updated_at": "2026-05-28T10:00:00",
        "approved_at": None,
    }


# ── Test 1: approve transitions pending → approved ───────────────────────────


@pytest.mark.asyncio
async def test_approve_transitions_pending_to_approved():
    req = _pending_request(dept_id=10)
    conn = _make_conn(req)

    approved_rows = []

    from backend.db.repositories import hire_requests as hr_repo

    async def _fake_approve(c, request_id, org_id, approved_by):
        approved_rows.append({"request_id": request_id, "approved_by": approved_by})

    # After approve(), get_by_id should return the approved row
    approved_req = {**req, "status": "approved", "approved_by": 42, "approved_by_name": "Bob Manager"}

    get_calls = []

    async def _fake_get_by_id(c, request_id, org_id):
        get_calls.append(len(get_calls))
        # First call (inside approve_request for permission check) returns pending
        # Second call (after approve(), for the updated row) returns approved
        if len(get_calls) == 1:
            return req
        return approved_req

    email_calls = []

    async def _fake_send_approved(to_email, recipient_name, role_name, dept_name, approver_name, request_url, note=None):
        email_calls.append({"to": to_email, "role_name": role_name, "note": note})
        return True

    with patch.object(hr_repo.HireRequestRepository, "approve", _fake_approve), \
         patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get_by_id), \
         patch("backend.services.email_service.EmailService.send_hire_request_approved",
               AsyncMock(side_effect=_fake_send_approved)):

        result = await HireRequestService.approve_request(
            conn,
            request_id=1,
            org_id=1,
            user_id=42,
            role="dept_admin",
            dept_id=10,
        )

    assert approved_rows == [{"request_id": 1, "approved_by": 42}]
    assert result["status"] == "approved"
    # Raiser email fired (HR list is empty in mock so only raiser email)
    assert any(e["to"] == "alice@example.com" for e in email_calls), \
        f"Expected raiser email; got {email_calls}"


# ── Test 1b: approve WITH note surfaces the note to the raiser ────────────────


@pytest.mark.asyncio
async def test_approve_with_note_notifies_raiser_with_note():
    """Regression (#2): when the approver supplies a note (e.g. they modified the
    request before approving), the requester's in-app notification AND email must
    include the note text — not just a generic "approved" message."""
    req = _pending_request(dept_id=10, requested_by=99)
    conn = _make_conn(req)

    from backend.db.repositories import hire_requests as hr_repo

    async def _fake_approve(c, request_id, org_id, approved_by):
        return None

    get_calls = []
    approved_req = {**req, "status": "approved", "approved_by": 42, "approved_by_name": "Bob Manager"}

    async def _fake_get_by_id(c, request_id, org_id):
        get_calls.append(len(get_calls))
        return req if len(get_calls) == 1 else approved_req

    email_calls = []

    async def _fake_send_approved(to_email, recipient_name, role_name, dept_name, approver_name, request_url, note=None):
        email_calls.append({"to": to_email, "note": note})
        return True

    note_text = "Increased headcount to 2; trimmed comp band by 2 LPA"

    with patch.object(hr_repo.HireRequestRepository, "approve", _fake_approve), \
         patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get_by_id), \
         patch("backend.services.email_service.EmailService.send_hire_request_approved",
               AsyncMock(side_effect=_fake_send_approved)):

        await HireRequestService.approve_request(
            conn,
            request_id=1,
            org_id=1,
            user_id=42,
            role="dept_admin",
            dept_id=10,
            note=note_text,
        )

    # Raiser email carries the note.
    raiser_emails = [e for e in email_calls if e["to"] == "alice@example.com"]
    assert raiser_emails and raiser_emails[0]["note"] == note_text, \
        f"Expected raiser email to carry the note; got {email_calls}"

    # Raiser in-app notification (user_id=99) message contains the note text.
    # _notify calls conn.execute(sql, org_id, user_id, type, title, message, action_url).
    notif_calls = [
        c for c in conn.execute.call_args_list
        if c.args and "INSERT INTO notifications" in c.args[0] and len(c.args) > 5 and c.args[2] == 99
    ]
    assert notif_calls, "Expected a notification to the raiser (user 99)"
    assert any(note_text in c.args[5] for c in notif_calls), \
        f"Expected note text in raiser notification; got {[c.args[5] for c in notif_calls]}"


# ── Test 2: reject transitions pending → rejected with reason ─────────────────


@pytest.mark.asyncio
async def test_reject_transitions_pending_to_rejected_with_reason():
    req = _pending_request(dept_id=10)
    conn = _make_conn(req)

    rejected_rows = []

    from backend.db.repositories import hire_requests as hr_repo

    async def _fake_reject(c, request_id, org_id, rejection_reason):
        rejected_rows.append({"request_id": request_id, "reason": rejection_reason})

    rejected_req = {**req, "status": "rejected", "rejection_reason": "Budget freeze"}

    get_calls = []

    async def _fake_get_by_id(c, request_id, org_id):
        get_calls.append(1)
        if len(get_calls) == 1:
            return req
        return rejected_req

    email_calls = []

    async def _fake_send_rejected(to_email, raiser_name, role_name, reason, approver_name):
        email_calls.append({"to": to_email, "reason": reason})
        return True

    with patch.object(hr_repo.HireRequestRepository, "reject", _fake_reject), \
         patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get_by_id), \
         patch("backend.services.email_service.EmailService.send_hire_request_rejected",
               AsyncMock(side_effect=_fake_send_rejected)):

        result = await HireRequestService.reject_request(
            conn,
            request_id=1,
            org_id=1,
            user_id=42,
            role="dept_admin",
            dept_id=10,
            reason="Budget freeze",
        )

    assert rejected_rows == [{"request_id": 1, "reason": "Budget freeze"}]
    assert result["status"] == "rejected"
    assert len(email_calls) == 1
    assert email_calls[0]["to"] == "alice@example.com"
    assert email_calls[0]["reason"] == "Budget freeze"


# ── Test 3: HR cannot pick up a pending request (must be approved first) ──────


@pytest.mark.asyncio
async def test_hr_cannot_accept_pending_request():
    """accept() must raise _BadTransitionError when status is 'pending'."""
    req = _pending_request()
    conn = _make_conn(req)

    from backend.db.repositories import hire_requests as hr_repo

    async def _fake_get_by_id(c, request_id, org_id):
        return req

    with patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get_by_id):
        with pytest.raises(_BadTransitionError) as exc_info:
            await HireRequestService.accept(
                conn,
                request_id=1,
                org_id=1,
                user_id=55,
                role="hr",
            )

    assert "awaiting dept_admin approval" in str(exc_info.value).lower() or \
           "must be approved" in str(exc_info.value).lower(), \
        f"Unexpected error message: {exc_info.value}"


# ── Test 4: dept_admin of wrong dept cannot approve ──────────────────────────


@pytest.mark.asyncio
async def test_dept_admin_wrong_dept_cannot_approve():
    """dept_admin whose dept_id doesn't match the request's department_id is blocked."""
    req = _pending_request(dept_id=10)  # request is for dept 10
    conn = _make_conn(req)

    from backend.db.repositories import hire_requests as hr_repo

    async def _fake_get_by_id(c, request_id, org_id):
        return req

    with patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get_by_id):
        with pytest.raises(InsufficientPermissionsError) as exc_info:
            await HireRequestService.approve_request(
                conn,
                request_id=1,
                org_id=1,
                user_id=99,
                role="dept_admin",
                dept_id=20,  # caller is in dept 20 — wrong dept
            )

    assert "own department" in str(exc_info.value).lower(), \
        f"Unexpected error message: {exc_info.value}"


# ── Test 5: org_head can approve any dept's request ──────────────────────────


@pytest.mark.asyncio
async def test_org_head_can_approve_any_dept():
    req = _pending_request(dept_id=10)
    conn = _make_conn(req)

    approved_rows = []

    from backend.db.repositories import hire_requests as hr_repo

    async def _fake_approve(c, request_id, org_id, approved_by):
        approved_rows.append(request_id)

    approved_req = {**req, "status": "approved", "approved_by": 1, "approved_by_name": "CEO"}

    get_calls = []

    async def _fake_get_by_id(c, request_id, org_id):
        get_calls.append(1)
        return req if len(get_calls) == 1 else approved_req

    with patch.object(hr_repo.HireRequestRepository, "approve", _fake_approve), \
         patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get_by_id), \
         patch("backend.services.email_service.EmailService.send_hire_request_approved",
               AsyncMock(return_value=True)):

        result = await HireRequestService.approve_request(
            conn,
            request_id=1,
            org_id=1,
            user_id=1,
            role="org_head",
            dept_id=99,  # org_head's own dept — doesn't matter for permission
        )

    assert approved_rows == [1]
    assert result["status"] == "approved"


# ── Test 6: reject requires a non-empty reason ───────────────────────────────


@pytest.mark.asyncio
async def test_reject_requires_non_empty_reason():
    from backend.exceptions import ValidationError

    req = _pending_request()
    conn = _make_conn(req)

    from backend.db.repositories import hire_requests as hr_repo

    async def _fake_get_by_id(c, request_id, org_id):
        return req

    with patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get_by_id):
        with pytest.raises(ValidationError):
            await HireRequestService.reject_request(
                conn,
                request_id=1,
                org_id=1,
                user_id=42,
                role="dept_admin",
                dept_id=10,
                reason="   ",  # blank — should fail
            )
