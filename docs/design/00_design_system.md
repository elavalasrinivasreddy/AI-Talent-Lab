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
| `--color-primary` | `#0D9488` | Brand · CTAs · active nav · AI affordances |
| `--color-primary-hover` | `#0F766E` | Hover · gradient mid |
| `--color-primary-active` | `#134E4A` | Active · gradient deep |
| `--color-primary-bg` | `rgba(13,148,136,.12)` | Tint (chip bg, hover) |
| `--color-primary-soft` | `rgba(13,148,136,.18)` | Soft fill / subtle highlight |
| `--color-primary-border` | `rgba(13,148,136,.30)` | Border tint, focus rings |

> The primary halo is the shadow token `--shadow-glow-primary` (see §4).

No competitor ATS uses teal (Greenhouse green, Lever blue-grey, Ashby dark, indigo
`#6366f1` = AI slop). Reads as serious AI infrastructure; works dark + light.

### Pipeline stage palette

| Token | Value | Stage |
|---|---|---|
| `--color-stage-sourced` | `#8B5CF6` purple | AI activity |
| `--color-stage-emailed` | `#06B6D4` cyan | Outreach in flight |
| `--color-stage-applied` | `#3B82F6` blue | Candidate action |
| `--color-stage-screening` | `var(--color-primary)` teal | System reviewing |
| `--color-stage-interview` | `#D97706` amber | Humans involved |
| `--color-stage-offer` | (see `globals.css`) | Offer extended |
| `--color-stage-selected` | `#10B981` emerald | Success |
| `--color-stage-rejected` | `#64748B` gray | Closed |

> `globals.css` defines `--color-stage-{sourced,emailed,applied,screening,interview,offer,selected,rejected}`.
> There is **no** `--color-stage-hold` token — the on-hold state is styled via the warning palette (`--color-warning`).

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

> These LangGraph stage colors are **not** defined as CSS custom properties in `globals.css`;
> they live inline / in component constants. Names above are the doc's logical labels, not CSS tokens.

### Semantic

| Token | Value | Use |
|---|---|---|
| `--color-success` / `--color-success-bg` | `#10B981` / `rgba(16,185,129,.12)` | Hired, healthy |
| `--color-warning` / `--color-warning-bg` | `#D97706` / `rgba(217,119,6,.12)` | Attention |
| `--color-danger` / `--color-danger-bg` | `#EF4444` / `rgba(239,68,68,.12)` | Error, missing |
| `--color-info` / `--color-info-bg` | `#3B82F6` / `rgba(59,130,246,.12)` | Neutral signal |

### Surface scale (dark default / light `[data-theme="light"]`)

| Token | Dark | Light | Use |
|---|---|---|---|
| `--color-bg-primary` | `#06080F` | `#F1F5F9` | Page bg |
| `--color-bg-secondary` | `#0B0F1A` | `#FFFFFF` | Sidebar, rail |
| `--color-bg-card` | `#111827` | `#FFFFFF` | Card |
| `--color-bg-elevated` | `#1A2236` | `#F8FAFC` | Elevated |
| `--color-bg-input` | `#1A2236` | `#F8FAFC` | Form inputs |
| `--color-bg-hover` | `#243049` | `#E2E8F0` | Hover |
| `--color-border` | `#1E3047` | `#E2E8F0` | Border |
| `--color-border-strong` | `#2C3E5D` | `#CBD5E1` | Hover/focus border |

> Also in `globals.css`: `--color-bg-tertiary`, `--color-bg-active`, `--color-bg-overlay`,
> `--color-border-light`, `--color-border-focus`. Exact values: `globals.css` is the source of truth.

### Text scale

| Token | Dark | Light | Use |
|---|---|---|---|
| `--color-text-primary` | `#F8FAFC` | `#0F172A` | Primary text |
| `--color-text-secondary` | `#94A3B8` | `#475569` | Secondary / meta |
| `--color-text-tertiary` | `#64748B` | `#64748B` | Tertiary / hint |
| `--color-text-muted` | `#475569` | `#94A3B8` | Muted / disabled |
| `--color-text-inverse` | — | — | Text on primary/colored fills |

---

## 2. Typography

```css
--font-primary: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono:    'JetBrains Mono', ui-monospace, monospace;
```

Google Fonts link in `frontend/index.html` (weights 300–800 + mono 400–600).

`globals.css` also exposes the scale as tokens — prefer these over hard-coded values:
`--font-size-{xs,sm,base,md,lg,xl,2xl,3xl}`, `--font-weight-{light,regular,medium,semibold,bold,extrabold}`,
`--line-height-{tight,normal,relaxed}`.

| Use | Size | Weight | Tracking |
|---|---|---|---|
| `.h1` page title | 26px | 700 | -0.02em |
| `.h2` section | 19px | 700 | -0.01em |
| `.h3` card head | 15px | 700 | 0 |
| Body | 14px | 400 | 0 |
| Body sm | 13px | 400 | 0 |
| `.muted` | 13px | 400 | `--color-text-secondary` |
| `.tiny` | 11px | 400 | `--color-text-tertiary` |
| `.kicker` overline | 10.5px | 700 | 0.08em UPPER · `--color-text-tertiary` |
| `.num` | inherit | inherit | `tabular-nums` for scores/$ |

---

## 3. Radius & spacing

```css
--radius-sm:4px --radius-md:8px --radius-lg:12px --radius-xl:16px --radius-2xl:20px --radius-full:999px
--space-1:4px --space-2:8px --space-3:12px --space-4:16px --space-5:20px --space-6:24px --space-8:32px --space-10:40px --space-12:48px --space-16:64px
```

8pt system (`--space-2` base). Cards `--radius-xl`; chips/buttons `--radius-md`; pills `--radius-full`.

## 4. Shadows

```css
--shadow-sm: 0 1px 2px rgba(0,0,0,.4);                                               /* subtle */
--shadow-md: 0 4px 14px rgba(0,0,0,.35);                                             /* card / card hover */
--shadow-lg: 0 12px 36px rgba(0,0,0,.45);                                            /* modal/hero */
--shadow-glow-primary: 0 0 0 1px var(--color-primary-border), 0 6px 24px var(--color-primary-soft); /* primary halo */
```

(`globals.css` also defines `--shadow-card` for the default card elevation.)

Light-mode shadows are softer. Default cards are border + bg, no shadow.

---

## 5. Primitive components to build

Shared atoms — build once, use everywhere. **Status:** `StatusBadge`, `Badge`,
`ScoreCircle`, `EmptyState`, `SkeletonCard`, `NotificationBell`, **and now
`Icon` / `Chip` / `Stat` / `RoleGate`** all exist in `components/common/` (Phase B
landed 2026-05-29).

> **Token reconciliation — done 2026-06-13 (Sprint 4 / D1):** this doc now uses the real
> `globals.css` names (`--color-primary`, `--color-bg-*`, `--color-text-*`, `--color-stage-*`,
> `--space-*`, `--radius-*`, `--shadow-*`). The short v3 aliases (`--p`, `--bg-2`, `--tx-0`,
> `--ps-*`, `--r-*`, `--s-*`, `--sh-*`) were **never** added to `globals.css` and should not
> be used — write components against the `--color-*` / `--space-*` / `--radius-*` tokens above.
> `globals.css` remains the source of truth for exact values.

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
