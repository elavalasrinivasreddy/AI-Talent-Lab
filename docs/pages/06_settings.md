# Page Design: Settings

> Organization profile, team management, competitor management, email templates, appearance, and security.

---

## 1. Overview

| Aspect | Detail |
|--------|--------|
| Route | `/settings` · `/settings/:tab` |
| Auth | Required (JWT) |
| Layout | Sidebar + Settings layout (left tabs + right content) |
| Tabs | Profile, Organization, Team Members, Departments, Competitors, Screening Questions, Email/Message Templates, Interview Templates, Integrations, Appearance, Security |

---

## 2. Page Layout

```
┌──────┬──────────────────────────────────────────────────────────┐
│      │  ┌─ Header ─────────────────────────────────────────┐   │
│      │  │ ⚙️ Settings                                      │   │
│      │  │ Manage your account and organization             │   │
│      │  └──────────────────────────────────────────────────┘   │
│ S    │                                                          │
│ I    │  ┌─ Settings Layout ────────────────────────────────┐   │
│ D    │  │ ┌────────────┐ ┌────────────────────────────────┐│   │
│ E    │  │ │ Tab List   │ │ Tab Content                    ││   │
│ B    │  │ │            │ │                                ││   │
│ A    │  │ │ 👤 Profile │ │  (see each tab below)         ││   │
│ R    │  │ │ 🏢 Org     │ │                                ││   │
│      │  │ │ 👥 Team    │ │                                ││   │
│      │  │ │ 🏷️ Compet. │ │                                ││   │
│      │  │ │ 📧 Email   │ │                                ││   │
│      │  │ │ 🎨 Theme   │ │                                ││   │
│      │  │ │ 🔐 Security│ │                                ││   │
│      │  │ └────────────┘ └────────────────────────────────┘│   │
│      │  └──────────────────────────────────────────────────┘   │
└──────┴──────────────────────────────────────────────────────────┘
```

---

## 3. Tab Details

### 3.1 Profile Tab
**All roles can access.**

| Field | Type | Editable | Notes |
|-------|------|----------|-------|
| Name | text | ✅ | User's display name |
| Email | text | ❌ (read-only) | Immutable — primary login |
| Role | text | ❌ (read-only) | Set by admin |
| Organization | text | ❌ (read-only) | From org table |
| Department | text | ❌ (read-only) | Assigned by admin |
| Phone | text | ✅ | Optional |
| Avatar | file upload | ✅ | Profile photo |

**Actions:**
- [Save Profile] — updates name, phone, avatar
- [Change Password] — opens password change form (current password + new + confirm)

### 3.2 Organization Tab
**Admin only can edit. Others view read-only.**

| Field | Type | Editable | Notes |
|-------|------|----------|-------|
| Organization Name | text | ❌ (immutable) | Set at registration |
| Industry / Segment | dropdown | ✅ | Technology, Healthcare, etc. |
| Company Size | radio | ✅ | startup / smb / enterprise |
| Website | url | ✅ | Company website |
| Headquarters | text | ✅ | City, Country |
| About Us | textarea | ✅ | **Inserted into every JD "About Us" section** |
| Culture Keywords | tags input | ✅ | e.g., "innovation, remote-first, diversity" |
| Benefits Template | textarea | ✅ | Standard benefits included in JDs |
| LinkedIn | url | ✅ | Company LinkedIn page |
| Glassdoor | url | ✅ | Company Glassdoor page |
| Logo | file upload | ✅ | Organization logo |

**Actions:**
- [Save Changes] — updates all mutable fields
- Success toast: "Organization profile updated ✅"

### 3.3 Team Members Tab
**Admin only.**

```
┌─────────────────────────────────────────────────────────────────┐
│  👥 Team Directory                    [+ Add Team Member]      │
│                                                                  │
│  [🔍 Search by name or email...]                               │
│                                                                  │
│  Name          │ Email              │ Role         │ Dept  │ Act│
│  ──────────────┼────────────────────┼──────────────┼───────┼────│
│  Srinivas R    │ sri@company.com    │ 🟣 Admin     │ Eng   │ ✅ │
│  Priya S       │ priya@company.com  │ 🔵 Recruiter │ Eng   │ ✅ │
│  Rahul K       │ rahul@company.com  │ 🟢 Hiring Mgr│ Mktg  │ ✅ │
│  Neha P        │ neha@company.com   │ 🔵 Recruiter │ Sales │ ❌ │
│                                                                  │
│  ┌── Add User Form ────────────────────────────────────────┐   │
│  │  Name: [              ]                                 │   │
│  │  Email: [              ]                                │   │
│  │  Password: [              ]                             │   │
│  │  Role: [Recruiter ▼]                                    │   │
│  │  Department: [Engineering ▼]                            │   │
│  │                                                         │   │
│  │  [+ Add User]                                           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**User actions (per row):**
- Edit role (dropdown)
- Edit department (dropdown)
- Deactivate / Reactivate toggle
- Cannot delete users (only deactivate)

### 3.4 Competitors Tab
**Admin and Recruiter can manage.**

```
┌─────────────────────────────────────────────────────────────────┐
│  🏷️ Competitor Companies                   [+ Add Competitor]  │
│                                                                  │
│  These companies are used for market benchmarking when          │
│  generating JDs. Top 3 are used per search.                    │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Google   │ │ Flipkart │ │ Razorpay │ │ Infosys  │          │
│  │ Tech     │ │ E-comm   │ │ FinTech  │ │ IT Serv  │          │
│  │ [✏️] [🗑️]│ │ [✏️] [🗑️]│ │ [✏️] [🗑️]│ │ [✏️] [🗑️]│          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                  │
│  ┌── Add Competitor ───────────────────────────────────────┐   │
│  │  Company Name: [              ]                         │   │
│  │  Website: [              ]                              │   │
│  │  Industry: [Technology ▼]                               │   │
│  │  Notes: [              ]                                │   │
│  │  [Add]                                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.5 Screening Questions Tab
**Admin only. Controls dynamic application form fields.**

```
┌─────────────────────────────────────────────────────────────────┐
│  ❓ Screening Questions              [+ Add Question]           │
│                                                                  │
│  Department: [All (Org Default) ▼]                              │
│                                                                  │
│  These questions appear on the public application form when     │
│  candidates click the magic link.                               │
│                                                                  │
│  # │ Label              │ Type     │ Required │ Actions         │
│  ──┼────────────────────┼──────────┼──────────┼────────────────│
│  1 │ Notice Period      │ select   │ ✅       │ [✏️] [🗑️] [↕️]│
│    │ Options: Immediate, 15d, 30d, 60d, 90d                    │
│  2 │ Current Salary     │ number   │ ✅       │ [✏️] [🗑️] [↕️]│
│  3 │ Expected Salary    │ number   │ ✅       │ [✏️] [🗑️] [↕️]│
│  4 │ Total Experience   │ number   │ ✅       │ [✏️] [🗑️] [↕️]│
│  5 │ Availability       │ text     │ ❌       │ [✏️] [🗑️] [↕️]│
│                                                                  │
│  ┌── Add Question ─────────────────────────────────────────┐    │
│  │  Label: [              ]                                │    │
│  │  Type: [text ▼]  (text/textarea/select/number/date)     │    │
│  │  Options (for select): [Opt 1, Opt 2, ...]              │    │
│  │  Required: [☐]                                          │    │
│  │  [Add]                                                  │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

- Department dropdown: set questions per-department or org-wide default
- Drag to reorder (↕️)
- Questions stored in `screening_questions` table
- Dynamic form generated on public apply page from these questions

### 3.6 Email/Message Templates Tab
**Admin only.**

```
┌─────────────────────────────────────────────────────────────────┐
│  📧 Message Templates                  [+ New Template]         │
│                                                                  │
│  Channel: [All ▼]  Category: [All ▼]                            │
│                                                                  │
│  ┌── Initial Outreach (Email) ─────────────────────────────┐   │
│  │  Subject: Exciting opportunity at {{org_name}}          │   │
│  │  Preview: Hi {{candidate_name}}, we found your profile...│  │
│  │  [✏️ Edit] [📋 Duplicate] [🗑️ Delete]                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌── Follow-up (Email) ────────────────────────────────────┐   │
│  │  Subject: Following up — {{role_name}} at {{org_name}}  │   │
│  │  Preview: Hi {{candidate_name}}, just checking in...     │  │
│  │  [✏️ Edit] [📋 Duplicate] [🗑️ Delete]                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌── WhatsApp Outreach ────────────────────────────────────┐   │
│  │  Preview: Hi {{candidate_name}}! {{org_name}} has an     │  │
│  │  opening for {{role_name}}. Interested?                   │  │
│  │  [✏️ Edit] [📋 Duplicate] [🗑️ Delete]                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Variables: {{candidate_name}}, {{role_name}}, {{org_name}},    │
│  {{match_score}}, {{magic_link}}, {{schedule_link}}             │
│  Test: [Send test to self]                                      │
└─────────────────────────────────────────────────────────────────┘
```

- Multi-channel: email, WhatsApp, SMS templates
- Categories: outreach, follow_up, rejection, offer, custom
- Template variables with preview rendering
- Test send to own email/phone

### 3.7 Interview Templates Tab
**Admin only. Default scorecard templates for structured evaluation.**

```
┌─────────────────────────────────────────────────────────────────┐
│  🎯 Interview Scorecard Templates      [+ New Template]         │
│                                                                  │
│  ┌── Default Technical Template ───────────────────────────┐   │
│  │  Dimensions:                                            │   │
│  │  • Technical Skills     Weight: 40%                     │   │
│  │  • Problem Solving      Weight: 25%                     │   │
│  │  • Communication        Weight: 20%                     │   │
│  │  • Culture Fit          Weight: 15%                     │   │
│  │  [✏️ Edit] [📋 Duplicate]                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌── Behavioral Template ──────────────────────────────────┐   │
│  │  Dimensions:                                            │   │
│  │  • Leadership           Weight: 30%                     │   │
│  │  • Teamwork             Weight: 25%                     │   │
│  │  • Communication        Weight: 25%                     │   │
│  │  • Adaptability         Weight: 20%                     │   │
│  │  [✏️ Edit] [📋 Duplicate]                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Note: AI auto-generates position-specific scorecards from JD. │
│  These are fallback templates used when AI generation is off.   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.8 Integrations Tab
**Admin only. API keys and third-party connections.**

```
┌─────────────────────────────────────────────────────────────────┐
│  🔗 Integrations                                                │
│                                                                  │
│  ── Job Portals ────────────────────────────────────────────    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ LinkedIn     │ │ Naukri       │ │ Indeed       │            │
│  │ 🔴 Not setup │ │ 🔴 Not setup │ │ 🔴 Not setup │            │
│  │ [Configure]  │ │ [Configure]  │ │ [Configure]  │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                  │
│  ── Communication ──────────────────────────────────────────    │
│  ┌──────────────┐ ┌──────────────┐                              │
│  │ WhatsApp     │ │ SMTP/Email   │                              │
│  │ 🔴 Not setup │ │ 🔴 Not setup │                              │
│  │ [Configure]  │ │ [Configure]  │                              │
│  └──────────────┘ └──────────────┘                              │
│                                                                  │
│  ── Calendar ───────────────────────────────────────────────    │
│  ┌──────────────┐ ┌──────────────┐                              │
│  │ Google Cal   │ │ Outlook      │                              │
│  │ 🔴 Not setup │ │ 🔴 Not setup │                              │
│  │ [Connect]    │ │ [Connect]    │                              │
│  └──────────────┘ └──────────────┘                              │
│                                                                  │
│  ── Notifications ──────────────────────────────────────────    │
│  ┌──────────────┐                                               │
│  │ Slack        │                                               │
│  │ 🔴 Not setup │                                               │
│  │ [Connect]    │                                               │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

### 3.9 Appearance Tab
**All roles.**

```
┌─────────────────────────────────────────────────────────────────┐
│  🎨 Theme                                                      │
│                                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │  ☀️ Light    │ │  🌙 Dark     │ │  💻 System   │           │
│  │  Clean white │ │  Dark mode   │ │  Follow OS   │           │
│  │  interface   │ │  (default)   │ │  setting     │           │
│  │  [Selected]  │ │              │ │              │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
│                                                                  │
│  Changes apply immediately — no save needed.                    │
└─────────────────────────────────────────────────────────────────┘
```

### 3.7 Security Tab
**Future enhancement. Placeholder for now.**

- Password policy configuration
- Session timeout settings
- Two-factor authentication (TOTP)
- Active sessions list
- Login history / audit log

---

## 4. Backend Integration

| Action | API Endpoint | Method |
|--------|-------------|--------|
| Get profile | `/api/auth/me` | GET |
| Update profile | `/api/auth/profile` | PATCH |
| Change password | `/api/auth/change-password` | POST |
| Get org | `/api/settings/org` | GET |
| Update org | `/api/settings/org` | PATCH |
| List users | `/api/auth/users` | GET |
| Add user | `/api/auth/add-user` | POST |
| Update user | `/api/auth/users/:id` | PATCH |
| List competitors | `/api/settings/competitors` | GET |
| Add competitor | `/api/settings/competitors` | POST |
| Delete competitor | `/api/settings/competitors/:id` | DELETE |
| List departments | `/api/settings/departments` | GET |
| Create department | `/api/settings/departments` | POST |
| List screening Qs | `/api/settings/screening-questions` | GET |
| Add screening Q | `/api/settings/screening-questions` | POST |
| Update screening Q | `/api/settings/screening-questions/:id` | PATCH |
| Delete screening Q | `/api/settings/screening-questions/:id` | DELETE |
| List templates | `/api/settings/message-templates` | GET |
| Create template | `/api/settings/message-templates` | POST |
| Update template | `/api/settings/message-templates/:id` | PATCH |
| Delete template | `/api/settings/message-templates/:id` | DELETE |
| List scorecard tmpls | `/api/settings/scorecard-templates` | GET |
| Create scorecard tmpl | `/api/settings/scorecard-templates` | POST |

---

## 5. What's Immutable

| Field | Why | Set When |
|-------|-----|----------|
| Org Name | Unique tenant identifier, used in URLs/references | Registration |
| Admin Email | Primary account, login credential | Registration |
| Org ID | Internal identifier, used everywhere | Registration |
| User Email | Login credential, used for notifications | User creation |
