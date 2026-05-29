> **Build status:** ❌ Not redesigned — old UI live
> Consolidated docs index: [../../README.md](../../README.md) · Status tracker: [../../STATUS.md](../../STATUS.md) · Design system: [../00_design_system.md](../00_design_system.md)
> This page merges the v3 redesign spec with the pre-v3 behavioral spec (appendix below, where one existed).

# Page 03 — Position Detail (Pipeline tab focus)

**Pattern:** *Stack-ranked list per stage* (variant **B**)
**Replaces:** Kanban + Grid toggle (Grid was default; Kanban hidden behind a toggle)
**Why:** Kanban cards lie — equal size hides time-in-stage, ATS strength, AI vs human source, AI confidence. Stack-ranked rows show all of it on one screen and triage 5× faster.

Preview reference: `/tmp/atl-design-preview-v3.html` → tab "Position Detail".
Existing doc this supersedes: `docs/pages/04_position_detail.md` (Pipeline tab section).

---

## 1. Route & layout

| Aspect | Value |
|---|---|
| Route | `/positions/:id` and `/positions/:id/:tab` (tabs: `pipeline` default, `candidates`, `jd`, `kit`, `activity`, `settings`) |
| Auth | Required (JWT) |
| Layout | App shell · breadcrumb · hero · 7-stage stat strip → tabs → tab content |

---

## 2. Backend tie-in

| Endpoint | Used for |
|---|---|
| `GET /api/v1/positions/{id}` | Hero data (title, status, comp, location, dept, owner) |
| `GET /api/v1/positions/{id}/pipeline-summary` | 7-stage counts + stage health (avg time-in-stage, pass-through, AI confidence) — **partially new** (see §8) |
| `GET /api/v1/candidates/position/{id}?stage=screening&page=1&sort=ats_desc` | Ranked candidate rows for active stage |
| `PATCH /api/v1/candidates/{id}/status` | Stage transitions ("Move →" button) |
| `POST /api/v1/candidates/{id}/draft-rejection` | R-key shortcut |
| `POST /api/v1/interviews/` | I-key shortcut |
| `POST /api/v1/positions/{id}/search-now` | Hero "Run Search" button |

---

## 3. Page layout (top to bottom)

```
[ breadcrumb:  Positions › Senior ML Engineer ]

[ HERO ]
  Title (big) · status chip · meta (dept · location · comp · days · owner)
  Tags row (AI-generated JD, code, remote-friendly, urgent)                  [Share] [Run Search] [Add Candidate]

[ 7-STAGE STAT STRIP — each stage clickable, top accent in stage color ]
  Sourced 34 (+6 today)  Emailed 28 (+4)  Applied 18 (+2)  Screening 9 (avg 3.4d)  Interview 5  Selected 1  Rejected 2

[ TABS:  Pipeline · Candidates · JD (v2.1) · Interview Kit · Activity · Settings ]

[ STAGE HEALTH HEADER for active stage ]
  Stage name + count + 2-step ATS line · avg-time-in-stage (warn if exceeded target) · AI confidence · pass-through % · saturation bar

[ keyboard shortcut hint bar:  E=Email · I=Schedule · R=Reject · M=Move · ↑↓ Navigate ]

[ STACK-RANKED ROWS ] (one row per candidate, sorted by ATS desc)
   #1  [94 ATS]  Alex Chen · 8 yrs · Inflection · Bangalore   [+12 skills] [+8 yrs] [−K8s cert]   [skills chips]   AI-sourced  5h in stage   [Move →] [I] [⋯]
   #2  [88 ATS]  Maya Patel · 7 yrs · Google · Bangalore     ...
   #3  [82 ATS]  Ravi Singh · 6 yrs · Razorpay · Bangalore   ...
   ...

[ FOOTER row ]
  [Bulk: select all] [Smart-select ≥80% ATS] [Smart-select last 7d sourced]
                              Showing 5 of 9 in Screening · show all · switch to Kanban view
```

---

## 4. Stack-ranked row anatomy

```
[ rank ] [ ats score+label ] [ avatar + name + sub ] [ reasoning chips ] [ skills chips ] [ source ] [ time-in-stage ] [ actions ]
   #1       [94 ATS]             [AC] Alex Chen          [+12][+8][−K8s]   [Python][PyTorch]   AI-sourced    5h          [Move →][I][⋯]
                                       8 yrs · Inflection
```

| Cell | Notes |
|---|---|
| **rank** | `#N` font-mono — survives sort; lets you reference candidates by rank verbally |
| **ATS** | Color by band: high (≥80) green, mid (60–79) amber, low (<60) red. Number is huge — the most important visual signal. |
| **identity** | Avatar (initials) + name + sub line ("8 yrs · Inflection AI · Bangalore"). Avatar gradient varies for visual distinction. |
| **reasoning chips** | Pulled from `candidate_applications.skill_match_data.matched_skills/missing_skills/experience_match`. Format: `+N skills` (green), `−Xitem` (red). **Max 3 chips visible** — overflow shown on hover. |
| **skills chips** | Top 3 skills + `+N` overflow. |
| **source** | AI-sourced (teal, with chip icon) / Referral / Career page / etc. Distinguishing AI vs human at the row level is critical (see §5). |
| **time-in-stage** | "5h" / "2d" / "5d (stale)". Stale = > stage target (per stage health). Stale rows shown in `--warn`. |
| **actions** | `[Move →]` primary (advance to next stage), `[I]` schedule interview, `[⋯]` overflow menu (Move to X · Schedule · Draft Rejection · Add to Pool). |

Row click → `/candidates/:id` with `location.state = { from: '/positions/:id', fromTab: 'pipeline', fromLabel: 'Back to Senior ML Engineer' }`.

---

## 5. Why AI-sourced vs human-added is a first-class distinction

Backend has `pipeline_events.event_type = 'sourced' | 'manually_added'` (or similar). Surface this:

- **Source chip** is one of: `AI-sourced` (teal, with CPU icon) / `Referral` / `Career page` / `LinkedIn` / `Manual upload`.
- **Analytics page** (`06_analytics.md`) builds its core narrative on this distinction.
- **Stage health** AI confidence metric is meaningful primarily for AI-sourced candidates.

---

## 6. Stage Health header

For the currently active stage, show:

| Metric | Source | Display |
|---|---|---|
| Stage name + count | `pipeline-summary` | "● Screening · 9 candidates" |
| 2-step ATS reminder | static | "2-step ATS: embedding → LLM analysis · threshold 80%" |
| Avg time in stage | aggregate of (`now() - stage_entered_at`) for current candidates | "3.4d · target ≤ 2d" (warn color if exceeded) |
| AI confidence | mean(`skill_match_data.confidence`) | "High · 0.83" |
| Pass-through rate | candidates moved out of stage / candidates entered stage (last 30d) | "56% · healthy" |
| Saturation bar | (current count / position headcount target × stage multiplier) | linear bar 0-100% |

These metrics turn the stage tab from a passive count into an active health signal.

---

## 7. Keyboard shortcuts

Implemented globally for the pipeline tab when a row has focus (via arrow keys):

| Key | Action |
|---|---|
| ↑ / ↓ | Move focus row |
| → | Open candidate detail in same tab (preserves back nav) |
| **E** | Trigger outreach email modal for focused candidate |
| **I** | Open Schedule Interview modal (see existing `ScheduleInterviewModal`) |
| **R** | Trigger Draft Rejection — opens modal with AI-drafted email |
| **M** | Open "Move to" stage picker (popover) |
| `?` | Show all shortcuts overlay |

Use `useKeyboardShortcuts` hook (new) bound to focused row's candidate ID. Per PRODUCT_IMPROVEMENTS §3.2 recommendation.

---

## 8. New / changed backend

Mostly read-only, but the **pipeline-summary** endpoint needs richer fields:

```
GET /api/v1/positions/{id}/pipeline-summary
{
  stages: {
    sourced: { count: 34, delta_today: 6 },
    emailed: { count: 28, delta_today: 4 },
    applied: { count: 18, delta_today: 2 },
    screening: {
      count: 9,
      avg_time_in_stage_days: 3.4,
      target_time_in_stage_days: 2,
      ai_confidence_mean: 0.83,
      pass_through_30d: 0.56,
      saturation: 0.68,
    },
    interview: { count: 5, panels_this_week: 3 },
    selected: { count: 1, awaiting_accept: true },
    rejected: { count: 2, rate: 0.12 }
  }
}
```

Additive — wraps existing data plus a few aggregations. ~40 lines in `backend/repos/dashboard.py` + `services/dashboard_service.py`. **Recommended** — without it, stack-ranked view loses its biggest advantage over kanban (the stage-health header).

---

## 9. Other tabs (less changed but still in scope)

- **Candidates tab** (list view): keep current implementation but apply v3 visual tokens (chip styles, no emojis, font swap).
- **JD tab**: keep current; the JD redesign happens in the JD Chat flow (`05_jd_chat.md`), not here. Add small "edit in chat session" CTA.
- **Interview Kit tab**: keep current; visual token pass.
- **Activity tab**: keep current; visual token pass. @mention support already works.
- **Settings tab**: keep current; visual token pass. Most settings are now also accessible via `07_settings.md` AI Behavior Console — eventually deprecate per-position settings duplicates.

---

## 10. Components to build / refactor

| Component | Path | Notes |
|---|---|---|
| `<PositionDetailPage>` | `frontend/src/components/Positions/PositionDetailPage.jsx` | Refactor (214 lines) — owns tab routing, hero, stat strip |
| `<PositionHero>` | `Positions/PositionHero.jsx` | New — title, meta, actions |
| `<StageStatStrip>` | `Positions/StageStatStrip.jsx` | New — 7 clickable stage cells with top accent |
| `<PipelineStackView>` | `Positions/PipelineStackView.jsx` | New — owns Stage Health header + rows |
| `<StageHealthHeader>` | `Positions/StageHealthHeader.jsx` | New |
| `<CandidateRankedRow>` | `Positions/CandidateRankedRow.jsx` | New — the stack-ranked row |
| `<PipelineKanbanView>` | `Positions/PipelineKanbanView.jsx` | Keep as toggleable secondary view (use existing PipelineTab.css) |
| `useKeyboardShortcuts` hook | `frontend/src/hooks/useKeyboardShortcuts.js` | New |

---

## 11. Empty / loading / error states

| Condition | Display |
|---|---|
| No candidates in active stage | "No candidates in this stage yet. [Run AI search] · [Add manually]" |
| Position has no candidates anywhere | Whole-page CTA: "Trigger first search" with backend call to `POST /positions/:id/search-now` |
| Pipeline summary fails | Show stage counts from fallback endpoint, hide health header with banner "Stage health unavailable" |
| Row action fails (Move) | Toast: "Couldn't move. Try again or check API" — row remains in stage |


---

## Appendix — pre-v3 behavioral spec & flows

_Retained from the original `docs/pages/` spec for workflow, edge-case, and API detail. The v3 spec above supersedes the **visual** design; the behavior here is still the reference._

# Page Design: Position Detail
> **Version 2.1 — Updated**
> Deep-dive into a single hiring position. Tabs: Pipeline, Candidates, JD, Interview Kit, Activity, Settings.
> All candidate navigation is context-aware. API endpoints updated to /api/v1/ prefix.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Route | `/positions/:id` · `/positions/:id/:tab` |
| Auth | Required (JWT) |
| Entry Points | Dashboard → click position row · Sidebar → active sessions |
| Layout | Sidebar + full-width detail with tabs |

---

## 2. Page Layout

```
┌──────┬──────────────────────────────────────────────────────────┐
│      │  ← Dashboard                                            │
│      │                                                          │
│      │  ┌── POSITION HEADER ─────────────────────────────────┐ │
│ S    │  │  Senior Python Developer        Status: [Open ▼]   │ │
│ I    │  │  Engineering · Created Apr 5 · by Srinivas R        │ │
│ D    │  │  Priority: 🔴 Urgent  ·  Headcount: 2  ·  Deadline: May 15 │
│ E    │  └────────────────────────────────────────────────────┘ │
│ B    │                                                          │
│ A    │  ┌── STATS ROW ───────────────────────────────────────┐ │
│ R    │  │  👥 24 Sourced  │ 📧 18 Emailed  │ 📝 8 Applied  │ 🎙️ 3 Interview │
│      │  └────────────────────────────────────────────────────┘ │
│      │                                                          │
│      │  ┌── TABS ────────────────────────────────────────────┐ │
│      │  │ [Pipeline][Candidates][JD][Interview Kit][Activity][Settings] │
│      │  └────────────────────────────────────────────────────┘ │
│      │                                                          │
│      │  ┌── TAB CONTENT ─────────────────────────────────────┐ │
│      │  │  (see sections below)                              │ │
│      │  └────────────────────────────────────────────────────┘ │
└──────┴──────────────────────────────────────────────────────────┘
```

---

## 3. Tab Content

### 3.1 Pipeline Tab (Grid + Kanban Toggle)

**Default view: Tab-based Grid.** Toggle to Kanban with the view switcher in the tab header.

```
[▦ Grid]  [▥ Kanban]   ← view toggle, top-right of Pipeline tab

── TAB-BASED GRID VIEW ──────────────────────────────────────────────
[Sourced (8)] [Emailed (6)] [Applied (4)] [Screening (2)] [Interview (3)] [Selected (1)] [Rejected (4)]
     ↑ active tab highlighted with stage color

┌── Sourced ───────────── [🔍 Search...] [Sort: Score ▼] ──────────────┐
│                                                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │
│  │ [RK] 92%    │  │ [SM] 88%    │  │ [AT] 85%    │                   │
│  │ Rahul K.    │  │ Sanya M.    │  │ Arjun T.    │                   │
│  │ TechCorp    │  │ Google      │  │ Flipkart    │                   │
│  │ 6 yrs · Blr │  │ 5 yrs · Del │  │ 7 yrs · Hyd │                   │
│  │ Python,Fast │  │ ML,Python   │  │ Java,Spring │                   │
│  │ [📧][📅][⋯]│  │ [📧][📅][⋯]│  │ [📧][📅][⋯]│                   │
│  └─────────────┘  └─────────────┘  └─────────────┘                   │
│                                                                        │
│  ← Prev  Page 1 of 2  Next →                                          │
└────────────────────────────────────────────────────────────────────────┘
```

**Grid card:** ATS score circle (top-right), initials avatar (top-left), name/company/exp/location, top 2–3 skills, quick actions row (📧 Email, 📅 Schedule, ⋯ More).

**Sort options per tab:** Score (high→low), Name, Date added, Experience.

**Search:** per-tab search bar — filters candidates within that stage.

---

**Kanban view (toggle):**

```
Sourced (8)   │ Emailed (6)  │ Applied (4)  │ Screening (2) │ Interview (3) │ ✅(1) │ ❌(4)
──────────────┼──────────────┼──────────────┼───────────────┼───────────────┼──────┼──────
┌──────────┐  │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐  │ ┌──────────┐  │      │
│ Rahul K  │  │ │ Priya S  │ │ │ Amit R   │ │ │ Neha P   │  │ │ Sanya M  │  │      │
│ 85% ●    │  │ │ 78% ●    │ │ │ 92% ●    │ │ │ 74% ●    │  │ │ 88% ●    │  │      │
│ TechCorp │  │ │ InfoSys  │ │ │ Flipkart │ │ │ Wipro    │  │ │ Google   │  │      │
│ [...]    │  │ │ [...]    │ │ │ [...]    │ │ │ [...]    │  │ │ [...]    │  │      │
└──────────┘  │ └──────────┘ │ └──────────┘ │ └──────────┘  │ └──────────┘  │      │
```

**"..." menu options (both views):**
```
Move to: Emailed | Applied | Screening | Interview | On Hold
Schedule Interview
Draft Rejection Email
Add to Talent Pool
```

**Card click:** navigate to `/candidates/:id` (position context in `location.state`).

---

### 3.2 Candidates Tab (List View)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Status ▼] [Score ▼] [Source ▼] [🔍 Search...]      [📧 Bulk Email] │
│                                                                      │
│ ☐ │ Name          │ Score    │ Status      │ Source      │ Exp      │
│ ──┼───────────────┼──────────┼─────────────┼─────────────┼──────────│
│ ☐ │ Amit R        │ ●92%     │ Applied     │ Simulation  │ 7 yrs   │
│ ☐ │ Sanya M       │ ●88%     │ Interview   │ Simulation  │ 5 yrs   │
│ ☐ │ Rahul K       │ ●85%     │ Sourced     │ Simulation  │ 6 yrs   │
│ ☐ │ Arjun T       │ ○81%     │ Emailed     │ Simulation  │ 5 yrs   │
│ ☐ │ Lisa W        │ ○72%     │ Screening   │ Career Page │ 8 yrs   │
│                                                                      │
│ Bulk: [Select all]  With selected: [📧 Send Email] [⏭ Status ▼]    │
│ ← Prev  Page 1 of 3  Next →                                         │
└──────────────────────────────────────────────────────────────────────┘
```

- Score dots: ● green (≥80%), ● amber (60–79%), ○ red (<60%)
- Click row → `/candidates/:id` with position + tab context
- Sortable columns (click header)
- Bulk actions: send outreach email, change status

---

### 3.3 JD Tab

```
┌──────────────────────────────────────────────────────────────────────┐
│  📄 Job Description         [✏️ Edit]  [📥 PDF]  [📥 Markdown]       │
│  ────────────────────────────────────────────────────────────────    │
│                                                                      │
│  # Senior Python Developer                                           │
│                                                                      │
│  ## About TechCorp                                                   │
│  {org.about_us content from settings — pulled automatically}        │
│                                                                      │
│  ## Role Overview  ...                                               │
│  ## Responsibilities  ...                                            │
│  ## Requirements  ...                                                │
│  ## Benefits  ...                                                    │
│                                                                      │
│  (rendered markdown)                                                 │
│                                                                      │
│  [View original chat session →]                                     │
│  [🌐 Showing on career page]  ·  [Hide from career page]            │
└──────────────────────────────────────────────────────────────────────┘
```

**Edit mode:** Click Edit → textarea with raw markdown. Click Save → re-renders.
**Career page toggle:** Shows whether position is visible on public career page. Toggle hides/shows it without changing position status.

---

### 3.4 Interview Kit Tab

```
┌──────────────────────────────────────────────────────────────────────┐
│  🎯 Interview Kit      [🔄 Regenerate]  [📤 Share Link to Interviewers] │
│                                                                      │
│  ── Technical Questions (5) ─────────────────────────────────────   │
│  1. Explain how Python's GIL affects multithreading performance.    │
│     Difficulty: Senior | Expected: CPU-bound vs IO-bound...         │
│  2. Design a rate-limiting middleware in FastAPI.                   │
│     Difficulty: Senior | Expected: Redis, token bucket...           │
│                                                                      │
│  ── Behavioral Questions (3) ────────────────────────────────────   │
│  1. Describe a time you had to debug a critical production issue.   │
│     Expected: STAR format, shows ownership and systematic approach  │
│                                                                      │
│  ── Situational Questions (2) ───────────────────────────────────   │
│  1. If you inherited a poorly documented codebase, what would...    │
│                                                                      │
│  ── Culture Fit Questions (2) ───────────────────────────────────   │
│  1. What does remote-first collaboration look like to you?          │
│     (Based on org culture keyword: "remote-first")                  │
│                                                                      │
│  ── Scorecard Template ──────────────────────────────────────────   │
│  Technical Skills (40%) │ Problem Solving (30%) │                   │
│  Communication (15%)    │ Culture Fit (15%)                         │
│  [✏️ Edit Dimensions]                                                │
└──────────────────────────────────────────────────────────────────────┘
```

- Generated by AI after JD is finalized (auto-triggered or manually via button)
- Share Link generates a shareable URL for interviewers (no platform account needed)
- Questions categorized: Technical, Behavioral, Situational, Culture Fit
- Culture Fit questions derive from org's `culture_keywords` in settings
- Scorecard template pulled from Settings → Interview Templates (or org default)

---

### 3.5 Activity Tab

```
┌──────────────────────────────────────────────────────────────────────┐
│  📜 Team Activity                           [Filter: All ▼]         │
│                                                                      │
│  Apr 12, 15:30  💬 Neha P commented on Priya Sharma                 │
│                 "Strong technical skills, let's go to round 2"      │
│                                                                      │
│  Apr 12, 14:00  📋 Raj K submitted scorecard for Priya S            │
│                 Overall: 4.2/5 · Recommendation: Yes                │
│                                                                      │
│  Apr 11, 10:00  📅 Interview scheduled: Priya S — Round 1 Technical │
│                 Apr 12 · 2:00 PM · Raj K, Neha P                   │
│                                                                      │
│  Apr 10, 14:32  📝 Amit R applied via magic link                    │
│                                                                      │
│  Apr 9, 11:00   🤖 AI search completed: 24 candidates found         │
│                 8 above 80% threshold, 16 below                     │
│                                                                      │
│  ── Comment ─────────────────────────────────────────────────────   │
│  [SR]  Write a comment... @mention team members         [Post]      │
└──────────────────────────────────────────────────────────────────────┘
```

- Shows ALL activity on this position: candidate events, comments, interviews, scorecards
- @mention support: type `@` to see team members → mention creates notification for that person
- Filter options: All, Comments, Emails, Scorecards, Status Changes, Interviews

---

### 3.6 Settings Tab

```
┌──────────────────────────────────────────────────────────────────────┐
│  ⚙️ Position Settings                                               │
│                                                                      │
│  ── Auto Candidate Search ──────────────────────────────────────    │
│  Frequency:  [Daily ▼]  (Manual / Daily / Every 2 days / Weekly)    │
│  Last run:   Apr 12, 2026 at 10:30 AM                               │
│  Next run:   Apr 13, 2026 at 10:30 AM                               │
│  [🔍 Run Now]     [⏸ Pause Search]                                  │
│                                                                      │
│  ── ATS Threshold ──────────────────────────────────────────────    │
│  Minimum match score:  [80%  ▼]                                     │
│  (60% / 70% / 75% / 80% / 85% / 90%)                               │
│                                                                      │
│  ── Auto Follow-up (Outreach Reminder) ─────────────────────────    │
│  If candidate doesn't click link within:                            │
│  [48 hours ▼]  (Disabled / 24h / 48h / 72h)                        │
│  → System auto-sends follow-up email using "Follow-up" template     │
│  Note: Only one follow-up per candidate per position. Never sent    │
│  to candidates who have already clicked or applied.                 │
│                                                                      │
│  ── Position Details ───────────────────────────────────────────    │
│  Headcount:    [2]                                                   │
│  Priority:     [Urgent ▼]                                           │
│  Deadline:     [2026-05-15]                                         │
│  Assigned to:  [Srinivas R ▼]                                       │
│  Department:   [Engineering ▼]                                       │
│                                                                      │
│  ── Career Page ────────────────────────────────────────────────    │
│  [🌐 Visible on career page]  Toggle to hide from public page       │
│  Career URL: aitalentlab.com/techcorp/careers (view ↗)             │
│                                                                      │
│  [💾 Save Changes]                                                  │
│                                                                      │
│  ── Danger Zone ────────────────────────────────────────────────    │
│  [🟡 Put on Hold]  [🔴 Close Position]  [🗑️ Archive]               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Position Status Rules

| Status | Color | Actions Available |
|---|---|---|
| Draft | Gray | Open, Delete |
| Open | Green | On Hold, Close, Run Search, Edit Settings |
| On Hold | Amber | Reopen, Close |
| Closed | Red | Archive, Reopen |
| Archived | Dark Gray | Delete (admin only) |

Auto-pool rule: When position closed/archived, all non-selected candidates auto-added to talent pool.

---

## 5. API Endpoints

| Action | Endpoint | Method |
|---|---|---|
| Load position | `GET /api/v1/positions/:id` | GET |
| Load pipeline (Kanban) | `GET /api/v1/dashboard/pipeline/:id` | GET |
| Load candidates (list) | `GET /api/v1/candidates/position/:id` | GET |
| Update status | `PATCH /api/v1/positions/:id/status` | PATCH |
| Update settings | `PATCH /api/v1/positions/:id` | PATCH |
| Trigger search | `POST /api/v1/positions/:id/search-now` | POST |
| Change candidate status | `PATCH /api/v1/candidates/:id/status` | PATCH |
| Send outreach emails | `POST /api/v1/candidates/send-outreach` | POST |
| Load interview kit | `GET /api/v1/positions/:id/interview-kit` | GET |
| Generate interview kit | `POST /api/v1/positions/:id/interview-kit/generate` | POST |
| Load interviews | `GET /api/v1/interviews/position/:id` | GET |
| Schedule interview | `POST /api/v1/interviews/` | POST |
| Load activity | `GET /api/v1/dashboard/activity?position_id=:id` | GET |
| Add comment | `POST /api/v1/pipeline-events` (comment type) | POST |
