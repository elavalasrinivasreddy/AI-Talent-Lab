# AI Talent Lab — Redesign Spec (v3)

> **Status:** Pattern-level approved · awaiting build sign-off
> **Source preview:** `/tmp/atl-design-preview-v3.html` (open in browser)
> **Date:** 2026-05-18
> **What this is:** The build spec for the v3 UI redesign. One doc per page. Use this when implementing in real code.

---

## Why a redesign (not a recolor)

The first attempt at "redesign" was a paint job — same kanban, same funnel, same KPI strip, same horizontal Settings tabs, in new colors. The user explicitly rejected it: *"you always taking existing UI as reference due to this the redesigned UI is looking old one like kanban, funnel, etc."*

This redesign starts from the **backend reality** of AI Talent Lab — what the product actually does that no generic ATS does — and asks: *what UX pattern would surface this best?*

### Six unique product moments that shaped every page

1. **LangGraph state machine for JD generation** — 8 stages with HARD STOP vs SOFT SKIP behavior. Cards (Internal Check, Market Research, Variants, Bias) are first-class blocks, not chat bubbles.
2. **Two-step ATS scoring with reasoning** — `emb×0.4 + skills×0.4 + exp×0.2 × 100`. The breakdown is the value, not the number.
3. **AI sourcing agent (Celery, every 24h)** — pipeline distinguishes AI-sourced from human-added at every stage.
4. **Magic-link panel feedback** — unauthenticated, mobile, single-submit, 4-weighted-dimension scorecard.
5. **Conversational apply** — 8-step linear wizard (not a free-form chat).
6. **Settings = AI policy editor** — ATS thresholds, sourcing schedules, scorecard rubrics. Settings configure what agents do on your behalf.

---

## Approved pattern picks (locked in)

### Authenticated app surfaces

| Page | Pattern | Variant | Doc |
|------|---------|---------|-----|
| Dashboard | Today's Briefing (NOW/NEXT/PULSE lanes) | A | [01_dashboard.md](01_dashboard.md) |
| Positions list | Pipeline Garden cards | A | [02_positions_list.md](02_positions_list.md) |
| Position Detail | Stack-ranked list per stage | **B** | [03_position_detail.md](03_position_detail.md) |
| Candidate Detail | Compare-to-ideal overlay | **B** | [04_candidate_detail.md](04_candidate_detail.md) |
| JD Chat | Document-first canvas | **B** | [05_jd_chat.md](05_jd_chat.md) |
| Analytics | Agent ROI Dashboard | A | [06_analytics.md](06_analytics.md) |
| Settings | AI Behavior Console | A | [07_settings.md](07_settings.md) |
| Talent Pool | Pool ↔ Position matrix | A | [08_talent_pool.md](08_talent_pool.md) |
| Hire Request | 5-step relay workflow | A | [09_hire_request.md](09_hire_request.md) |
| Interview Scheduling | Calendar-first dashboard + modal | A | [15_interview_scheduling.md](15_interview_scheduling.md) |
| Notifications | Right-slide drawer + grouped rows | A | [16_notifications.md](16_notifications.md) |

### Public / candidate / external surfaces

| Page | Pattern | Variant | Doc |
|------|---------|---------|-----|
| Apply Chat | Conversational stepper | A | [10_apply_chat.md](10_apply_chat.md) |
| Panel Feedback | Anchored tap-rate | A | [11_panel_feedback.md](11_panel_feedback.md) |
| Career page | Story + interactive fit filter | A | [12_career_page.md](12_career_page.md) |
| Status portal | Permanent transparency URL | A | [13_status_portal.md](13_status_portal.md) |
| Auth | Magic-link-first | A | [14_auth.md](14_auth.md) |
| GDPR / Privacy | Trust-led one-page | A | [19_gdpr_privacy.md](19_gdpr_privacy.md) |

### Internal / operator surfaces

| Page | Pattern | Variant | Doc |
|------|---------|---------|-----|
| Platform admin | Cross-org control tower | A | [17_platform_admin.md](17_platform_admin.md) |
| Dev console | Multi-org developer admin · dev-mode only | A | [18_dev_console.md](18_dev_console.md) |

**Design system:** [00_design_system.md](00_design_system.md) — tokens, typography, primitives.

---

## Patterns explicitly rejected (do not reintroduce)

| Rejected pattern | Why | Replaced by |
|------------------|-----|-------------|
| Kanban for pipeline | Hides time-in-stage, ATS confidence, AI vs human source. Card sizes lie. | Stack-ranked list (B) with stage-health header |
| Horizontal funnel bars as analytics centerpiece | Generic ATS · doesn't reveal AI agent contribution | Side-by-side AI funnel vs human-added funnel, plus "where humans override" override-list |
| 4-card KPI strip with emoji icons | Every dashboard looks like this · count without action context | NOW/NEXT/PULSE lanes — counts inline in actionable rows |
| Horizontal tab Settings (11+ tabs) | Cramped, no taxonomy of WHAT the settings do | Purpose-grouped left rail with live preview pane |
| Single-column scrolling candidate detail | Wastes right rail · ATS reasoning hidden behind tab clicks | Compare-to-ideal grid (JD spec ⇔ candidate evidence side-by-side) |
| Chat bubbles for JD generation | Buries the LangGraph state machine · variant selection awkward in bubbles | Document-first canvas with inline agent blocks + supplementary chat rail |
| Emoji as primary icons | "AI slop" aesthetic | Inline SVG (Lucide-style strokes) for product UI · emoji only in user content (status portal greetings, role flair) |

---

## Build order (when this gets implemented)

Phase A — **Design tokens** (lowest risk, highest visual impact):
1. `frontend/index.html` — swap DM Sans → Plus Jakarta Sans Google Font link
2. `frontend/src/styles/globals.css` — replace indigo tokens with teal palette; add stage-color tokens; add `--bg-0/1/2/3/4` and `--tx-0/1/2/3/4` semantic scales; add semantic colors (`--ok`, `--warn`, `--bad`, `--info`)

Phase B — **Shared atoms** (new building blocks):
3. Create `frontend/src/components/common/Icon.jsx` — inline-SVG icon set (replace all emoji-icon usage in Sidebar, AnalyticsPage KPIStrip, SettingsPage tabs)
4. Create `frontend/src/components/common/Chip.jsx` — variants (primary / success / warning / danger / info / neutral)
5. Create `frontend/src/components/common/Stat.jsx` — left-accent stat card with delta
6. Refactor existing `StatusBadge.jsx` to use new stage palette

Phase C — **Page-by-page redesign** (each is independent):
7. Dashboard → see `01_dashboard.md`
8. Positions list → `02_positions_list.md`
9. Position Detail (pipeline tab redesign) → `03_position_detail.md`
10. Candidate Detail → `04_candidate_detail.md`
11. JD Chat → `05_jd_chat.md` *(biggest architectural change)*
12. Analytics → `06_analytics.md`
13. Settings → `07_settings.md`
14. Talent Pool → `08_talent_pool.md`
15. Hire Request workflow → `09_hire_request.md` *(new page, not currently in router)*
16. Apply Chat → `10_apply_chat.md`
17. Panel Feedback → `11_panel_feedback.md`
18. Career page → `12_career_page.md`
19. Status portal → `13_status_portal.md`
20. Auth → `14_auth.md`
21. Interview Scheduling → `15_interview_scheduling.md` *(also re-enables `/interviews` route)*
22. Notifications drawer + history page → `16_notifications.md`
23. Platform admin → `17_platform_admin.md` *(platform_admin role)*
24. Dev console → `18_dev_console.md` *(refactor visual treatment)*
25. GDPR / Privacy → `19_gdpr_privacy.md`

Phase D — **Documentation sync** (after build):
21. Update `docs/pages/*.md` to match v3 (or deprecate them, pointing here)
22. Update `docs/PRODUCT_PLAN.md` v2.3 with redesign summary
23. Update `docs/FRONTEND_PLAN.md` §2 with new token system
24. Update `CLAUDE.md` invariants if any new ones emerge (e.g. "all stat cards use `<Stat>` component, never inline styles")

---

## How to read each page doc

Each `docs/redesign/NN_<page>.md` contains:

1. **Pattern name + variant (A/B) + what it replaces.**
2. **Backend tie-in** — which routers, services, agents, DB columns the UI reads/writes. Often references existing memory files in `~/.claude/.../memory/` and the existing `docs/pages/` for context.
3. **Layout sketch** (ASCII) — the structure to build.
4. **Component breakdown** — concrete React components to add or refactor.
5. **State & interactions** — what changes when, including SSE events for JD chat.
6. **Role-adaptive behavior** if applicable.
7. **Empty / loading / error states.**
8. **API endpoints used.**
9. **Build notes** — exact file paths in `frontend/src/` to create or modify, with line-level guidance where useful.

---

## Open questions for the user (before build starts)

- Should we install **lucide-react** as the icon library, or inline SVGs in a single `Icon.jsx` component? (Inline SVG is what preview v3 uses; lucide adds a dep but is cleaner long-term.)
- Should we install **Recharts** for Analytics charts, or keep custom SVG-on-the-fly? (Preview v3 uses inline SVG everywhere; Recharts gives interactivity for free but adds a dep.)
- Hire Request page (`09_hire_request.md`) is **new** — not in current router. Should the build add it now or treat as Phase 2?
- Status portal redesign — should we extend the existing `CandidateStatusPage` or treat the v3 design as a separate brand surface?
- Interview Scheduling (`15_interview_scheduling.md`) — the `/interviews` route currently redirects. Re-enable as a calendar-first page now, or after real Google Calendar OAuth lands in Phase 2?
- Notifications grouping (`16_notifications.md`) — add `group_key` column to `notifications` table now or after the bell-drawer ships ungrouped?
- Platform admin (`17_platform_admin.md`) is mostly green-field. Build now or after MVP customer count justifies it?

These are the design-affecting choices; everything else is implementation detail.

## What's covered (full router inventory)

Every authenticated, public, and operator route in `frontend/src/router.jsx` now has a redesign doc:

| Route | Doc |
|---|---|
| `/login`, `/register` | `14_auth.md` |
| `/chat`, `/chat/:sessionId` | `05_jd_chat.md` |
| `/dashboard` | `01_dashboard.md` |
| `/positions`, `/positions/:id`, `/positions/:id/:tab` | `02_positions_list.md` + `03_position_detail.md` |
| `/candidates/:id` | `04_candidate_detail.md` |
| `/talent-pool` | `08_talent_pool.md` |
| `/interviews` (currently redirect → re-enable as real page) | `15_interview_scheduling.md` |
| `/settings`, `/settings/:tab` | `07_settings.md` |
| `/analytics` | `06_analytics.md` |
| `/platform` (platform_admin) | `17_platform_admin.md` |
| `/dev` | `18_dev_console.md` |
| `/apply/:token` | `10_apply_chat.md` |
| `/panel/:token` | `11_panel_feedback.md` |
| `/careers/:orgSlug`, `/careers/:orgSlug/:positionId` | `12_career_page.md` |
| `/delete-my-data`, `/privacy` | `19_gdpr_privacy.md` |
| `/status/:token` | `13_status_portal.md` |
| *New route* `/hire-requests` (Phase 2) | `09_hire_request.md` |
| *Global surface* topbar notification drawer | `16_notifications.md` |
