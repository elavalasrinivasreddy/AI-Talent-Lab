# Project Status — Phase-Wise Tracker

> **The single source of truth for "where are we and what do I do next."** Open this first.
> Restructured 2026-06-13 into a phase-wise tracker (Phases A–F) with per-phase completion counts.
> Older snapshots live in [`archive/`](archive/).
>
> **Last updated:** 2026-06-13 · **Branch:** `refactor/service-decomposition` · verified against code + commit log.
> **Sprints 1–4 closed** — front door (S1), **SaaS layer/billing (S2, bug log #247–#251)**, code-review quality (S3, #228–#238), Phase-D QA (S4, #239–#246).
> **Sprint-closure review 2026-06-13** — adversarial review of Sprint 2 billing/quota code found 3 new bugs (#252–#254) and fixed them: `BillingService` plan-validation dead code + idempotency gap on confirm; `AuditTab` CSV injection. All items now green. See [`qa/bug_fixes_log.md`](qa/bug_fixes_log.md).
> **Phase B/C/D reconciliation 2026-06-13 (S5)** — code-traced the open items: (1) **Real LLM token streaming was already live** (it had been mis-marked ❌) — promoted to ✅; (2) **GoogleCalendarAdapter implemented** (real freebusy + Meet-link events; env-var activated, honest mock fallback) — awaits the owner's OAuth credentials to go live; (3) **Multi-approver relay is single-tier only** — finance/CEO chain confirmed *not* built and deferred by decision; (4) **Hire-request form polished** (inline validation + a11y); (5) Phase C closed (CI + deploy config done). De-duplicated: Phase B and Phase D were tracking the same Calendar/Branding/Video items — **Phase B is now the single source of truth**, Phase D rows cross-reference it.

---

## One-line status

**Product engineering: Phases A–C complete (MVP + extended + hardening, 106 tests green, RLS live).**
**Business: pre-launch, zero users; billing/quota layer built in simulation (Sprint 2) — Razorpay KYC + hosting are the gates left in Phase F (active).**
See [`product/05_market_validation.md`](product/05_market_validation.md) for the market read and 90-day plan.

## Completion summary

| Phase | Scope | ✅ Done | ⚠️ Partial | ❌ Not started | Progress |
|---|---|---|---|---|---|
| **A** | Core MVP (foundation) | 24 | 0 | 0 | ████████ 100% |
| **B** | Extended features | 9 | 2 | 0 | ███████░ ~91% |
| **C** | Hardening & audit closure | 25 | 0 | 0 | ████████ 100% |
| **D** | Phase-2 features | 7 | 3 | 2 | ██████░░ ~71% |
| **E** | Phase-3 features | 0 | 0 | 9 | ░░░░░░░░ 0% |
| **F** | SaaS launch readiness ← **active** | 2 | 5 | 2 | ████░░░░ ~45% |

Legend: ✅ done + committed (code-traced or test-backed) · ⚠️ built but needs activation/QA/key · ❌ not started
Priority: **P0** security/core-flow blocker · **P1** sold feature that didn't work · **P2** polish.
**Rule:** a feature is "done" when a test walks it and it has no open P0/P1 — not when the UI renders.

---

## Phase A — Core MVP foundation ✅ 24/24

All 24 core features from [`product/02_features.md`](product/02_features.md) §1 are built, wired, and
covered by the backend suite + Playwright core-loop E2E. Highlights:

- ✅ Auth & multi-tenancy (JWT, roles, lockout, denylist) — `test_auth.py`
- ✅ Hire request → approval → pickup (4 email touchpoints) — `test_hire_request_approval.py`
- ✅ JD creation chat — 8-stage LangGraph: intake → internal skills → market research (Tavily) → 3 variants → streamed JD → bias check → team-lead approval → save → sourcing *(PDF-only upload; Position Setup Modal omits headcount/priority — P2)*
- ✅ Two-phase semantic ATS (cosine 0.35 gate → LLM weighted score → screening/on_hold routing)
- ✅ Inbound apply loop (career page → apply chat → resume parse → screening Qs → recruiter notified) — `test_candidate_core_loop.py`
- ✅ Candidate portal, interviews (invites, reminders, round results), panel magic-link feedback
- ✅ Talent pool (bulk upload, real embeddings AI-match), analytics/dashboard — *dedicated tests filled 2026-06-13 (Sprint 3): `test_dashboard.py` + `test_talent_pool.py` were empty stubs, now real (part of 132-test suite)*
- ✅ Notifications, AI interview kit, career page, debrief generator
- ✅ v3 redesign: **19/19 surfaces** to spec (teal `#0D9488` + Plus Jakarta Sans) — per-page banners in [`design/pages/`](design/pages/)

## Phase B — Extended features · 9 ✅ / 2 ⚠️ / 0 ❌

> **Single source of truth for Calendar / Branding / Video.** Phase D #1/#2/#3 are the
> same three features (historical duplication) — they now cross-reference these rows.

| Item | Status | Notes |
|---|---|---|
| Pipeline grid+Kanban, GDPR/DPDP flow, status portal, AI copilot bar, hiring notes, analytics deep-dive, approval workflow, talent-pool contact status | ✅ | See [`product/02_features.md`](product/02_features.md) §2 |
| Video introduction upload | ⚠️ | Frontend built 2026-06-13 (post-submission add-on) + recruiter player live; **only a ~2-min live click-through remains** before ✅ (= Phase D #3) |
| Calendar integration | ⚠️ | **Real `GoogleCalendarAdapter` implemented 2026-06-13** (freebusy → slot grid + `events.insert` with auto Meet link; env-var activated via `CALENDAR_PROVIDER=google` + `GOOGLE_CALENDAR_CREDENTIALS`; falls back to mock with a clear log if creds absent). **Remaining:** owner supplies OAuth creds + one live test. Helper: `scripts/google_calendar_setup.py`; [guide §0](integrations/calendar.md) (= Phase D #1) |
| Career page custom branding | ✅ | UI built + settings wired (2026-06-12); QA'd 2026-06-13 by code-trace (= Phase D #2) |

## Phase C — Hardening & audit closure · 100%

The 2026-06-11 audit ([snapshot](archive/2026-06-11_PRODUCT_STATUS.md)) found 4 P0s + 14 P1s. All closed:

| Group | Status | Evidence |
|---|---|---|
| P0-1 `/dev/*` exposure | ✅ | `DEV_MODE: bool = False` fail-safe · commit `90e6413` |
| P0-2 RLS inert | ✅ **Live** | `APP_DATABASE_URL` dual-pool; `test_rls_isolation.py` ✓ |
| P0-3 GDPR cross-tenant deletion | ✅ | org-scope check + rate limit · `90e6413` |
| P0-4 Collusion detection dead | ✅ | `_answer_similarity` fixed · `90e6413` |
| P1-1…14 (emails, reminders, round-result UI, portal fields, real embeddings, …) | ✅ | commits `982efaa`, `778d882`, `e47acf9` |
| Test net | ✅ | **2026-06-13 (Sprint 3):** 5 stub files filled → **132 backend tests green @ 37.54% coverage** (`pytest-cov`, floor `COV_MIN=37`, `make coverage`); first **frontend unit tests** added (`api.js`, `HireRequests/helpers.js`, dashboard metadata, `npm test`); **`make e2e`** one-command runner. CI pipeline shipped under **F9** (now ✅) — this row is closed. Bug log #228, #232–#235 |
| Code-review cleanup (2026-06-13, Sprint 3) | ✅ | 2 DOM hacks → React (E2/E3 — `window.prompt`→ConfirmModal, bias-fix globals→event delegation, also repaired DOMPurify-stripped buttons); dead-file sweep (E4); service facades documented (E6); `/uploads` env-gated + object-storage plan (E7); `utcnow()` deprecation. Bug log #229–#231, #236–#238 |
| Error monitoring | ✅ | Sentry: backend API + Celery + frontend |
| Architecture debt (SQL→repositories, god-object split, stub repos) | ✅ | CRITICAL-03, HIGH-04, HIGH-05 all done |
| Deployment configs (X-Forwarded-For, `ENCRYPTION_KEY`) | ✅ | Config/code complete 2026-06-13 (Sprint 2): documented in [architecture/production_config.md](architecture/production_config.md). Live cutover (staging/backups/uptime) is hosting-dependent and tracked under **F6** — not a code gap |

## Phase D — Phase-2 features · 7 ✅ / 3 ⚠️ / 2 ❌

From [`product/03_roadmap.md`](product/03_roadmap.md) §4.
**Note:** #1 Calendar, #2 Branding and #3 Video are the same features tracked in **Phase B** —
Phase B holds the authoritative status; these rows mirror it.

| # | Feature | Status | Notes |
|---|---|---|---|
| 12 | JD chat interactive refinement | ✅ | Shipped (commits `099cdd0`–`62fe99e`) |
| 1 | Google Calendar OAuth (real) | ⚠️ | **Adapter now implemented** (2026-06-13) — see Phase B "Calendar integration". Needs owner's OAuth creds + a live test to flip ✅ |
| 2 | Career page branding | ✅ | QA'd 2026-06-13 (code-trace): settings→PATCH `/settings/org` (gated `require_org_head`)→`OrgRepository`→DB cols→careers GET→`CareerPage` applies color/banner/tagline. Minor: cleared fields can't reset (PATCH `exclude_none`); silent save errors. See [reviews/2026-06-13_sprint4_qa.md](reviews/2026-06-13_sprint4_qa.md) |
| 3 | Video intro frontend | ⚠️ | Built 2026-06-13 (Sprint 4) as a **post-submission add-on** (decision: avoids touching the apply completion state machine — zero risk of lost applications). `_step_complete` now offers an optional video + sets `video_offer`; `ApplyPage` shows the upload card at `completion` (skip is local; `/upload-video` unchanged). Recruiter player already live via `get_with_application` (needs `position_id` context — plain `get()` path doesn't surface it yet). Unit test `tests/test_video_intro.py` locks the contract. **Automated gate cleared 2026-06-13:** backend suite 133 passed (incl. this test), coverage 37.62% > floor; `npm run build` clean. **Only remaining before ✅:** a ~2-min live click-through of the optional-video card + recruiter player. |
| 6 | GDPR data export (Art. 20) | ✅ | Built 2026-06-13 (Sprint 4): `Settings → Data export` tab (`DataExportTab.jsx`, was a placeholder) → standalone SAR export via `gdprApi.exportCandidateData` → talent-pool lookup helper + by-ID, structured summary + copy/download JSON. Admin-gated. (Deletion-context export remains in the GDPR/DPDP tab.) |
| 7 | Audit log UI | ✅ | QA'd 2026-06-13 (code-trace): `AuditTab`→GET `/settings/audit-logs` (gated `require_org_head`)→`AuditService.get_logs` returns `{total, logs[]}`; response shape matches consumer; debounced search + pagination + CSV(page). Minor: UI exposes search only, not the user_id/action filter params backend supports. See QA review doc |
| 8 | team_lead dashboard | ✅ | QA'd 2026-06-13 (code-trace): `DashboardPage` role-routes `team_lead`→`TeamLeadDashboard` fed by `useDashboardData`; `lanes.{now,next,pulse}` shape matches all consumers; File-Hire-Request CTA→`/hire-requests/new`; onboarding empty-state handled. See QA review doc |
| 9 | Multi-approver relay | ⚠️ | **Single-tier only** (code-traced `services/hire_requests/approvals.py` 2026-06-13): one `dept_admin`/`org_head` approval → HR pickup. There is **no** finance/CEO chain and **no** `approval_chain` table/sequencing. **Decision 2026-06-13: deferred** — current single-tier approval is sufficient; multi-tier relay to be added only if a pilot needs it |
| 4 | WhatsApp integration | ❌ | **Promoted — India wedge, rank #5 in [validation brief](product/05_market_validation.md) §6** |
| 5 | Self-scheduling links | ❌ | Blocked by calendar integration |
| 10 | Hire-request wizard polish | ✅ | Done 2026-06-13: inline per-field validation (role required, headcount ≥ 1, experience/comp min≤max, no negatives), `aria-invalid` highlighting + field-level messages, auto-focus to first invalid field, errors clear on edit. `HireRequestForm.jsx`; esbuild-clean |
| 11 | Real LLM token streaming | ✅ | **Was already live — corrected from ❌ 2026-06-13.** `run_drafting_final` streams via `llm.astream()` → `token_queue` → `jd_token` SSE; `ChatContext.jsx` renders incrementally; covered by `tests/test_phase2_actions.py` |

## Phase E — Phase-3 features · 0/9

LinkedIn/Naukri real API, HRIS sync, Slack/Teams, offer management, referrals, multi-language JD,
custom career domains, Chrome extension, API & webhooks — all ❌ by design. **Per the
[validation brief](product/05_market_validation.md), Naukri job-posting may get promoted to Phase F+1;
everything else waits for customer pull.**

## Phase F — SaaS launch readiness ← ACTIVE · 2 ✅ / 5 ⚠️ / 2 ❌

New phase added 2026-06-13 from the [market validation brief](product/05_market_validation.md) §5–6.
This is the gap between "product" and "business."

| # | Item | Status | Notes |
|---|---|---|---|
| F1 | Landing page + pricing + demo booking | ⚠️ | **Folded into the SPA 2026-06-13** (Sprint 1 — not a separate static site): `/` + `/pricing` public routes in `frontend/src/components/Marketing/`, pricing mirrors roadmap tiers. Code done + builds clean. Redesigned landing page and auth shell for premium aesthetic (glassmorphism, scroll animations, capability chips). Needs: hosting + Calendly URL swap (in `MarketingChrome.jsx`) |
| F2 | Billing (Razorpay) + plan/quota enforcement + **LLM spend caps per org** | ⚠️ | **Built 2026-06-13 (Sprint 2, bug log #247–#249).** Plan/quota enforcement (`services/plans.py` + `quota_service.py`, soft-warn→hard-block 402s; gates positions/seats/applications); per-org monthly **LLM budget** (COGS risk closed — `BudgetExceededError`, hard-stop in JD chat); Razorpay adapter **simulation-first** (`adapters/billing/*` + `routers/billing.py`, full checkout→invoice→plan flow works in sim). Tests: `test_quota.py`, `test_billing.py`. **2 edge-case bugs fixed 2026-06-13 (review #252–#253):** silent plan fallback in `start_checkout` + idempotency gap in `confirm`. **Remaining before ✅:** Razorpay **KYC + live keys** (`BILLING_PROVIDER=razorpay`) and a live pytest run (needs Docker/Postgres) |
| F3 | ToS + privacy policy pages | ⚠️ | Drafted 2026-06-13, served in-app at `/legal/*` (linked from apply consent, career page, status page). Needs: [PLACEHOLDER] fill + lawyer review |
| F4 | Email deliverability runbook (SPF/DKIM, domain warm-up) | ❌ | Outreach lands in spam without it |
| F5 | Self-serve onboarding (seeded demo org, first-run checklist) | ❌ | Activation target: first JD + first application ≤ 7 days |
| F6 | Production environment (staging, backups/DR, uptime monitoring, `ENCRYPTION_KEY`, X-Forwarded-For) | ⚠️ | Dockerfile + compose exist. **2026-06-13 (Sprint 2):** `ENCRYPTION_KEY` generation + reverse-proxy `--proxy-headers`/`X-Forwarded-For` (rate-limit + audit IP correctness) + billing env now documented in [architecture/production_config.md](architecture/production_config.md). **Remaining:** staging, backups/DR, uptime monitoring (hosting-dependent) |
| F7 | External integration keys (Calendar OAuth, one enrichment provider or hide toggle) | ⚠️ | Credential work, not bugs; adapters fall back honestly |
| F8 | Repo hygiene: push current code to GitHub; fix README (says SQLite, code is Postgres+RLS) | ✅ | Done 2026-06-13 (Sprint 1): README/Postgres aligned, `.gitignore` hardened, tracked sqlite/chroma removed from index + pushed |
| F9 | CI pipeline (pytest + lint on push, Playwright on PR) + fill/delete 5 stub test files | ✅ | **Done 2026-06-13.** Stub tests filled (Sprint 3 → 132 backend tests @ 37.54%, frontend units, `make coverage`/`make e2e`); **CI pipeline added (Sprint 2, bug log #250)** — `.github/workflows/ci.yml`: ruff+pytest (coverage floor, testcontainers Postgres) on push, vitest+build, Playwright on PR. From [2026-06-13 review](reviews/2026-06-13_full_codebase_review.md) §4 |

---

## 🎯 What's next (do these in order)

> **Day-to-day dev work queue:** [`../TODO.md`](../TODO.md) (created 2026-06-13) — sprint-ordered
> checklist of every doable gap from the validation brief + code review, with a blocked-on-keys list.
> This file stays the source of truth for *state*; TODO.md is the *work queue*.

1. **F1 + F3 + F4** — the "front door" batch (~week; F8 repo hygiene ✅ done, F1/F3 dev done — just hosting + lawyer review left). Then start **25 discovery calls** (India SMB beachhead — [validation brief](product/05_market_validation.md) §4).
2. **F2 billing + quotas** — ✅ built in simulation (Sprint 2). Left before a paid pilot: Razorpay **KYC + live keys** (`BILLING_PROVIDER=razorpay`) and a live pytest run.
3. **F5 onboarding** — built from watching the first pilots, not before.
4. **Calendar go-live** — owner supplies Google OAuth creds (run `scripts/google_calendar_setup.py`, see [guide §0](integrations/calendar.md)), then one live test flips Calendar (Phase B / D#1) to ✅. The other Phase-D ⚠️ items (video click-through, multi-approver relay) get promoted only when a pilot needs them.
5. **No new features unless a pilot customer is blocked without it** (rule from the 90-day plan).

---

## Where the detail lives

- **Market validation / 90-day plan**: [product/05_market_validation.md](product/05_market_validation.md)
- **Strategy / why** (moat, narrow-the-surface): [product/04_strategy.md](product/04_strategy.md)
- **Forward roadmap detail**: [product/03_roadmap.md](product/03_roadmap.md)
- **Bug ledger + validation**: [qa/bug_fixes_log.md](qa/bug_fixes_log.md) · [qa/testing_validation_tracker.md](qa/testing_validation_tracker.md)
- **RLS runbook**: [RLS_ACTIVATION.md](RLS_ACTIVATION.md) · **Per-surface reviews**: [reviews/](reviews/)
- **Full 3-lens code review (eng/QA/design, 2026-06-13)**: [reviews/2026-06-13_full_codebase_review.md](reviews/2026-06-13_full_codebase_review.md)
- **Audit snapshot (file:line evidence)**: [archive/2026-06-11_PRODUCT_STATUS.md](archive/2026-06-11_PRODUCT_STATUS.md)

## How to keep this file honest

- Update a row the moment its state changes; recompute the phase counts in the summary table.
- "Built" is not "done." Mark ⚠️ until the activation step (key, QA, cutover, test) completes.
- When a phase closes, write a dated snapshot into `archive/` and collapse its section here to one line.
- Code wins over docs. Where this file and the code disagree, fix this file.
