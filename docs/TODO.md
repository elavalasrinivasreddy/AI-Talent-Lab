# TODO — Development Gap Closure

> **The working checklist.** Consolidates every actionable gap from the
> [market validation brief](docs/product/05_market_validation.md) and the
> [2026-06-13 full code review](docs/reviews/2026-06-13_full_codebase_review.md),
> filtered by *doable now* vs *blocked on external keys/accounts*.
> Created 2026-06-13. Tick items here; when a whole group closes, update the matching
> row in [docs/STATUS.md](docs/STATUS.md) (still the source of truth for *state*; this file is the work queue).
>
> **Rules:** work top-down within a sprint · "done" = test/QA-walked, not "renders" ·
> no new features unless a pilot customer is blocked (timebox this whole file: ~3 weeks).

---

## Sprint 1 — What sales hits first (trust + front door)

*A prospect's path is: landing page → demo → security questions → invoice. Close gaps in that order.*

- [x] **Landing page + pricing page + demo-booking link** (F1) — done 2026-06-13 → `landing/` (static single page + pricing section). **Open:** host it; swap `BOOKING_URL` mailto → Calendly (3 spots, see `landing/README.md`).
- [x] **ToS + Privacy Policy pages** (F3) — done 2026-06-13 → `landing/terms.html` + `privacy.html`; copies served in-app at `/legal/*` (`frontend/public/legal/`); linked from apply consent screen, apply footer, career page, status page (`VITE_MARKETING_URL` switches links to the hosted site). **Open:** fill [PLACEHOLDERS] + lawyer review, then remove draft banners.
- [x] **Security one-pager** — done 2026-06-13 → [docs/product/07_security_one_pager.md](product/07_security_one_pager.md), claims code-traced against STATUS.md/RLS docs.
- [ ] **Repo hygiene** (F8/E5) — local README already says Postgres (GitHub copy is the stale one); `.gitignore` hardened 2026-06-13 (`*.sqlite`, `uploads/`). **Remaining (run locally):** `git rm --cached backend/db/talent_lab.sqlite && git rm -r --cached backend/db/chroma` → commit → push.
- [ ] **Demo video (3 min)** from [DEMO_GUIDE.md](DEMO_GUIDE.md) — *deferred by decision 2026-06-13; plan later.*

## Sprint 2 — Make it chargeable + safe to operate (the "SaaS layer")

- [ ] **Plan & quota enforcement** (F2a) — plan field on org (`starter/professional/business/founder_pilot`), middleware checks: active positions, candidates/month, users. Pure code, no keys needed. *~2 days*
- [ ] **LLM spend caps per org** (F2b) — extend existing `llm_usage_logger` with a monthly budget per org + soft-warn / hard-stop. Closes the COGS risk from validation brief §5. *~1 day*
- [ ] **Razorpay adapter (simulation-first)** (F2c) — same adapter pattern as email: `BillingAdapter` with `SimulationBilling` now, `RazorpayBilling` activates when keys arrive. Invoice records + plan assignment work end-to-end in simulation. *~2 days*
- [ ] **CI pipeline** (E1/Q2) — GitHub Actions: pytest + lint on push, Playwright on PR. Makes every later checkbox durable. *~½ day*
- [ ] **`ENCRYPTION_KEY` generation + prod config docs** — self-generated, not externally blocked; documents the prod env (incl. X-Forwarded-For note). *~½ day*

## Sprint 3 — Code review queue (quality gaps)

- [ ] **Fill the 5 stub test files** (Q1) — priority order: `test_positions.py`, `test_interviews.py`, `test_talent_pool.py`, `test_settings.py`, `test_dashboard.py`. Delete any you decide not to write — no empty stubs. *~2–3 days*
- [ ] **Kill the two DOM hacks** (E2/E3/D2) — bias-fix `window.acceptBiasFix` + injected HTML in `FinalJDCard.jsx:355` → React components; `window.prompt` in `PipelineTab.jsx:237` → existing `ConfirmModal`. *~1 day*
- [ ] **Dead-file sweep** (E4) — delete `frontend/src/utils/candidates.py`, `frontend/tests/example.spec.ts`, `Dashboard/legacy/` (confirm unused), clean `old_frontend/` + `old_backend/` out of the working folder. *~1 hour*
- [ ] **First frontend unit tests** (Q3) — `utils/api.js` (auth header, 401 handling, error normalization), then `useDashboardData.js`, `HireRequests/helpers.js`. *~1 day*
- [ ] **Coverage floor** (Q5) — `pytest-cov`, record current %, fail CI below it. *~½ hour*
- [ ] **`make e2e` script** (Q6) — boot both dev servers + seed + run Playwright, one command. *~½ day*
- [ ] **Service shim check** (E6) — `hire_request_service.py` / `position_service.py`: confirm thin re-exports, add docstring, or finish migration. *~1 hour*
- [ ] **Uploads dir gating** (E7) — env-gate the static `uploads/` mount; plan object storage before pilots upload real resumes. *~½ day*

## Sprint 4 — Built-but-unverified (QA the ⚠️ items) + small wins

- [ ] **QA career-page branding** (Phase D#2) — built 06-12, never QA'd. Walk it, then mark ✅ in STATUS.
- [ ] **QA audit-log UI** (Phase D#7) — same.
- [ ] **QA team_lead dashboard** (Phase D#8) — same.
- [ ] **GDPR export UI** (Phase D#6) — backend endpoint exists; small frontend. *~1 day*
- [ ] **Video intro apply-chat step + player** (Phase D#3) — backend done; frontend step. *~1 day*
- [ ] **Onboarding first-run** (F5) — seeded demo org + "publish your first JD" checklist; finalize after watching first pilot, but scaffold now. *~2 days*
- [ ] **Design-token doc reconciliation** (D1) — update `design/00_design_system.md` to match `globals.css` names (don't churn 59 code files). *~1 hour*
- [ ] **A11y pass** (D4) — axe-core on apply chat + career page; log findings in `docs/reviews/`. *~½ day*

---

## ⛔ Blocked — needs external keys/accounts (do NOT start; revisit when credentials exist)

| Item | Blocked on | Prep already done |
|---|---|---|
| Google Calendar OAuth (real) | Google Cloud OAuth client | Mock adapter, schema columns, [guide](docs/integrations/calendar.md) |
| Candidate self-scheduling | Calendar above | — |
| WhatsApp outreach | Meta Business API approval | Roadmap #4; **start the application now — approval takes weeks** |
| Enrichment provider (Proxycurl/Apollo/Hunter) | Paid account | Adapter falls back honestly; or hide the toggle (allowed now) |
| Email DKIM/SPF live setup | Production domain | Runbook can be *written* now (Sprint 1 optional) |
| Razorpay **live** mode | Razorpay account/KYC | Adapter + simulation built in Sprint 2; **start KYC now — it takes days** |
| Naukri/LinkedIn APIs | Partner access | Phase 3; don't touch |
| Sentry prod DSN / prod env | Hosting decision | Code is no-op-safe already |

**Two things to kick off today even though they're "blocked":** Razorpay KYC and the WhatsApp
Business API application — both have multi-week lead times and cost nothing to start.

---

## Done log

*(Move finished items here with date + commit, so STATUS.md updates stay easy.)*

- **2026-06-13** — Sprint 1: landing site (`landing/`), ToS + Privacy drafts (landing + in-app `/legal/*` + consent/footer links), security one-pager (`docs/product/07_security_one_pager.md`), `.gitignore` hardening. STATUS.md F1/F3/F8 updated. Demo video deferred. *(commit: pending push)*
