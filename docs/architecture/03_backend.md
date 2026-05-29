# Architecture: Backend (API, Security, Tasks, ATS)

> Part of the consolidated docs. Start at [`docs/README.md`](../README.md) for the map.
> Siblings: [`01_stack_structure.md`](01_stack_structure.md) · [`02_data_model.md`](02_data_model.md) ·
> [`04_ai_agents.md`](04_ai_agents.md)

All routes under `/api/v1/`. There are **20 routers** in `backend/routers/`.

---

## 1. Router inventory

| Router | Prefix | Auth | Notes |
|---|---|---|---|
| auth | `/auth` | mixed | register/login/me/users/add-user, forgot/reset/set password |
| chat | `/chat` | JWT | SSE stream + session CRUD + save-position |
| positions | `/positions` | JWT | list/detail/update/status/search-now/interview-kit; legacy `/requests/*` shims |
| candidates | `/candidates` | JWT | detail/timeline/status/notes/bulk-upload/outreach/rejection/mark-selected/tags |
| interviews | `/interviews` | JWT | create/list/update/send-invites/generate-debrief |
| panel | `/panel` | token | verify/enrich/submit (magic link, no JWT) |
| apply | `/apply` | token | verify/message/upload-resume/complete (magic link) |
| careers | `/careers` | none | public career page + direct apply |
| dashboard | `/dashboard` | JWT | stats/positions/pipeline/funnel/activity |
| talent_pool | `/talent-pool` | JWT | search/suggest/add/remove/add-to-position |
| settings | `/settings` | JWT | org/departments/competitors/screening/templates/scorecards |
| notifications | `/notifications` | JWT | list/read/read-all |
| **hire_requests** | `/hire-requests` | JWT | dedicated router: create/list/detail/edit/approve/reject |
| **copilot** | `/copilot` | JWT | AI copilot suggestions (uncontacted, overdue, stale) |
| **notes** | `/notes` | JWT | collaborative hiring notes + @mention |
| **gdpr** | `/gdpr` | mixed | delete-my-data, export (backend), retention |
| **status** | `/status` | token | candidate status portal (per-application permanent URL) |
| **platform** | `/platform` | JWT (platform_admin) | cross-org control tower |
| **dev_admin** | `/dev` | JWT (dev) | multi-org developer admin, dev-mode only |
| health | `/` , `/api/v1/health` | none | liveness |

Routers in **bold** post-date the original `BACKEND_PLAN`. Per-endpoint detail for the
core routers lives below; for newer ones, read the router file.

### Key endpoint groups

**auth:** `POST /register` (org + org_head), `POST /login`, `GET /me`,
`GET /users`, `POST /add-user` (invite-by-email or set-password-now),
`PATCH /users/{id}`, `PATCH /profile`, `POST /change-password`,
`POST /forgot-password`, `POST /reset-password`, set-password (invite completion).

**chat:** `POST /stream` (SSE, all stages), `GET /sessions`, `GET /sessions/{id}`,
`DELETE /sessions/{id}`, `PATCH /sessions/{id}/title`, `POST /sessions/{id}/upload`,
`POST /sessions/{id}/save-position` (save → draft → team_lead approval gate → search).

**candidates:** `GET /position/{id}`, `GET /{id}`, `GET /{id}/timeline`,
`PATCH /{id}/status`, `PATCH /{id}/notes`, `POST /bulk-upload`, `POST /send-outreach`,
`POST /{id}/draft-rejection`, `POST /{id}/send-rejection`, `POST /{id}/mark-selected`,
tags CRUD.

**interviews:** `POST /`, `GET /position/{id}`, `GET /candidate/{id}`, `GET /{id}`,
`PATCH /{id}`, `POST /{id}/send-invites` (candidate email + panel magic links),
`POST /{id}/generate-debrief`.

**panel (token):** `GET /{token}`, `POST /{token}/enrich`, `POST /{token}/submit`.

**apply (token):** `GET /{token}`, `POST /{token}/message`, `POST /{token}/upload-resume`,
`POST /{token}/complete`.

**hire_requests:** `POST /`, `GET /`, `GET /{id}`, `PATCH /{id}`,
`POST /{id}/approve` (dept_admin/org_head), `POST /{id}/reject`. Roles enforced in
`hire_request_service.py`: `_FILER_ROLES`, `_APPROVER_ROLES`, `_PICKUP_ROLES`.

---

## 2. Standard error response

```json
{ "error": { "code": "POSITION_NOT_FOUND",
             "message": "Position with ID 42 not found in your organization",
             "details": null } }
```

Use `AppError` subclasses, not raw `HTTPException(detail={...})`. Status-transition
guards → 400 `INVALID_TRANSITION`; not-found → 404; validation → 422 with serializable
details. (The validation handler was fixed during the hire-request audit so `ValueError`
in Pydantic `ctx` no longer 500s.)

---

## 3. Magic link system

Signed JWT payload: `{type: apply|panel_feedback|password_reset, entity_id, exp}`.

| Type | Expiry | Single-use |
|---|---|---|
| apply | 72h from send | multiple sessions OK, one completion (`candidate_sessions.status`) |
| panel_feedback | 168h (7d) from interview date | one-time (`interview_panel.feedback_submitted`) |
| password_reset | 24h from request | enforced via `consumed_magic_links` |

---

## 4. Security

| Concern | Implementation |
|---|---|
| Password hashing | bcrypt (12 rounds) |
| JWT claims | `user_id`, `org_id`, `department_id`, `role`, `exp`; 24h expiry |
| Account lockout | 5 fails → 15 min (`locked_until`) |
| SQL injection | parameterized queries only |
| CORS | whitelist `FRONTEND_URL` only |
| Rate limiting | 100 req/min per IP, 10 auth/min (Redis) |
| PII | CTC fields AES-256 at rest (`ENCRYPTION_KEY`) |
| Tenant isolation | every query filtered by `org_id` (`middleware/tenant_context.py`) |
| Postgres RLS | second defense — `SET LOCAL app.current_org_id` per transaction; policy `org_id = current_setting('app.current_org_id')::int` on every business table |

Open hardening items (rate limiting on `/hire-requests/*`, cursor pagination, JWT
denylist, `consumed_magic_links` cleanup) are tracked in [`../TECH_DEBT.md`](../TECH_DEBT.md).

---

## 5. Background tasks (Celery)

- `tasks/candidate_pipeline.py` → source → dedup (within org, skip if updated ≤7d) →
  ATS score → pipeline_events → notify recruiter.
- `tasks/scheduled_search.py` → find positions with `next_search_at <= NOW()` → queue.
- `tasks/email_outreach.py` → outreach batches (magic links) **and**
  `send_followup_reminders` (every hour): finds `emailed` apps, link sent ≥48h ago,
  not clicked, not rejected, not yet followed up → sends follow-up, sets
  `followup_sent_at`, logs `followup_sent` event. Eliminates ghosting.

Beat: scheduled_search + followups hourly.

---

## 6. Semantic ATS scoring

Two-step, in `services/candidate_service.py`. Keyword matching fails (Postgres vs
PostgreSQL, "AWS preferred" vs "required"); semantic understands meaning.

**Step 1 — embedding similarity** (every candidate, cheap): cosine of
`positions.jd_embedding` vs `candidates.resume_embedding` (both precomputed JSON
arrays). If `< 0.35`, return `embedding_only` score, skip the LLM.

**Step 2 — LLM structured analysis** (only above 0.35): returns matched/missing/extra
skills + `experience_match` + `skills_match` + summary.

**Final score:**
```
(embedding × 0.40 + skills_match × 0.40 + experience_match × 0.20) × 100
```

Embeddings: `text-embedding-3-small` (1536-dim) via the LLM factory; JD embedded once
on save (re-embed on JD edit), resume embedded once on parse. Stored as JSON in
Postgres — not ChromaDB (that's reserved for the internal-check JD search) and not
pgvector (overkill for pairwise compare).
