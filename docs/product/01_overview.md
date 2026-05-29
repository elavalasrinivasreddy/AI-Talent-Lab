# Product Overview

> Part of the consolidated docs. Start at [`docs/README.md`](../README.md) for the map.
> Sibling docs: [`02_features.md`](02_features.md) · [`03_roadmap.md`](03_roadmap.md)

---

## 1. What we are building

AI Talent Lab is a **conversational AI hiring platform**. The primary interface is a
chat window — recruiters talk to the system, the system does the work. The dashboard
is secondary: a visibility and management layer, not the work layer.

**One-line pitch:**
> "An AI hiring copilot that creates job descriptions through conversation, finds
> matching candidates, manages outreach, and tracks the full hiring pipeline — with
> humans in control of every decision."

---

## 2. Core philosophy

| Principle | What it means |
|---|---|
| **Chat is the work layer** | Recruiters interact via conversation, not forms |
| **AI assists, humans decide** | AI drafts, suggests, enriches — never auto-rejects or auto-hires |
| **Company-first** | Candidate data belongs to the org — no global candidate identity |
| **Magic links over logins** | Candidates and panel members use time-limited links — no accounts |
| **Department isolation always** | Every record and query scoped to org + department |
| **Transparency via communication** | Candidates receive status updates at every stage — no ghosting |

---

## 3. The problem we solve

- Recruiters spend 60–70% of time on repetitive tasks: writing JDs, searching portals, sending emails
- Candidates experience silence — no updates, no feedback, no closure
- Panel members give inconsistent feedback with no structure
- Hiring managers have no pipeline visibility until too late
- Existing ATS tools manage data but don't do the work

**We do the work.**

---

## 4. Who uses this platform

### Platform users (authenticated)

The role model was refactored on 2026-05-28 (commit `28d61da`). Canonical roles live
in `backend/models/auth.py` → `VALID_ORG_ROLES = ("org_head", "dept_admin", "hr", "team_lead")`,
plus `platform_admin` for cross-org operators.

| Role | What they do | Was called |
|---|---|---|
| **org_head** | Manages org settings, departments, team. Full visibility across all departments. Top approver. | admin |
| **dept_admin** | Department-level admin. Approves hire requests before they reach HR. | *(new tier)* |
| **hr** | Uses chat to create JDs, sources candidates, manages pipeline, tracks interviews. Picks up approved hire requests. | recruiter |
| **team_lead** | Views positions/candidates in their department. Files hire requests. Approves the JD before sourcing starts. | hiring_manager |
| **platform_admin** | Cross-org operator (platform admin + dev console surfaces). | — |

### External users (magic link only — no login)

| Role | What they do |
|---|---|
| **Panel member** | Clicks magic link in interview invitation. Views candidate resume + JD. Submits structured feedback. |
| **Candidate** | Clicks magic link in outreach email. Chat-based application. Receives status update emails. |

---

## 5. Three interface layers

```
1. RECRUITER CHAT       — Where JDs are created and hiring workflow is initiated
2. RECRUITER DASHBOARD  — Pipeline tracking, candidate management, analytics
3. CANDIDATE CHAT       — Magic link chat for application and updates
```

Panel members have their own dedicated page (`/panel/:token`) — not one of these three.

---

## 6. End-to-end workflow

### Phase 0 — Hire Request + approval (newer, gates the rest)

```
team_lead / dept_admin / org_head files a hire request
  → dept_admin (or org_head) approves or rejects        [4 email touchpoints]
  → on approval, hr (or org_head) picks it up to start sourcing
  → JD chat opens, pre-seeded from the request
```

Roles enforced in `backend/services/hire_request_service.py`:
`_FILER_ROLES = {team_lead, dept_admin, org_head}`,
`_APPROVER_ROLES = {dept_admin, org_head}`,
`_PICKUP_ROLES = {hr, org_head}`. See
[`design/pages/09_hire_request.md`](../design/pages/09_hire_request.md).

### Phase 1 — JD creation (chat)

```
Recruiter opens chat
  → Types role requirements (or uploads existing JD)
  → System validates, asks clarifying questions if needed
  → Internal Skills Check: AI searches past org JDs (embedding similarity)
    → Shows additional skills as selectable chips (user accepts or skips)
  → Market Research: AI searches competitor JDs via Tavily
    → Shows market skills as selectable chips (user accepts or skips)
  → System generates 3 JD variants side-by-side (editable inline)
    → User selects one
  → Final JD generated (streamed)
  → JD Bias Check: AI scans for biased language (non-blocking)
  → User reviews, can edit or ask AI to refine
  → team_lead approves the JD (approval gate before sourcing — commit 9db825a)
  → Position Setup Modal: headcount, search frequency, ATS threshold, priority
  → Position saved → background candidate search triggered (post-approval)
  → Recruiter redirected to Position Detail page
```

### Phase 2 — Candidate sourcing (background)

```
Background job (daily by default, configurable):
  → Check talent pool first (pool candidates matching JD)
  → Query candidate source adapter (Tavily default; simulation fallback)
  → For each candidate found:
      • Check for duplicate within org (email/phone match)
      • If duplicate + updated <= 7 days: skip
      • If duplicate + older: update profile
      • If new: create candidate + application records
      • Run semantic ATS scoring (not keyword matching)
  → Categorize: above/below ATS threshold
  → Notify recruiter with results
  → Recruiter decides who to contact
  → Outreach emails sent with magic links
```

### Phase 3 — Candidate application (magic link chat)

```
Candidate clicks link in outreach email (or finds position on career page)
  → Opens candidate chat interface (no login needed)
  → AI greets by name, confirms interest
  → If not interested: polite close, session ends
  → If interested:
      • Current role/company confirmation
      • Total + relevant experience
      • Current + expected CTC
      • Notice period / availability
      • Resume upload (PDF/DOCX)
      • Dynamic screening questions from org settings
  → Application saved
  → System auto-sends "interview process overview" email
  → Candidate status -> Applied
  → Recruiter notified
```

### Phase 4 — Interview pipeline (dashboard)

```
Recruiter reviews candidates in Position Detail
  → Views candidate profile (skills match, application, resume)
  → Schedules interview rounds (date, time, panel members, meeting link)
  → System sends invites: candidate (email) + panel members (magic link email)
  → Auto-reminder sent 24h before interview if not already sent
  → Panel members submit feedback via their magic link
  → After all feedback in: recruiter sets round result (passed/rejected)
  → If rejected: system drafts rejection email -> recruiter reviews and sends
  → If all rounds passed: recruiter clicks "Mark as Selected"
```

### Phase 5 — Talent pool (always running)

```
When candidate rejected or position closed/archived:
  → Candidate auto-added to org talent pool
When new position created:
  → AI checks pool for matches and suggests them
  → Recruiter can add pool candidates to new pipeline without sourcing
```

---

## 7. Candidate status state machine

```
Sourced -> Emailed -> Applied -> Screening -> Interview (R1, R2...) -> Selected
                                                                    -> Rejected
```

**Rules:**
- Any round result = Rejected -> system drafts rejection email -> recruiter sends
- All rounds passed -> recruiter clicks "Mark as Selected" -> status = Selected
- Recruiter can manually reject at any stage (pre-screen, budget mismatch, withdrawal)
- System drafts, human sends — never auto-send rejections

Full per-table status enums live in
[`architecture/02_data_model.md`](../architecture/02_data_model.md).

---

## 8. Role permissions

Updated to current role names. Source of truth is the role checks scattered through
`backend/routers/*` and `backend/services/*`; this table is the human summary.

| Action | org_head | dept_admin | hr | team_lead | Panel (link) | Candidate (link) |
|---|---|---|---|---|---|---|
| File hire request | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Approve hire request | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Pick up approved request (source) | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Create positions | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Generate JDs via chat | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Approve JD before sourcing | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| View all dept positions | ✅ | ✅ | ✅ | ✅ (assigned) | ❌ | ❌ |
| View all org positions | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Source + outreach | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Change candidate status | ✅ | ✅ | ✅ | ✅ (assigned) | ❌ | ❌ |
| Schedule interviews | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Submit scorecard | ❌ | ❌ | ❌ | ❌ | ✅ (via link) | ❌ |
| Mark as selected | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Send rejection email | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage team | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Edit org settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage talent pool | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View dashboard | ✅ (full org) | ✅ (dept) | ✅ (own dept) | ✅ (assigned) | ❌ | ❌ |
| Submit application | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (via link) |

---

## 9. Key developer rules (invariants)

1. **Every DB query filters by `org_id`** — if it doesn't, it's a security bug
2. **Never auto-send rejection emails** — system drafts, human sends
3. **Magic links are time-limited and single-use** (panel feedback)
4. **AI enriches, humans decide** — AI output always shown to user before acting
5. **Adapter pattern for all external services** — never hardcode a provider
6. **Background tasks for long operations** — search, scoring, email blasts
7. **PipelineEvent for every meaningful action** — this powers Timeline + analytics
8. **Department isolation from day one** — adding it later requires touching everything
9. **API versioning** — all routes under `/api/v1/` from day one
