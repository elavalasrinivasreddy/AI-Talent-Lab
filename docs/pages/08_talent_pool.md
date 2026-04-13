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
