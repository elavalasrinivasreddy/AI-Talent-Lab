"""
test_hire_request_service.py – Unit tests for HireRequestService.

Covers (without duplicating test_hire_request.py CRUD or test_hire_request_approval.py):
  1. Status-transition guards (happy paths + rejection of invalid transitions)
  2. Tenant isolation (org A cannot read/modify org B's requests)
  3. Role-based guards (team_lead can create, hr cannot approve, etc.)
  4. Cancel semantics (owner vs admin, terminal-state guard)
  5. accept() transition approved → accepted

All tests use mock asyncpg connections following the pattern in
test_hire_request_approval.py — no real DB, no Celery, no email delivery.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from backend.exceptions import (
    InsufficientPermissionsError,
    ValidationError,
    NotFoundError,
)
from backend.services.hire_request_service import HireRequestService, _BadTransitionError


# ── Shared helpers ─────────────────────────────────────────────────────────────


def _make_conn(request_row=None, *, fetchrow_override=None, fetch_override=None):
    """
    Build a mock asyncpg connection.

    * ``request_row``      – returned for hire_requests SELECTs and audit INSERT RETURNING
    * ``fetchrow_override`` – optional callable(sql, *args) -> row to replace default logic
    * ``fetch_override``    – optional callable(sql, *args) -> list to replace default logic
    """
    conn = AsyncMock()

    _audit_row = {
        "id": 1, "org_id": 1, "user_id": 1, "action": "ok",
        "entity_type": "hire_request", "entity_id": "1",
        "details": None, "ip_address": None, "created_at": "2026-06-01T10:00:00",
    }

    async def _fetchrow(sql, *args):
        if fetchrow_override:
            return await fetchrow_override(sql, *args)
        if "INSERT INTO audit_log" in sql:
            return _audit_row
        if request_row is not None:
            return request_row
        return None

    async def _fetch(sql, *args):
        if fetch_override:
            return await fetch_override(sql, *args)
        return []

    conn.fetchrow = _fetchrow
    conn.fetch = _fetch
    conn.execute = AsyncMock(return_value=None)
    conn.fetchval = AsyncMock(return_value=0)

    _txn = AsyncMock()
    _txn.__aenter__ = AsyncMock(return_value=None)
    _txn.__aexit__ = AsyncMock(return_value=False)
    conn.transaction = MagicMock(return_value=_txn)

    return conn


def _make_request(
    *,
    id: int = 1,
    org_id: int = 1,
    status: str = "pending",
    dept_id: int = 10,
    requested_by: int = 99,
    accepted_by=None,
    accepted_by_name=None,
    approved_by=None,
    approved_by_name=None,
    notes=None,
    reviewing_locked_by=None,
    role_name: str = "Senior Engineer",
) -> dict:
    return {
        "id": id,
        "org_id": org_id,
        "role_name": role_name,
        "status": status,
        "department_id": dept_id,
        "requested_by": requested_by,
        "requested_by_name": "Alice",
        "requested_by_email": "alice@example.com",
        "department_name": "Engineering",
        "accepted_by": accepted_by,
        "accepted_by_name": accepted_by_name,
        "approved_by": approved_by,
        "approved_by_name": approved_by_name,
        "rejection_reason": None,
        "headcount": 1,
        "work_type": "onsite",
        "priority": "normal",
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
        "notes": notes,
        "reviewing_locked_by": reviewing_locked_by,
        "reviewing_locked_by_name": None,
        "created_at": "2026-06-01T10:00:00",
        "updated_at": "2026-06-01T10:00:00",
        "approved_at": None,
    }


def _patch_repo(get_calls_holder=None, *, initial_row, after_row=None):
    """
    Return a dict of patch targets for HireRequestRepository methods.

    ``get_calls_holder`` – a list that records how many times get_by_id was called.
    ``initial_row``      – returned on first get_by_id call (or all calls if after_row is None).
    ``after_row``        – returned on second+ calls (simulates post-mutation state).
    """
    calls = get_calls_holder if get_calls_holder is not None else []

    async def _fake_get(conn, request_id, org_id):
        calls.append(1)
        if after_row is not None and len(calls) > 1:
            return after_row
        return initial_row

    return _fake_get


# ────────────────────────────────────────────────────────────────────────────
# 1. Status-transition: create always produces pending status
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_produces_pending_status():
    """team_lead creates a request → status is 'pending', not approved."""
    pending_row = _make_request(status="pending", dept_id=None, requested_by=1)
    conn = _make_conn(pending_row)

    from backend.db.repositories import hire_requests as hr_repo
    from backend.db.repositories import departments as dept_repo_mod

    async def _fake_create(c, **kwargs):
        return pending_row

    async def _fake_get(c, request_id, org_id):
        return pending_row

    with patch.object(hr_repo.HireRequestRepository, "create", _fake_create), \
         patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get), \
         patch("backend.services.hire_requests.crud._notify_approvers_on_create",
               AsyncMock(return_value=None)):
        result = await HireRequestService.create(
            conn,
            org_id=1,
            user_id=1,
            role="team_lead",
            role_name="Backend Engineer",
            headcount=1,
        )

    assert result["status"] == "pending"


# ────────────────────────────────────────────────────────────────────────────
# 2. Role guard: hr role cannot create a hire request
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_hr_cannot_create_hire_request():
    """HR cannot file a hire request — only team_lead/dept_admin/org_head can."""
    conn = _make_conn()
    with pytest.raises(InsufficientPermissionsError):
        await HireRequestService.create(
            conn,
            org_id=1,
            user_id=5,
            role="hr",
            role_name="Backend Engineer",
            headcount=1,
        )


# ────────────────────────────────────────────────────────────────────────────
# 3. Transition guard: cannot approve an already-approved request
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cannot_approve_already_approved_request():
    """approve_request on a request already in 'approved' status raises _BadTransitionError."""
    already_approved = _make_request(status="approved", dept_id=10)
    conn = _make_conn(already_approved)

    from backend.db.repositories import hire_requests as hr_repo

    async def _fake_get(c, request_id, org_id):
        return already_approved

    with patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get):
        with pytest.raises(_BadTransitionError) as exc:
            await HireRequestService.approve_request(
                conn, 1, 1, user_id=42, role="dept_admin", dept_id=10,
            )

    assert "approved" in str(exc.value).lower() or "pending" in str(exc.value).lower()


# ────────────────────────────────────────────────────────────────────────────
# 4. Transition guard: cannot reject an already-rejected request
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cannot_reject_already_rejected_request():
    """reject_request on a terminal 'rejected' request raises _BadTransitionError."""
    rejected_req = _make_request(status="rejected", dept_id=10)
    conn = _make_conn(rejected_req)

    from backend.db.repositories import hire_requests as hr_repo

    async def _fake_get(c, request_id, org_id):
        return rejected_req

    with patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get), \
         patch("backend.services.email_service.EmailService.send_hire_request_rejected",
               AsyncMock(return_value=True)):
        with pytest.raises(_BadTransitionError):
            await HireRequestService.reject_request(
                conn, 1, 1,
                user_id=42, role="dept_admin", dept_id=10,
                reason="duplicate",
            )


# ────────────────────────────────────────────────────────────────────────────
# 5. Transition: approved → accepted (HR pickup)
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_hr_can_accept_approved_request():
    """accept() on an approved request succeeds and returns 'accepted' status."""
    approved_req = _make_request(status="approved", dept_id=10, requested_by=99)
    accepted_req = _make_request(status="accepted", dept_id=10, requested_by=99,
                                 accepted_by=55, accepted_by_name="Bob HR")
    conn = _make_conn()

    from backend.db.repositories import hire_requests as hr_repo

    accept_calls = []

    async def _fake_accept(c, request_id, org_id, accepted_by, chat_session_id=None):
        accept_calls.append({"request_id": request_id, "accepted_by": accepted_by})

    get_calls = []

    async def _fake_get(c, request_id, org_id):
        get_calls.append(1)
        return approved_req if len(get_calls) == 1 else accepted_req

    with patch.object(hr_repo.HireRequestRepository, "accept", _fake_accept), \
         patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get), \
         patch("backend.services.email_service.EmailService.send_hire_request_picked_up",
               AsyncMock(return_value=True)):
        result = await HireRequestService.accept(
            conn, 1, 1, user_id=55, role="hr",
        )

    assert accept_calls == [{"request_id": 1, "accepted_by": 55}]
    assert result["status"] == "accepted"


# ────────────────────────────────────────────────────────────────────────────
# 6. Transition guard: cannot accept an already-accepted request
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cannot_accept_already_accepted_request():
    """accept() when status is already 'accepted' raises _BadTransitionError."""
    accepted_req = _make_request(
        status="accepted", dept_id=10, accepted_by=55, accepted_by_name="Bob HR",
    )
    conn = _make_conn(accepted_req)

    from backend.db.repositories import hire_requests as hr_repo

    async def _fake_get(c, request_id, org_id):
        return accepted_req

    with patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get):
        with pytest.raises(_BadTransitionError) as exc:
            await HireRequestService.accept(conn, 1, 1, user_id=55, role="hr")

    assert "picked up" in str(exc.value).lower() or "already" in str(exc.value).lower()


# ────────────────────────────────────────────────────────────────────────────
# 7. Transition guard: pending request cannot be accepted before approval
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_pending_request_cannot_be_accepted():
    """accept() on a pending (unapproved) request raises _BadTransitionError."""
    pending = _make_request(status="pending")
    conn = _make_conn(pending)

    from backend.db.repositories import hire_requests as hr_repo

    async def _fake_get(c, request_id, org_id):
        return pending

    with patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get):
        with pytest.raises(_BadTransitionError) as exc:
            await HireRequestService.accept(conn, 1, 1, user_id=55, role="hr")

    assert "approval" in str(exc.value).lower() or "approved" in str(exc.value).lower()


# ────────────────────────────────────────────────────────────────────────────
# 8. Transition guard: team_lead cannot approve
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_team_lead_cannot_approve():
    """team_lead role is not in _APPROVER_ROLES → InsufficientPermissionsError."""
    conn = _make_conn()
    with pytest.raises(InsufficientPermissionsError):
        await HireRequestService.approve_request(
            conn, 1, 1, user_id=10, role="team_lead", dept_id=10,
        )


# ────────────────────────────────────────────────────────────────────────────
# 9. Transition guard: hr cannot approve
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_hr_cannot_approve():
    """hr role is not in _APPROVER_ROLES → InsufficientPermissionsError."""
    conn = _make_conn()
    with pytest.raises(InsufficientPermissionsError):
        await HireRequestService.approve_request(
            conn, 1, 1, user_id=10, role="hr", dept_id=10,
        )


# ────────────────────────────────────────────────────────────────────────────
# 10. Transition guard: only hr/org_head can pick up
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_team_lead_cannot_accept():
    """team_lead role is not in _PICKUP_ROLES → InsufficientPermissionsError."""
    conn = _make_conn()
    with pytest.raises(InsufficientPermissionsError):
        await HireRequestService.accept(conn, 1, 1, user_id=10, role="team_lead")


# ────────────────────────────────────────────────────────────────────────────
# 11. Tenant isolation: get() raises NotFoundError for wrong org
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_returns_not_found_for_wrong_org():
    """
    HireRequestRepository.get_by_id scopes by org_id. When it returns None
    (simulating a cross-org query miss) the service raises NotFoundError.
    """
    conn = _make_conn(request_row=None)  # None → not found

    from backend.db.repositories import hire_requests as hr_repo

    async def _fake_get(c, request_id, org_id):
        # Simulate: request 1 belongs to org 1, not org 2
        if org_id == 2:
            return None
        return _make_request(id=1, org_id=1)

    with patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get):
        with pytest.raises(NotFoundError):
            await HireRequestService.get(conn, request_id=1, org_id=2)


# ────────────────────────────────────────────────────────────────────────────
# 12. Tenant isolation: approve by wrong org user is blocked
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_approve_blocked_for_wrong_org():
    """
    A dept_admin from org 2 cannot approve a request that belongs to org 1.
    The service's get() raises NotFoundError when the repo returns None.
    """
    conn = _make_conn()

    from backend.db.repositories import hire_requests as hr_repo

    async def _fake_get(c, request_id, org_id):
        # org 2 sees nothing
        if org_id == 2:
            return None
        return _make_request(id=1, org_id=1, dept_id=10)

    with patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get):
        with pytest.raises(NotFoundError):
            await HireRequestService.approve_request(
                conn, 1, org_id=2,
                user_id=200, role="dept_admin", dept_id=10,
            )


# ────────────────────────────────────────────────────────────────────────────
# 13. Tenant isolation: accept blocked for wrong org
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_accept_blocked_for_wrong_org():
    """
    An HR user from org 2 cannot accept a request from org 1.
    """
    conn = _make_conn()

    from backend.db.repositories import hire_requests as hr_repo

    async def _fake_get(c, request_id, org_id):
        if org_id == 2:
            return None
        return _make_request(id=1, org_id=1, status="approved")

    with patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get):
        with pytest.raises(NotFoundError):
            await HireRequestService.accept(
                conn, 1, org_id=2, user_id=200, role="hr",
            )


# ────────────────────────────────────────────────────────────────────────────
# 14. Cancel: owner can cancel a pending request
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_owner_can_cancel_pending_request():
    """The request owner (team_lead) can cancel their own pending request."""
    req = _make_request(status="pending", requested_by=99)
    cancelled_req = {**req, "status": "cancelled"}
    conn = _make_conn()

    from backend.db.repositories import hire_requests as hr_repo

    cancel_calls = []

    async def _fake_cancel(c, request_id, org_id, notes=None):
        cancel_calls.append(request_id)
        return True  # indicates cancellation succeeded

    get_calls = []

    async def _fake_get(c, request_id, org_id):
        get_calls.append(1)
        return req if len(get_calls) <= 1 else cancelled_req

    with patch.object(hr_repo.HireRequestRepository, "cancel", _fake_cancel), \
         patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get):
        result = await HireRequestService.cancel(
            conn, 1, 1, user_id=99, role="team_lead",
        )

    assert cancel_calls == [1]
    assert result["status"] == "cancelled"


# ────────────────────────────────────────────────────────────────────────────
# 15. Cancel: another user cannot cancel someone else's request
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_non_owner_team_lead_cannot_cancel():
    """A team_lead who is not the owner and not an admin cannot cancel."""
    req = _make_request(status="pending", requested_by=99)
    conn = _make_conn(req)

    from backend.db.repositories import hire_requests as hr_repo

    async def _fake_get(c, request_id, org_id):
        return req

    with patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get):
        with pytest.raises(InsufficientPermissionsError):
            await HireRequestService.cancel(
                conn, 1, 1, user_id=77, role="team_lead",  # 77 != 99 (owner)
            )


# ────────────────────────────────────────────────────────────────────────────
# 16. Cancel: terminal states cannot be cancelled
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.parametrize("terminal_status", ["cancelled", "fulfilled", "rejected"])
async def test_cannot_cancel_terminal_request(terminal_status):
    """Cancelling a request already in a terminal state raises _BadTransitionError."""
    req = _make_request(status=terminal_status, requested_by=99)
    conn = _make_conn(req)

    from backend.db.repositories import hire_requests as hr_repo

    async def _fake_get(c, request_id, org_id):
        return req

    with patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get):
        with pytest.raises(_BadTransitionError) as exc:
            await HireRequestService.cancel(
                conn, 1, 1, user_id=99, role="team_lead",
            )

    assert terminal_status in str(exc.value).lower()


# ────────────────────────────────────────────────────────────────────────────
# 17. Cancel: dept_admin from wrong dept is blocked
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_dept_admin_wrong_dept_cannot_cancel():
    """dept_admin whose dept (20) doesn't match request's dept (10) is blocked."""
    req = _make_request(status="pending", dept_id=10, requested_by=99)
    conn = _make_conn(req)

    from backend.db.repositories import hire_requests as hr_repo

    async def _fake_get(c, request_id, org_id):
        return req

    with patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get):
        with pytest.raises(InsufficientPermissionsError):
            await HireRequestService.cancel(
                conn, 1, 1,
                user_id=42, role="dept_admin",
                caller_dept_id=20,  # wrong dept
            )


# ────────────────────────────────────────────────────────────────────────────
# 18. Update: owner can edit a pending request
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_owner_can_update_pending_request():
    """Request owner can patch fields while status is 'pending'."""
    req = _make_request(status="pending", requested_by=99)
    updated_req = {**req, "role_name": "Staff Engineer"}
    conn = _make_conn()

    from backend.db.repositories import hire_requests as hr_repo

    async def _fake_get(c, request_id, org_id):
        return req

    async def _fake_update(c, request_id, org_id, **fields):
        return {**req, **fields}

    with patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get), \
         patch.object(hr_repo.HireRequestRepository, "update", _fake_update):
        result = await HireRequestService.update(
            conn, 1, 1,
            user_id=99, role="team_lead",
            role_name="Staff Engineer",
        )

    assert result["role_name"] == "Staff Engineer"


# ────────────────────────────────────────────────────────────────────────────
# 19. Update: editing an approved request is blocked
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cannot_edit_approved_request():
    """Update on a non-pending request raises _BadTransitionError."""
    req = _make_request(status="approved", requested_by=99)
    conn = _make_conn(req)

    from backend.db.repositories import hire_requests as hr_repo

    async def _fake_get(c, request_id, org_id):
        return req

    with patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get):
        with pytest.raises(_BadTransitionError) as exc:
            await HireRequestService.update(
                conn, 1, 1,
                user_id=99, role="team_lead",
                role_name="Principal Engineer",
            )

    assert "approved" in str(exc.value).lower()


# ────────────────────────────────────────────────────────────────────────────
# 20. Payload validation: blank role_name is rejected at create time
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_rejects_blank_role_name():
    """ValidationError raised for an empty role_name before any DB interaction."""
    conn = _make_conn()
    with pytest.raises(ValidationError) as exc:
        await HireRequestService.create(
            conn,
            org_id=1, user_id=1, role="team_lead",
            role_name="   ",  # blank
            headcount=1,
        )
    assert "role name" in str(exc.value).lower()


# ────────────────────────────────────────────────────────────────────────────
# 21. Payload validation: headcount out of range
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_rejects_headcount_zero():
    conn = _make_conn()
    with pytest.raises(ValidationError):
        await HireRequestService.create(
            conn,
            org_id=1, user_id=1, role="team_lead",
            role_name="Engineer",
            headcount=0,  # invalid
        )


@pytest.mark.asyncio
async def test_create_rejects_headcount_over_limit():
    conn = _make_conn()
    with pytest.raises(ValidationError):
        await HireRequestService.create(
            conn,
            org_id=1, user_id=1, role="team_lead",
            role_name="Engineer",
            headcount=101,
        )


# ────────────────────────────────────────────────────────────────────────────
# 22. Payload validation: invalid work_type
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_rejects_invalid_work_type():
    conn = _make_conn()
    with pytest.raises(ValidationError):
        await HireRequestService.create(
            conn,
            org_id=1, user_id=1, role="team_lead",
            role_name="Engineer",
            headcount=1,
            work_type="in_space",
        )


# ────────────────────────────────────────────────────────────────────────────
# 23. Payload validation: experience_min > experience_max
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_rejects_inverted_experience_range():
    conn = _make_conn()
    with pytest.raises(ValidationError):
        await HireRequestService.create(
            conn,
            org_id=1, user_id=1, role="team_lead",
            role_name="Engineer",
            headcount=1,
            experience_min=10,
            experience_max=5,
        )


# ────────────────────────────────────────────────────────────────────────────
# 24. Payload validation: comp_min > comp_max
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_rejects_inverted_comp_range():
    conn = _make_conn()
    with pytest.raises(ValidationError):
        await HireRequestService.create(
            conn,
            org_id=1, user_id=1, role="team_lead",
            role_name="Engineer",
            headcount=1,
            comp_min=100_000,
            comp_max=50_000,
        )


# ────────────────────────────────────────────────────────────────────────────
# 25. Approve: dept_admin cannot approve an org-level (deptless) request
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_dept_admin_cannot_approve_org_level_request():
    """dept_admin is blocked from approving hire requests that have no department_id."""
    req = _make_request(status="pending", dept_id=None)
    conn = _make_conn(req)

    from backend.db.repositories import hire_requests as hr_repo

    async def _fake_get(c, request_id, org_id):
        return req

    with patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get):
        with pytest.raises(InsufficientPermissionsError) as exc:
            await HireRequestService.approve_request(
                conn, 1, 1, user_id=42, role="dept_admin", dept_id=10,
            )

    assert "org_head" in str(exc.value).lower() or "org-level" in str(exc.value).lower()


# ────────────────────────────────────────────────────────────────────────────
# 26. Reject: dept_admin cannot reject an org-level request
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_dept_admin_cannot_reject_org_level_request():
    """dept_admin is blocked from rejecting deptless requests — org_head must act."""
    req = _make_request(status="pending", dept_id=None)
    conn = _make_conn(req)

    from backend.db.repositories import hire_requests as hr_repo

    async def _fake_get(c, request_id, org_id):
        return req

    with patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get):
        with pytest.raises(InsufficientPermissionsError):
            await HireRequestService.reject_request(
                conn, 1, 1,
                user_id=42, role="dept_admin", dept_id=10,
                reason="No budget",
            )


# ────────────────────────────────────────────────────────────────────────────
# 27. Approve-modified: notes required
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_approve_modified_requires_notes():
    """approve_modified raises ValidationError when notes are blank."""
    req = _make_request(status="pending", dept_id=10)
    conn = _make_conn(req)

    from backend.db.repositories import hire_requests as hr_repo

    async def _fake_get(c, request_id, org_id):
        return req

    with patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get):
        with pytest.raises(ValidationError):
            await HireRequestService.approve_modified(
                conn, 1, 1,
                user_id=42, role="dept_admin", dept_id=10,
                notes="   ",  # blank
                modification_diff={},
            )


# ────────────────────────────────────────────────────────────────────────────
# 28. Approve-modified: happy path stores modified status
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_approve_modified_happy_path():
    """approve_modified transitions pending → approved_modified."""
    req = _make_request(status="pending", dept_id=10, requested_by=99)
    modified_req = {**req, "status": "approved_modified", "approved_by": 42}
    conn = _make_conn()

    from backend.db.repositories import hire_requests as hr_repo

    approve_mod_calls = []

    async def _fake_approve_modified(c, request_id, org_id, *, approved_by, notes, modification_diff):
        approve_mod_calls.append({"request_id": request_id, "notes": notes})

    get_calls = []

    async def _fake_get(c, request_id, org_id):
        get_calls.append(1)
        return req if len(get_calls) == 1 else modified_req

    with patch.object(hr_repo.HireRequestRepository, "approve_modified", _fake_approve_modified), \
         patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get), \
         patch("backend.services.email_service.EmailService.send_hire_request_approved",
               AsyncMock(return_value=True)):
        result = await HireRequestService.approve_modified(
            conn, 1, 1,
            user_id=42, role="dept_admin", dept_id=10,
            notes="Reduced headcount to 1",
            modification_diff={"headcount": {"from": 2, "to": 1}},
        )

    assert approve_mod_calls[0]["notes"] == "Reduced headcount to 1"
    assert result["status"] == "approved_modified"


# ────────────────────────────────────────────────────────────────────────────
# 29. get(): not found raises NotFoundError
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_nonexistent_request_raises_not_found():
    conn = _make_conn(request_row=None)

    from backend.db.repositories import hire_requests as hr_repo

    async def _fake_get(c, request_id, org_id):
        return None

    with patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get):
        with pytest.raises(NotFoundError):
            await HireRequestService.get(conn, request_id=999, org_id=1)


# ────────────────────────────────────────────────────────────────────────────
# 30. org_head can approve deptless requests
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_org_head_can_approve_deptless_request():
    """org_head bypasses dept matching and can approve requests with no department."""
    req = _make_request(status="pending", dept_id=None, requested_by=99)
    approved_req = {**req, "status": "approved", "approved_by": 1}
    conn = _make_conn()

    from backend.db.repositories import hire_requests as hr_repo

    approve_calls = []

    async def _fake_approve(c, request_id, org_id, approved_by):
        approve_calls.append(request_id)

    get_calls = []

    async def _fake_get(c, request_id, org_id):
        get_calls.append(1)
        return req if len(get_calls) == 1 else approved_req

    with patch.object(hr_repo.HireRequestRepository, "approve", _fake_approve), \
         patch.object(hr_repo.HireRequestRepository, "get_by_id", _fake_get), \
         patch("backend.services.email_service.EmailService.send_hire_request_approved",
               AsyncMock(return_value=True)):
        result = await HireRequestService.approve_request(
            conn, 1, 1,
            user_id=1, role="org_head", dept_id=None,
        )

    assert approve_calls == [1]
    assert result["status"] == "approved"
