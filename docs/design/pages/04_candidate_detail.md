> **Build status:** ❌ Not redesigned — old UI live
> Consolidated docs index: [../../README.md](../../README.md) · Status tracker: [../../STATUS.md](../../STATUS.md) · Design system: [../00_design_system.md](../00_design_system.md)
> This page merges the v3 redesign spec with the pre-v3 behavioral spec (appendix below, where one existed).

# Page 04 — Candidate Detail

**Pattern:** *Compare-to-ideal overlay* (variant **B**)
**Replaces:** 5-tab single-column scroll with ATS reasoning hidden behind a tab click
**Why:** The most common question is "why did we match this candidate?" The compare-grid puts the **JD's actual requirements** next to the **candidate's actual evidence** — match status (met / partial / missing) shown explicitly, with reasoning inline.

Preview reference: `/tmp/atl-design-preview-v3.html` → tab "Candidate Detail".
Existing doc this supersedes: `docs/pages/05_candidate_detail.md`.

---

## 1. Route & layout

| Aspect | Value |
|---|---|
| Route | `/candidates/:id` (preserves `location.state.from` for back nav) |
| Auth | Required (JWT) |
| Layout | App shell · breadcrumb · hero with score ring + action panel · status/tags row · score breakdown band · **compare-to-ideal grid** · AI signal cards row · tabs · two-column rail |

---

## 2. Backend tie-in

| Endpoint | Used for |
|---|---|
| `GET /api/v1/candidates/{id}?include=position_jd` | Candidate + active position JD requirements (so we can render compare-grid) |
| `GET /api/v1/candidates/{id}/timeline` | Timeline tab |
| `GET /api/v1/interviews/candidate/{id}` | Interview history sidebar + Interviews tab |
| `GET /api/v1/copilot/suggestions?candidate_id=` | Right rail "Copilot suggests" cards |
| `PATCH /api/v1/candidates/{id}/status` | Status dropdown |
| `POST /api/v1/candidates/{id}/draft-rejection` | Draft Rejection button |
| `POST /api/v1/candidates/{id}/mark-selected` | Mark as Selected |
| `POST /api/v1/talent-pool/{id}/add` | Add to pool |
| Tag CRUD: `candidate_tags` table | Tags row chips |

### Critical data shape: `skill_match_data` JSON

Stored in `candidate_applications.skill_match_data`. The compare-grid needs:
```json
{
  "matched_skills": [{"skill": "Python", "weight": 8, "evidence": "5 yrs daily use · torch.distributed contributor"}, ...],
  "missing_skills": [{"skill": "CKA cert", "weight": 2, "severity": "low"}],
  "partial_skills": [{"skill": "Kubernetes prod", "weight": 6, "evidence": "Uses K8s for serving · uncertain cluster-ops scope"}],
  "extra_skills": [{"skill": "GraphQL"}],
  "experience_match": 0.92,
  "skills_match": 0.96,
  "emb_score": 0.94,
  "final_score": 94
}
```

**If the backend doesn't already store `weight`, `evidence`, and `severity` per skill, that's a small additive change** — see §8.

---

## 3. Page layout (top to bottom)

```
[ breadcrumb: Positions › Senior ML Engineer › Alex Chen ]

[ HERO ]
  [avatar lg]  Alex Chen
               Senior ML Engineer · 8 yrs exp · Inflection AI
               ✉ email · 📍 Bangalore · LinkedIn                       [SCORE RING 94/Strong]   [Action panel]
                                                                                                  - Move to Interview (pri)
                                                                                                  - Schedule
                                                                                                  - Mark Selected
                                                                                                  - Draft Rejection (danger ghost)

[ STATUS + TAGS row ]
  Status: [Screening ▼]  Stage entered: 5h ago · 12 days total
  Tags: [python-expert] [strong-comm] [remote-ok] [referral-from-ravi] [+ Add tag]

[ SCORE BREAKDOWN BAND ]
  "emb 0.4 · skills 0.4 · exp 0.2 · max 100"
  [ horizontal stacked bar with 4 segments:  +38 emb sim 0.94  |  +38 skills 0.96  |  +18 exp 0.92  |  −4 K8s gap ]

[ COMPARE-TO-IDEAL GRID — the radical part ]
  "Requirements Match · Comparing this candidate against the JD · 12 of 13 must-haves met"   [show gaps only]
  ┌──────────────────────────────────┬──────────────────────────────────┐
  │ LEFT: What the role needs        │ RIGHT: What this candidate has   │
  ├──────────────────────────────────┼──────────────────────────────────┤
  │ ✓ 5+ yrs prod ML       w8        │ ✓ 8 yrs · Tech Lead · 50M req/d  │
  │ ✓ PyTorch              w9        │ ✓ 5 yrs daily · torch contributor│
  │ ✓ LLM fine-tune        w10       │ ✓ Owned LoRA + RLHF papers       │
  │ ✓ Vector DBs           w7        │ ✓ Pinecone + pgvector prod       │
  │ ✓ Python + SQL         w8        │ ✓ Strong (resume + screening)    │
  │ ~ K8s in production    w6        │ ~ Dev clusters · prod scope ?    │
  │ ✓ Research / OSS       w4        │ ✓ NeurIPS 2024 + open-rlhf 8.2k★ │
  │ ✗ CKA cert             w2        │ ✗ Worth probing in interview     │
  └──────────────────────────────────┴──────────────────────────────────┘

[ 3-card row ]
  AI Analysis            Career Trajectory             Red Flags
  (LLM summary text)     [Steady Growth chip]          [None detected chip]

[ TAB RAIL: Skills Match · Application · Resume · Interviews(3) · Timeline ]

[ Two-column rail ]
  LEFT: Interview history (3 rounds, dates, panelists, scores, rec)
  RIGHT: Copilot suggests
         - "Similar to 3 past successful hires: Riya M., Dev S., Pooja N."
         - "Comp ask 15% above mid-band · within urgent-role threshold"
```

---

## 4. The Compare-to-Ideal grid in detail

Two columns, equal width, separated by a thin border.

### LEFT column: `What the role needs`
For each requirement from the active position's JD:
- Marker icon: `✓` (met, green bg), `~` (partial, amber bg), `✗` (missing, red bg)
- Requirement text (`req`)
- Evidence line: must-have/nice-to-have · weight (e.g. "Must-have · weight 8/10")
- Weight badge (right-aligned, gray)

### RIGHT column: `What this candidate has`
For each requirement (same order as left):
- Same marker color
- Candidate's actual evidence (1–2 lines from `skill_match_data.evidence`)
- Point contribution to score on right (+8 green, +3 warn-color, 0 red)

### "Show gaps only" toggle
Filters out met-rows so the user sees only partial + missing items. Useful for offer-stage candidates where most reqs are green.

### Hover affordance
Each marker icon shows tooltip with the full LLM reasoning sentence (from `skill_match_data.<skill>.reasoning`).

---

## 5. Score breakdown band (the equation visualized)

Single horizontal bar, 32px tall, divided into 4 colored segments:

| Segment | Width % | Color | Label |
|---|---|---|---|
| emb similarity | (emb_score × 40 / final_score) × 100 | --bg-4 / neutral | "+38 emb sim 0.94" |
| skills match | (skills_match × 40 / final_score) × 100 | --ok | "+38 skills 0.96" |
| experience match | (experience_match × 20 / final_score) × 100 | --ok lighter | "+18 exp 0.92" |
| gap penalty | varies (visualize negative if applicable) | --bad | "−4 K8s gap" |

Tooltip: full equation in mono font — `emb×0.40 + skills×0.40 + exp×0.20 × 100 = 94`.

The point of this band: **trust**. Recruiters and hiring managers should never have to ask "why 94?" again.

---

## 6. Sticky action panel (top right)

Action priority:
1. **Move to next stage** (`btn-pri`) — context-aware label ("Move to Interview" / "Send Offer" / etc.)
2. **Schedule** — opens `<ScheduleInterviewModal>`
3. **Mark Selected** (only when all rounds reviewed; admin/recruiter/HM only)
4. **Draft Rejection** (`btn-ghost color: var(--bad)`)

Position: sticky in the hero. Scrolls with page until hero leaves viewport, then docks to top-right of viewport.

---

## 7. Components to build / refactor

| Component | Path | Notes |
|---|---|---|
| `<CandidateDetailPage>` | `frontend/src/components/Candidates/CandidateDetailPage.jsx` | Refactor (465 lines) |
| `<CandidateHero>` | `Candidates/CandidateHero.jsx` | New — score ring + identity + action panel |
| `<ScoreRing>` | `Candidates/ScoreRing.jsx` | New — conic-gradient ring with band-colored arc + center number |
| `<ScoreBreakdownBand>` | `Candidates/ScoreBreakdownBand.jsx` | New — the equation-visualized bar |
| `<CompareToIdealGrid>` | `Candidates/CompareToIdealGrid.jsx` | New — the radical 2-column grid |
| `<RequirementRow>` | `Candidates/RequirementRow.jsx` | New — left-column row (marker + req + weight) |
| `<EvidenceRow>` | `Candidates/EvidenceRow.jsx` | New — right-column row (marker + evidence + points) |
| `<TagsRow>` | `Candidates/TagsRow.jsx` | New — chip row with add-tag affordance (reuses existing `candidate_tags` API) |
| `<CopilotSuggestions>` | `common/CopilotSuggestions.jsx` | New — right-rail suggestion cards |
| Existing tabs (Skills Match, Application, Resume, Interviews, Timeline) | Keep mostly as-is | Just visual token pass — they remain useful drill-downs |

---

## 8. Backend additions

If `skill_match_data` doesn't already carry per-skill `weight`, `evidence`, `severity` — add them.

Current ATS scoring in `backend/services/candidate_service.py` produces matched/missing skills as plain arrays. The compare-grid needs each skill annotated:

```python
# In candidate_service.py — _ats_score_with_reasoning()
{
  "matched_skills": [
    {
      "skill": "Python",
      "weight": 8,          # NEW — pulled from JD requirement extraction
      "evidence": "..."     # NEW — LLM-generated 1-line evidence sentence
    },
    ...
  ]
}
```

This is a ~50 line change. Reuses existing LLM call (add 2 fields to JSON schema in the prompt).

If we ship the redesign without these fields, the grid still works but with weaker text ("Strong match" instead of "Built rate-limiting in production — STAR-format response").

---

## 9. Empty / loading / error states

| Condition | Display |
|---|---|
| Candidate at `status=sourced/emailed` (no application yet) | Hide Application tab; show banner: "Candidate not yet applied. ATS based on resume vs JD." |
| No resume parsed | Resume tab: "No resume on file. Score uses public profile data." |
| Score data missing | Hero shows score ring with `—`; compare-grid replaced with "Scoring in progress · auto-retries in 30s" |
| Position deleted | Hero "Active position N/A" + compare-grid disabled; AI Analysis still useful |
| Loading | Skeleton hero (gray ring) + skeleton compare-grid (2 columns of grey rows) |

---

## 10. Role-adaptive

| Action | Admin | Recruiter | HM | Panel (link) |
|---|---|---|---|---|
| Move to next stage | ✅ | ✅ | ✅ (assigned only) | ❌ |
| Mark Selected | ✅ | ✅ | ✅ | ❌ |
| Send Rejection | ✅ | ✅ | ✅ | ❌ |
| View CTC fields | ✅ | ✅ | ✅ | **❌ blurred** |
| Edit Tags | ✅ | ✅ | ✅ | ❌ |
| See compare-grid | ✅ | ✅ | ✅ | ✅ (no actions) |

---

## 11. Migration plan

1. Backend: add `weight` + `evidence` to `skill_match_data` schema (additive, no migration).
2. Add `GET /api/v1/candidates/{id}?include=position_jd` query param to include JD requirements for compare-grid.
3. Frontend: build new components in parallel with existing page.
4. Behind feature flag `candidate_compare_grid=1`, replace return tree.
5. After 2 weeks, remove the old single-column return tree.


---

## Appendix — pre-v3 behavioral spec & flows

_Retained from the original `docs/pages/` spec for workflow, edge-case, and API detail. The v3 spec above supersedes the **visual** design; the behavior here is still the reference._

# Page Design: Candidate Detail
> **Version 2.1 — Updated**
> Full candidate profile. Communication Hub tab REMOVED. Replaced with unified Timeline tab.
> Candidate profile opens from ANY section — context-aware back navigation.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Route | `/candidates/:id` · `/candidates/:id/:tab` |
| Auth | Required (JWT) |
| Entry Points | Position Detail (Pipeline + Candidates tabs) · Talent Pool · Dashboard activity · Notification click |
| Back Button | Context-aware — returns to where user came from |
| Tabs | Skills Match · Application · Resume · Interviews · Timeline |

---

## 2. Context-Aware Back Navigation

```javascript
// Always pass context when navigating TO candidate detail:
navigate(`/candidates/${id}`, {
  state: {
    from: '/positions/42',
    fromLabel: 'Back to Senior Python Developer',
    fromTab: 'pipeline'      // restores correct tab on position
  }
});

// From talent pool:
navigate(`/candidates/${id}`, {
  state: { from: '/talent-pool', fromLabel: 'Back to Talent Pool' }
});
```

**Reachable from:**
- Position Detail → Pipeline tab (Kanban card click)
- Position Detail → Candidates tab (list row click)
- Talent Pool → candidate card click
- Dashboard → activity feed candidate name link
- Notification → `action_url` deep link

---

## 3. Page Layout

```
┌──────┬────────────────────────────────────────────────────────────┐
│      │  ← Back to Senior Python Developer                        │
│      │                                                            │
│ S    │  ┌── CANDIDATE HEADER ──────────────────────────────────┐  │
│ I    │  │                                                      │  │
│ D    │  │  [RK]  Rahul Kumar                      ATS: 92%     │  │
│ E    │  │        Senior Developer @ TechCorp Pvt Ltd           │  │
│ B    │  │        ✉ rahul@email.com  ·  📍 Bangalore            │  │
│ A    │  │        💼 6 years experience  ·  🔗 LinkedIn          │  │
│ R    │  │                                                      │  │
│      │  │  Status: [Sourced ▼]                                 │  │
│      │  │  [📅 Schedule Interview]  [🏊 Add to Pool]           │  │
│      │  │  [Draft Rejection Email]  [✅ Mark as Selected]      │  │
│      │  └──────────────────────────────────────────────────────┘  │
│      │                                                            │
│      │  ┌── TABS ─────────────────────────────────────────────┐  │
│      │  │ [Skills Match][Application][Resume][Interviews][Timeline]│
│      │  └──────────────────────────────────────────────────────┘  │
│      │                                                            │
│      │  (tab content below)                                       │
└──────┴────────────────────────────────────────────────────────────┘
```

---

## 4. Candidate Header

**ATS Score circle:**
- ≥80%: green, "Strong Match"
- 60–79%: amber, "Good Match"
- 40–59%: orange, "Partial Match"
- <60%: red, "Weak Match"

**Status dropdown:** Changes pipeline status. Options: Sourced / Emailed / Applied / Screening / Interview / On Hold. Cannot manually set to Selected or Rejected — use dedicated buttons.

**"Draft Rejection Email":** Triggers AI to draft a professional rejection email based on the candidate's profile and rejection reason. Opens review modal → recruiter edits if needed → clicks Send. Appears on timeline as "Rejection email sent." Button disabled if already rejected.

**Tags row (below action buttons):**
Free-form recruiter labels for the candidate. Displayed as chips below the action row. Used for talent pool filtering and re-engagement targeting.

```
Tags: [python] [strong-communicator] [open-to-relocation] [+ Add tag]
```

- Click `+ Add tag` → inline text input → press Enter to add
- Click any existing tag → removes it (with confirmation for pool candidates)
- Tags are org-scoped — visible to all org members, not the candidate
- Examples: `strong-communicator`, `relocation-needed`, `overqualified`, `great-culture-fit`, `revisit-q3`
- Stored in `candidate_tags` table, returned with candidate detail API

**"Mark as Selected":**
- Only visible when recruiter manually enables (all rounds reviewed)
- Confirmation: "Mark Rahul Kumar as Selected for Senior Python Developer?"
- On confirm: status → Selected, notification sent, candidate appears in selected list
- Irreversible — requires deliberate action

---

## 5. Tab: Skills Match

```
┌── 🎯 ATS Score: 92% ────────────────────────────────────────────────┐
│                                                                      │
│  ████████████████████████████████████░░░░  92 / 100                 │
│  ✅ Strong Match                                                      │
│                                                                      │
│  Matched Skills (8)                                                  │
│  [Python] [FastAPI] [PostgreSQL] [Docker] [AWS] [Redis] [CI/CD] [REST]│
│                                                                      │
│  Missing Skills (2)                                                  │
│  [Kubernetes] [Terraform]                                            │
│                                                                      │
│  Additional Skills — not in JD but candidate has (3)                 │
│  [GraphQL] [MongoDB] [Kafka]                                         │
│                                                                      │
│  AI Analysis                                                         │
│  "Strong backend developer with 6 years building high-throughput     │
│   Python APIs. Direct experience at TechCorp is highly relevant.    │
│   Main gaps are in infrastructure tooling (Kubernetes, Terraform)   │
│   which are preferred but not required. Overall: strong candidate." │
│                                                                      │
│  📈 Career Trajectory: Steady Growth                                │
│  "Clear upward progression: Junior → Senior in 3 years.            │
│   Average tenure 26 months — above industry average."               │
│                                                                      │
│  ⚠️ Red Flags: None detected                                        │
│  (When detected, shows e.g.:)                                       │
│  ⚠️ Short tenure: 3 roles in 2 years (2020–2022)                   │
│     Severity: Medium — worth discussing in interview                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

Chip colors: Matched = green · Missing = red · Additional = blue (info).

**Trajectory patterns:** `steady_growth` / `job_hopper` / `career_pivot` / `specialist`
**Red flag types:** short tenure · employment gap · title regression · frequent switches
**Severity levels:** low (informational) · medium (worth discussing) · high (strong concern)

---

## 6. Tab: Application

Shows if `status ≥ applied`. Otherwise: `"Candidate sourced/emailed but hasn't applied yet."`

```
┌── Application Details ──────────────────── Applied: Apr 10, 2026 ───┐
│                                                                      │
│  Current Role         Senior Developer at TechCorp Pvt Ltd          │
│  Total Experience     6 years                                        │
│  Relevant Experience  4 years                                        │
│  Notice Period        30 days                                        │
│  Current CTC          ₹18,00,000 per annum    [HR-only 👁]           │
│  Expected CTC         ₹24,00,000 per annum    [HR-only 👁]           │
│  Availability         After 30 days notice                           │
│                                                                      │
│  ── Additional Screening Responses ────────────────────────────     │
│  Office availability   Yes, 3 days/week from Bangalore               │
│  Active offers?        No current offers                             │
│  Interview timing      Mon–Fri, 10am–6pm IST                        │
└──────────────────────────────────────────────────────────────────────┘
```

CTC fields marked HR-only — not visible to panel members.

---

## 7. Tab: Resume

```
┌── 📄 Resume ──────────────────────────────────────── [📥 Download] ──┐
│                                                                       │
│  (resume_text rendered as formatted content)                          │
│                                                                       │
│  RAHUL KUMAR · Senior Python Developer                                │
│  Bangalore · rahul@email.com                                          │
│                                                                       │
│  EXPERIENCE                                                           │
│  Senior Developer — TechCorp Pvt Ltd (2022–Present)                   │
│  • Built microservices architecture serving 2M+ daily users           │
│  • Led migration from monolith to FastAPI + PostgreSQL                │
│  ...                                                                  │
└───────────────────────────────────────────────────────────────────────┘
```

No resume: `"No resume uploaded. Candidate was sourced — upload one manually if available."`

---

## 8. Tab: Interviews

```
┌── 🎙️ Interview Rounds ──────────────────────────── [+ Schedule] ───┐
│                                                                      │
│  Round 1: Technical Interview               ✅ Completed             │
│  Apr 12 · 2:00 PM · 60 min · Google Meet                           │
│  Panel: Raj K., Neha P.    Scorecards: 2/2                         │
│                                                                      │
│  ┌── Scores ────────────────────────────────────────────────────┐  │
│  │  Dimension        Raj K.   Neha P.   Average                 │  │
│  │  Technical        4/5      4/5       4.0                     │  │
│  │  Problem Solving  5/5      4/5       4.5                     │  │
│  │  Communication    4/5      3/5       3.5                     │  │
│  │  Culture Fit      3/5      4/5       3.5                     │  │
│  │  Overall          4.0      3.75      3.88                    │  │
│  │                                                              │  │
│  │  Raj K.:   👍 Yes — "Solid, proceed"                        │  │
│  │  Neha P.:  👍 Yes — "Good skills, proceed"                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  Result: [Passed ▼]                                                  │
│                                                                      │
│  ────────────────────────────────────────────────────────────────   │
│                                                                      │
│  Round 2: Manager Interview                 📅 Scheduled             │
│  Apr 16 · 11:00 AM · 45 min                                         │
│  Panel: Amit S.    Scorecards: 0/1 pending                          │
│  [Reschedule]  [Cancel Round]                                       │
│                                                                      │
│  ────────────────────────────────────────────────────────────────   │
│                                                                      │
│  Round 3: HR Interview                      ⏳ Not Scheduled         │
│  [+ Schedule This Round]                                            │
│                                                                      │
│  ────────────────────────────────────────────────────────────────   │
│                                                                      │
│  [Generate Interview Debrief]  ← appears when all rounds done       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 9. Tab: Timeline (Replaces Communication Hub)

**All events for this candidate in one reverse-chronological feed.** No separate Communication Hub tab.

```
┌── 📜 Activity Timeline ──────────────────────────────────────────────┐
│                                                                       │
│  TODAY                                                                │
│  ──────────────────────────────────────────────────────────         │
│  📋  2:45 PM   Raj K. submitted scorecard — Round 1                  │
│                Overall: 4.0/5 · Rec: Yes  [View ▾]                  │
│                                                                       │
│  📋  11:30 AM  Neha P. submitted scorecard — Round 1                 │
│                Overall: 3.75/5 · Rec: Yes  [View ▾]                 │
│                                                                       │
│  Apr 12                                                               │
│  ──────────────────────────────────────────────────────────         │
│  📅  10:00 AM  Interview scheduled — Round 1 Technical               │
│                Apr 12 · 2:00 PM · Raj K., Neha P.                  │
│                Invite sent to candidate + panel                      │
│                                                                       │
│  Apr 10                                                               │
│  ──────────────────────────────────────────────────────────         │
│  📝  2:32 PM   Applied via magic link  [View Application ▾]          │
│  🔄  2:33 PM   Status changed to Applied                             │
│                                                                       │
│  Apr 9                                                                │
│  ──────────────────────────────────────────────────────────         │
│  👁  2:20 PM   Magic link clicked                                     │
│  📧  11:15 AM  Outreach email sent  [Preview ▾]                      │
│  📊  11:00 AM  ATS scored: 92% (Strong Match)                        │
│                8 matched · 2 missing                                  │
│  🔍  10:45 AM  Sourced via AI candidate search                        │
│                                                                       │
│  ── Comments ──────────────────────────────────────────────────     │
│  [SR]  Write a comment... @mention team members           [Post]    │
└───────────────────────────────────────────────────────────────────────┘
```

**Event icon reference:**
| Icon | Event |
|---|---|
| 🔍 | Sourced (search or upload) |
| 📊 | ATS scored |
| 📧 | Outreach email sent |
| 👁 | Magic link clicked |
| 📝 | Application submitted |
| 🔄 | Status changed |
| 📅 | Interview scheduled/rescheduled |
| 📋 | Scorecard submitted |
| 💬 | Team comment |
| 📤 | Rejection email sent |
| ⭐ | Marked as selected |
| 🏊 | Added to talent pool |

Expandable events: email preview ▾, application responses ▾, scorecard summary ▾.

---

## 10. Schedule Interview Modal

Opens from header "Schedule Interview" button or Interviews tab "+ Schedule":

```
┌── 📅 Schedule Interview ───────────────────────────────── [✕] ──┐
│                                                                  │
│  Candidate:  Rahul Kumar  (Sr Python Dev · Round 1)             │
│                                                                  │
│  Round *         [Round 1 — Technical ▼]                        │
│  Panel *         [🔍 Search team or enter email...]              │
│                  [Raj K.  ✕]  [Neha P.  ✕]  [+ Add]            │
│  Date *          [Apr 15, 2026  📅]                              │
│  Time *          [10:00 AM ▼]    Duration [60 min ▼]            │
│  Meeting Link    [Auto-generate Google Meet ▼]                  │
│  Notes           [Optional notes for panel members...]          │
│                                                                  │
│  ☑ Send interview invitation to candidate                       │
│  ☑ Send feedback magic links to panel members                   │
│  ☑ Auto-remind 24h before (email)                               │
│                                                                  │
│               [Cancel]      [Schedule Interview]               │
└──────────────────────────────────────────────────────────────────┘
```

---

## 11. API Endpoints

| Action | Endpoint | Method |
|---|---|---|
| Load candidate | `GET /api/v1/candidates/:id` | GET |
| Get timeline | `GET /api/v1/candidates/:id/timeline` | GET |
| Update status | `PATCH /api/v1/candidates/:id/status` | PATCH |
| Add to pool | `POST /api/v1/talent-pool/:id/add` | POST |
| Draft rejection | `POST /api/v1/candidates/:id/draft-rejection` | POST |
| Send rejection | `POST /api/v1/candidates/:id/send-rejection` | POST |
| Mark selected | `POST /api/v1/candidates/:id/mark-selected` | POST |
| Get interviews | `GET /api/v1/interviews/candidate/:id` | GET |
| Schedule interview | `POST /api/v1/interviews/` | POST |
| Generate debrief | `POST /api/v1/interviews/:id/generate-debrief` | POST |
| Add comment | timeline event via `POST /api/v1/pipeline-events` | POST |
