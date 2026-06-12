# Feature Catalog & Build Status

> Part of the consolidated docs. Start at [`docs/README.md`](../README.md) for the map.
> For per-page UI build status, see [`docs/STATUS.md`](../STATUS.md).
> Sibling docs: [`01_overview.md`](01_overview.md) · [`03_roadmap.md`](03_roadmap.md)

Status legend: ✅ done · ⚠️ partial (backend only / mock) · ❌ not started

---

## 1. Core MVP features

> ⚠️ **Outdated claim (corrected 2026-06-11):** "functional end-to-end" reflects UI build status, not
> verified runtime behavior. A full code audit found several ✅ features below are wired-looking but
> silently broken (e.g. interview invite emails are a no-op, collusion detection was dead, status portal
> 404s, talent-pool AI-match uses random vectors). **See [`../STATUS.md`](../STATUS.md)
> for the real per-feature state before trusting any ✅ in this table** (most of those audit findings are
> now fixed — the tracker has current state). This catalog is the *intended*
> feature set; it has not been re-verified line-by-line.

| # | Feature | Status | Notes |
|---|---|---|---|
| 1 | Auth & multi-tenancy | ✅ | `org_id` + `department_id` on every table; JWT + role middleware |
| 2 | Organization settings | ✅ | About Us, culture, benefits — feeds JD generation |
| 3 | Competitor management | ✅ | Feeds market research step |
| 4 | Screening questions config | ✅ | Dynamic questions in candidate apply chat |
| 5 | Department + team management | ✅ | Invite-by-email + set-password-now both supported (commit `d4ea759`) |
| 6 | Recruiter chat — JD generation | ✅ | LangGraph pipeline: intake → internal → market → variants → final |
| 7 | JD bias checker | ✅ | Post-generation, non-blocking |
| 8 | Position Setup Modal | ✅ | Headcount, search freq, ATS threshold, priority; save-as-draft (commit `62fe99e`) |
| 9 | Background candidate search | ✅ | Celery, daily/configurable; Tavily adapter default (commit `d4ea759`) |
| 10 | Semantic ATS scoring | ✅ | `emb×0.4 + skills×0.4 + exp×0.2 × 100`, not keyword matching |
| 11 | Duplicate candidate detection | ✅ | Email/phone match within org only |
| 12 | Email outreach with magic links | ✅ | Personalized, tracked; Resend/SMTP/simulation adapters |
| 13 | Candidate magic link chat | ✅ | Chat-based application — NOT a form |
| 14 | Candidate pipeline management | ✅ | Status tracking, grid + Kanban toggle |
| 15 | Interview scheduling | ✅ | Rounds, panels, date/time, meeting link (mock calendar availability) |
| 16 | Panel magic link feedback | ✅ | Structured form + AI enrichment of rough notes |
| 17 | AI-drafted rejection emails | ✅ | System drafts, recruiter reviews and sends |
| 18 | Candidate timeline | ✅ | Unified chronological event feed (PipelineEvent based) |
| 19 | Talent pool | ✅ | Auto-add on reject/close, bulk upload, AI suggestions |
| 20 | Dashboard & analytics | ✅ | Stats, funnel, positions list, activity feed |
| 21 | Notifications | ✅ | In-app alerts for key events |
| 22 | AI interview kit | ✅ | Questions + scorecard template from JD |
| 23 | Career page | ✅ | Public job board, auto-publishes open positions |
| 24 | Interview debrief generator | ✅ | AI summary after all rounds complete |

---

## 2. Extended features

Planned after the original MVP.

| # | Feature | Status | Notes |
|---|---|---|---|
| 1 | Pipeline tab-based grid redesign | ✅ | Grid + Kanban toggle both built |
| 2 | GDPR/DPDP compliance | ✅ | `gdpr.py` router, `DeleteMyDataPage`, `data_retention_months` |
| 3 | Candidate status portal | ✅ | `CandidateStatusPage`, `status_token` column |
| 4 | AI Copilot dashboard | ✅ | `copilot_service.py`, `copilot_suggestions` table, dismissible action bar |
| 5 | Collaborative hiring notes | ✅ | `notes.py` router with @mention support |
| 6 | Hiring analytics deep dive | ✅ | `AnalyticsPage.jsx`, dedicated analytics routes |
| 7 | Approval workflow | ✅ | Hire-request dept_admin approval + team_lead JD gate (commits `44aff50`, `9db825a`) |
| 8 | Talent pool contact status / unsubscribe | ✅ | `contact_status` (active/unsubscribed/employed) + unsubscribe endpoint |
| 9 | Video introduction upload | ⚠️ | Endpoint + DB columns done; frontend pending |
| 10 | Calendar integration | ⚠️ | `MockCalendarAdapter` only; real Google OAuth not implemented. See [integrations/calendar.md](../integrations/calendar.md) |
| 11 | Career page custom branding | ❌ | `AppearanceTab` only handles theme — no career color/logo/banner |

---

## 3. Hire request — approval workflow

Newer surface (Phase 1 shipped 2026-05-19, approval layer added 2026-05-28).

**Shipped:**
- Dedicated `/api/v1/hire-requests/*` router (service + repository, transactions, audit log, tenant isolation)
- Frontend: `/hire-requests` list · `/new` wizard · `/:id` detail · `/:id/edit`
- dept_admin approval workflow with 4 email touchpoints (commit `44aff50`)
- Status flow: `pending → accepted/approved → fulfilled` plus `cancelled` / `rejected`
- Sidebar nav with pending-count badge; dashboard widgets via legacy `/positions/requests/*` shims

**Deferred (Phase 2):** see [`03_roadmap.md`](03_roadmap.md) and
[`design/pages/09_hire_request.md`](../design/pages/09_hire_request.md) for the full
Phase 1 vs Phase 2 split.

---

## 4. Out of scope (MVP)

| Feature | Reason |
|---|---|
| Offer letter generation | Legally sensitive, org-specific T&C |
| Document checklist | Complex, org-specific |
| Background verification | Third-party integration complexity |
| Voice/phone AI screening | Replaced by chat via magic link |
| LinkedIn/Naukri real API | ToS complexity — use simulation/Tavily adapter |
| Calendar integration (real OAuth) | Phase 2 |
| WhatsApp | Phase 2 |
| Candidate self-scheduling | Phase 2 |
