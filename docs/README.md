# AI Talent Lab — Documentation

> ⚠️ **Read first (2026-06-11):** the **functional truth** of what actually works lives in
> [`PRODUCT_STATUS.md`](PRODUCT_STATUS.md), and the **strategic read** (vision, design, gaps,
> alternatives) in [`PRODUCT_ASSESSMENT.md`](PRODUCT_ASSESSMENT.md). Where the product docs below
> say "done / functional end-to-end / production-ready," they mean the **UI/redesign** picture —
> a full code audit found several features wired-looking but silently broken, plus security holes.
> Trust `PRODUCT_STATUS.md` over any green checkmark in `product/*` or `STATUS.md`.

Single home for product, architecture, and design docs. This index is the front door.
Consolidated 2026-05-29 from a sprawl of overlapping files (old `pages/` vs `redesign/`,
two product docs, one 1,700-line backend doc) into the structure below.

> **Conventions**
> - Code is the ultimate source of truth. Where a doc and the code disagree, the code
>   wins — docs note which file is authoritative (e.g. `backend/db/migrations.py` for the
>   schema, `frontend/src/styles/globals.css` for design tokens).
> - Per-page specs in `design/pages/` carry a **Build status** banner and merge the v3
>   redesign spec with the pre-v3 behavioral spec (kept as an appendix).
> - The redesign build status lives in one place: [`STATUS.md`](STATUS.md).

---

## Map

### Product — what we're building and why
| Doc | Contents |
|---|---|
| [product/01_overview.md](product/01_overview.md) | Vision, philosophy, users + roles, end-to-end workflow, status state machine, permissions, invariants |
| [product/02_features.md](product/02_features.md) | Full feature catalog with build status; out-of-scope |
| [product/03_roadmap.md](product/03_roadmap.md) | Validation, competitive landscape, role-based UX ideas, Phase 2/3, compliance, monetization, mobile |

### Architecture — how it's built
| Doc | Contents |
|---|---|
| [architecture/01_stack_structure.md](architecture/01_stack_structure.md) | Tech stack, 3-layer pattern, project structure, config, local dev |
| [architecture/02_data_model.md](architecture/02_data_model.md) | DB entities, status enums, key columns, resume-storage decision |
| [architecture/03_backend.md](architecture/03_backend.md) | 20 routers, error format, magic links, security/RLS, Celery tasks, ATS scoring |
| [architecture/04_ai_agents.md](architecture/04_ai_agents.md) | LangGraph pipeline, agent inventory, SSE events, error recovery, resume intelligence |
| [architecture/05_frontend.md](architecture/05_frontend.md) | Routes, components, state/contexts, responsive, perf, UI standards, a11y |

### Design — how it looks
| Doc | Contents |
|---|---|
| [design/00_design_system.md](design/00_design_system.md) | Why-redesign rationale, rejected patterns, tokens, typography, primitives, motion |
| [design/pages/](design/pages/) | One spec per surface (19), each with a build-status banner |

### Reference
| Doc | Contents |
|---|---|
| [PRODUCT_STATUS.md](PRODUCT_STATUS.md) | **Functional truth tracker** — per feature: built/wired/tested/gaps with file:line. The real "does it work" source. |
| [PRODUCT_ASSESSMENT.md](PRODUCT_ASSESSMENT.md) | **Strategic read** — vision validation, design, gaps, better-than-existing alternatives, what to do next. |
| [STATUS.md](STATUS.md) | Redesign build-status tracker — UI/v3 only, NOT functional status |
| [TECH_DEBT.md](TECH_DEBT.md) | Production hardening tracker |
| [integrations/calendar.md](integrations/calendar.md) | Google/Outlook calendar OAuth guide |

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

---

## What changed in the consolidation

Removed (content merged, recoverable from git history):
`docs/pages/*` and `docs/redesign/*` → merged into `design/`; `PRODUCT_PLAN.md` +
`PRODUCT_IMPROVEMENTS.md` → `product/`; `BACKEND_PLAN.md` + `FRONTEND_PLAN.md` →
`architecture/`; `docs/superpowers/*` scratch plans (superseded by shipped code + STATUS).
`CALENDAR_INTEGRATION_GUIDE.md` → `integrations/calendar.md`. `TECH_DEBT.md` kept as-is.
