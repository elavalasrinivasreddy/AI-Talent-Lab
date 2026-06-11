# Product Status — Functional Truth Tracker

> **What this is:** the single source of truth for *"does each feature actually work end-to-end?"*
> Not UI-redesign status (that's [`STATUS.md`](STATUS.md)), not a bug ledger (that's
> [`bug_fixes_log.md`](bug_fixes_log.md)). This maps **intended feature → real code → wired? → tested? → gaps**,
> with `file:line` evidence.
>
> **Generated:** 2026-06-11 from a full read of the codebase (162 backend `.py`, 143 frontend `.jsx`)
> via 5 parallel domain audits. Status verdicts are code-traced, not assumed.

---

## ⚠️ Reality check — this contradicts the optimistic docs

[`STATUS.md`](STATUS.md) and the session notes claim *"production-ready for Phase 2 landing, 198 bugs
fixed, all negative-path tests pass."* **That is the UI/redesign picture, not the functional one.**
At the code level, a large share of features are **wired-looking but silently broken**, and there are
**three verified production-critical security/correctness holes**. The redesign is real and good; the
end-to-end plumbing is not done. Treat "production-ready" as **not yet true**.

The honest one-line status: **strong demo, not yet a product you can put real candidate data into.**

---

## Legend

| Status | Meaning |
|---|---|
| ✅ **Built+Wired** | Full path frontend → API → service → DB/side-effect connects and works |
| 🟡 **Partial** | Core exists but a step is missing, mocked, or breaks the chain |
| 🟠 **Built-not-wired** | Code exists but a signature/registration/route gap stops it at runtime |
| 🔵 **Stub** | Placeholder only |
| ❌ **Missing** | Not implemented |

Priority: **P0** = security or core-flow blocker, fix before any real use · **P1** = feature is sold but doesn't work · **P2** = polish.

---

## 🔴 P0 — Verified critical (fix before real candidate data touches this)

> **Progress 2026-06-11:** P0-1, P0-3, P0-4 **FIXED** (see ✅ below). **P0-2 (RLS) deferred** —
> architectural (touches the DB connection-acquisition path); do it deliberately next session.
> **How to do P0-2:** acquire the request's org_id in the connection dependency and run
> `await conn.execute("SELECT set_config('app.current_org_id', $1, true)", str(org_id))` right
> after acquiring each pooled connection (inside `get_connection`/the request DB dependency),
> so every RLS policy sees the value. Then add a test that a query without the WHERE clause
> still returns only same-org rows. Alternative if you don't want DB-level RLS yet: drop the
> dead policies and document WHERE-clause isolation as the explicit model.

| # | Issue | Evidence | Impact |
|---|---|---|---|
| P0-1 | **`/dev/*` routes live by default.** `DEV_MODE: bool = True` is the config default; guard is `getattr(settings,'DEV_MODE',True)`. `/dev/token/{user_id}` mints a valid JWT for ANY user with no auth. | [config.py:19](../backend/config.py#L19), [dev_admin.py:22](../backend/routers/dev_admin.py#L22), [dev_admin.py:204](../backend/routers/dev_admin.py#L204) | **Full account takeover** of any org/user unless prod `.env` explicitly sets `DEV_MODE=False`. Nothing fails safe. |
| P0-2 | **RLS is inert.** 18 tables have RLS policies keyed on `current_setting('app.current_org_id')`, but `SET LOCAL` is **never executed** — middleware only sets `request.state` in Python. | [tenant_context.py:53-56](../backend/middleware/tenant_context.py#L53), [dependencies.py:45](../backend/dependencies.py#L45) (docstring lies), [migrations.py:1217](../backend/db/migrations.py#L1217) | Tenant isolation = `WHERE org_id` clauses only. One missing filter = cross-tenant leak with **no DB backstop**. |
| P0-3 | **GDPR cross-tenant deletion.** `process_deletion` fetches the request by integer `id` only, no `org_id` ownership check; endpoint is not rate-limited. | [gdpr_service.py:283](../backend/services/gdpr_service.py#L283), [gdpr.py:92](../backend/routers/gdpr.py#L92) | An org_head from Org A can erase Org B's candidate data by guessing an ID. |
| P0-4 | **Collusion detection never fires.** Answers stored as a list of dicts (JSONB); `_answer_similarity` does `set(answers_a) & set(answers_b)` → `TypeError: unhashable type: dict` → collusion pass aborts. | [pre_evaluations.py:38](../backend/routers/pre_evaluations.py#L38), [pre_eval_grade.py:117](../backend/tasks/pre_eval_grade.py#L117) | The anti-cheating feature (sessions S141) silently does nothing. Colluders auto-advance. |

---

## 🟠 P1 — Sold but broken / missing (features users will hit)

| # | Feature | Status | Evidence | What's wrong |
|---|---|---|---|---|
| P1-1 | **Interview invite emails** | 🟡 no-op | [interview_service.py:217](../backend/services/interview_service.py#L217) | `send_invites` only stamps `invite_sent_at`; never calls `EmailService`. Candidate + panel get **no email**. The templates exist ([email_service.py:376,447](../backend/services/email_service.py#L376)) but are never called. |
| P1-2 | **24h interview auto-reminder** | ❌ Missing | [celery_app.py:36](../backend/celery_app.py#L36) | No beat task, no task file. The UI checkbox is decorative. |
| P1-3 | **Set round result (pass/reject)** | 🟡 no UI | [interviews.py:41](../backend/routers/interviews.py#L41) backend exists; no control in `InterviewsTab.jsx` | Recruiter cannot set `overall_result` from the UI → no rejection draft trigger, no "all rounds passed" → **downstream pipeline stalls**. |
| P1-3b| **Rejection email draft** | 🟠 broken | [rejection_task.py:12](../backend/tasks/rejection_task.py#L12) | `rejection_task` not in `celery_app` include list → `NotRegistered` at runtime; also writes to a `meta` column that isn't in the notifications INSERT → draft body dropped. |
| P1-4 | **Outreach email batch** | 🟠 signature bug | [candidates.py:226](../backend/routers/candidates.py#L226) vs [email_outreach.py:41](../backend/tasks/email_outreach.py#L41) | `.delay(application_ids, org_id)` but task takes only `application_ids` → `TypeError`. Also magic tokens are NULL on freshly sourced candidates, so even fixed it sends to no one. |
| P1-5 | **Apply chat profiling steps** | 🟡 skipped | [candidate_chat.py:16-22](../backend/agents/candidate_chat.py#L16) | `STEPS` omits `current_role`, `experience`, `compensation`, `notice_period`. Those four data points are **never collected**; `apply_service` reads them as `None`. Frontend buttons for them are unreachable. |
| P1-6 | **"Interview process overview" email on apply** | ❌ Missing | grep of `email_service.py` | Spec calls for it on status=Applied. No template, no trigger. |
| P1-7 | **Pre-evaluation candidate page** | 🟠 missing route | [CandidateDashboard.jsx:121](../frontend/src/pages/CandidatePortal/CandidateDashboard.jsx#L121) | Dashboard opens `/pre-evaluations/:token` but that frontend route/page **doesn't exist**. Backend endpoints are fine; candidates hit a dead URL. |
| P1-8 | **Status portal** | 🟡 partial | [status.py:26-83](../backend/routers/status.py#L26) | API returns no `timeline` and no `pre_eval_token`, but the page renders both → always empty. Worse: `status_token` is **never generated** on apply, so `WHERE status_token=$1` 404s for everyone. |
| P1-9 | **Talent-pool AI match** | 🟡 fake | [talent_pool_service.py:29-39](../backend/services/talent_pool_service.py#L29) | `_get_embedding()` uses LangChain `FakeEmbeddings` (random vectors). Match scores are meaningless noise. |
| P1-10 | **Enrichment providers** | 🔵 stub | [enrichment/__init__.py:10](../backend/adapters/enrichment/__init__.py#L10) | Only `simulation` exists; Proxycurl/Apollo/Hunter return `None`. Enabling enrichment in prod silently no-ops. |
| P1-11 | **`above_threshold_count`** | 🟡 always 0 | [candidate_pipeline.py:94](../backend/tasks/candidate_pipeline.py#L94) | Initialized to 0, never incremented. Sourcing notifications always say "0 above threshold." |
| P1-12 | **Consent foundations** | ❌ Missing | grep | A "locked decision" in the plan; no consent field on candidates, no consent flag in the pipeline. |
| P1-13 | **Google Calendar** | 🔵 stub | [calendar_service.py:109](../backend/services/calendar_service.py#L109) | `GoogleCalendarAdapter` raises `NotImplementedError`. `CALENDAR_PROVIDER=google` in prod crashes. Mock works. |
| P1-14 | **Gemini key via Providers UI** | 🟡 dropped | [settings_service.py:768](../backend/services/settings_service.py#L768) | `GEMINI_API_KEY` not in `_MUTABLE_ENV_KEYS` → silently un-saveable. Also `update_providers` writes `.env` at runtime → won't survive container restart / read-only FS. |

---

## 🟢 What actually works end-to-end (the real foundation)

These were code-traced as ✅ Built+Wired:

- **Auth & roles** — login, register, magic-link, password reset, JWT, account lockout, Redis JWT denylist. ([auth_service.py](../backend/services/auth_service.py), `test_auth.py` ✓)
- **Hire request → approval → pickup** — filing, dept_admin approval, 4 email touchpoints, HR pickup → seeds JD chat. (`test_hire_request_approval.py` ✓) *Caveat: frontend approve button only shows for `pending` status; `begin-review`/`approve-modified` backend routes have no UI.*
- **JD creation chat** — intake, internal skills check (chips), market research via Tavily (chips), 3 variants, streamed final JD, bias check, team-lead JD approval, position save, post-approval search trigger. *Caveats: PDF-only upload (DOCX rejected); empty-ChromaDB returns mock skills silently; Position Setup Modal doesn't expose headcount/priority.*
- **Bias check provider-aware JSON** — `json_mode` correctly dispatched per provider (Groq/OpenAI/Gemini). *Caveat: bare `except` silently returns `[]` on any failure.*
- **Two-phase ATS** — cosine 0.35 gate → LLM weighted score → `screening`/`on_hold` routing; On-Hold tab + bulk reject. *Caveat: low scorers sit in on_hold until manual reject (no auto-reject); bulk reject uses `window.prompt()`; no rejection email sent.*
- **Talent pool** — org-isolated, bulk upload (LLM-parsed, email dedup), add-to-pipeline, contact status. *(AI-match is fake — P1-9.)*
- **Apply chat (partial flow)** — greeting → interest → resume upload+parse → screening questions → save → status=Applied → recruiter notified → ATS dispatched. *(Profiling steps skipped — P1-5; no candidate email — P1-6.)*
- **Candidate portal** — real password login (not a stub), multi-application timeline. *(Pre-eval launch URL is dead — P1-7; no auto password-setup email.)*
- **Pre-eval nightly batch grading** — Celery beat → LLM grade against scorecard. *(Collusion broken — P0-4; fragile JSON parse leaves failures stuck in `submitted`.)*
- **Panel feedback** — magic link, single-use enforcement, AI enrich, debrief generation. *(Not-attended panelist can still submit later; debrief overwrites the `notes` column.)*
- **Career page (public)** — department grouping, filters, apply entry → token → apply route. *(Testimonials hardcoded; Fit Finder is keyword heuristic, not LLM.)*
- **Analytics/dashboard** — funnel, source, velocity, time-to-hire, agent ROI, ops. (`test_dashboard.py` ✓)
- **Audit logs, LLM usage analytics, GDPR flow (UI), platform admin, dev console, notifications bell.** *(See per-domain caveats; GDPR has P0-3.)*
- **Mark as Selected** — works. *(Not gated on all-rounds-passed.)*

---

## 🧪 Testing reality

`STATUS.md` says "39 pytest pass, Vitest + Playwright configured." True, but **coverage is shallow and the
critical surfaces are untested**:

| Layer | Real coverage | Untested |
|---|---|---|
| Backend pytest | auth, hire-request approval, positions, dashboard, talent pool, settings | **entire candidate-facing flow** (apply chat, resume, pre-eval submit/grade, collusion, status portal, careers apply), sourcing pipeline, ATS routing, interviews, panel feedback, calendar, notifications, GDPR, RLS |
| Frontend Vitest | `Button.jsx` atom | every page/flow |
| Playwright E2E | login, dashboard nav, public apply | every real workflow |

No test exercises a full hire → source → apply → screen → interview → offer path. The features broken in P0/P1
are exactly the ones with **zero tests** — which is why they passed "validation."

---

## Recommended next sequence (precise)

**Gate 0 — make it safe (½ day, P0):** set `DEV_MODE` default to `False` and add a startup assert; add `org_id`
ownership check + rate limit to GDPR deletion; either wire `SET LOCAL app.current_org_id` per request (real RLS)
or delete the dead policies and document WHERE-clause isolation as the model; fix collusion answer-shape
(`{qid: answer}` dict or key by `question_id`).

**Gate 1 — make one flow real end-to-end (2-3 days, P1):** pick the **core loop** — hire request → JD → source →
apply → screen → interview → decide — and close every break in it: interview invite emails (P1-1), set-round-result
UI + rejection draft registration (P1-3/3b), apply profiling steps (P1-5), status_token generation + status portal
fields (P1-8), pre-eval frontend page (P1-7). Add one Playwright test that walks the whole loop so it can't silently
break again.

**Gate 2 — make the AI claims true (P1):** real talent-pool embeddings (P1-9), at least one real enrichment provider
or hide the toggle (P1-10), `above_threshold_count` (P1-11).

**Gate 3 — polish (P2):** the caveats above (DOCX upload, headcount/priority in modal, approval-status UI gaps,
notification edge cases, calendar real provider).

Do **not** add new features until Gate 0 and the core loop in Gate 1 are green. The redesign already outran the
plumbing; the work now is making what's drawn actually run.

---

*Per-domain raw audit detail (every feature, every file:line) is summarized above; regenerate by re-running the
5-domain code audit. This file should be updated whenever a P0/P1 row changes state.*
