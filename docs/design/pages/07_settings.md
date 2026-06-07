> **Build status:** ✅ Redesigned (2026-05-29)
> Consolidated docs index: [../../README.md](../../README.md) · Status tracker: [../../STATUS.md](../../STATUS.md) · Design system: [../00_design_system.md](../00_design_system.md)
> This page merges the v3 redesign spec with the pre-v3 behavioral spec (appendix below, where one existed).

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

---

## 11. Premium UI/UX Enhancements (V3.1)

To elevate the AI Behavior Console from a functional MVP to a premium enterprise experience, the following UI/UX patterns are enforced across all tabs:

### 11.1 Right-Side Drawers (Slide-overs)
- **Replaces:** Centered modals.
- **Why:** Sliding panels from the right (`<SlideOver>`) preserve the user's context of the underlying table, provide more vertical space for forms, and match modern SaaS standards.
- **Usage:** Used for "+ Add Team Member", "+ Add Question", "+ New Template", etc.

### 11.2 Modern List Views
- **Replaces:** Basic HTML `<table className="settings-table">`.
- **Why:** Raw tables look brutalist. Modern lists use Avatar clusters, colored role badges (matching Pipeline Garden), and clean `...` overflow menus for actions (Edit, Deactivate, Delete) that appear on hover.
- **Usage:** `TeamTab`, `DepartmentsTab`, `ScreeningQuestionsTab`.

### 11.3 AI Auto-Draft (The "Wow" Factor)
- **Feature:** A `✨ Auto-draft` button injected into manual data-entry fields.
- **Why:** Instead of forcing the user to write their own "About Us" or "Benefits Template", they can paste their website URL, and the system extracts and summarizes the data.
- **Usage:** `OrganizationTab` (Culture Keywords, About Us), `MessageTemplatesTab`.

### 11.4 Premium Empty States
- **Replaces:** Dashed-border boxes with emojis.
- **Why:** Empty states should be inviting. They now use subtle glassmorphism, soft gradient backgrounds, and branded illustrations with clear CTAs.

---

## Appendix — pre-v3 behavioral spec & flows

_Retained from the original `docs/pages/` spec for workflow, edge-case, and API detail. The v3 spec above supersedes the **visual** design; the behavior here is still the reference._

# Page Design: Settings
> **Version 2.2 — Updated**
> Organization profile, team, departments, competitors, screening questions, message templates,
> interview templates, integrations, appearance, security.
> WhatsApp integration is Phase 2 — noted where relevant.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Route | `/settings` · `/settings/:tab` |
| Auth | Required (JWT) |
| Layout | Sidebar + left tab list + right content panel |
| Default tab | Profile |

---

## 2. Page Layout

```
┌──────┬──────────────────────────────────────────────────────────┐
│      │  ⚙️ Settings                                            │
│      │  Manage your account and organization                   │
│ S    │                                                          │
│ I    │  ┌── Tab List (240px) ──┐  ┌── Tab Content ──────────┐  │
│ D    │  │ GENERAL              │  │                         │  │
│ E    │  │  👤 My Profile       │  │   (see each tab below)  │  │
│ B    │  │  🏢 Organization     │  │                         │  │
│ A    │  │  👥 Team Members     │  │                         │  │
│ R    │  │  🏗 Departments      │  │                         │  │
│      │  │                      │  │                         │  │
│      │  │ HIRING & ATS         │  │                         │  │
│      │  │  🏷 Competitor Intel  │  │                         │  │
│      │  │  ❓ Screening Qs     │  │                         │  │
│      │  │  📧 Msg Templates    │  │                         │  │
│      │  │  🎯 Interview Tmpls  │  │                         │  │
│      │  │                      │  │                         │  │
│      │  │ WORKSPACE            │  │                         │  │
│      │  │  🔗 Integrations     │  │                         │  │
│      │  │  🎨 Appearance       │  │                         │  │
│      │  │  🔐 Security         │  │                         │  │
│      │  └──────────────────────┘  └─────────────────────────┘  │
└──────┴──────────────────────────────────────────────────────────┘
```

---

## 3. Tabs

### 3.1 My Profile
**All roles can access and edit their own profile.**

| Field | Editable | Notes |
|---|---|---|
| Full Name | ✅ | Display name |
| Email | ❌ | Immutable — login credential |
| Role | ❌ | Set by admin |
| Organization | ❌ | From org table |
| Department | ❌ | Assigned by admin |
| Timezone | ✅ | Default: Asia/Kolkata |
| Phone | ✅ | Optional |
| Avatar | ✅ | Upload photo (max 2MB) |

**Actions:**
- [Save Profile] — updates name, phone, timezone, avatar
- [Change Password] — opens inline form:
  ```
  Current Password: [          ]
  New Password:     [          ]
  Confirm:          [          ]
  [Update Password]
  ```

**API:** `GET /api/v1/auth/me` · `PATCH /api/v1/auth/profile` · `POST /api/v1/auth/change-password`

---

### 3.2 Organization
**Admin can edit. Others see read-only view.**

| Field | Editable | Impact |
|---|---|---|
| Organization Name | ❌ | Immutable — unique tenant ID |
| Org Slug | ❌ | Immutable — used in career page URL |
| Industry / Segment | ✅ | |
| Company Size | ✅ | startup / smb / enterprise |
| Website | ✅ | |
| Headquarters | ✅ | Shown on career page |
| **About Us** | ✅ | **Inserted into every generated JD** |
| **Culture Keywords** | ✅ | **Used in AI interview kit** (culture fit questions) |
| **Benefits Template** | ✅ | **Appended to all generated JDs** |
| LinkedIn URL | ✅ | Shown on career page |
| Glassdoor URL | ✅ | Shown on career page |
| Logo | ✅ | Shown on career page + apply page |

> ⚠️ About Us, Culture Keywords, and Benefits Template directly feed into JD generation.
> Keep them up to date before creating new positions.

**API:** `GET /api/v1/settings/org` · `PATCH /api/v1/settings/org`

---

### 3.3 Team Members
**Admin only.**

```
👥 Team Directory                              [+ Add Team Member]

[🔍 Search by name or email...]

Name           │ Email                │ Role          │ Dept      │ Active
───────────────┼──────────────────────┼───────────────┼───────────┼────────
Srinivas R     │ sri@techcorp.com     │ 🟣 Admin      │ Eng       │ ✅ [Edit]
Priya S        │ priya@techcorp.com   │ 🔵 Recruiter  │ Eng       │ ✅ [Edit]
Rahul K        │ rahul@techcorp.com   │ 🟢 Hiring Mgr │ Marketing │ ✅ [Edit]
Neha P         │ neha@techcorp.com    │ 🔵 Recruiter  │ Sales     │ ❌ [Reactivate]

── Add Team Member ──────────────────────────────────────────────────
Name:       [              ]
Email:      [              ]
Password:   [              ]  (they can change on first login)
Role:       [Recruiter ▼]  (Admin / Recruiter / Hiring Manager)
Department: [Engineering ▼]
[+ Add User]
```

**Row edit:** Inline dropdowns to change role and department. Deactivate/Reactivate toggle.
**Cannot delete users** — only deactivate. Data integrity requires user records to remain.

**API:** `GET /api/v1/auth/users` · `POST /api/v1/auth/add-user` · `PATCH /api/v1/auth/users/:id`

---

### 3.4 Departments
**Admin only.**

```
🏗 Departments                               [+ Add Department]

┌──────────────────────────────────────────────────────────────┐
│  Engineering          Head: Srinivas R     12 members  [✏️][🗑️] │
│  └─ Frontend          Head: —              3 members   [✏️][🗑️] │
│  └─ Backend           Head: —              5 members   [✏️][🗑️] │
│                                                              │
│  Product              Head: Rahul K        4 members   [✏️][🗑️] │
│  Marketing            Head: —              2 members   [✏️][🗑️] │
└──────────────────────────────────────────────────────────────┘

── Add Department ───────────────────────────────────────────────
Name:        [              ]
Description: [              ]
Parent Dept: [None ▼]
Head:        [Select user ▼]
[Add]
```

Can only delete empty departments (no users, no positions).

**API:** `GET /api/v1/settings/departments` · `POST /api/v1/settings/departments` · `PATCH /api/v1/settings/departments/:id`

---

### 3.5 Competitor Intel
**Admin and Recruiter can manage.**

```
🏷 Competitor Companies                       [+ Add Competitor]

These companies are used in JD market research (top 3 selected per search).

┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Google   │ │ Flipkart │ │ Razorpay │ │ Infosys  │
│ Tech     │ │ E-comm   │ │ FinTech  │ │ IT Serv  │
│ [✏️][🗑️] │ │ [✏️][🗑️] │ │ [✏️][🗑️] │ │ [✏️][🗑️] │
└──────────┘ └──────────┘ └──────────┘ └──────────┘

── Add Competitor ───────────────────────────────────────────────
Company Name: [              ]
Website:      [              ]
Industry:     [Technology ▼]
Notes:        [              ]
[Add]
```

**API:** `GET /api/v1/settings/competitors` · `POST /api/v1/settings/competitors` · `DELETE /api/v1/settings/competitors/:id`

---

### 3.6 Screening Questions
**Admin only. Controls dynamic questions in candidate apply chat.**

```
❓ Screening Questions                        [+ Add Question]

Department: [All Departments (Org Default) ▼]

These questions are asked during the candidate magic link chat application.
Order them by dragging (↕) — they appear in this order in the chat.

# │ Label               │ Type    │ Required │ Actions
──┼─────────────────────┼─────────┼──────────┼──────────────────
1 │ Notice Period       │ select  │ ✅       │ [✏️] [🗑️] [↕️]
  │ Options: Immediate, 15 days, 30 days, 60 days, 90+ days
2 │ Current Salary (LPA)│ number  │ ✅       │ [✏️] [🗑️] [↕️]
3 │ Expected Salary (LPA│ number  │ ✅       │ [✏️] [🗑️] [↕️]
4 │ Office availability │ select  │ ✅       │ [✏️] [🗑️] [↕️]
  │ Options: Yes (3 days/week), Yes (5 days/week), No
5 │ Active offers?      │ text    │ ❌       │ [✏️] [🗑️] [↕️]

── Add Question ─────────────────────────────────────────────────
Label:      [                          ]
Type:       [text ▼]  (text/number/select/date/boolean)
Options:    [Opt 1, Opt 2, ...]  (for select type)
Required:   [☐]
[Add]
```

**Department dropdown:** Set questions per-department or use org-wide default. If a department has its own questions, those override the org default.

**API:** `GET /api/v1/settings/screening-questions` · `POST/PATCH/DELETE /api/v1/settings/screening-questions/:id` · `PATCH /api/v1/settings/screening-questions/reorder`

---

### 3.7 Message Templates
**Admin only.**

```
📧 Message Templates                         [+ New Template]

Category: [All ▼]   Channel: [Email ▼]

── Initial Outreach (Email — Default) ───────────────────────────
Subject: Exciting opportunity at {{org_name}}
Preview: Hi {{candidate_name}}, we came across your profile and think...
[✏️ Edit]  [📋 Duplicate]  [🗑️ Delete]

── Interview Process Overview (Email — Default) ─────────────────
Subject: Your application for {{role_name}} at {{org_name}}
Preview: Hi {{candidate_name}}, thanks for applying! Here's what to expect...
[✏️ Edit]  [📋 Duplicate]
Note: This is auto-sent after candidate completes application chat.

── Rejection (Email — Default) ──────────────────────────────────
Subject: Update on your application — {{role_name}} at {{org_name}}
Preview: Hi {{candidate_name}}, thank you for your interest. After careful...
[✏️ Edit]  [📋 Duplicate]  [🗑️ Delete]

── Follow-up (Email) ─────────────────────────────────────────────
Subject: Following up — {{role_name}} at {{org_name}}
Preview: Hi {{candidate_name}}, just checking back on your interest...
[✏️ Edit]  [📋 Duplicate]  [🗑️ Delete]

Available variables: {{candidate_name}}, {{role_name}}, {{org_name}},
{{magic_link}}, {{interview_date}}, {{interview_time}}, {{round_name}}

[Send test email to myself]
```

**Categories:** outreach / interview_process_overview / rejection / interview_invite / follow_up / custom

> Note: WhatsApp templates will be added in Phase 2 when WhatsApp Business API is integrated.

**API:** `GET/POST/PATCH/DELETE /api/v1/settings/message-templates/:id?`

---

### 3.8 Interview Templates
**Admin only. Scorecard dimension templates for panel feedback.**

```
🎯 Interview Scorecard Templates              [+ New Template]

── Default Technical (Default ✅) ────────────────────────────────
Dimensions:
• Technical Skills     Weight: 40%  — "Assess technical depth..."
• Problem Solving      Weight: 30%  — "Ability to break down..."
• Communication        Weight: 15%  — "Clarity, listening..."
• Culture Fit          Weight: 15%  — "Alignment with values..."
[✏️ Edit]  [📋 Duplicate]

── Behavioral ────────────────────────────────────────────────────
Dimensions:
• Leadership           Weight: 30%
• Teamwork             Weight: 25%
• Communication        Weight: 25%
• Adaptability         Weight: 20%
[✏️ Edit]  [📋 Duplicate]  [🗑️ Delete]

Note: AI auto-generates position-specific scorecards from the JD.
These templates are fallback defaults used if AI generation is disabled.
```

**API:** `GET/POST/PATCH /api/v1/settings/scorecard-templates/:id?`

---

### 3.9 Integrations
**Admin only.**

```
🔗 Integrations

── Job Portals ─────────────────────────────────────────────────
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ LinkedIn     │  │ Naukri       │  │ Indeed       │
│ 🔴 Not set   │  │ 🔴 Not set   │  │ 🔴 Not set   │
│ Phase 3      │  │ Phase 3      │  │ Phase 3      │
└──────────────┘  └──────────────┘  └──────────────┘

── Email ───────────────────────────────────────────────────────
┌──────────────┐  ┌──────────────┐
│ Resend       │  │ SMTP         │
│ 🔴 Not set   │  │ 🔴 Not set   │
│ [Configure]  │  │ [Configure]  │
└──────────────┘  └──────────────┘

── Communication (Phase 2) ─────────────────────────────────────
┌──────────────┐
│ WhatsApp     │
│ Business API │
│ Phase 2      │
└──────────────┘

── Calendar (Phase 2) ──────────────────────────────────────────
┌──────────────┐  ┌──────────────┐
│ Google Cal   │  │ Outlook      │
│ Phase 2      │  │ Phase 2      │
└──────────────┘  └──────────────┘

── Notifications ───────────────────────────────────────────────
┌──────────────┐
│ Slack        │
│ 🔴 Not set   │
│ Phase 3      │
└──────────────┘
```

---

### 3.10 Appearance
**All roles.**

```
🎨 Theme

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  🌙 Dark     │  │  ☀️ Light    │  │  💻 System   │
│  (Default)   │  │              │  │  Follow OS   │
│  [Active]    │  │  [Select]    │  │  [Select]    │
└──────────────┘  └──────────────┘  └──────────────┘

Changes apply immediately — no save needed.
Stored in localStorage per device.
```

---

### 3.11 Security
**Future / Placeholder — shown as coming soon.**

- Password policy configuration
- Session management (view active sessions, revoke)
- Two-factor authentication (TOTP) — Phase 2
- Login history / audit log — Phase 2

---

## 4. Immutable Fields

| Field | Why | Set When |
|---|---|---|
| Org Name | Unique tenant identifier | Registration |
| Org Slug | Used in career page URL | Registration (auto-generated) |
| Admin Email | Login credential | Registration |
| User Email | Login credential | User creation |
