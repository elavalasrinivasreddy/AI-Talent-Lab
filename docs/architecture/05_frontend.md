# Architecture: Frontend

> Part of the consolidated docs. Start at [`docs/README.md`](../README.md) for the map.
> Design tokens + visual system: [`design/00_design_system.md`](../design/00_design_system.md).
> Per-page specs + build status: [`design/pages/`](../design/pages/) and [`STATUS.md`](../STATUS.md).

Stack: React 18 + Vite 5, vanilla CSS custom properties, React Router v6, Context API,
axios (REST) + native Fetch (SSE), react-markdown + remark-gfm, inline Lucide-style SVG,
Plus Jakarta Sans + JetBrains Mono.

---

## 1. Routes (live)

Authenticated (sidebar + topbar):
`/dashboard` · `/chat` · `/chat/:sessionId` · `/positions` · `/positions/:id` ·
`/positions/:id/:tab` · `/candidates/:id` · `/talent-pool` · `/interviews` (redesign
re-enables as real page) · `/settings` · `/settings/:tab` · `/analytics` ·
`/hire-requests` (+ `/new`, `/:id`, `/:id/edit`) · `/platform` (platform_admin) · `/dev`.

Public (no sidebar): `/login` · `/register` · forgot/reset/set-password ·
`/apply/:token` · `/panel/:token` · `/careers/:orgSlug` · `/careers/:orgSlug/:positionId` ·
`/status/:token` · `/delete-my-data` · `/privacy`.

All API calls use the `/api/v1/` prefix; vite proxies `/api` → `:8000`.

---

## 2. Component folders

`components/` has one folder per surface:
`Auth, Sidebar, Chat, Dashboard, Positions, Candidates, Interviews, TalentPool,
Settings, Notifications, Apply, Panel, Careers, Status, HireRequests, Analytics,
Platform, DevAdmin, GDPR, common`.

The redesigned **Chat** surface is the most evolved: `JDCanvas`, `JDRail`, `JDStepper`,
`ChatTopBar`, `MessageInput`, `FinalizeCTA`, `ProvenanceChip`, `PositionSetupModal`,
plus `blocks/` and `cards/` (document-first canvas, not chat bubbles).

`common/` shared primitives currently include `Badge`, `StatusBadge`, `ScoreCircle`,
`EmptyState`, `SkeletonCard`, `NotificationBell`. The redesign's planned `Icon` / `Chip` /
`Stat` atoms are **not yet built** — see [`STATUS.md`](../STATUS.md).

---

## 3. State management

Provider hierarchy:

```
<ThemeProvider>          dark/light/system — localStorage
  <AuthProvider>         token, user, login(), logout()
    <NotificationProvider>  unread count, poll 30s
      <ChatProvider>     sessions, messages, streaming, workflowStage
        <RouterProvider />
```

### ChatContext — SSE event mapping

| Event | UI action |
|---|---|
| `token` | append to current message |
| `stage_change` | update stepper/stage indicator |
| `card_internal` / `card_market` / `card_variants` / `card_bias` | render the matching block on the canvas |
| `jd_token` | append to final-JD block (separate stream) |
| `metadata` | update session title/stage |
| `done` | stop streaming |
| `error` / `stage_skipped` / `stream_interrupted` | error/skip handling (see [04_ai_agents.md](04_ai_agents.md)) |

---

## 4. Context-aware back navigation

Candidate detail opens from position pipeline/candidates tab, talent pool, dashboard
activity, notifications. Always pass `state: {from, fromLabel, fromTab}` so the back
button returns correctly; `CandidateDetailPage` reads `useLocation().state`.

---

## 5. Responsive, performance, theme

- Breakpoints: desktop >1200 (full sidebar), tablet 768–1200 (overlay), mobile <768
  (hamburger). App is desktop-first; public pages (apply/panel/careers) mobile-first.
- Perf: `React.lazy()` per page, 300ms debounced search, batched SSE token renders,
  skeleton screens (not spinners), optimistic status/comment updates, 20/page pagination.
- Theme: `['dark','light','system']` in localStorage, applied as `theme-*` class on
  `<html>`, instant switch.

---

## 6. UI/UX production standards

- **AI typing indicator** while streaming: input disabled + "AI is thinking…",
  3-dot pulse before first token, send-button spinner, stage-pill pulse.
- **Pipeline stage colors** defined once in `utils/constants.js` (`PIPELINE_STAGES`)
  and consumed only via `StatusBadge` — no inline status colors. Color is never the only
  signal (label + dot).
- **Designed empty states** for: new-org dashboard, empty pipeline, empty talent pool,
  no chat sessions, no notifications.
- **ATS score** rendered as an SVG arc (`ScoreCircle`), color-coded ≥80 green / ≥60
  amber / else red — not a plain number.
- **Skeleton loaders** sized to match real cards so layout doesn't jump.

---

## 7. Accessibility baseline

Keyboard-navigable interactive elements; `aria-label` on icon-only buttons; status
conveyed by text + dot, not color alone; labels on inputs; visible focus rings (no
global `outline:none`); `alt` on images; focus-trapped modals; toasts via `role="status"`.
