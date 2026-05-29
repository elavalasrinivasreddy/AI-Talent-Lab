> **Build status:** ❌ Not redesigned — old UI live
> Consolidated docs index: [../../README.md](../../README.md) · Status tracker: [../../STATUS.md](../../STATUS.md) · Design system: [../00_design_system.md](../00_design_system.md)
> This page merges the v3 redesign spec with the pre-v3 behavioral spec (appendix below, where one existed).

# Page 08 — Talent Pool

**Pattern:** *Pool ↔ Position fit matrix* (variant A)
**Replaces:** Grid-of-candidate-cards with separate "AI suggestions" sidebar
**Why:** The pool isn't a graveyard — it's a future-hire engine. A matrix makes the **matching potential** the primary view: which pool candidates fit which open positions, scored by AI.

Preview reference: `/tmp/atl-design-preview-v3.html` → tab "Talent Pool".
Existing doc this supersedes: `docs/pages/08_talent_pool.md`.

---

## 1. Route & layout

| Aspect | Value |
|---|---|
| Route | `/talent-pool` |
| Auth | Required (JWT) · admin / recruiter |
| Layout | App shell · hero stats · toolbar · matrix · copilot suggestion footer |

---

## 2. Backend tie-in

| Endpoint | Used for |
|---|---|
| `GET /api/v1/talent-pool/?skill=&exp=&contact_status=` | Pool candidate list with filters |
| `GET /api/v1/talent-pool/fit-matrix?positions=open` | **New** — for each pool candidate × each open position, AI fit score |
| `GET /api/v1/copilot/suggestions?type=pool_match` | Footer suggestions ("Re-engage Lin K. for Senior ML Eng") |
| `POST /api/v1/talent-pool/bulk-upload` | Bulk resume upload |
| `POST /api/v1/talent-pool/{candidate_id}/add-to-position` | Move pool candidate into a position pipeline |
| `PATCH /api/v1/talent-pool/{candidate_id}/contact-status` | Active / unsubscribed / employed |
| `POST /api/v1/talent-pool/{candidate_id}/re-engage` | Trigger outreach email |

The fit-matrix endpoint runs the existing 2-step ATS scoring (`candidate_service._ats_score`) for each pool candidate against each open position's JD embedding. Cached for 24h per `(candidate_id, position_id)` pair; recomputed on JD save or candidate-resume-update.

---

## 3. Layout

```
[ topbar: "Talent Pool" + sub · [Bulk upload] [Add candidate] ]

[ HERO ]
  "47 candidates in pool. AI suggests 12 fit your 5 open positions."
  "Auto-pooled on close or rejection · pool is a re-engagement engine, not a graveyard."
                                         [47 In Pool] [12 AI Fits] [5 Open Reqs] [8 Re-engaged 90d]

[ TOOLBAR ]
  [Search skills/exp/tags] [All skills ▼] [All exp ▼] [Contact status ▼]
                                     "Showing 6 of 47 · sorted by best-fit aggregate"

[ MATRIX ]
  ┌─────────────────────┬─────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
  │ Pool Candidate      │ Contact │ ML Eng   │ Backend  │ Designer │ Sales AE │ DevOps   │
  ├─────────────────────┼─────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
  │ Lin Kowalski        │ ● Active│ [92]     │ [81]     │ —        │ —        │ [73]     │
  │ Yuki Lim            │ ● Active│ [71]     │ [85]     │ —        │ —        │ [89]     │
  │ Fatima Bah          │ ● Active│ [62]     │ [84]     │ —        │ —        │ [71]     │
  │ Jin Nguyen          │ ● Active│ —        │ —        │ [91]     │ —        │ —        │
  │ Noah Roberts        │ ● Active│ —        │ —        │ —        │ [87]     │ —        │
  │ Priya Tiwari (dim)  │ Employed│ —        │ [66]     │ —        │ —        │ —        │
  └─────────────────────┴─────────┴──────────┴──────────┴──────────┴──────────┴──────────┘

[ COPILOT SUGGESTION FOOTER ]
  "Copilot suggests: Re-engage Lin K. for Senior ML Eng (92% fit · was offer-stage last cycle)
   and Yuki L. for DevOps Eng (89% fit · we paused outreach 28d ago)."          [Re-engage 2 →]
```

---

## 4. Matrix cell semantics

| Score | Color band | Visual |
|---|---|---|
| 85–100 | `--ok` saturated | `[NN]` with darker green bg + border |
| 80–84 | `--ok` muted | green bg lighter |
| 70–79 | `--warn` muted | amber bg |
| 60–69 | `--warn` muted | amber bg lighter |
| 50–59 | `--tx-3` | neutral bg |
| no match (below threshold or scoring not run) | `—` | very faint |

**Cell click → drill-in:** opens `/candidates/:id` with `state.from='/talent-pool'` AND `state.activePositionId={col.positionId}` so the candidate detail page shows compare-to-ideal grid scoped to that position's JD.

**Cell hover:** quick popover with top 2 matched skills + top 1 missing skill.

---

## 5. Candidate row

| Cell | Detail |
|---|---|
| Avatar + name | Initials, brand gradient. Click → candidate detail (no position context — uses last application) |
| Sub line | "6 yrs · ML · Bangalore · pool 12d" — yrs / function / location / time-in-pool |
| Contact status | chip — Active (`--ok`) / Unsubscribed (`--tx-3`) / Employed elsewhere (`--info`) |

Employed candidates row is dimmed (62% opacity) — visible but de-prioritized.

---

## 6. Filters

| Filter | Options | Default |
|---|---|---|
| Search | free-text across skills, name, email, tags | empty |
| Skill | All skills · top 50 from pool · filtered to those present in pool | All |
| Experience | All · 0–3 yrs · 3–7 yrs · 7+ yrs | All |
| Contact status | All · Active · Unsubscribed · Employed | All |
| Time in pool | All · <30d · 30–90d · 90d+ | All |

Filters narrow the row list. Columns (positions) stay the same.

---

## 7. Copilot suggestion footer

Pulls from `copilot_suggestions` table where `type='pool_match'`. Highlights the 1-2 best re-engagement opportunities with context ("was offer-stage last cycle" / "we paused outreach 28d ago").

`[Re-engage 2 →]` button triggers bulk re-engagement: opens a confirmation modal listing the candidates, the outreach email template that will be used, and the position they'll be added to. On confirm, calls `POST /talent-pool/{id}/re-engage` for each.

---

## 8. Bulk actions

When user selects rows (checkbox column — optional, can ship without):
- **Bulk re-engage** — send outreach to selected candidates for a chosen position
- **Bulk add to position** — move selected candidates into a pipeline at status=sourced
- **Bulk tag** — add a tag to all selected
- **Bulk remove from pool** — archive permanently

---

## 9. Components to build / refactor

| Component | Path | Notes |
|---|---|---|
| `<TalentPoolPage>` | `frontend/src/components/TalentPool/TalentPoolPage.jsx` | Refactor |
| `<PoolHero>` | `TalentPool/PoolHero.jsx` | New — stats + headline |
| `<PoolToolbar>` | `TalentPool/PoolToolbar.jsx` | New — search + filters |
| `<PoolMatrix>` | `TalentPool/PoolMatrix.jsx` | New — the main matrix component |
| `<MatrixCell>` | `TalentPool/MatrixCell.jsx` | New — fit score cell with hover |
| `<ContactStatusChip>` | `TalentPool/ContactStatusChip.jsx` | New |
| `<CopilotPoolFooter>` | `TalentPool/CopilotPoolFooter.jsx` | New |
| `<BulkUploadModal>` | `TalentPool/BulkUploadModal.jsx` | Keep existing |

---

## 10. Empty / loading / error states

| Condition | Display |
|---|---|
| Empty pool | Hero "Your pool is empty. Candidates who reach offer or get rejected here will auto-pool." + CTA "[Bulk upload resumes]" |
| No open positions | Matrix collapses to a single-column list of pool candidates with "No open positions to match against" banner |
| Fit-matrix still computing | "Fit scores updating · ~30s" skeleton in cells; rows render with `—` initially |
| Filter narrows to 0 rows | "No candidates match these filters. [Clear filters]" |
| API error | "Couldn't load pool. [Retry]" |

---

## 11. Build notes

1. The fit-matrix is the make-or-break compute. Cache aggressively (24h TTL per pair) via Redis or a `pool_fit_cache` table.
2. When a position's JD changes, invalidate all cache rows for that position. Re-compute lazily on next view, or proactively via a Celery task.
3. When a candidate's resume updates, invalidate cache rows for that candidate.
4. For large pools (>500 candidates), paginate the row list — but always score ALL pool candidates against all open positions in the background (so the matrix is complete when scrolled).


---

## Appendix — pre-v3 behavioral spec & flows

_Retained from the original `docs/pages/` spec for workflow, edge-case, and API detail. The v3 spec above supersedes the **visual** design; the behavior here is still the reference._

# Page Design: Talent Pool
> **Version 2.1 — Updated**
> Org-wide candidate database. Bulk upload zone appears FIRST (most prominent).
> AI suggestions panel. Auto-add rules. Context-aware back navigation.

---

## 1. Overview

| Aspect | Detail |
|---|---|
| Route | `/talent-pool` |
| Auth | Required (JWT) |
| Layout | Sidebar + full-width page |
| Entry | Sidebar navigation link |

---

## 2. Page Layout

```
┌──────┬──────────────────────────────────────────────────────────┐
│      │  ┌── HEADER ─────────────────────────────────────────┐   │
│      │  │  🗃 Talent Pool  ·  1,247 candidates · Org-wide   │   │
│      │  └────────────────────────────────────────────────────┘   │
│ S    │                                                            │
│ I    │  ┌── BULK UPLOAD ZONE (FIRST — most prominent) ────────┐  │
│ D    │  │  Drop resumes here or click to upload               │  │
│ E    │  │  [+ Upload Resumes]                                 │  │
│ B    │  └────────────────────────────────────────────────────┘   │
│ A    │                                                            │
│ R    │  ┌── AI SUGGEST PANEL ─────────────────────────────────┐  │
│      │  │  Match pool → position: [Select position ▼] [Find]  │  │
│      │  └────────────────────────────────────────────────────┘   │
│      │                                                            │
│      │  ┌── SEARCH + FILTERS ─────────────────────────────────┐  │
│      │  │  [🔍 Search...]  [Location ▼]  [Source ▼]  [Reason ▼]│  │
│      │  └────────────────────────────────────────────────────┘   │
│      │                                                            │
│      │  ┌── CANDIDATE GRID (3 columns) ───────────────────────┐  │
│      │  │  [Card] [Card] [Card] [Card] [Card] [Card]          │  │
│      │  └────────────────────────────────────────────────────┘   │
└──────┴──────────────────────────────────────────────────────────┘
```

---

## 3. Bulk Upload Zone

Full-width, dashed border, **always visible above candidate grid**:

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │                                                          │  │
│   │   📁                                                     │  │
│   │                                                          │  │
│   │   Drop resumes here to add offline candidates            │  │
│   │   or    [+ Upload Resumes]                               │  │
│   │                                                          │  │
│   │   PDF or DOCX · Up to 50 files · Max 5MB each           │  │
│   └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  AI will automatically: parse resumes · extract skills ·         │
│  detect duplicates · add new profiles to pool                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Upload results summary (shown after processing):**
```
┌── Upload Results ──────────────────────────────────────────────┐
│  Processed 12 resumes                                          │
│                                                                │
│  ✅ 9 new candidates added to pool                             │
│                                                                │
│  ⚠️  3 duplicates detected:                                    │
│  • Priya Sharma (priya@email.com) — last updated 3 months ago │
│    [Update Profile]  [Skip]                                    │
│  • Rahul Mehta — last updated 2 days ago                       │
│    [Skip — recent profile]  (auto-suggested)                   │
│  • Ananya K. — last updated 8 months ago                       │
│    [Update Profile]  [Skip]                                    │
│                                                                │
│  [Done]                                                        │
└────────────────────────────────────────────────────────────────┘
```

**Duplicate logic:**
- Match on email (primary) or phone (secondary) within same org only
- Updated ≤ 7 days → auto-suggest "Skip — recent profile"
- Updated > 7 days → suggest "Update Profile"
- "Update Profile" refreshes: resume, parsed data, `updated_at`

---

## 4. AI Suggest Panel

```
┌── 🤖 AI Match Suggestions ────────────────────────────────────────┐
│                                                                    │
│  Find pool candidates for a new position before sourcing:         │
│                                                                    │
│  [Sr Python Developer (Apr 2026) ▼]    [Find Matches]             │
│                                                                    │
│  ── Results ───────────────────────────────────────────────────   │
│  Found 3 pool candidates above 70% match:                         │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ Priya Sharma │  │ Ankit Mehta  │  │ Deepa R.     │            │
│  │ 87% match    │  │ 82% match    │  │ 79% match    │            │
│  │ Rejected     │  │ Pool Closed  │  │ Rejected     │            │
│  │              │  │              │  │              │            │
│  │ [Add to      │  │ [Add to      │  │ [Add to      │            │
│  │  Pipeline]   │  │  Pipeline]   │  │  Pipeline]   │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
└────────────────────────────────────────────────────────────────────┘
```

"Add to Pipeline" → creates new `candidate_applications` record for that position at `status = 'sourced'`. Candidate appears in position's pipeline.

---

## 5. Candidate Cards Grid

3-column grid (2 on tablet, 1 on mobile). 20 cards per page.

```
┌── Candidate Card ──────────────────────────────────────┐
│                                                        │
│  [PR]  Priya Sharma                   [Rejected ●]    │
│        Sr Developer @ TCS                             │
│        📍 Bangalore · 5 yrs exp · LinkedIn            │
│                                                        │
│  [python]  [react]  [fastapi]  [docker]               │
│                                                        │
│  ──────────────────────────────────────────────────   │
│                                                        │
│  Pool reason: Rejected (Sr Python Dev #42)            │
│  Added: Mar 22, 2026                                   │
│                                                        │
│  [Re-engage]              [View Profile]              │
└────────────────────────────────────────────────────────┘
```

**Pool reason badge colors:**
- "Rejected" → red
- "Position Closed" → amber
- "Position Archived" → gray
- "Manual" → blue

**Card click:** Navigate to `/candidates/:id` with `from: '/talent-pool'` in location state.

**Re-engage:** Opens compose panel to send outreach email about a new opening.

---

## 6. Filters

| Filter | Options |
|---|---|
| Search | Free text — name, skills, title, company |
| Location | All + unique locations in pool |
| Source | All / LinkedIn / Naukri / Upload / Career Page / Manual / Simulation |
| Pool Reason | All / Rejected / Position Closed / Position Archived / Manual |

---

## 7. Auto-Pool Rules

Candidates automatically added when:
1. `candidate_applications.status` → `rejected`
2. `positions.status` → `closed` or `archived` (all non-selected candidates)
3. Recruiter manually clicks "Add to Pool" on Candidate Detail

System sets:
- `candidates.in_talent_pool = true`
- `candidates.talent_pool_reason = 'rejected' | 'position_closed' | 'position_archived' | 'manual'`
- `candidates.talent_pool_added_at = NOW()`
- PipelineEvent created: `event_type = 'added_to_pool'`

---

## 8. API Endpoints

| Action | Endpoint | Method |
|---|---|---|
| Load pool | `GET /api/v1/talent-pool/` | GET |
| Search/filter | `GET /api/v1/talent-pool/?q=&location=&source=&reason=&page=` | GET |
| Bulk upload | `POST /api/v1/candidates/bulk-upload` | POST (multipart) |
| AI suggest | `POST /api/v1/talent-pool/suggest/:position_id` | POST |
| Add to pipeline | `POST /api/v1/talent-pool/:candidate_id/add-to-position` | POST |
| Manual add | `POST /api/v1/talent-pool/:candidate_id/add` | POST |
| Remove from pool | `DELETE /api/v1/talent-pool/:candidate_id/remove` | DELETE |
