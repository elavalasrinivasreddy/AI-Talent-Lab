# Schema Gap Analysis: Design Doc vs Current DB

> [!IMPORTANT]
> This maps every column/index the [design doc](file:///media/elavala-srinivas-reddy/HDD/2026/AI%20Talent%20Lab/docs/design/jd_generation_workflow_design.md) names that **does not yet exist** in [migrations.py](file:///media/elavala-srinivas-reddy/HDD/2026/AI%20Talent%20Lab/backend/db/migrations.py).

---

## 1. `positions` Table — Missing Columns

| # | Column | Type | Default | Design Doc Reference | Notes |
|---|--------|------|---------|---------------------|-------|
| 1 | `picked_up_by` | `INTEGER REFERENCES users(id) ON DELETE SET NULL` | `NULL` | §Atomic HR Pickup, line 189 | Tracks which HR picked up the hire request. CAS guard column. |
| 2 | `picked_up_at` | `TIMESTAMPTZ` | `NULL` | §Atomic HR Pickup, line 190 | Timestamp of pickup. |
| 3 | `revision_cycle` | `INTEGER` | `0` | §Revision Cycle Cap, line 214 | Increments on reviewer rejection only. |
| 4 | `reviewer_id` | `INTEGER REFERENCES users(id) ON DELETE SET NULL` | `NULL` | §ATS Submit, line 325; §Flow 2 Reviewer Resolution | Server-resolved reviewer for pending_jd_approval. |
| 5 | `submitted_by_role` | `TEXT` | `NULL` | §Authority Snapshotting, line 284 | Snapshot of submitter's role at submit time. |
| 6 | `reviewer_role_at_submit` | `TEXT` | `NULL` | §Authority Snapshotting, line 284 | Snapshot of reviewer's role at submit time. |
| 7 | `submitted_at` | `TIMESTAMPTZ` | `NULL` | §ATS Submit, line 327 | When the JD was submitted for approval. |
| 8 | `sourcing_freq` | `TEXT` | `NULL` | §ATS Submit, line 323; §Post-open editable fields | ATS sourcing frequency config. Currently `search_interval_hours` exists — design uses `sourcing_freq` as a distinct field. **Clarify**: alias or new column? |
| 9 | `final_jd` | `TEXT` | `NULL` | §Deleted Session Edge Case, line 432 | "JD content lives on `positions.final_jd`". Currently stored as `jd_markdown`. **Clarify**: rename `jd_markdown` → `final_jd` or add alias? |

> [!NOTE]
> The existing columns `requires_approval`, `approval_status`, `approved_by`, `approved_at`, `review_notes` already cover parts of the approval flow. The design doc adds `reviewer_id` as the **server-resolved** reviewer (distinct from `approved_by` which records who actually approved).

---

## 2. `hire_requests` Table — Missing Columns

| # | Column | Type | Default | Design Doc Reference | Notes |
|---|--------|------|---------|---------------------|-------|
| 1 | `reviewing_locked_by` | `INTEGER REFERENCES users(id) ON DELETE SET NULL` | `NULL` | §admin_reviewing Lock Rules, line 121 | Atomic lock for admin review. |
| 2 | `reviewing_locked_at` | `TIMESTAMPTZ` | `NULL` | §admin_reviewing Lock Rules, line 121 | TTL tracking — 30 min auto-release. |
| 3 | `notes` | `TEXT` | `NULL` | §Notes Visibility, line 147-149 | Admin rejection/modification notes + TL cancellation notes. Currently `rejection_reason` exists — design also needs general `notes` for approve_modified and cancel scenarios. **Clarify**: rename `rejection_reason` → `notes` or add separately? |
| 4 | `modification_diff` | `JSONB` | `NULL` | §Data Integrity, line 478 | "Diff JSON for admin modify — Store as JSONB with `schema_version: 1`". For `approved_modified` status. |

### Status Values Gap

Current `hire_requests.status` values: `pending` (default in CREATE TABLE)

Design doc states:
```
draft → submitted → admin_reviewing → approved | approved_modified | rejected | cancelled
```

**Missing status values**: `draft`, `submitted`, `admin_reviewing`, `approved`, `approved_modified`, `cancelled`. The current default is `pending` — needs to be changed to `draft`.

---

## 3. `chat_messages` Table — Missing Columns

| # | Column | Type | Default | Design Doc Reference | Notes |
|---|--------|------|---------|---------------------|-------|
| 1 | `message_type` | `TEXT` | `NULL` | §Rejection → Revision Flow, line 386 | Distinguishes `feedback_injection` from normal messages. |
| 2 | `revision_cycle` | `INTEGER` | `0` | §Rejection → Revision Flow, line 387 | Ties feedback to a specific revision cycle. |

### Missing Index

| Index | Design Doc Reference |
|-------|---------------------|
| `uq_chat_feedback_injection ON chat_messages (session_id, message_type, revision_cycle) WHERE message_type = 'feedback_injection'` | §Rejection → Revision Flow, line 388-390 | Idempotent feedback injection guard. |

---

## 4. `positions.status` Values Gap

Current valid statuses in [position_service.py](file:///media/elavala-srinivas-reddy/HDD/2026/AI%20Talent%20Lab/backend/services/position_service.py#L18):
```python
VALID_STATUSES = {"draft", "open", "on_hold", "closed", "archived"}
```

Design doc states:
```
jd_in_progress → pending_jd_approval ⇄ draft_needs_revision → open → cancelled
```

**Missing statuses**: `jd_in_progress`, `pending_jd_approval`, `draft_needs_revision`, `cancelled`
**Should remove/remap**: `draft` → `jd_in_progress` (for Flow 2), `on_hold` (not in design)

---

## 5. Summary Migration Checklist

### Priority 1 — DB Columns (Implementation Priority #1 from design doc)

```sql
-- positions: new columns
ALTER TABLE positions ADD COLUMN IF NOT EXISTS picked_up_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS revision_cycle INTEGER DEFAULT 0;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS submitted_by_role TEXT;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS reviewer_role_at_submit TEXT;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- hire_requests: admin_reviewing lock
ALTER TABLE hire_requests ADD COLUMN IF NOT EXISTS reviewing_locked_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE hire_requests ADD COLUMN IF NOT EXISTS reviewing_locked_at TIMESTAMPTZ;
ALTER TABLE hire_requests ADD COLUMN IF NOT EXISTS modification_diff JSONB;

-- chat_messages: feedback injection
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS message_type TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS revision_cycle INTEGER DEFAULT 0;

-- unique index for idempotent feedback injection
CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_feedback_injection
  ON chat_messages (session_id, message_type, revision_cycle)
  WHERE message_type = 'feedback_injection';
```

### Priority 2 — Status Enum Alignment (service layer)

| Entity | Current | Target |
|--------|---------|--------|
| `positions.status` | `draft, open, on_hold, closed, archived` | `jd_in_progress, pending_jd_approval, draft_needs_revision, open, cancelled, closed, archived` |
| `hire_requests.status` | `pending` (default) | `draft, submitted, admin_reviewing, approved, approved_modified, rejected, cancelled` |

### Priority 3 — Clarification Needed

| Item | Question |
|------|----------|
| `sourcing_freq` vs `search_interval_hours` | Are these the same field? Design says `sourcing_freq`, schema has `search_interval_hours`. |
| `final_jd` vs `jd_markdown` | Design references `positions.final_jd`. Schema has `jd_markdown`. Rename or alias? |
| `notes` vs `rejection_reason` on `hire_requests` | Design uses generic `notes` for approval/rejection/cancel. Schema has `rejection_reason`. Expand or rename? |
| `requires_approval` column | Design doc doesn't mention this column — approval is always required (except org_head bypass). Keep or drop? |

---

## 6. FK Constraint Adjustments

The design doc specifies `ON DELETE SET NULL` for these FKs (currently missing cascade behavior):

| Table | Column | Required FK behavior |
|-------|--------|---------------------|
| `positions` | `reviewer_id` | `ON DELETE SET NULL` + trigger to re-resolve |
| `positions` | `picked_up_by` | `ON DELETE SET NULL` |
| `hire_requests` | `reviewing_locked_by` | `ON DELETE SET NULL` (auto-releases lock) |
| `hire_requests` | `requested_by` | `ON DELETE SET NULL` — currently `NOT NULL` ⚠️ |

> [!WARNING]
> `hire_requests.requested_by` is currently `NOT NULL`. The design doc says "User deleted while `requested_by` → display as 'Former employee'", which implies it should be nullable with `ON DELETE SET NULL`. This is a **breaking change** that requires a data migration.
