# Full Codebase Review — Engineering · QA · UI Design

> Three-lens review written 2026-06-13. Complements the per-surface reviews in this folder
> (all C1–C10 + GA findings from 2026-05-29/30 verified fixed — see
> [`code_review_findings.md`](code_review_findings.md)). This review covers **current state**:
> what those passes didn't catch or what regressed/remained since.
>
> Status legend: 🔴 fix before pilots · 🟠 fix soon · 🟡 nice-to-have · ✅ resolved (date)

---

## Verdict

| Lens | Grade | One-liner |
|---|---|---|
| Engineering | **A−** | Textbook layering and tenant isolation; let down by zero CI and a few fragile DOM hacks |
| QA | **B−** | Real coverage on critical paths, but 5 test files are empty stubs — two of which STATUS.md cited as evidence |
| UI Design | **B+** | Strong system, broad token adoption; token drift unreconciled and two native-browser UX breaks remain |

---

## 1. Engineering review

### What's good (keep doing this)

- **Layering is real, not aspirational.** Routers → services → repositories, consistently.
  Tenant scoping is pervasive: `org_id` appears **470 times across all 19 repository files** —
  the "every query filters by org_id" invariant is visibly enforced, plus Postgres RLS as backstop.
- **`main.py` is a clean app factory** — opt-in Sentry, proper lifespan (DB/Redis/Chroma close),
  middleware separated into modules, explicit comment preventing the double-prefix footgun.
- **Adapter pattern actually followed** (LLM, email, candidate sources, calendar) — providers are
  swappable; fallbacks are honest (simulation/mock when keys absent).
- **Service decomposition done right**: `hire_requests/` and `positions/` split into
  crud/approvals/notifications/reviews modules after the god-object finding (HIGH-04) — and it stuck.
- **Review discipline is unusually good**: 19 per-surface review docs, a 7-angle checklist, every
  CRIT/HIGH finding closed with commit references.

### What needs to change

| # | Sev | Finding | Location | Recommendation |
|---|---|---|---|---|
| E1 | 🔴 | **No CI pipeline.** No `.github/workflows/`. The 104 tests + Playwright run only when a human remembers. Every "tests green" claim is a point-in-time statement. | repo root | GitHub Actions: `pytest` + lint on every push; Playwright on PR. ~30 lines of YAML, highest leverage item in this review. |
| E2 | 🟠 | **Injected HTML + `window.acceptBiasFix` global.** Bias-fix buttons are built as an HTML string with inline `onclick` + hardcoded hex color, wired through a window global. Fragile, bypasses React reconciliation, XSS-adjacent if JD text ever reaches it unescaped. Flagged in [`../product/04_strategy.md`](../product/04_strategy.md) §3 — still present. | `FinalJDCard.jsx:355,377` | Render the fix list as React components; delete the global. |
| E3 | 🟠 | **`window.prompt()` for bulk reject** — native dialog, no validation, no design-system styling. Also flagged in strategy doc — still present. | `PipelineTab.jsx:237` | Reuse the existing `ConfirmModal` component with a numeric input. |
| E4 | 🟠 | **Dead/stray files in the tree**: empty `frontend/src/utils/candidates.py` (a 1-line Python file inside the React src!); `frontend/tests/example.spec.ts` (Playwright scaffold sample); `Dashboard/legacy/` (superseded by v3 — confirm unused, then delete); `old_frontend/`, `old_backend/` with full `node_modules`/`.venv` sitting in the working folder. | various | Delete. Dead code is review surface you pay for on every pass. |
| E5 | 🟠 | **Build artifacts in the source tree**: `backend/db/talent_lab.sqlite`, `backend/db/chroma/*.bin`, `__pycache__` everywhere. If any are tracked by git, history bloats and secrets risk rises. | `backend/db/` | Verify `.gitignore` covers them; `git rm --cached` if tracked. |
| E6 | 🟡 | `hire_request_service.py` and `position_service.py` still exist alongside their split `hire_requests/` and `positions/` packages. | `backend/services/` | If they're thin re-export shims, fine — add a docstring saying so; if they hold logic, finish the migration. |
| E7 | 🟡 | Local-dev `uploads/` mounted unconditionally as static dir in prod path. | `main.py:100` | Gate behind env check or move to object storage before pilots upload real resumes. |

---

## 2. QA review (test coverage audit)

### What exists (verified by reading the files, not the docs)

- **Backend: 104 test functions across 18 real test files.** Strong coverage: auth, RLS isolation,
  hire-request lifecycle (4 files), candidate core loop, candidates, GDPR, panel feedback, pre-eval,
  CTC encryption, Tavily sourcing, chat, drafts, invites, position approval, phase-2 actions, competitor state.
- **Frontend E2E: 3 real Playwright specs** — `e2e/core-loop.spec.ts` (15 assertions; login → pipeline →
  candidate detail → status portal), `tests/candidate_flow.spec.ts`, `tests/login_flow.spec.ts`.

### What's wrong

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| Q1 | 🔴 | **Five test files are empty `# TODO: Implement` stubs**: `test_dashboard.py`, `test_interviews.py`, `test_positions.py`, `test_talent_pool.py`, `test_settings.py`. Worse: **STATUS.md cited `test_dashboard.py ✓` as evidence** for the analytics feature. This violates the project's own rule — *code wins over docs*. (STATUS.md corrected 2026-06-13 as part of this review.) | Either implement them (positions & interviews first — they guard revenue-path flows) or delete the stubs so the suite stops implying coverage that doesn't exist. |
| Q2 | 🔴 | **No CI gate** (= E1). A green suite nobody runs is indistinguishable from a red one. | Same fix as E1. |
| Q3 | 🟠 | **Zero frontend unit tests**, despite `vitest` + `@testing-library/*` being installed and configured in `package.json`. The riskiest untested units: `utils/api.js` (token handling — had a prior MED finding C6), `useDashboardData.js`, `HireRequests/helpers.js`, SSE stream parsing in chat. | Start with `api.js` (auth header, 401 handling, error normalization) — ~1 day, protects everything. |
| Q4 | 🟠 | **Untested routers** (no dedicated tests, not walked by core-loop E2E): `notifications`, `copilot`, `notes`, `candidate_portal`, `careers`, `status`, `platform`, `dashboard`, `settings`, `talent_pool`, `interviews` (partial via `test_position_approval`/`test_phase2_actions`). | Prioritize by pilot exposure: interviews > talent_pool > dashboard > settings > the rest. |
| Q5 | 🟡 | **No coverage measurement** — no `pytest-cov` config, so "coverage" is anecdote. | Add `pytest --cov=backend --cov-report=term-missing`; set a floor (start at current %, ratchet up). |
| Q6 | 🟡 | E2E depends on `POST /dev/seed-core-loop` with both dev servers up — manual, undocumented in CI terms. | Script it (`make e2e`), then wire into CI. |

### Coverage map (router-level)

| Router | Test evidence | Router | Test evidence |
|---|---|---|---|
| auth | ✅ `test_auth`, `test_invite_flow` | careers | ⚠️ E2E only |
| hire_requests | ✅ 4 files | status | ⚠️ E2E only |
| apply | ✅ `test_candidate_core_loop` | interviews | ⚠️ partial (`test_position_approval`) |
| candidates | ✅ `test_candidates` | dashboard | ❌ stub |
| gdpr | ✅ `test_gdpr` | positions | ⚠️ partial; stub file |
| panel | ✅ `test_panel_feedback` | talent_pool | ❌ stub |
| pre_evaluations | ✅ `test_pre_eval` | settings | ❌ stub |
| chat | ✅ `test_chat`, `test_drafts` | notifications, copilot, notes, candidate_portal, platform | ❌ none |

---

## 3. UI design review

### What's good

- **The design system is the product's strongest aesthetic asset** (confirmed prior assessment):
  19 page specs each with build-status banners, a "rejected patterns" table, backend-derived
  patterns (LangGraph stages as first-class blocks, ATS reasoning surfaced). Teal `#0D9488` +
  Plus Jakarta Sans reads as serious infrastructure.
- **Token adoption is broad** — 59 files consume the CSS variables; common primitives exist and are
  used (`Chip`, `EmptyState`, `RoleGate`, `ScoreCircle`, `SkeletonCard`, `Stat`, `ConfirmModal`).
- Skeleton loaders and empty states shipped across public pages (prior review item, verified closed).

### What needs to change

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| D1 | 🟠 | **Token drift unreconciled** (flagged in strategy doc §3, still true): `design/00_design_system.md` specifies short v3 names (`--p`, `--bg-2`); `globals.css` ships long v2.2 names (`--color-bg-primary`, `--font-size-*`). Two sources of truth. | Cheapest fix: update the *doc* to match `globals.css` (59 files already use the long names — don't churn code for naming). |
| D2 | 🟠 | **Native-browser UX breaks the system's own bar**: `window.prompt` bulk-reject (E3) and string-injected bias-fix buttons with hardcoded `#10B981` instead of tokens (E2). These are the only two places the product suddenly looks like a 2010 webpage. | Same fixes as E2/E3 — this is the design rationale for doing them. |
| D3 | 🟡 | `Dashboard/legacy/` CSS+JSX still shipped in the bundle if imported anywhere — risk of v2 styles leaking. | Delete with E4. |
| D4 | 🟡 | A11y pass has no evidence trail — `architecture/05_frontend.md` mentions a11y standards, but no axe audit/checklist exists per page. Magic-link candidates include screen-reader users; apply chat is the page to audit first. | One axe-core pass on apply chat + career page; log results in this folder. |

---

## 4. Priority queue (merged, do in order)

1. 🔴 **E1/Q2 — CI pipeline** (pytest + lint on push; Playwright on PR). Half a day, makes every other claim durable.
2. 🔴 **Q1 — resolve the 5 stub test files**: implement positions + interviews; delete or implement the rest. Never cite a stub as evidence again.
3. 🟠 **E2 + E3 — kill the two DOM hacks** (`window.acceptBiasFix`, `window.prompt`) using existing primitives. ~1 day, closes D2 too.
4. 🟠 **E4/E5 — dead-file & artifact sweep** (stray `.py`, scaffold spec, legacy dashboard, sqlite/chroma binaries, `old_*` folders). ~1 hour.
5. 🟠 **Q3 — first frontend unit tests** on `api.js`.
6. 🟡 **D1 token-doc reconciliation · Q5 coverage floor · E6 shim docstrings · D4 a11y pass on apply chat.**

Everything above slots in front of (or alongside) Phase F items in [`../STATUS.md`](../STATUS.md) —
none of it conflicts with the sell-first plan; items 1–4 total roughly three days.

---

## How to keep this doc honest

- When an item closes, mark the row ✅ with date + commit, same convention as `code_review_findings.md`.
- Re-run this three-lens review before onboarding the first paid pilot.
