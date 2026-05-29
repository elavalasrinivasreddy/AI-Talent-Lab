# Build Status — v3 Redesign Tracker

> Single source of truth for "what's redesigned vs not." Last updated 2026-05-29.
> Detail per surface lives in each [`design/pages/NN_*.md`](design/pages/) banner.
> Production hardening (separate axis) is tracked in [`TECH_DEBT.md`](TECH_DEBT.md).

Two axes per surface:
- **Feature** — does it work at all? (Live / Backend-only / Not built)
- **v3 redesign** — rebuilt to the v3 spec? (✅ Done / 🟡 Partial / ❌ Not started)

---

## Headline

**3 of 19 surfaces redesigned to v3.** 16 pending. Most pages are functionally live but
still render the pre-redesign UI.

| | Count |
|---|---|
| ✅ Redesigned (v3) | 3 — Auth, JD Chat, Hire Request |
| ❌ Pending redesign | 16 |

---

## Foundation (cross-cutting)

| Item | Status | Notes |
|---|---|---|
| Phase A — design tokens (`globals.css`) | 🟡 Partial | Teal + Plus Jakarta tokens exist; only `auth.css` + `chat.css` consume them. Other pages still old styling. |
| Phase B — shared atoms `Icon` / `Chip` / `Stat` / `RoleGate` | ❌ Not built | `common/` has Badge, StatusBadge, ScoreCircle, EmptyState, SkeletonCard, NotificationBell only |
| `StatusBadge` remap to v3 palette | 🟡 | Component exists; `constants.js` palette vs design-system palette not reconciled |

---

## Per-surface

| # | Surface | Feature | v3 redesign | Notes |
|---|---|---|---|---|
| 01 | Dashboard | Live | ❌ | Old `DashboardPage`; NOW/NEXT/PULSE lanes not built. Approval/Drafts widgets bolted onto old layout. |
| 02 | Positions List | Live | ❌ | Pipeline Garden cards not built |
| 03 | Position Detail | Live | ❌ | Stack-ranked list (variant B) not built |
| 04 | Candidate Detail | Live | ❌ | Compare-to-ideal overlay not built |
| 05 | **JD Chat** | Live | ✅ | Document-first canvas, 8-stage stepper, inline blocks, interactive refinement shipped |
| 06 | Analytics | Live | ❌ | Old `AnalyticsPage`; Agent ROI dashboard not built |
| 07 | Settings | Live | ❌ | AI Behavior Console (grouped rail) not built |
| 08 | Talent Pool | Live | ❌ | Pool↔Position matrix not built |
| 09 | **Hire Request** | Live | 🟡 | Phase 1 + dept_admin approval shipped. 2-col wizard polish + multi-tier relay deferred |
| 10 | Apply Chat | Live | ❌ | Conversational stepper redesign not built |
| 11 | Panel Feedback | Live | ❌ | Anchored tap-rate redesign not built |
| 12 | Career Page | Live | ❌ | Story + fit-filter redesign not built |
| 13 | Status Portal | Live | ❌ | Transparency-URL redesign not built |
| 14 | **Auth** | Live | ✅ | Teal auth + forgot/reset/set-password shipped |
| 15 | Interview Scheduling | Not built | ❌ | `/interviews` route redirects; redesign re-enables as calendar-first page |
| 16 | Notifications | Live (bell) | ❌ | Right-slide drawer + grouping not built |
| 17 | Platform Admin | Backend-ish | ❌ | Basic `platform` router; control-tower UI not built |
| 18 | Dev Console | Live | ❌ | Exists; visual refresh pending |
| 19 | GDPR / Privacy | Live | ❌ | Pages live in old style |

---

## Suggested redesign order (from design system + highest visible impact)

1. **Phase B atoms first** (`Icon`, `Chip`, `Stat`, `RoleGate`) — everything else depends on them
2. Dashboard (01) — most-seen surface, currently most dated
3. Positions List (02) + Position Detail (03) — the daily work surfaces
4. Candidate Detail (04) — where ATS reasoning should shine
5. Settings (07), Analytics (06), Talent Pool (08)
6. Public surfaces: Apply (10), Panel (11), Career (12), Status (13)
7. Remaining: Interview Scheduling (15), Notifications (16), Platform (17), Dev (18), GDPR (19)
8. Hire Request (09) wizard polish — close the 🟡
