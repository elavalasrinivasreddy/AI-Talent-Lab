> **Build status:** ❌ Not redesigned — basic platform router exists
> Consolidated docs index: [../../README.md](../../README.md) · Status tracker: [../../STATUS.md](../../STATUS.md) · Design system: [../00_design_system.md](../00_design_system.md)
> This page merges the v3 redesign spec with the pre-v3 behavioral spec (appendix below, where one existed).

# Page 17 — Platform Admin Dashboard

**Pattern:** *Cross-org control tower* (variant A)
**Replaces:** Current `PlatformPage.jsx` (exists but minimal)
**Why:** `platform_admin` is a distinct role for the SaaS operator (not a customer org admin). They need cross-org visibility: which customers are healthy, who's churning, where AI cost is concentrated, which features get used. Today this is reportedly a stub.

Preview reference: not yet in `/tmp/atl-design-preview-v3.html` — to be added.
Existing component: `frontend/src/components/Platform/PlatformPage.jsx`.

---

## 1. Route & layout

| Aspect | Value |
|---|---|
| Route | `/platform` (separate route family — outside `AppLayout` per `router.jsx`) |
| Auth | Required (JWT) · role check `platform_admin` only |
| Layout | **No org sidebar** (platform admins don't belong to an org context) · custom topbar with org switcher + "Back to platform" |
| Login redirect | `PublicGuard` redirects `platform_admin` users to `/platform` on login |

---

## 2. Backend tie-in

| Endpoint | Used for |
|---|---|
| `GET /api/v1/platform/overview` | Top-level metrics: total orgs, active users, hires this month, LLM cost MTD |
| `GET /api/v1/platform/orgs?status=&plan=&health=` | Org list with health scores |
| `GET /api/v1/platform/orgs/{id}/snapshot` | Per-org deep-dive (used by org detail drawer) |
| `GET /api/v1/platform/usage?period=30d` | Aggregate usage: positions created, candidates sourced, JD generations, panel feedbacks |
| `GET /api/v1/platform/llm-cost?period=` | Token usage + cost breakdown per provider per org |
| `GET /api/v1/platform/feature-adoption` | Which extended features are used and by whom |
| `GET /api/v1/platform/audit-log?cursor=` | Cross-org audit trail (filterable by org) |
| `POST /api/v1/platform/orgs/{id}/impersonate` | Generate short-lived JWT to log in AS org admin (with audit trail) — Phase 2 |

These endpoints need to exist behind `platform_admin` role gate. Most aggregations are SQL over existing tables, scoped to **all orgs** (bypasses RLS for this role only — per `project_architecture.md` invariants this requires a separate code path with explicit role-check and audit logging).

---

## 3. Layout

```
[ topbar: "AI Talent Lab · Platform"  · org switcher [All orgs ▼]  · profile (platform_admin) ]

[ HERO STRIP — 4-card platform KPIs ]
  Orgs Active 87 (+5)   MAU 312    Hires this month 142    LLM Cost MTD ₹2.4L (-8%)

[ 2-col grid ]
  LEFT (60%): Org health table — sortable, filterable
   ┌─ TechCorp · paid · health 82 ──────────────────────────────┐
   │ 12 positions · 34 hires · LLM ₹18K · active 7d · last 4h ago │
   │ ⚡ AI sourcing 67% · panel completion 92% · response NPS 88   │
   └────────────────────────────────────────────────────────────┘
   ... (more org rows, sortable by health ascending → at-risk first)

  RIGHT (40%): Anomaly feed + LLM cost tile
   - Anomaly: "Org Wayne · 0 logins in 14d (was daily-active)"
   - Anomaly: "Org Stark · LLM spend up 4x · check usage pattern"
   - LLM cost stacked bar by provider (Groq / OpenAI / Gemini)

[ Feature adoption matrix — heatmap ]
  Rows: orgs · cols: features (JD chat, AI sourcing, talent pool, panel mlinks, ...)
  Cells: usage intensity (color band)

[ Recent platform-level audit events ]
  "Platform admin user X impersonated org Y as admin · for 12 min · 14:32 UTC"
  ...
```

---

## 4. Org health table

Each row represents a customer org. Sorted by health score ascending by default (at-risk first).

| Field | Source / formula |
|---|---|
| Org name + plan | `organizations.name`, `subscription_tier` |
| Health score (0-100) | composite: activity, retention, hires/month, NPS, response time |
| Positions count | live count |
| Hires (last 30d) | `pipeline_events` where `event_type=selected` |
| LLM cost (MTD) | sum of `llm_usage` rows |
| Last active | most recent user login |
| AI sourcing % | share of candidates from `actor_type=ai_agent` |
| Panel completion % | submitted / total |
| NPS (response surveys) | candidate response data |

Row click → org detail drawer.

### Filters

- Plan tier (Free / Growth / Scale / Enterprise)
- Health band (Healthy 70+ · At-risk 40-69 · Critical <40)
- Activity (Active 7d / Active 30d / Dormant)
- Region / vertical (Phase 2)

---

## 5. Org detail drawer (right slide)

Opens from row click — preserves context. Shows:

- Org profile (name, slug, plan, created, primary contact)
- 30-day activity sparkline
- User list (admins, recruiters, HMs, panelists)
- Key metrics in detail
- Recent audit events
- Quick actions:
  - **Impersonate as org admin** (Phase 2 — audited)
  - **Open intercom thread**
  - **Adjust plan**
  - **Send support email**

---

## 6. Anomaly feed

Right-rail card listing detected anomalies:

| Anomaly type | Example |
|---|---|
| `dormant_active_org` | "Wayne Enterprises · 0 logins in 14d (was daily-active)" |
| `llm_cost_spike` | "Stark · LLM spend ₹18K → ₹74K · check usage" |
| `negative_growth` | "Acme · -3 net positions this month (closures > new)" |
| `feedback_stall` | "Pied Piper · 6 panel scorecards overdue >7d (org-wide pattern)" |
| `support_burst` | "GlobeTech · 4 support tickets in 24h (vs normal 0)" |

Each anomaly is actionable: click to drill into the org with relevant filter pre-applied.

Source: `platform_anomalies` materialized view (refresh hourly) or computed by a Celery task `detect_platform_anomalies`.

---

## 7. LLM cost tile

Stacked bar chart (Groq / OpenAI / Gemini) for last 30 days. Per-org dropdown filters. Per-org cost-per-hire metric: `total_cost / hires_count`.

This is the **finance-facing metric** — platform admins explain unit economics to investors via this tile.

---

## 8. Feature adoption matrix

Heatmap grid:
- Rows = orgs (top 30 by activity)
- Columns = extended features (JD chat, AI sourcing, talent pool, panel feedback, GDPR delete flow, copilot suggestions, hire requests, video intro, calendar OAuth, career page branding)
- Cells = intensity (Never used · Used once · Used weekly · Used daily)

Identifies which features actually deliver value and where there are activation gaps. Drives product roadmap priorities.

---

## 9. Components to build

| Component | Path | Notes |
|---|---|---|
| `<PlatformPage>` | `frontend/src/components/Platform/PlatformPage.jsx` | Refactor (currently minimal) |
| `<PlatformTopbar>` | `Platform/PlatformTopbar.jsx` | New — separate topbar (no org sidebar) |
| `<PlatformHero>` | `Platform/PlatformHero.jsx` | New — 4-card KPI strip |
| `<OrgHealthTable>` | `Platform/OrgHealthTable.jsx` | New — sortable, filterable |
| `<OrgDetailDrawer>` | `Platform/OrgDetailDrawer.jsx` | New |
| `<AnomalyFeed>` | `Platform/AnomalyFeed.jsx` | New — right rail |
| `<LLMCostTile>` | `Platform/LLMCostTile.jsx` | New |
| `<FeatureAdoptionMatrix>` | `Platform/FeatureAdoptionMatrix.jsx` | New |
| `<PlatformAuditLog>` | `Platform/PlatformAuditLog.jsx` | New — cross-org audit feed |

---

## 10. Role gating & RLS bypass

`platform_admin` is the **only** role allowed to bypass RLS (row-level security). Every query from this page must:
1. Verify caller role at the service layer
2. Log the query into `platform_audit_log` (who · what · when · which org accessed)
3. Use a dedicated DB connection without `app.current_org_id` set

If a regular `admin` user (org-scoped) hits a platform endpoint, return 403.

---

## 11. Empty / loading / error states

| Condition | Display |
|---|---|
| First-time platform admin | Hero shows "Welcome. Connecting first orgs..." with empty table |
| No anomalies detected | Anomaly feed: "All systems healthy across 87 orgs · last check 12 min ago" |
| LLM cost data lag | Tile shows "Updated 1h ago" timestamp |
| Cross-org query fails | Banner "Some metrics unavailable · partial view shown" |

---

## 12. Build notes

1. The current `PlatformPage` is barely scaffolded — this is mostly a green-field build.
2. Platform endpoints can ship incrementally: hero stats first, then org table, then drawer, then anomalies.
3. Feature adoption matrix is the highest-effort tile but most product-strategic — ships last.
4. Impersonation flow (Phase 2) requires:
   - Generating short-lived JWT for the target org admin
   - Frontend banner "You are viewing as org X · platform_admin Y · [Return to platform]"
   - Every action under impersonation logged with `impersonated_by_user_id`
5. Phase 3: open analytics SDK for orgs to embed their own dashboards via API (also lives here).
