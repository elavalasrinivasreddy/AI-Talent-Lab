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

## 3. Layout (V4: Contextual Copilot Match)

```
[ topbar: "Talent Pool" + sub · [+ Upload Resumes] ]

[ HERO (Optional based on scroll) ]
  "47 candidates in pool."

[ TOOLBAR ]
  [Search skills/exp/tags] [Location ▼] [Reason ▼]  [ ✨ AI Match to Position ]

[ DATA TABLE / GRID ]
  [ Avatar/Name ] [ Skills ] [ Location ] [ Experience ] [ Source/Reason ] [ Actions ]
  (Clean standard list, no horizontal scrolling)
```

---

## 4. AI Match Side-Panel (Copilot)

Triggered by the `[ ✨ AI Match to Position ]` button in the toolbar.
Instead of a massive Matrix, this provides an on-demand, targeted vector search.

1. **Position Selection:** 
   - A searchable dropdown/list of Open Positions.
   - **RBAC Enforcement:** Scoped HR and Dept Admins ONLY see positions in their department. Org Head and Global HR see all positions (grouped by department).
2. **Match Compute:** Once selected, the backend scores the pool against that specific position's JD embedding and streams the top 5-10 matches.
3. **Action:** Recruiter can click `[Add to Pipeline]` directly from the side-panel match results.

---

## 5. Candidate Row

| Cell | Detail |
|---|---|
| Avatar + name | Initials, brand gradient. Click → candidate detail |
| Sub line | yrs / function / location / time-in-pool |
| Contact status | chip — Active / Unsubscribed / Employed elsewhere |

---

## 6. Filters

| Filter | Options | Default |
|---|---|---|
| Search | free-text across skills, name, email, tags | empty |
| Location | All + unique locations in pool | All |
| Pool Reason | All + Rejected, Position Closed, Manual | All |

---

## 7. Bulk Actions & Uploads

- **Bulk Upload:** Triggered via the `[+ Upload Resumes]` button in the topbar. Opens a modal with the drag-and-drop zone, completely removing it from the default page view.

---

## 8. Components to build / refactor

| Component | Path | Notes |
|---|---|---|
| `<TalentPoolPage>` | `frontend/src/components/TalentPool/TalentPoolPage.jsx` | Refactor (add scroll wrappers) |
| `<PoolToolbar>` | `TalentPool/PoolToolbar.jsx` | Refactor to horizontal layout |
| `<CopilotMatchPanel>`| `TalentPool/CopilotMatchPanel.jsx` | New — Sliding side panel for AI matching |
| `<BulkUploadModal>` | `TalentPool/BulkUploadModal.jsx` | New — Move existing Dropzone here |

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
