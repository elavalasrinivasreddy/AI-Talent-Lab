# Page 07 — Settings

**Pattern:** *AI Behavior Console* (variant A)
**Replaces:** 11-tab horizontal layout (GENERAL / HIRING & ATS / WORKSPACE rows of tabs)
**Why:** Settings *are* the policy editor for AI behavior. ATS thresholds, sourcing schedules, screening Qs, scorecard rubrics all configure what agents do on your behalf. A purpose-grouped left rail makes that obvious. A LIVE PREVIEW pane makes the AI's response to changes visible.

Preview reference: `/tmp/atl-design-preview-v3.html` → tab "Settings".
Existing doc this supersedes: `docs/pages/06_settings.md`.

---

## 1. Route & layout

| Aspect | Value |
|---|---|
| Route | `/settings` and `/settings/:section` |
| Auth | Required (JWT) · admin-only for most sections; team members see Profile + Notifications |
| Layout | App shell · header bar · 3-column: left rail (240px) · middle form · right preview (320px) |

---

## 2. Backend tie-in

All settings persist via existing `settings.py` router (`PATCH /api/v1/settings/...`). The preview pane reads aggregate data via `dashboardApi`.

| Endpoint | Used for |
|---|---|
| `GET /api/v1/settings/org` | Workspace name, locale, timezone |
| `PATCH /api/v1/settings/org` | Save org changes |
| `GET /api/v1/settings/ats-rules` | ATS threshold + weights + auto-archive |
| `PATCH /api/v1/settings/ats-rules` | Save ATS rules · triggers re-score Celery task |
| `GET /api/v1/settings/sourcing` | Sourcing schedule |
| `PATCH /api/v1/settings/sourcing` | Save sourcing config |
| `GET /api/v1/settings/screening-questions` | Screening Qs list (per org) |
| `CRUD /api/v1/settings/screening-questions` | Manage |
| `GET /api/v1/settings/scorecard-templates` | Scorecard rubrics |
| `CRUD /api/v1/settings/scorecard-templates` | Manage |
| `GET /api/v1/settings/team` | Members |
| `CRUD /api/v1/settings/team` | Invite / remove |
| `GET /api/v1/settings/career-brand` | Career page branding (Phase 2 — see PRODUCT_PLAN §13) |
| `PATCH /api/v1/settings/career-brand` | Save brand |
| `GET /api/v1/settings/audit-log?cursor=` | Audit viewer (Phase 2) |
| `GET /api/v1/dashboard/ats-preview?threshold=` | LIVE PREVIEW pane — "what would advance under this threshold" (**new** — small aggregation) |

---

## 3. Layout

```
[ topbar:  "AI Behavior Console"  · sub · [Reset section] [Save changes] ]

┌────────── 240px ───────────┬────────── form ──────────────┬─────── 320px ──────┐
│ LEFT RAIL (purpose groups) │ ATS scoring rules · "Defines  │ LIVE PREVIEW       │
│                            │  how AI scores each candidate"│                    │
│ 🤖 How the AI thinks       │                              │ "What AI does now" │
│   ● ATS scoring rules      │ ▼ Minimum ATS threshold      │                    │
│     Sourcing schedule      │   Slider 50→90% · ▶ 80%      │ pv-card: "Of last  │
│     Screening questions    │                              │ 90d candidates: 32%│
│     Scorecard rubric       │ ▼ Score weights              │ would advance"     │
│     JD bias detection      │   emb 0.40 / skills 0.40 /   │                    │
│     LLM provider           │   exp 0.20  · sum 1.00 ✓     │ pv-card: cost      │
│                            │                              │ preview chart      │
│ 👥 How your team works     │ ▼ Auto-behaviors             │                    │
│   Departments              │   ☑ Auto-archive below ths   │ pv-card: last 10   │
│   Team members (12)        │   ☑ Re-score on JD edit      │ candidates score   │
│   Approval rules           │   ☐ Show reasoning to cand   │ distribution       │
│   Notifications            │   ☐ Comp-band override (NEW) │                    │
│                            │                              │ pv-card (highlight)│
│ 🧍 How candidates see you  │                              │ "Why equation     │
│   Career page brand        │                              │ matters"          │
│   Email templates          │                              │                    │
│   Apply flow toggles       │                              │ history list       │
│   Video intro (on)         │                              │ - Threshold 75→80 │
│   Status portal copy       │                              │ - Skills 0.35→0.40│
│                            │                              │                    │
│ 🔒 Compliance & data       │                              │                    │
│   GDPR / DPDP retention    │                              │                    │
│   Audit log (2.1k)         │                              │                    │
│   Security                 │                              │                    │
│   Integrations             │                              │                    │
│   Data export              │                              │                    │
└────────────────────────────┴──────────────────────────────┴────────────────────┘
```

---

## 4. The 4 purpose groups

The left rail reorganizes the 11 existing tabs around **what the AI does on your behalf** rather than data type.

### 🤖 How the AI thinks for you (`--p` color)
- **ATS scoring rules** — threshold, weights, auto-behaviors (sample shown in preview)
- **Sourcing schedule** — frequency, max-per-day, talent-pool-first-N
- **Screening questions** — dynamic Qs in apply chat
- **Scorecard rubric** — competency dimensions + anchors per dimension
- **JD bias detection** — sensitivity level, language model
- **LLM provider** — Groq / OpenAI / Gemini · model name · max tokens · temperature

### 👥 How your team works (purple `#8B5CF6`)
- **Departments** — list + create
- **Team members** — invite, role assign, deactivate
- **Approval rules** — 2-step hire approval toggle, who approves what
- **Notifications** — email / in-app per event type, grouped notifications
- **Hire request templates** — pre-filled templates per role family

### 🧍 How candidates see you (cyan `#06B6D4`)
- **Career page brand** — primary color, banner image, tagline, hero copy
- **Email templates** — outreach / follow-up / interview-invite / rejection / offer
- **Apply flow toggles** — require video intro, max steps, consent text
- **Video intro** — enabled/disabled, 60s max, mandatory vs optional
- **Status portal copy** — branding, FAQ items, contact instructions

### 🔒 Compliance & data (gray `--tx-3`)
- **GDPR / DPDP retention** — data_retention_months per applicant; auto-cleanup task
- **Audit log** — table of all org actions with filters (Phase 2 feature per PRODUCT_IMPROVEMENTS)
- **Security** — 2FA, SSO (enterprise), session policy
- **Integrations** — Calendar OAuth, Slack, WhatsApp (Phase 2), API & Webhooks (Phase 3)
- **Data export** — GDPR Article 20 (Phase 2 feature)

---

## 5. The LIVE PREVIEW pane (the radical part)

For every setting that affects AI behavior, the right pane shows **what would change**.

### Example: ATS threshold section

| Card | Content |
|---|---|
| "Under current settings" | "Of last 90d candidates: 32% would advance past screening (vs 27% with 85% threshold). Estimated +12 hires per quarter if threshold lowered to 75%." |
| "Cost preview" | inline SVG sparkline of LLM-cost-per-day; current usage line |
| "Last 10 candidates · this threshold" | Score chips colored by band — visualizes who advances |
| "Why the equation matters" | Explainer card with the literal math example: `0.5×40 + 0.95×40 + 0.9×20 = 76` |
| "History · last 5 changes" | Who changed what, when |

For other sections, preview adapts:

- **Sourcing schedule** → "Next run in 6h · 18 candidates sourced last run"
- **Screening Qs** → live preview of the apply chat with current Qs visible
- **Career brand** → live preview of `/careers/:orgSlug` rendered inline (iframe or screenshot)
- **Bias detection** → sample biased phrases that *would* be flagged at current sensitivity

This preview pane is what makes Settings feel like a *console*, not a form. **It's the most product-distinctive surface in the app** — no other ATS has this.

---

## 6. Components to build / refactor

| Component | Path | Notes |
|---|---|---|
| `<SettingsPage>` | `frontend/src/components/Settings/SettingsPage.jsx` | Refactor (currently 97 lines · horizontal tabs) |
| `<SettingsRail>` | `Settings/SettingsRail.jsx` | New — purpose-grouped left nav with icons + counts |
| `<SettingsBody>` | `Settings/SettingsBody.jsx` | Slot for active section |
| `<SettingsLivePreview>` | `Settings/SettingsLivePreview.jsx` | New — right-rail preview pane (section-aware) |
| Section components (one per setting, e.g. `<ATSScoringSection>`, `<SourcingSection>`, etc.) | `Settings/sections/` | Mix of refactor (existing tabs in `Settings/tabs/`) and new |
| Existing `Settings/tabs/*` components | `Settings/tabs/` | Migrate logic into new section components; deprecate when done |
| `<Slider>` shared atom | `common/Slider.jsx` | New — used by ATS threshold + weights |
| `<Toggle>` | `common/Toggle.jsx` | Already exists in v3 preview CSS; promote to component |

---

## 7. Role permissions

| Section | Admin | Recruiter | HM |
|---|---|---|---|
| ATS scoring rules | ✅ | ❌ (read-only) | ❌ |
| Sourcing schedule | ✅ | ✅ (own dept) | ❌ |
| Screening Qs | ✅ | ❌ | ❌ |
| Scorecard rubric | ✅ | ❌ | ❌ |
| Bias detection | ✅ | ❌ | ❌ |
| LLM provider | ✅ | ❌ | ❌ |
| Departments | ✅ | ❌ | ❌ |
| Team members | ✅ | ❌ | ❌ |
| Approval rules | ✅ | ❌ | ❌ |
| Notifications | ✅ self | ✅ self | ✅ self |
| Hire request templates | ✅ | ❌ | ✅ (own dept) |
| Career page brand | ✅ | ❌ | ❌ |
| Email templates | ✅ | ✅ (read + use, can't save) | ❌ |
| Apply flow toggles | ✅ | ❌ | ❌ |
| GDPR / Compliance | ✅ | ❌ | ❌ |
| Audit log | ✅ | ❌ | ❌ |
| Integrations | ✅ | ❌ | ❌ |

Non-admin users see the rail but disallowed sections are greyed out with a "Admin-only" indicator.

---

## 8. Save semantics

- Changes are **not** saved on slider/input change. Use `[Save changes]` button (top right).
- "Reset section" reverts unsaved changes in the active section only.
- ATS / sourcing / scorecard saves trigger:
  - Toast: "Saved · re-scoring 47 candidates in background"
  - Celery task `re_score_org_applications` (existing)
- History list in preview pane updates immediately on save.

---

## 9. Empty / loading / error states

| Condition | Display |
|---|---|
| First-time setup (org just created) | Highlight defaults in each section + "We've pre-filled sensible defaults. Adjust and save." |
| Saving | Button shows spinner; disable form during save |
| Save fails | Toast "Couldn't save. [Retry]" — form remains editable |
| Preview pane API error | "Live preview unavailable." form still works |
| Read-only (non-admin) | Form fields disabled · save button hidden · banner "Admin-only · contact admin to change" |

---

## 10. Build notes

1. Build `<SettingsRail>` + `<SettingsLivePreview>` shells first.
2. Migrate one section at a time from old `Settings/tabs/*` into new `Settings/sections/*`.
3. ATS scoring section should be first — it has the richest live preview demo.
4. The new section structure makes it easier to add **Phase 2 features** (audit log viewer, career page branding form, video intro toggle) — those should ship inside the new shell, not as standalone tabs.
5. Update `frontend/src/router.jsx` to support `/settings/ats-rules`, `/settings/sourcing`, etc. as deep links.
