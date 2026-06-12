# Project Status — Phase-Wise Tracker

> **The single source of truth for "where are we and what do I do next."** Open this first.
> Restructured 2026-06-13 into a phase-wise tracker (Phases A–F) with per-phase completion counts.
> Older snapshots live in [`archive/`](archive/).
>
> **Last updated:** 2026-06-13 · **Branch:** `feature/phase2-items` · verified against code + commit log.

---

## One-line status

**Product engineering: Phases A–C complete (MVP + extended + hardening, 106 tests green, RLS live).**
**Business: pre-launch, zero users, no billing — Phase F (SaaS launch readiness) is the active phase.**
See [`product/05_market_validation.md`](product/05_market_validation.md) for the market read and 90-day plan.

## Completion summary

| Phase | Scope | ✅ Done | ⚠️ Partial | ❌ Not started | Progress |
|---|---|---|---|---|---|
| **A** | Core MVP (foundation) | 24 | 0 | 0 | ████████ 100% |
| **B** | Extended features | 8 | 2 | 1 | ██████░░ ~82% |
| **C** | Hardening & audit closure | 24 | 1 | 0 | ███████░ ~98% |
| **D** | Phase-2 features | 1 | 6 | 5 | ███░░░░░ ~33% |
| **E** | Phase-3 features | 0 | 0 | 9 | ░░░░░░░░ 0% |
| **F** | SaaS launch readiness ← **active** | 0 | 3 | 5 | █░░░░░░░ ~19% |

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
- ✅ Talent pool (bulk upload, real embeddings AI-match), analytics/dashboard — ⚠️ *no dedicated tests: `test_dashboard.py` and `test_talent_pool.py` are empty stubs (found 2026-06-13 review)*
- ✅ Notifications, AI interview kit, career page, debrief generator
- ✅ v3 redesign: **19/19 surfaces** to spec (teal `#0D9488` + Plus Jakarta Sans) — per-page banners in [`design/pages/`](design/pages/)

## Phase B — Extended features · 8 ✅ / 2 ⚠️ / 1 ❌

| Item | Status | Notes |
|---|---|---|
| Pipeline grid+Kanban, GDPR/DPDP flow, status portal, AI copilot bar, hiring notes, analytics deep-dive, approval workflow, talent-pool contact status | ✅ | See [`product/02_features.md`](product/02_features.md) §2 |
| Video introduction upload | ⚠️ | Backend + DB done; apply-chat step + player UI pending |
| Calendar integration | ⚠️ | `MockCalendarAdapter` only; real Google OAuth pending — [guide](integrations/calendar.md) |
| Career page custom branding | ❌→⚠️ | UI built + settings wired (2026-06-12) but **needs QA** before ✅ |

## Phase C — Hardening & audit closure · ~98%

The 2026-06-11 audit ([snapshot](archive/2026-06-11_PRODUCT_STATUS.md)) found 4 P0s + 14 P1s. All closed:

| Group | Status | Evidence |
|---|---|---|
| P0-1 `/dev/*` exposure | ✅ | `DEV_MODE: bool = False` fail-safe · commit `90e6413` |
| P0-2 RLS inert | ✅ **Live** | `APP_DATABASE_URL` dual-pool; `test_rls_isolation.py` ✓ |
| P0-3 GDPR cross-tenant deletion | ✅ | org-scope check + rate limit · `90e6413` |
| P0-4 Collusion detection dead | ✅ | `_answer_similarity` fixed · `90e6413` |
| P1-1…14 (emails, reminders, round-result UI, portal fields, real embeddings, …) | ✅ | commits `982efaa`, `778d882`, `e47acf9` |
| Test net | ⚠️ | **104 test functions / 18 real files** + 3 Playwright specs. **But:** 5 test files are empty `TODO` stubs (dashboard, interviews, positions, talent_pool, settings), no CI pipeline, zero frontend unit tests — see [reviews/2026-06-13_full_codebase_review.md](reviews/2026-06-13_full_codebase_review.md) |
| Error monitoring | ✅ | Sentry: backend API + Celery + frontend |
| Architecture debt (SQL→repositories, god-object split, stub repos) | ✅ | CRITICAL-03, HIGH-04, HIGH-05 all done |
| Deployment configs (X-Forwarded-For, `ENCRYPTION_KEY`) | ⚠️ | Deferred to production environment setup — do in Phase F |

## Phase D — Phase-2 features · 1 ✅ / 6 ⚠️ / 5 ❌

From [`product/03_roadmap.md`](product/03_roadmap.md) §4:

| # | Feature | Status | Notes |
|---|---|---|---|
| 12 | JD chat interactive refinement | ✅ | Shipped (commits `099cdd0`–`62fe99e`) |
| 1 | Google Calendar OAuth (real) | ⚠️ | Mock done; needs OAuth client + adapter |
| 2 | Career page branding | ⚠️ | Built, needs QA (see Phase B) |
| 3 | Video intro frontend | ⚠️ | Backend done |
| 6 | GDPR data export (Art. 20) | ⚠️ | Backend endpoint exists; no frontend |
| 7 | Audit log UI | ⚠️ | Built (2026-06-12); needs QA |
| 8 | team_lead dashboard | ⚠️ | Wired in DashboardPage; needs QA |
| 9 | Multi-approver relay | ⚠️ | dept_admin tier shipped; finance/CEO tiers + `approval_chain` remain |
| 4 | WhatsApp integration | ❌ | **Promoted — India wedge, rank #5 in [validation brief](product/05_market_validation.md) §6** |
| 5 | Self-scheduling links | ❌ | Blocked by calendar integration |
| 10 | Hire-request wizard polish | ❌ | P2 |
| 11 | Real LLM token streaming | ❌ | P2 |

## Phase E — Phase-3 features · 0/9

LinkedIn/Naukri real API, HRIS sync, Slack/Teams, offer management, referrals, multi-language JD,
custom career domains, Chrome extension, API & webhooks — all ❌ by design. **Per the
[validation brief](product/05_market_validation.md), Naukri job-posting may get promoted to Phase F+1;
everything else waits for customer pull.**

## Phase F — SaaS launch readiness ← ACTIVE · 0 ✅ / 3 ⚠️ / 5 ❌

New phase added 2026-06-13 from the [market validation brief](product/05_market_validation.md) §5–6.
This is the gap between "product" and "business."

| # | Item | Status | Notes |
|---|---|---|---|
| F1 | Landing page + pricing + demo booking | ⚠️ | Built 2026-06-13 (`landing/` — static, no build step). Needs: hosting + Calendly URL swap (see `landing/README.md`) |
| F2 | Billing (Razorpay) + plan/quota enforcement + **LLM spend caps per org** | ❌ | Tiers exist only in docs; LLM usage tracked but uncapped (COGS risk) |
| F3 | ToS + privacy policy pages | ⚠️ | Drafted 2026-06-13 (`landing/terms.html` + `privacy.html`, served in-app at `/legal/*`; linked from apply consent, career page, status page). Needs: [PLACEHOLDER] fill + lawyer review |
| F4 | Email deliverability runbook (SPF/DKIM, domain warm-up) | ❌ | Outreach lands in spam without it |
| F5 | Self-serve onboarding (seeded demo org, first-run checklist) | ❌ | Activation target: first JD + first application ≤ 7 days |
| F6 | Production environment (staging, backups/DR, uptime monitoring, `ENCRYPTION_KEY`, X-Forwarded-For) | ⚠️ | Dockerfile + compose exist; rest pending |
| F7 | External integration keys (Calendar OAuth, one enrichment provider or hide toggle) | ⚠️ | Credential work, not bugs; adapters fall back honestly |
| F8 | Repo hygiene: push current code to GitHub; fix README (says SQLite, code is Postgres+RLS) | ⚠️ | Local README already correct; `.gitignore` hardened 2026-06-13. Remaining: `git rm --cached` the tracked sqlite/chroma files + push (commands in TODO.md done log) |
| F9 | CI pipeline (pytest + lint on push, Playwright on PR) + fill/delete 5 stub test files | ❌ | Top items from [2026-06-13 review](reviews/2026-06-13_full_codebase_review.md) §4 |

---

## 🎯 What's next (do these in order)

> **Day-to-day dev work queue:** [`../TODO.md`](../TODO.md) (created 2026-06-13) — sprint-ordered
> checklist of every doable gap from the validation brief + code review, with a blocked-on-keys list.
> This file stays the source of truth for *state*; TODO.md is the *work queue*.

1. **F1 + F3 + F4 + F8** — the "front door" batch (~week). Then start **25 discovery calls** (India SMB beachhead — [validation brief](product/05_market_validation.md) §4).
2. **F2 billing + quotas** — required before any paid pilot.
3. **F5 onboarding** — built from watching the first pilots, not before.
4. QA the six Phase-D ⚠️ items as pilots touch them; promote to ✅ only with a test.
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
