# Page Design: Talent Pool / CRM

> Org-wide candidate database for re-engagement and historical search.

---

## 1. Page Purpose

The Talent Pool page provides a searchable, filterable view of ALL candidates across the organization — regardless of which position they were originally sourced for. Candidates who were rejected, passed-over, or whose positions were closed are automatically added to the pool. Recruiters can search the pool before sourcing new candidates, saving time and money.

---

## 2. Page Layout

```
┌──────┬─────────────────────────────────────────────────────────┐
│      │  ┌─ Header ─────────────────────────────────────────┐   │
│      │  │ 🗃 Talent Pool              [AI Suggest ▼]        │   │
│      │  │ 1,247 candidates across all positions             │   │
│      │  └──────────────────────────────────────────────────┘   │
│      │                                                         │
│ S    │  ┌─ Search & Filters ───────────────────────────────┐   │
│ I    │  │ [🔍 Search skills, name, company...]              │   │
│ D    │  │ [Location ▼] [Source ▼] [Tags ▼] [Score ▼]       │   │
│ E    │  │ [Experience ▼] [Added Date ▼] [Clear Filters]    │   │
│ B    │  └──────────────────────────────────────────────────┘   │
│ A    │                                                         │
│ R    │  ┌─ Candidate Grid ─────────────────────────────────┐   │
│      │  │ ┌─────────────────────────────────────────────┐   │   │
│      │  │ │ 👤 Priya Sharma          87% match (avg)    │   │   │
│      │  │ │ Senior Python Developer @ TCS               │   │   │
│      │  │ │ 📍 Bangalore │ 6 yrs exp │ linkedin         │   │   │
│      │  │ │ 🏷 python react strong-communicator          │   │   │
│      │  │ │ Pool reason: Position closed (Sr Dev #42)   │   │   │
│      │  │ │ [View Profile] [Re-engage] [Remove]         │   │   │
│      │  │ └─────────────────────────────────────────────┘   │   │
│      │  │ ┌─────────────────────────────────────────────┐   │   │
│      │  │ │ 👤 Rahul Verma            72% match (avg)   │   │   │
│      │  │ │ ML Engineer @ Flipkart                      │   │   │
│      │  │ │ 📍 Hyderabad │ 4 yrs exp │ naukri           │   │   │
│      │  │ │ 🏷 machine-learning tensorflow               │   │   │
│      │  │ │ Pool reason: Rejected (ML Eng #38)          │   │   │
│      │  │ │ [View Profile] [Re-engage] [Remove]         │   │   │
│      │  │ └─────────────────────────────────────────────┘   │   │
│      │  │                                                   │   │
│      │  │ [← Prev]  Page 1 of 25  [Next →]                │   │
│      │  └──────────────────────────────────────────────────┘   │
│      │                                                         │
│      │  ┌─ AI Suggestions Panel (when position selected) ──┐   │
│      │  │ 🤖 3 pool candidates match "Sr Python Dev #55"   │   │
│      │  │ ┌───────────┐ ┌───────────┐ ┌───────────┐        │   │
│      │  │ │ Priya S.  │ │ Ankit M.  │ │ Deepa R.  │        │   │
│      │  │ │ 87% match │ │ 82% match │ │ 79% match │        │   │
│      │  │ │ [Add to   │ │ [Add to   │ │ [Add to   │        │   │
│      │  │ │ Pipeline] │ │ Pipeline] │ │ Pipeline] │        │   │
│      │  │ └───────────┘ └───────────┘ └───────────┘        │   │
│      │  └──────────────────────────────────────────────────┘   │
└──────┴─────────────────────────────────────────────────────────┘
```

---

## 3. Sections

### 3.1 Header
- Page title with total pool count
- **AI Suggest dropdown**: Select an open position → shows matching pool candidates

### 3.2 Search & Filters
- **Full-text search** across skills, name, company, title
- **Filters**: Location, source portal, tags, score range, experience range, date added
- **Clear all filters** button
- Search is debounced (300ms)

### 3.3 Candidate Grid
- Card-based layout (not table — better for scanning profiles)
- Each card shows: name, title, company, location, experience, source, tags, pool reason
- **Average match score** from their original position scoring
- Actions per card: View Profile, Re-engage (send email/WhatsApp), Remove from pool
- Pagination (20 per page)

### 3.4 AI Suggestions Panel
- Appears when a position is selected from the header dropdown
- Shows top candidates from pool that match the selected position's JD
- Each suggestion has a match score and "Add to Pipeline" button
- Adding moves the candidate from pool to the position's pipeline (status: sourced)

---

## 4. Backend APIs Used

| Action | Endpoint | Method |
|--------|----------|--------|
| Load pool candidates | `/api/talent-pool/` | GET |
| AI suggest matches | `/api/talent-pool/suggest/{position_id}` | POST |
| Add to pipeline | `/api/talent-pool/{candidate_id}/add` (from pool to position) | POST |
| Remove from pool | `/api/talent-pool/{candidate_id}/remove` | DELETE |
| Add tag | `/api/candidates/{id}/tags` | POST |
| Remove tag | `/api/candidates/{id}/tags/{tag}` | DELETE |
| Re-engage | `/api/communications/send` | POST |
| Find duplicates | `/api/talent-pool/deduplicate` | POST |

---

## 5. Auto-Pool Rules

Candidates are automatically added to the talent pool when:
1. **Candidate rejected** — status changed to `rejected` for any position
2. **Position closed** — all candidates in `sourced`, `emailed` status are pooled
3. **Position archived** — all non-selected candidates are pooled
4. **Manual add** — recruiter clicks "Add to Pool" on any candidate

Pool reason is tracked for context: `"rejected"`, `"position_closed"`, `"position_archived"`, `"manual"`.

---

## 6. Deduplication

- **Trigger**: Manual "Find Duplicates" button or automatic when new candidates are sourced
- **Match criteria**: Same email address (primary) or same name + company (secondary)
- **Merge UI**: Side-by-side comparison → pick which profile data to keep
- **After merge**: All position links, scores, and tags are combined
