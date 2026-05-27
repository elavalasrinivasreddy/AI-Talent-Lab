# Technical Debt — Production Hardening Tracker

> **Purpose:** Items that are *not* roadmap features but *are* needed for a fully production-ready system. Things like rate limiting, pagination, test coverage, performance budgets, and pre-existing bugs surfaced during audits.
>
> Different from `docs/PRODUCT_PLAN.md §13` (Phase 2 user-facing features) and `docs/PRODUCT_IMPROVEMENTS.md §5` (Phase 2 roadmap). Items here ship silently — users don't notice them landing, but a production deploy without them is risky.
>
> **Last updated:** 2026-05-19

---

## Severity tiers

- **🔴 Critical** — pre-prod blocker; ship before customers see prod
- **🟠 High** — should land in the next sprint; ship before scaling past a few orgs
- **🟡 Medium** — quality bar, schedule when convenient
- **🟢 Low** — nice-to-have / cleanup

---

## Hire Request (`/api/v1/hire-requests/*`)

Shipped 2026-05-19. The backend logic is sound — transactions, audit log, tenant isolation, status guards all verified live — but it's missing standard production-grade guardrails the other routers have.

| Severity | Item | Notes |
|---|---|---|
| 🟠 High | **Rate limiting on hire-request endpoints** | `POST /` and `PATCH /:id` have no rate limit. Auth has `10/min`; hire-request should cap creates at `30/min` per user to prevent spam. Use the existing `@limiter.limit(...)` decorator pattern from `routers/auth.py`. |
| 🟠 High | **Cursor pagination on `GET /hire-requests/`** | Hard `LIMIT 100` only — no offset/cursor. Will silently truncate above 100 requests per org. Add `?cursor=` + `?limit=` params; switch repo `list_for_org` to use seek pagination on `(created_at, id)`. |
| 🟡 Medium | **Unit + integration test coverage for `HireRequestService`** | Service logic is verified by manual live smoke tests only. Need: pytest for status-transition rules, validation edge cases, role gating, tenant isolation. Target: 80%+ coverage of `services/hire_request_service.py`. |

## Auth (`/api/v1/auth/*`)

Shipped 2026-05-19. Solid, but improvements identified:

| Severity | Item | Notes |
|---|---|---|
| 🟡 Medium | **JWT denylist on logout** | Logout today is client-side only (clears sessionStorage). To truly invalidate a session before its 24h expiry, we need a Redis-backed denylist keyed by JWT `jti` (auth tokens don't carry `jti` yet — magic-link tokens do). |
| 🟡 Medium | **Periodic cleanup of `consumed_magic_links`** | Rows accumulate forever. Add a daily Celery task to delete entries older than 30 days. |
| 🟢 Low | **Per-user rate limit on `POST /auth/magic-link`** | Currently `5/min` per IP. A per-account limit would prevent inbox spam if many people share an IP. |

## JD Chat (`/api/v1/chat/*`)

Phase 1 of the redesign shipped 2026-05-20. Backend SSE emission was tightened; frontend got a full layout inversion (canvas-left, rail-right) with 8-stage stepper + 5 inline agent blocks. Remaining gaps:

| Severity | Item | Notes |
|---|---|---|
| 🟡 Medium | **Fake LLM token streaming** | `services/chat_service.py:166-171` splits the finished JD into words with 12ms sleep. Real LLM streaming needs `astream_tokens` plumbing in the LLM adapter layer. See redesign §13 F1 |
| 🟡 Medium | **`emit_token` misnamed** | Same root cause — sends complete messages as one chunk, not real per-token streaming. Bundle with the LLM-streaming fix |
| 🟡 Medium | **Greeting drift risk** | `chat_service.GREETING_MESSAGE` and `ChatContext.resetChat` both hardcode the same welcome text. Will drift on edit. Extract to a single source (config endpoint or shared constant) |
| 🟡 Medium | **Stage skip not emitted for `intake` / `final_jd` / `complete`** | Only soft-skippable nodes (`internal_check`, `market_research`, `bias_check`) call `_record_skip`. Lower priority because hard-stops can't be skipped |
| 🟢 Low | **Type-checker warnings in `agents/orchestrator.py`** | `state: dict` parameter vs `AgentState` TypedDict expected by nodes; `action_data` Optional[dict] hits `.get(...)` without a None guard. Runtime safe (Python doesn't enforce TypedDict); fix during a static-analysis sweep |
| 🟢 Low | **Unused `AgentState` import** in `orchestrator.py` line 11 | Pre-existing — left alone in this PR to keep the diff focused |

## Pre-existing bugs surfaced during audits

These predate the redesign work — fix opportunistically during related page work.

| Severity | Item | Where | Notes |
|---|---|---|---|
| 🟠 High | `current_user["id"]` KeyError | `routers/positions.py`, `routers/candidates.py`, `routers/talent_pool.py` | `get_current_user` returns `user_id`, not `id`. `routers/notifications.py` already has a fix-comment. Will 500 any code path that hits it. Fix during next positions / candidate / talent-pool page audit. |
| 🟡 Medium | Inconsistent error format in legacy endpoints | Various pre-redesign routers | Some still use `HTTPException(detail={"error": ...})` instead of `AppError`. Standardize during page-by-page work. |

## General

| Severity | Item | Notes |
|---|---|---|
| 🟠 High | **HTML injection in transactional email templates** | `backend/services/email_service.py` interpolates `candidate_name`, `role_name`, `org_name`, `round_name`, `meeting_link`, `apply_url`, `feedback_url`, etc. directly into f-strings. Escape with `html.escape()` and validate URL schemes (only `https://`). Better: move to Jinja2 with `autoescape=True`. Flagged by automated security review 2026-05-27. |
| 🟠 High | **Notification IDOR within tenant** | `backend/services/notification_service.py:mark_read(org_id, notification_id)` scopes by tenant but not by user. Any user in the org can mark another user's notifications read. Add `user_id` to signature + WHERE clause. Flagged by automated security review 2026-05-27. |
| 🟠 High | **`backend/dist/` and chroma binary noise in working tree** | `backend/data/chroma/*.sqlite3` shows as modified on every run. Either add to `.gitignore` or move to a runtime-only path. |
| 🟡 Medium | **Frontend bundle is >500KB after minify** | Vite warns. Code-split routes (especially `/dev`, `/platform`) via `React.lazy` + `Suspense`. |
| 🟡 Medium | **No E2E tests** | Manual smoke tests cover auth + hire request today. Phase 1 cohort can ship without, but post-customer-1 we need Playwright or similar. |
| 🟢 Low | **Cleanup of legacy `/positions/requests/*` shims** | Kept for backward compatibility with existing Dashboard widgets. Migrate Dashboard widgets to `hireRequestsApi` and delete the shims. |

---

## How to use this file

- **When shipping a feature**, add any hardening items that didn't make the Phase 1 cut here, with severity + notes
- **When auditing a page before redesign**, log any pre-existing bugs you spot here (don't fix them inline unless they block the redesign)
- **At sprint planning**, pull all 🔴 + 🟠 items and triage; 🟡 / 🟢 schedule opportunistically
- Items in this doc do **not** appear in `PRODUCT_PLAN.md` because they're not customer-facing features — they're "operational excellence" work
