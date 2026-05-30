# Design System — v3 Tokens, Primitives & Philosophy

> Part of the consolidated docs. Start at [`docs/README.md`](../README.md) for the map.
> Per-page specs: [`pages/`](pages/). Build status: [`../STATUS.md`](../STATUS.md).
> Maps to CSS custom properties in `frontend/src/styles/globals.css` (source of truth).
> No new dependencies — inline SVG icons, vanilla CSS, no chart library.

---

## 0. Why a redesign (not a recolor)

The first "redesign" was a paint job — same kanban, same funnel, same KPI strip in new
colors. The user rejected it: *"you always take existing UI as reference, so the
redesigned UI looks like the old one — kanban, funnel, etc."* v3 starts from **backend
reality** — what the product does that no generic ATS does — and picks the UX pattern
that surfaces it.

### Six product moments that shaped every page

1. **LangGraph JD state machine** — 8 stages, HARD STOP vs SOFT SKIP. Agent outputs are
   first-class blocks, not chat bubbles.
2. **Two-step ATS scoring with reasoning** — the breakdown is the value, not the number.
3. **AI sourcing agent (Celery, 24h)** — distinguishes AI-sourced from human-added at
   every stage.
4. **Magic-link panel feedback** — unauthenticated, mobile, single-submit, weighted
   scorecard.
5. **Conversational apply** — linear 8-step wizard, not free-form chat.
6. **Settings = AI policy editor** — thresholds, sourcing schedules, scorecard rubrics.

### Patterns explicitly rejected (do not reintroduce)

| Rejected | Why | Replaced by |
|---|---|---|
| Kanban for pipeline | Hides time-in-stage, ATS confidence, AI-vs-human source | Stack-ranked list (B) with stage-health header |
| Horizontal funnel as analytics centerpiece | Generic; hides AI contribution | AI funnel vs human-added funnel + override list |
| 4-card KPI strip with emoji | Every dashboard looks like this | NOW/NEXT/PULSE lanes, counts inline in actionable rows |
| Horizontal-tab Settings (11+ tabs) | Cramped, no taxonomy | Purpose-grouped left rail + live preview |
| Single-column candidate detail | Wastes right rail, hides ATS reasoning | Compare-to-ideal grid (JD spec ⇔ candidate evidence) |
| Chat bubbles for JD generation | Buries the state machine | Document-first canvas + inline agent blocks + chat rail |
| Emoji as primary icons | AI-slop aesthetic | Inline SVG; emoji only in user content |

---

## 1. Color tokens

### Primary — Teal (locked)

| Token | Value | Use |
|---|---|---|
| `--p` | `#0D9488` | Brand · CTAs · active nav · AI affordances |
| `--p-h` | `#0F766E` | Hover · gradient mid |
| `--p-a` | `#134E4A` | Active · gradient deep |
| `--p-bg` | `rgba(13,148,136,.12)` | Tint (chip bg, hover) |
| `--p-bd` | `rgba(13,148,136,.30)` | Border tint, focus rings |
| `--p-glow` | `rgba(13,148,136,.18)` | Box-shadow halo |

No competitor ATS uses teal (Greenhouse green, Lever blue-grey, Ashby dark, indigo
`#6366f1` = AI slop). Reads as serious AI infrastructure; works dark + light.

### Pipeline stage palette

| Token | Value | Stage |
|---|---|---|
| `--ps-sourced` | `#8B5CF6` purple | AI activity |
| `--ps-emailed` | `#06B6D4` cyan | Outreach in flight |
| `--ps-applied` | `#3B82F6` blue | Candidate action |
| `--ps-screening` | `var(--p)` teal | System reviewing |
| `--ps-interview` | `#D97706` amber | Humans involved |
| `--ps-selected` | `#10B981` emerald | Success |
| `--ps-rejected` | `#64748B` gray | Closed |
| `--ps-hold` | `#F59E0B` amber-orange | Paused |

> Note: this palette differs slightly from the older `constants.js` values in
> `frontend/src/utils/constants.js`. `constants.js` is the runtime source of truth for
> `PIPELINE_STAGES`; reconcile to these tokens when the page redesigns land.

### LangGraph stage colors (JD chat)

| Token | Value | Stage |
|---|---|---|
| `--st-intake` | `#3B82F6` | Intake (HARD STOP) |
| `--st-internal` | `#8B5CF6` | Internal Check (SOFT SKIP) |
| `--st-market` | `#06B6D4` | Market Research (SOFT SKIP) |
| `--st-variants` | `#D97706` | JD Variants (HARD STOP) |
| `--st-final` | `#10B981` | Final JD (HARD STOP) |
| `--st-bias` | `#10B981` | Bias Check (SOFT SKIP) |
| `--st-complete` | `#94A3B8` | Complete |

### Semantic

| Token | Value | Use |
|---|---|---|
| `--ok` / `--ok-bg` | `#10B981` / `rgba(16,185,129,.12)` | Hired, healthy |
| `--warn` / `--warn-bg` | `#D97706` / `rgba(217,119,6,.12)` | Attention |
| `--bad` / `--bad-bg` | `#EF4444` / `rgba(239,68,68,.12)` | Error, missing |
| `--info` / `--info-bg` | `#3B82F6` / `rgba(59,130,246,.12)` | Neutral signal |

### Surface scale (dark default / light `[data-theme="light"]`)

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg-0` | `#06080F` | `#F1F5F9` | Page bg |
| `--bg-1` | `#0B0F1A` | `#FFFFFF` | Sidebar, rail |
| `--bg-2` | `#111827` | `#FFFFFF` | Card |
| `--bg-3` | `#1A2236` | `#F8FAFC` | Elevated/input |
| `--bg-4` | `#243049` | `#E2E8F0` | Hover |
| `--bd` | `#1E3047` | `#E2E8F0` | Border |
| `--bd-strong` | `#2C3E5D` | `#CBD5E1` | Hover/focus border |

### Text scale

| Token | Dark | Light | Use |
|---|---|---|---|
| `--tx-0` | `#F8FAFC` | `#0F172A` | Primary |
| `--tx-1` | `#E2E8F0` | `#1E293B` | Slightly muted |
| `--tx-2` | `#94A3B8` | `#475569` | Secondary/meta |
| `--tx-3` | `#64748B` | `#64748B` | Tertiary/hint |
| `--tx-4` | `#475569` | `#94A3B8` | Disabled |

---

## 2. Typography

```css
--ff: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
--fm: 'JetBrains Mono', ui-monospace, monospace;
```

Google Fonts link in `frontend/index.html` (weights 300–800 + mono 400–600).

| Use | Size | Weight | Tracking |
|---|---|---|---|
| `.h1` page title | 26px | 700 | -0.02em |
| `.h2` section | 19px | 700 | -0.01em |
| `.h3` card head | 15px | 700 | 0 |
| Body | 14px | 400 | 0 |
| Body sm | 13px | 400 | 0 |
| `.muted` | 13px | 400 | `--tx-2` |
| `.tiny` | 11px | 400 | `--tx-3` |
| `.kicker` overline | 10.5px | 700 | 0.08em UPPER · `--tx-3` |
| `.num` | inherit | inherit | `tabular-nums` for scores/$ |

---

## 3. Radius & spacing

```css
--r-1:4px --r-2:8px --r-3:12px --r-4:16px --r-5:20px --r-f:999px
--s-1:4px --s-2:8px --s-3:12px --s-4:16px --s-5:20px --s-6:24px --s-8:32px --s-10:40px --s-12:48px
```

8pt system (`--s-2` base). Cards `--r-4`; chips/buttons `--r-2`; pills `--r-f`.

## 4. Shadows

```css
--sh-1: 0 1px 2px rgba(0,0,0,.4);                            /* subtle */
--sh-2: 0 4px 14px rgba(0,0,0,.35);                          /* card hover */
--sh-3: 0 12px 36px rgba(0,0,0,.45);                         /* modal/hero */
--sh-glow: 0 0 0 1px var(--p-bd), 0 6px 24px var(--p-glow);  /* primary halo */
```

Light-mode shadows are softer. Default cards are border + bg, no shadow.

---

## 5. Primitive components to build

Shared atoms — build once, use everywhere. **Status:** `StatusBadge`, `Badge`,
`ScoreCircle`, `EmptyState`, `SkeletonCard`, `NotificationBell`, **and now
`Icon` / `Chip` / `Stat` / `RoleGate`** all exist in `components/common/` (Phase B
landed 2026-05-29).

> **Token reconciliation (important for page work):** `globals.css` currently defines
> the v2.2 names (`--color-primary`, `--color-bg-card`, `--color-text-*`, `--space-*`,
> `--radius-*`), NOT the short v3 names in this doc (`--p`, `--bg-2`, `--tx-0`). The new
> atoms reference the real `--color-*` tokens with hex fallbacks. When you do a full
> token pass, either add the short aliases to `globals.css` or update this doc to the
> `--color-*` names — don't write components against `--p` until it exists.

- `<Icon name size />` — inline-SVG set (Lucide names). Replaces emoji icons in Sidebar,
  AnalyticsPage KPIStrip, SettingsPage tabs. File: `components/common/Icon.jsx`.
- `<Chip variant="primary|success|warning|danger|info|neutral" dot />` — pill status/tag.
- `<Stat label value delta accent />` — left-accent stat card with delta.
- `<StatusBadge stage />` — exists; remap to the pipeline palette above.
- `<RoleGate role="org_head|dept_admin|hr|team_lead|panel|candidate">` — renders children
  only for matching role. (Role names updated from the old admin/recruiter/hm set.)

---

## 6. Motion

```css
--transition-fast: 120ms ease   /* hover color/border */
--transition-base: 200ms ease   /* panel reveal, tab switch */
--transition-slow: 350ms ease   /* modal/page fade */
```

No spring physics, no decorative animation. Only animated by default: streaming caret on
final JD, pulsing dot on apply-chat current step, copilot suggestions slide-in once.

---

## 7. What we avoid

- No color outside the palette (status illustrations excepted).
- No emoji icons in product UI (emoji OK in user content + panel-feedback anchors).
- No box-shadow halos on every card — shadows reserved for elevation.
- No gradient overuse — sparingly on auth pitch, dashboard lanes, candidate-facing CTAs.
- No "AI slop" — no sparkles, rainbow gradients, "Ask AI ✨" everywhere. AI affordances
  are intentional and quiet.
