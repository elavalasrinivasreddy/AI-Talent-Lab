# Build Status — v3 Redesign Tracker

> Single source of truth for "what's redesigned vs not." Last updated 2026-05-30.
> Detail per surface lives in each [`design/pages/NN_*.md`](design/pages/) banner.
> Production hardening tracked in [`TECH_DEBT.md`](TECH_DEBT.md).
> Code review findings at [`review/code_review_findings.md`](review/code_review_findings.md).

Two axes per surface:
- **Feature** — does it work at all? (Live / Backend-only / Not built)
- **v3 redesign** — rebuilt to the v3 spec? (✅ Done / 🟡 Partial / ❌ Not started)

---

## Headline

**19 of 19 surfaces redesigned to v3.** All surfaces are functionally live.

| | Count |
|---|---|
| ✅ Redesigned (v3) | 19 |
| 🟡 Partial | 0 |
| ❌ Not started | 0 |

**Code review:** Opus 4.8 multi-angle review completed 2026-05-30.
All 10 critical/high/medium bugs fixed (16 commits on this branch).

---

## Foundation (cross-cutting)

| Item | Status | Notes |
|---|---|---|
| Phase A — design tokens (`globals.css`) | ✅ | Teal `#0D9488` + Plus Jakarta Sans tokens; all v3 pages consume via `var(--color-*)` |
| Phase B — shared atoms `Icon` / `Chip` / `Stat` / `RoleGate` | ✅ | Adopted across all redesigned surfaces |
| `StatusBadge` remap to v3 palette | 🟡 | Component exists; `constants.js` palette vs design-system palette not fully reconciled |
| Role gates in router | ✅ | `/chat` (hr+org_head), `/analytics` (org_head+dept_admin+platform_admin) gated via `RoleGuard` |

---

## Per-surface

| # | Surface | Feature | v3 redesign | Notes |
|---|---|---|---|---|
| 01 | Dashboard | Live | ✅ | NOW/NEXT/PULSE lanes, role-adaptive content, copilot bar. Legacy behind `?legacy_dashboard=1`. DeptChipBar dept filter wired end-to-end. |
| 02 | Positions List | Live | ✅ | Pipeline Garden cards, sparkline, stage strip per card. |
| 03 | Position Detail | Live | ✅ | PositionHero, StageStatStrip, StageHealthHeader, PipelineStackView, CandidateRankedRow. Settings tab gated to hr+org_head. |
| 04 | Candidate Detail | Live | ✅ | CandidateHero, CompareToIdealGrid, ScoreBreakdownBand, TagsRow. All score/timeline/notes tabs live. |
| 05 | **JD Chat** | Live | ✅ | Document-first canvas, 8-stage stepper, inline blocks, interactive refinement, retry, save-as-draft. |
| 06 | Analytics | Live | ✅ | Funnel, source breakdown, weekly velocity, time-to-hire. Backend response keys aligned with frontend (was showing zeros). |
| 07 | Settings | Live | ✅ | AI Behavior Console, 4-group rail, adminOnly items hidden for non-admin roles, SettingsLivePreview. Phase 2 tabs are placeholders. |
| 08 | Talent Pool | Live | ✅ | Score matrix, bulk add-to-position, contact status toggle, search+filter. |
| 09 | **Hire Request** | Live | ✅ | Full CRUD, dept_admin approval workflow, relay visualization, 4 email touchpoints. |
| 10 | Apply Chat | Live | ✅ | v3 teal tokens, multi-step chat flow (greeting→consent→interest→…), session persistence, mobile-first. |
| 11 | Panel Feedback | Live | ✅ | Anchored tap-rate buttons, single-use enforcement, thank-you state, mobile 44px targets. |
| 12 | Career Page | Live | ✅ | v3 teal gradient, department grouping, work-type filter, department-grouped position cards. |
| 13 | Status Portal | Live | ✅ | v3 teal tokens, progress step strip with active/current states, interview schedule, timeline. |
| 14 | **Auth** | Live | ✅ | Teal auth, forgot/reset/set-password, magic-link sign-in, sessionStorage persistence. |
| 15 | Interviews | Live | ✅ | Day selector strip, time-grouped timeline, skeleton loading, status chips. |
| 16 | Notifications | Live | ✅ | Bell dropdown, unread count badge, mark-all-read, action links, 30s polling. |
| 17 | Platform Admin | Live | ✅ | v3 tokens, tabbed interface (overview/orgs/activity), stats cards, org list, activity feed. |
| 18 | Dev Console | Live | ✅ | v3 tokens throughout (teal active tab, `--color-*` vars). Tabbed interface: overview, users, sessions, reset, log. |
| 19 | GDPR / Privacy | Live | ✅ | v3 tokens throughout. Multi-step deletion flow (form→sent→verifying→done), rate-limited, table coverage complete, atomic transaction. |

---

## Post-v3 enhancements (all optional, none blocking)

All 19 surfaces are v3. Items below are incremental improvements beyond the current spec.

| Item | Priority | Notes |
|---|---|---|
| Apply Chat richer stepper UX | LOW | Current multi-step chat flow works; spec envisions a more visual progress stepper |
| Career page job-fit filter | LOW | Department + work-type filters live; AI fit-score filtering not yet built |
| Status portal transparency URL | LOW | Progress strip live; shareable public URL for candidates not yet wired |
| Platform Admin org management UI | LOW | Stats/orgs/activity tabs live; bulk ops and org detail views not yet built |
| StatusBadge palette reconciliation | LOW | `constants.js` palette vs design-system `var(--color-*)` tokens |
| Notification drawer (right-slide) | LOW | Bell dropdown live; animated right-slide drawer + grouping deferred |
| C-MIG-04: AI behavior settings DB storage | LOW | Settings reset on restart; needs `org_settings` DB persistence |
| C-APPLY-01: session persistence warning | LOW | Backend SSE change needed to emit warning when session can't be saved |
