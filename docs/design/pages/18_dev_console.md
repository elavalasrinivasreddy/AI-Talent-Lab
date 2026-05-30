> **Build status:** ❌ Not redesigned — dev console exists, visual refresh pending
> Consolidated docs index: [../../README.md](../../README.md) · Status tracker: [../../STATUS.md](../../STATUS.md) · Design system: [../00_design_system.md](../00_design_system.md)
> This page merges the v3 redesign spec with the pre-v3 behavioral spec (appendix below, where one existed).

# Page 18 — Developer Console

**Pattern:** *Multi-org developer admin · public unauthenticated · dev-mode only* (variant A)
**Replaces:** Current `DevAdminPage.jsx` (already public, already multi-org · refresh visuals)
**Why:** The dev console is the **internal seed/test surface**. Used to spin up test orgs, generate magic links for any role, inspect system health, and bootstrap demo data. Should look like a developer tool (Stripe-test-mode-ish), not a customer-facing surface.

Preview reference: not yet in `/tmp/atl-design-preview-v3.html` — to be added.
Existing component: `frontend/src/components/DevAdmin/DevAdminPage.jsx`.

---

## 1. Route & layout

| Aspect | Value |
|---|---|
| Route | `/dev` |
| Auth | **Public** — no JWT required · gated server-side by `DEV_MODE=true` env var |
| Layout | Top warning bar ("DEV-ONLY · not for production use") · standalone page · no app sidebar |
| Backend gate | All `/api/v1/dev/*` endpoints return 404 unless `DEV_MODE=true` |

---

## 2. Backend tie-in

| Endpoint | Used for |
|---|---|
| `GET /api/v1/dev/orgs` | List all orgs across system (DEV_MODE bypasses tenant isolation) |
| `POST /api/v1/dev/orgs` | Create org with admin in one call (returns admin magic link) |
| `GET /api/v1/dev/users?org_id=` | Users per org |
| `POST /api/v1/dev/users` | Create user with role + return magic link for instant login |
| `POST /api/v1/dev/magic-link` | Generate magic link for any existing user (auth bypass) |
| `GET /api/v1/dev/health` | System health: DB · Redis · Celery workers · LLM provider · email adapter |
| `POST /api/v1/dev/seed-demo-data` | Generate fake org with N positions, N candidates, M interviews |
| `POST /api/v1/dev/reset-org/{id}` | Wipe an org's data (audit logged, requires confirmation) |
| `GET /api/v1/dev/logs/tail` | Last 100 log lines (filtered by level) |

---

## 3. Layout

```
[ TOP WARNING BAR (red gradient) ]
  🛠 DEV CONSOLE · DEV_MODE=true · DO NOT USE IN PRODUCTION

[ topbar: "Developer Console" · environment chip [Local · dev] · build hash · uptime ]

[ HEALTH STRIP — 4 cards, color-coded ]
  Backend  ● Healthy
  Database ● Connected · 6 ms
  Celery   ● 4 workers active
  Redis    ⚠ 78% memory (was OK)

[ 2-col grid ]
  LEFT (50%) — Create User panel
   Organization  [Acme · acme-prod ▼]   [+ Create new org]
   Role          [recruiter ▼]
   Email         [user@example.com]
   Full name     [Jane Doe]
                                                 [Create + Generate magic link →]

   ── ROLE REFERENCE ──
   platform_admin · org_admin · hiring_manager · recruiter · dept_admin · panelist

  RIGHT (50%) — Recent Users table
   Email                 Role          Org             Generated  Status
   priya@acme.com        org_admin     acme-prod       2h ago     [Copy link] [Open as]
   ravi@acme.com         recruiter     acme-prod       4h ago     [Copy link]
   maya@wayne.io         hiring_mgr    wayne-staging   1d ago     [Copy link]
   admin@atl.dev         platform_admin —              1d ago     [Copy link]

[ ROW 2 — 3 panels ]
  Seed Demo Data        |  Reset Org             |  Log Tail
  Pick template:        |  Org [Acme ▼]          |  [Filter: error/warn ▼]
   - Small recruiter    |  Reset will:           |  [tail -f stream live]
   - Mid-size recruiter |  - delete all positions|
   - Enterprise (50+)   |  - delete all candidates|  20:14 | INFO  | candidate sourced
   - JD-heavy demo      |  - keep org + admin     |  20:14 | INFO  | ats score 88
   [Seed →]             |  [Type org slug to confirm: ___] [Reset →] |  20:13 | WARN | retry exhausted
                                                            |  ...
```

---

## 4. Create-user flow (the primary use case)

1. Pick org (dropdown of all orgs · or `[+ Create new org]` inline)
2. Pick role from segmented control (radio chips for all 6 roles)
3. Enter email + full name
4. Click `[Create + Generate magic link]` → backend creates user, returns magic-link URL
5. UI shows the URL with `[Copy]` button + `[Open as user →]` (opens in new tab)
6. Row appears in Recent Users table

The whole flow is < 5 seconds. Critical for QA / demos / onboarding new dev hires.

---

## 5. Health strip cards

Each card represents a subsystem:

| Card | Source | States |
|---|---|---|
| Backend | `/dev/health` returns version + uptime | ✅ Healthy / ⚠ slow / 🔴 unreachable |
| Database | asyncpg ping ms | ✅ Connected · Xms / ⚠ slow (>50ms) / 🔴 down |
| Celery | broker probe + worker count | ✅ N workers / ⚠ idle / 🔴 broker unreachable |
| Redis | memory usage % | ✅ <70% / ⚠ 70-90% / 🔴 >90% |

Card click expands inline details (last error · last ping · per-worker stats).

---

## 6. Recent Users table

Recent generations from `/dev/magic-link` and `/dev/users`. Shows:
- Email · Role · Org · Generated time · Status (active / used / expired)
- Actions: [Copy link] · [Open as user] (opens new tab with magic-link URL pre-filled)

Helps demo flows: spin up org → create users → open multiple tabs → test multi-role scenarios fast.

---

## 7. Seed Demo Data panel

Templates select an org-shape:
- Small recruiter (1 org, 1 admin, 3 positions, 30 candidates, no interviews)
- Mid-size recruiter (1 org, 5 users, 12 positions, 150 candidates, 20 interviews, 8 panel feedbacks)
- Enterprise (3 depts, 25 users, 50 positions, 800 candidates, 200 interviews)
- JD-heavy demo (1 org, full LangGraph examples, 5 ChatSessions in different stages)

Click [Seed →] triggers Celery task `seed_demo_org` (background). Progress toast shows: "Seeding... 32% (150/450 candidates)".

---

## 8. Reset Org panel

Destructive — requires typing the org slug to confirm. Wipes:
- All `positions`, `candidates`, `applications`, `interviews`, `scorecards`, `pipeline_events`, `notifications`, `chat_sessions`, `talent_pool_*` rows for that org
- Keeps: the `organizations` row itself, `users` (admin), `departments`, base `settings`

Used to reset a demo org between presentations without recreating it from scratch.

---

## 9. Log tail panel

Live tailing of the last 100 log lines from the backend process. Filterable by level (debug / info / warn / error / critical). Updates via SSE.

Stops streaming when user navigates away.

---

## 10. Visual treatment

DevAdmin is intentionally **utilitarian** — looks like a dev tool, not a customer surface:
- Mono font for IDs, URLs, log lines
- Red warning header strip — unmissable
- Default to dark theme
- No animations beyond minimum
- "Test mode" framing similar to Stripe test dashboard

Org switcher offers `[Generate FAKE org]` button that prefixes the name with `[dev]` so test orgs never confuse with real ones.

---

## 11. Components to build

| Component | Path | Notes |
|---|---|---|
| `<DevAdminPage>` | `frontend/src/components/DevAdmin/DevAdminPage.jsx` | Refactor — already exists |
| `<DevWarningBar>` | `DevAdmin/DevWarningBar.jsx` | New — sticky top |
| `<HealthStrip>` | `DevAdmin/HealthStrip.jsx` | New — 4 status cards |
| `<CreateUserPanel>` | `DevAdmin/CreateUserPanel.jsx` | New (or refactor existing) |
| `<RecentUsersTable>` | `DevAdmin/RecentUsersTable.jsx` | New |
| `<SeedDemoPanel>` | `DevAdmin/SeedDemoPanel.jsx` | New |
| `<ResetOrgPanel>` | `DevAdmin/ResetOrgPanel.jsx` | New — with confirm-by-typing |
| `<LogTailPanel>` | `DevAdmin/LogTailPanel.jsx` | New — SSE stream |
| `<OrgSwitcher>` | `DevAdmin/OrgSwitcher.jsx` | New — top dropdown |

---

## 12. Security

Even though `/dev` is "public" routing-wise, the **backend gates all endpoints** with `DEV_MODE=true`:

```python
# backend/middleware/dev_gate.py
if not settings.DEV_MODE:
    raise HTTPException(404)
```

In production this env var is `false`. The route still renders client-side but every API call 404s and the UI shows a single error: "Dev console disabled in production."

CI verifies `DEV_MODE=false` in production builds.

---

## 13. Empty / loading / error states

| Condition | Display |
|---|---|
| DEV_MODE off (e.g. user lands in prod) | Entire page replaced with "Dev console is disabled in this environment." |
| Health check unreachable | All cards red · "Backend unreachable" message |
| Seed task failed midway | Toast + Celery task status link |
| Reset confirm typed wrong | Inline error "Slug doesn't match" |
| Log stream disconnects | "Reconnecting..." with retry |

---

## 14. Build notes

1. The existing `DevAdminPage.jsx` already supports create-user + multi-org. Refactor visuals; preserve all logic.
2. Health endpoint may need to be added if not present.
3. Seed/reset endpoints are powerful — ensure CSRF or origin-check is present even though "public" routing.
4. Log tail requires either backend SSE endpoint or read from a recent-log buffer (in-memory ring of last 200 lines).
5. Mark this entire surface as **not localized** — English only, dev audience.
