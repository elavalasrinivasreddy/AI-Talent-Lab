# AI Talent Lab — Documentation

> **Start here:** [`STATUS.md`](STATUS.md) is the single source of truth for *where the product is
> and what to do next*. Everything else is reference.

This is the front door to product, architecture, and design docs. Reorganized 2026-06-12 to collapse
seven overlapping status/plan files into one living tracker plus a clean reference set.

> **Conventions**
> - Code is the ultimate source of truth. Where a doc and the code disagree, the code wins.
> - Status/"what's next" lives in **one place** — [`STATUS.md`](STATUS.md). Don't add a second tracker.
> - Per-page specs in `design/pages/` carry a build-status banner.

---

## The four documents that matter most

| Doc | Read it when you want to know… |
|---|---|
| [STATUS.md](STATUS.md) | **Where are we, what works, what's next.** The living tracker. Open first. |
| [product/01_overview.md](product/01_overview.md) | **What we're building and why** — vision, users, end-to-end workflow, invariants. |
| [product/04_strategy.md](product/04_strategy.md) | **The strategic read** — the real moat, the core risk, opinionated next moves. |
| [product/03_roadmap.md](product/03_roadmap.md) | **What's coming** — Phase 2/3 features, compliance, monetization. |

---

## Map

### Product — what we're building and why
| Doc | Contents |
|---|---|
| [product/01_overview.md](product/01_overview.md) | Vision, philosophy, users + roles, end-to-end workflow, status state machine, permissions, invariants |
| [product/02_features.md](product/02_features.md) | Full feature catalog (for live build status, see [STATUS.md](STATUS.md)) |
| [product/03_roadmap.md](product/03_roadmap.md) | Validation, competitive landscape, role-based UX, Phase 2/3, compliance, monetization, mobile |
| [product/04_strategy.md](product/04_strategy.md) | Strategic read — vision validation, the data moat, the core solo-founder risk, what to do next |

### Architecture — how it's built
| Doc | Contents |
|---|---|
| [architecture/01_stack_structure.md](architecture/01_stack_structure.md) | Tech stack, 3-layer pattern, project structure, config, local dev |
| [architecture/02_data_model.md](architecture/02_data_model.md) | DB entities, status enums, key columns, resume-storage decision |
| [architecture/03_backend.md](architecture/03_backend.md) | Routers, error format, magic links, security/RLS, Celery tasks, ATS scoring |
| [architecture/04_ai_agents.md](architecture/04_ai_agents.md) | LangGraph pipeline, agent inventory, SSE events, error recovery, resume intelligence |
| [architecture/05_frontend.md](architecture/05_frontend.md) | Routes, components, state/contexts, responsive, perf, UI standards, a11y |
| [architecture/CROSS_ORG_SCHEMA.md](architecture/CROSS_ORG_SCHEMA.md) | Product-level (cross-org) candidate datastore schema design |

### Design — how it looks
| Doc | Contents |
|---|---|
| [design/00_design_system.md](design/00_design_system.md) | Why-redesign rationale, rejected patterns, tokens, typography, primitives, motion |
| [design/pages/](design/pages/) | One spec per surface (19), each with a build-status banner |

### Operations & QA
| Doc | Contents |
|---|---|
| [RLS_ACTIVATION.md](RLS_ACTIVATION.md) | **Live runbook** — RLS is built + tested; this is the dual-pool cutover to turn it on |
| [qa/bug_fixes_log.md](qa/bug_fixes_log.md) | Bug ledger — every fix, chronological |
| [qa/testing_validation_tracker.md](qa/testing_validation_tracker.md) | Validation of bug fixes + JD-chat E2E flow |
| [reviews/](reviews/) | Per-surface code-review findings (19 surfaces + consolidated findings) |
| [integrations/calendar.md](integrations/calendar.md) | Google/Outlook calendar OAuth guide |
| [DEMO_GUIDE.md](DEMO_GUIDE.md) | Demo walkthrough script |

### Archive
[`archive/`](archive/) holds superseded planning docs, kept as dated history: the 2026-06-11 functional
audit (file:line evidence), the v3 redesign tracker, the May-19 tech-debt tracker, and the executed
"missing functionality" implementation plan. Their live content now lives in [STATUS.md](STATUS.md).

---

## Per-page specs (design/pages/)

| # | Surface | # | Surface |
|---|---|---|---|
| 01 | [Dashboard](design/pages/01_dashboard.md) | 11 | [Panel Feedback](design/pages/11_panel_feedback.md) |
| 02 | [Positions List](design/pages/02_positions_list.md) | 12 | [Career Page](design/pages/12_career_page.md) |
| 03 | [Position Detail](design/pages/03_position_detail.md) | 13 | [Status Portal](design/pages/13_status_portal.md) |
| 04 | [Candidate Detail](design/pages/04_candidate_detail.md) | 14 | [Auth](design/pages/14_auth.md) |
| 05 | [JD Chat](design/pages/05_jd_chat.md) | 15 | [Interview Scheduling](design/pages/15_interview_scheduling.md) |
| 06 | [Analytics](design/pages/06_analytics.md) | 16 | [Notifications](design/pages/16_notifications.md) |
| 07 | [Settings](design/pages/07_settings.md) | 17 | [Platform Admin](design/pages/17_platform_admin.md) |
| 08 | [Talent Pool](design/pages/08_talent_pool.md) | 18 | [Dev Console](design/pages/18_dev_console.md) |
| 09 | [Hire Request](design/pages/09_hire_request.md) | 19 | [GDPR / Privacy](design/pages/19_gdpr_privacy.md) |
| 10 | [Apply Chat](design/pages/10_apply_chat.md) | | |
