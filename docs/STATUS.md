# Project Status & What's Next

> **The single source of truth for "where are we and what do I do next."** Open this first.
> It merges three things that used to live in separate, drifting files: functional truth
> (does each feature actually work?), the v3 redesign build status, and live production-hardening
> debt. Older snapshots are in [`archive/`](archive/).
>
> **Last updated:** 2026-06-12 (10:20 IST) · **Branch:** `feature/phase2-items` · verified against code + commit log.

---

## One-line status

**The core product works end-to-end and the redesign is done. All P0 security holes and all P1
feature breaks found in the 2026-06-11 audit are fixed and committed.** What remains is *activation
and depth*: cut RLS over to the app role, wire the external integrations that need real API keys,
deepen the test net, and pick the next Phase-2 features. This is no longer "strong demo, not a
product" — it's "product that needs its safety cutover and integration keys before real customer data."

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
| P0-2 | RLS inert (no tenant DB backstop) | ⚠️ **One env var from live** | Dual-pool wired: `get_admin_connection()` for migrations/platform_admin/Celery, `get_connection()` for all request traffic; `set_org_context` in per-org tasks; `test_rls_isolation.py` ✓ · commits `e342cae` + `feat/rls-activation`. **To activate: add `APP_DATABASE_URL=postgresql://talentlab_app:talentlab_app@localhost:5432/talentlab_dev` to `.env` and restart.** See [RLS_ACTIVATION.md](RLS_ACTIVATION.md) |
| P0-3 | GDPR cross-tenant deletion | ✅ Fixed | org-scope check + rate limit · commit `90e6413` |
| P0-4 | Collusion detection never fired (`TypeError`) | ✅ Fixed | `_answer_similarity` takes dicts · commit `90e6413` |
| P1-1…14 | Interview emails, 24h reminder, round-result UI, rejection draft, outreach signature, apply profiling steps, apply confirmation email, pre-eval page, status_token + portal fields, real talent-pool embeddings, `above_threshold_count`, Providers key allowlist | ✅ Fixed | commits `982efaa`, `778d882`, `e47acf9` · backend suite green |

---

## 🎯 What's next (do these in order)

The whole reason this file exists: a short, true list — not the old pile of contradicting plans.

1. **Flip RLS live (P0-2) — one line in `.env`.** The dual-pool cutover is coded and tested.
   Add `APP_DATABASE_URL="postgresql://talentlab_app:talentlab_app@localhost:5432/talentlab_dev"` to
   your `.env`, restart API + Celery, then smoke: login → dashboard → sourcing run → platform admin.
   If any surface returns empty rows, that path is missing org context — rollback = remove the line.
   Runbook: [RLS_ACTIVATION.md](RLS_ACTIVATION.md). *~15 minutes when you can watch it live.*
2. **Upgrade the core-loop test from API-level to a full Playwright UI walk.** `test_candidate_core_loop.py`
   is an API integration test (commit `8040f7b`); the assessment's bar is one E2E test that walks the real
   UI: career → apply → ATS → recruiter review → interview → decision. That test becomes the definition of done.
3. **Wire the external integrations that are stubbed on missing keys** (these are credential work, not bugs):
   real Google Calendar OAuth adapter, at least one real enrichment provider (Proxycurl/Apollo/Hunter) or
   hide the toggle, Naukri last. Until then they fall back to mock/no-op honestly.
4. **Deepen the test net on untested surfaces** — pre-eval submit/grade, sourcing pipeline, panel feedback,
   GDPR, calendar. `HireRequestService` still has only smoke coverage (see Live debt below).
5. **Then resume Phase-2 features** from [product/03_roadmap.md](product/03_roadmap.md): career-page branding,
   audit-log UI, team_lead dashboard, GDPR export UI, self-scheduling, WhatsApp (India).

**Rule:** a feature is "done" when a test walks it and it has no open P0/P1 here — not when the UI renders.
Don't add new surface until step 2 is green.

---

## ⚠️ Live operational debt (carried forward from the old TECH_DEBT tracker)

Most of the old [TECH_DEBT.md](archive/2026-05-19_TECH_DEBT.md) is resolved (rate limiting, pagination,
JWT denylist, magic-link cleanup, HTML-injection escaping, notification IDOR, bundle splitting — all ✅).
What's still open:

| Sev | Item | Notes |
|---|---|---|
| 🟠 | `HireRequestService` unit/integration tests | Verified by smoke tests only; target 80% on status-transition + tenant-isolation rules |
| 🟡 | Test depth on critical paths | See "What's next" step 4 — the gap that lets features silently break |
| 🟡 | CTC AES-256 encryption | Documented; needs `ENCRYPTION_KEY` set in prod to actually be on |

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
