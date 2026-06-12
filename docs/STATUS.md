# Project Status & What's Next

> **The single source of truth for "where are we and what do I do next."** Open this first.
> It merges three things that used to live in separate, drifting files: functional truth
> (does each feature actually work?), the v3 redesign build status, and live production-hardening
> debt. Older snapshots are in [`archive/`](archive/).
>
> **Last updated:** 2026-06-12 (14:45 IST) · **Branch:** `feature/phase2-items` · verified against code + commit log.

---

## One-line status

**All P0/P1 issues fixed, RLS live, 106 backend tests green, Playwright E2E wired.** What remains: external integration keys (Calendar, enrichment providers), and Phase-2 feature QA (branding, audit-log UI, self-scheduling, WhatsApp). Ready for guarded customer rollout.

---

## Legend

| Mark | Meaning |
|---|---|
| ✅ | Done + committed (code-traced or test-backed) |
| ⚠️ | Built but needs an activation step / external key before it's live |
| 🔵 | Stub by design — waiting on an external credential or a deliberate decision |
| ❌ | Not started |

Priority: **P0** = security/core-flow blocker · **P1** = sold feature that didn't work · **P2** = polish.

---

## ✅ What works end-to-end (the foundation)

Code-traced as built + wired. Caveats noted where a step is shallow.

- **Auth & roles** — login, register, magic-link, password reset, JWT, account lockout, Redis JWT denylist. (`test_auth.py` ✓)
- **Hire request → approval → pickup** — filing, dept_admin approval, 4 email touchpoints, HR pickup seeds JD chat. (`test_hire_request_approval.py` ✓)
- **JD creation chat** — 8-stage LangGraph: intake → internal skills → market research (Tavily) → 3 variants → streamed JD → bias check → team-lead approval → save → triggers sourcing. *(PDF-only upload; Position Setup Modal still omits headcount/priority — P2.)*
- **Two-phase ATS** — cosine 0.35 gate → LLM weighted score → `screening`/`on_hold` routing; On-Hold tab + bulk reject.
- **Inbound apply loop** — career page → apply chat (greeting → consent → interest → resume parse → profiling steps → screening Qs → save) → status=Applied → recruiter notified → ATS dispatched. **Now walked by `test_candidate_core_loop.py`.**
- **Candidate portal** — password auth, multi-application timeline, status portal with live timeline + pre-eval launch.
- **Interviews** — invite emails to candidate + panel (real send), round-result UI (pass/reject), rejection-draft task, 24h reminder task.
- **Pre-eval** — nightly batch LLM grading against scorecard; **collusion detection now fires** (answer-shape fixed).
- **Panel feedback** — magic link, single-use, AI enrich, debrief generation.
- **Talent pool** — org-isolated, bulk upload (LLM-parsed, dedup), real embeddings AI-match, add-to-pipeline.
- **Analytics/dashboard** — funnel, source, velocity, time-to-hire, agent ROI, ops. (`test_dashboard.py` ✓)
- **Platform admin, dev console, audit logs, LLM usage analytics, notifications, GDPR flow.**
- **Error monitoring** — Sentry across backend API, Celery workers, and frontend.

**v3 redesign:** all **19/19 surfaces** rebuilt to the v3 spec (teal `#0D9488` + Plus Jakarta Sans).
Per-surface detail: each [`design/pages/NN_*.md`](design/pages/) banner. Historical redesign tracker:
[`archive/2026-05-30_redesign_STATUS.md`](archive/2026-05-30_redesign_STATUS.md).

---

## ✅ Closed since the 2026-06-11 audit

The audit (snapshot: [`archive/2026-06-11_PRODUCT_STATUS.md`](archive/2026-06-11_PRODUCT_STATUS.md))
found 4 P0s and 14 P1s. State today:

| ID | Issue | Status | Evidence |
|---|---|---|---|
| P0-1 | `/dev/*` live by default (account takeover) | ✅ Fixed | `DEV_MODE: bool = False` fail-safe, [config.py:19](../backend/config.py#L19) · commit `90e6413` |
| P0-2 | RLS inert (no tenant DB backstop) | ✅ **Live** | `APP_DATABASE_URL` set in `.env`; dual-pool confirmed: `get_admin_connection()` for migrations/platform_admin/Celery, `get_connection()` (talentlab_app role, RLS enforced) for all request traffic; `test_rls_isolation.py` ✓ · 45/45 tests green |
| P0-3 | GDPR cross-tenant deletion | ✅ Fixed | org-scope check + rate limit · commit `90e6413` |
| P0-4 | Collusion detection never fired (`TypeError`) | ✅ Fixed | `_answer_similarity` takes dicts · commit `90e6413` |
| P1-1…14 | Interview emails, 24h reminder, round-result UI, rejection draft, outreach signature, apply profiling steps, apply confirmation email, pre-eval page, status_token + portal fields, real talent-pool embeddings, `above_threshold_count`, Providers key allowlist | ✅ Fixed | commits `982efaa`, `778d882`, `e47acf9` · backend suite green |

---

## 🎯 What's next (do these in order)

The whole reason this file exists: a short, true list — not the old pile of contradicting plans.

1. ~~**Flip RLS live (P0-2)**~~ ✅ **Done** — `APP_DATABASE_URL` set, tests pass.
2. ~~**Playwright E2E core-loop test**~~ ✅ **Done** — `frontend/e2e/core-loop.spec.ts`: login → pipeline → candidate detail → status portal. Seed endpoint `POST /dev/seed-core-loop` provides pre-scored fixture. Run with both dev servers up: `cd frontend && npx playwright test`.
3. **Wire the external integrations that are stubbed on missing keys** (credential work, not bugs):
   real Google Calendar OAuth adapter, at least one real enrichment provider (Proxycurl/Apollo/Hunter) or
   hide the toggle, Naukri last. Until then they fall back to mock/no-op honestly.
4. ~~**Deepen the test net**~~ ✅ **Done** — 106 backend tests (was 45): pre-eval, panel feedback, GDPR, HireRequestService, CTC encryption all covered. See Live debt table.
5. **Resume Phase-2 features** from [product/03_roadmap.md](product/03_roadmap.md): career-page branding (UI built, settings wired), audit-log UI (built), team_lead dashboard (wired in DashboardPage) — these are built but need QA + external integration keys for full activation. Next: GDPR export UI, self-scheduling, WhatsApp (India).

**Rule:** a feature is "done" when a test walks it and it has no open P0/P1 here — not when the UI renders.

---

## ⚠️ Live operational debt (carried forward from the old TECH_DEBT tracker)

Most of the old [TECH_DEBT.md](archive/2026-05-19_TECH_DEBT.md) is resolved (rate limiting, pagination,
JWT denylist, magic-link cleanup, HTML-injection escaping, notification IDOR, bundle splitting — all ✅).
What's still open:

| Sev | Item | Notes |
|---|---|---|
| ✅ | `HireRequestService` unit/integration tests | 33 tests: status transitions, role guards, tenant isolation, cancel semantics, payload validation |
| ✅ | Test depth on critical paths | 106 total tests: pre-eval, panel feedback, GDPR, HireRequestService all covered |
| ✅ | CTC AES-256 encryption | `backend/utils/crypto.py` (AES-256-GCM); `compensation_enc` column in `candidate_applications`; active when `ENCRYPTION_KEY` is set in `.env`; no-op when empty |

---

## Where the detail lives

- **Strategy / why** (vision, moat, what-to-do-next rationale): [product/04_strategy.md](product/04_strategy.md)
- **Forward roadmap** (Phase 2/3, monetization, compliance): [product/03_roadmap.md](product/03_roadmap.md)
- **Bug ledger + test validation**: [qa/bug_fixes_log.md](qa/bug_fixes_log.md) · [qa/testing_validation_tracker.md](qa/testing_validation_tracker.md)
- **RLS activation runbook**: [RLS_ACTIVATION.md](RLS_ACTIVATION.md)
- **Per-surface code reviews**: [reviews/](reviews/)
- **Audit snapshot (file:line evidence)**: [archive/2026-06-11_PRODUCT_STATUS.md](archive/2026-06-11_PRODUCT_STATUS.md)

---

## How to keep this file honest

- Update a row the moment its state changes (P0/P1 closed, integration activated, test added).
- "Built" is not "done." Mark ⚠️ until the activation step (key, cutover, test) is complete.
- When you finish everything in "What's next," re-audit and write a fresh snapshot into `archive/`.
- Code wins over docs. Where this file and the code disagree, fix this file.
