# Page Design: Settings
> **Version 2.1 — Updated**
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
