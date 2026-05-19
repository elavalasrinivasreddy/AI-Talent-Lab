# Design System — v3 Tokens & Primitives

> Tokens for the v3 redesign. Maps to CSS custom properties in `frontend/src/styles/globals.css`. **No new dependencies** — inline SVG icons, vanilla CSS, no chart library (decision pending).

---

## 1. Color tokens

### Primary — Teal (locked in)

| Token | Value | Use |
|-------|-------|-----|
| `--p` | `#0D9488` | Primary brand · CTAs · active nav · AI/agent affordances |
| `--p-h` | `#0F766E` | Primary hover · gradient mid-stop |
| `--p-a` | `#134E4A` | Primary active · gradient deep-stop |
| `--p-bg` | `rgba(13,148,136,.12)` | Primary tint (chip bg, hover surface) |
| `--p-bd` | `rgba(13,148,136,.30)` | Primary border tint (cards, focus rings) |
| `--p-glow` | `rgba(13,148,136,.18)` | Box-shadow halo (focus, logo) |

**Why teal?** No competitor ATS uses it (Greenhouse=green, Lever=blue-grey, Ashby=dark, indigo `#6366f1` = AI slop). Teal reads as *serious AI infrastructure* — calm, technical, premium. Works in both light and dark modes.

### Pipeline stage palette (from `docs/pages/02_chat.md` + extended)

| Token | Value | Stage |
|-------|-------|-------|
| `--ps-sourced` | `#8B5CF6` (purple) | AI activity — agent-discovered |
| `--ps-emailed` | `#06B6D4` (cyan) | Outreach in flight |
| `--ps-applied` | `#3B82F6` (blue) | Candidate action — they took initiative |
| `--ps-screening` | `var(--p)` (teal) | System reviewing — AI is active |
| `--ps-interview` | `#D97706` (amber) | Humans involved — schedule risk |
| `--ps-selected` | `#10B981` (emerald) | Success |
| `--ps-rejected` | `#64748B` (gray) | Closed |
| `--ps-hold` | `#F59E0B` (amber-orange) | Paused |

### LangGraph stage colors (JD chat)

| Token | Value | Stage |
|-------|-------|-------|
| `--st-intake` | `#3B82F6` | Intake (HARD STOP) |
| `--st-internal` | `#8B5CF6` | Internal Check (SOFT SKIP) |
| `--st-market` | `#06B6D4` | Market Research (SOFT SKIP) |
| `--st-variants` | `#D97706` | JD Variants (HARD STOP) |
| `--st-final` | `#10B981` | Final JD (HARD STOP) |
| `--st-bias` | `#10B981` | Bias Check (SOFT SKIP) |
| `--st-complete` | `#94A3B8` | Complete |

### Semantic colors

| Token | Value | Use |
|-------|-------|-----|
| `--ok` / `--ok-bg` | `#10B981` / `rgba(16,185,129,.12)` | Hired, accepted, healthy, met |
| `--warn` / `--warn-bg` | `#D97706` / `rgba(217,119,6,.12)` | Offer, attention needed, partial |
| `--bad` / `--bad-bg` | `#EF4444` / `rgba(239,68,68,.12)` | Rejected, error, missing |
| `--info` / `--info-bg` | `#3B82F6` / `rgba(59,130,246,.12)` | Interview, neutral signal |

### Surface scale (dark — default)

| Token | Value | Use |
|-------|-------|-----|
| `--bg-0` | `#06080F` | Deepest — page bg |
| `--bg-1` | `#0B0F1A` | Sidebar, control rail, auth pitch |
| `--bg-2` | `#111827` | Card surface |
| `--bg-3` | `#1A2236` | Elevated / chip / input |
| `--bg-4` | `#243049` | Hover state |
| `--bd` | `#1E3047` | Default border |
| `--bd-strong` | `#2C3E5D` | Hovered/focused border |

### Surface scale (light — `[data-theme="light"]`)

| Token | Value |
|-------|-------|
| `--bg-0` | `#F1F5F9` |
| `--bg-1` | `#FFFFFF` |
| `--bg-2` | `#FFFFFF` |
| `--bg-3` | `#F8FAFC` |
| `--bg-4` | `#E2E8F0` |
| `--bd` | `#E2E8F0` |
| `--bd-strong` | `#CBD5E1` |

### Text scale

| Token | Dark | Light | Use |
|-------|------|-------|-----|
| `--tx-0` | `#F8FAFC` | `#0F172A` | Primary text |
| `--tx-1` | `#E2E8F0` | `#1E293B` | Slightly muted |
| `--tx-2` | `#94A3B8` | `#475569` | Secondary / meta |
| `--tx-3` | `#64748B` | `#64748B` | Tertiary / hint |
| `--tx-4` | `#475569` | `#94A3B8` | Disabled / faint |

---

## 2. Typography

### Font stack

```css
--ff: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
--fm: 'JetBrains Mono', ui-monospace, monospace;
```

Plus Jakarta Sans replaces DM Sans. Stronger weight differentiation across 300/400/500/600/700/800. Google Font link in `frontend/index.html`:

```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

### Type scale (used in v3)

| Class / use | Size | Weight | Letter-spacing |
|-------------|------|--------|----------------|
| `.h1` / page titles | 26px | 700 | -0.02em |
| `.h2` / section | 19px | 700 | -0.01em |
| `.h3` / card head | 15px | 700 | 0 |
| Body | 14px | 400 | 0 |
| Body sm | 13px | 400 | 0 |
| `.muted` | 13px | 400 | 0 · `--tx-2` |
| `.tiny` | 11px | 400 | 0 · `--tx-3` |
| `.kicker` (overline) | 10.5px | 700 | 0.08em UPPERCASE · `--tx-3` |
| Numbers (`.num`) | inherits | inherits | `tabular-nums` — for ATS scores, $ values, anything in tables |

---

## 3. Radius & spacing

```css
--r-1: 4px;   --r-2: 8px;   --r-3: 12px;  --r-4: 16px;  --r-5: 20px;  --r-f: 999px;

--s-1: 4px;   --s-2: 8px;   --s-3: 12px;  --s-4: 16px;  --s-5: 20px;  --s-6: 24px;
--s-8: 32px;  --s-10: 40px; --s-12: 48px;
```

8pt spacing system (`--s-2` is the base). Cards use `--r-4` (16px) by default; chips & buttons use `--r-2` (8px); pills use `--r-f`.

---

## 4. Shadows

```css
--sh-1: 0 1px 2px rgba(0,0,0,.4);                            /* subtle */
--sh-2: 0 4px 14px rgba(0,0,0,.35);                          /* card hover */
--sh-3: 0 12px 36px rgba(0,0,0,.45);                         /* modal / hero */
--sh-glow: 0 0 0 1px var(--p-bd), 0 6px 24px var(--p-glow);  /* primary halo */
```

Light mode shadows are softer (lower alpha, no opacity-heavy variants).

---

## 5. Primitive components to build

These are new shared atoms. Build once, use everywhere.

### `<Icon name="..." size={16} />`
Inline-SVG icon set. Names mirror Lucide (e.g. `search`, `bell`, `calendar`, `briefcase`, `users`, `bar-chart`, `settings`, `alert-triangle`, `clock`, `check`, `x`, `play`, `mail`, `phone`, `map-pin`, `linkedin`, `cpu`, `zap`). One file: `frontend/src/components/common/Icon.jsx`.

Replaces emoji icons in:
- `Sidebar.jsx` (✨ 📊 💼 🗃 📈 ⚙ 🛠)
- `AnalyticsPage.jsx` KPIStrip (📋 ⏱ ✅ 🎉)
- `SettingsPage.jsx` tab list (👤 🏢 👥 …)

### `<Chip variant="primary|success|warning|danger|info|neutral" dot={true}>`
Pill-shaped status / tag chip with optional leading dot. Replaces ad-hoc inline-styled spans across the app.

### `<Stat label value delta accent />`
Stat card with left accent bar and delta line. Used in dashboard hero (admin role), analytics KPI strip, position detail stage-strip.

### `<StatusBadge stage="screening" />`
Updated to use the new pipeline stage palette. This component already exists (per CLAUDE.md invariant #7); just remap its colors.

### `<RoleGate role="admin|recruiter|hm|panel|candidate">`
Wraps role-adaptive UI. Renders children only when current user matches. Used heavily on Dashboard and Settings.

---

## 6. Motion

Transitions are short and purposeful:
- `--transition-fast: 120ms ease` (color/border change on hover)
- `--transition-base: 200ms ease` (panel reveal, tab switch)
- `--transition-slow: 350ms ease` (modal entrance, page fade-in)

No bouncy spring physics. No decorative animation. The only animated thing in v3 by default is:
- Streaming cursor on final JD generation (blinking caret)
- Pulsing dot on Apply chat current-step indicator
- AI Copilot suggestions slide-in on first render

---

## 7. Implementation order (this doc → real code)

1. Update `globals.css` with all the tokens above. Keep the old `--color-*` aliases pointing to new tokens for one release to avoid breaking unrelated callers.
2. Update `index.html` with the new font link.
3. Build `Icon.jsx` + `Chip.jsx` + `Stat.jsx` + `RoleGate.jsx`.
4. Refactor `StatusBadge.jsx` to new stage palette.
5. Then proceed page-by-page per `README.md` build order.

---

## 8. What we explicitly avoid

- **No new color outside the palette.** If a UI element needs a color, it picks from the tokens above. No ad-hoc hex anywhere except inline status illustrations.
- **No emoji icons in product UI.** Emoji is fine in user content (greetings, panel-feedback anchor glyphs intentionally use emoji as quick visual anchors), never as primary navigation/status icons.
- **No box-shadow halos on every card.** Shadows are reserved for elevation (modals, hovered cards). Default cards are border + bg, no shadow.
- **No gradient overuse.** Gradients are used sparingly: auth pitch panel, dashboard NOW/NEXT/PULSE lane backgrounds (subtle), CTA buttons in candidate-facing pages. Recruiter-side product UI is mostly flat.
- **No "AI slop" defaults** — no random sparkles, no rainbow gradients, no "Ask AI ✨" buttons everywhere. AI affordances are intentional and quiet.
