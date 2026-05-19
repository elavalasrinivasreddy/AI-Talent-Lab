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
