# Code Review: 19 — Settings Models + Configuration Changes

> **Surface:** backend/models/hire_request.py, backend/config/settings.py changes, backend/models/auth.py (role constants)
> **Reviewer:** Automated GA pass (2026-05-29)
> **Status:** REVIEW COMPLETE

---

## 1. Authorization

| Check | Status | Notes |
|-------|--------|-------|
| Role constants | ✅ PASS | `VALID_ROLES = {'org_head', 'dept_admin', 'hr', 'team_lead', 'platform_admin'}` — canonical set |
| Role hierarchy | ✅ PASS | `ROLE_HIERARCHY` dict with explicit level ordering for permission checks |
| JWT claims | ✅ PASS | `role`, `org_id`, `dept_id` stored in JWT — `dependencies.py` extracts them correctly (C1 fixed) |

---

## 2. SQL / Query Safety

| Check | Status | Notes |
|-------|--------|-------|
| Models don't contain SQL | ✅ N/A | Pydantic models are schemas only |

---

## 3. Error Handling

| Check | Status | Notes |
|-------|--------|-------|
| Pydantic validation | ✅ PASS | Request/response models use Pydantic validators with proper error messages |
| Missing required fields | ✅ PASS | `role_name: str` is required in `HireRequestCreate` — Pydantic rejects missing fields with 422 |
| Enum validation | ⚠️ WARN | `work_type` and `employment_type` are plain `str` fields with no enum validation. Invalid values like `work_type="banana"` pass validation |

**Finding C-MOD-01 (LOW):** Consider adding `Literal` or `Enum` validation for `work_type` (onsite/hybrid/remote) and `employment_type` (full_time/contract/internship) in Pydantic models.

---

## 4. Configuration Safety

| Check | Status | Notes |
|-------|--------|-------|
| Secrets in env vars | ✅ PASS | `SECRET_KEY`, `GROQ_API_KEY`, `TAVILY_API_KEY`, `RESEND_API_KEY` all from env |
| Default values | ✅ PASS | Dev-safe defaults (simulation email, localhost URLs) |
| .env.example | ✅ PASS | Documented all required env vars |
| JWT expiry | ✅ PASS | `ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24` (24h) — reasonable for SaaS |
| Magic link TTLs | ✅ PASS | Apply: 72h, Panel: 7d, Password reset: 24h — matches spec rule #7 |

---

## 5. Idempotency

| Check | Status | Notes |
|-------|--------|-------|
| Models are stateless | ✅ N/A | Pydantic models are pure data validation — no side effects |

---

## 6. Email Configuration

| Check | Status | Notes |
|-------|--------|-------|
| `FROM_EMAIL` default | ✅ PASS | `noreply@aitalentlab.com` — proper no-reply format |
| `FROM_NAME` default | ✅ PASS | `AI Talent Lab` — brand-consistent |
| Provider switching | ✅ PASS | `EMAIL_PROVIDER` env var switches between `simulation` and `resend` |

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 1 (C-MOD-01) |
