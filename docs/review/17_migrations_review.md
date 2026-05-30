# Code Review: 17 — Database Migrations

> **Surface:** db/migrations.py — all CREATE TABLE, ALTER TABLE, index, RLS policy statements
> **Reviewer:** Automated GA pass (2026-05-29)
> **Status:** REVIEW COMPLETE

---

## 1. Authorization (Schema Correctness for Tenant Isolation)

| Check | Status | Notes |
|-------|--------|-------|
| `org_id NOT NULL` on business tables | ✅ PASS | All business tables have `org_id INTEGER NOT NULL REFERENCES organizations(id)` |
| `department_id` on dept-scoped tables | ✅ PASS | `positions`, `candidate_applications`, `interviews` all have `department_id NOT NULL` |
| RLS enabled | ✅ PASS | `ENABLE ROW LEVEL SECURITY` on 17 tenant-scoped tables |
| RLS policies | ✅ PASS | `tenant_isolation` policy uses `org_id = current_setting('app.current_org_id', true)::int` |
| Tables WITHOUT org_id | ⚠️ WARN | `jd_variants` and `interview_panel` lack `org_id` column — accessed via parent (position_id, interview_id). RLS policies not created for these |

**Finding C-MIG-01 (LOW):** `jd_variants` and `interview_panel` tables don't have direct `org_id` columns. Their RLS can't use the simple `org_id =` policy. Current app-layer scoping (always JOINing via parent) is safe, but consider adding `org_id` for defense-in-depth.

---

## 2. SQL / Query Safety

| Check | Status | Notes |
|-------|--------|-------|
| Idempotent migrations | ✅ PASS | All `CREATE TABLE IF NOT EXISTS` and `DO $$ BEGIN IF NOT EXISTS ... END $$` guards |
| Incremental ALTERs | ✅ PASS | Column additions wrapped in `IF NOT EXISTS` checks on `information_schema.columns` |
| Index creation | ✅ PASS | All `CREATE INDEX IF NOT EXISTS` |
| Policy creation | ✅ PASS | `IF NOT EXISTS (SELECT 1 FROM pg_policies ...)` guard |
| Role rename migration | ✅ PASS | `UPDATE users SET role = 'org_head' WHERE role = 'admin'` — idempotent (already-migrated rows unaffected) |

---

## 3. Error Handling

| Check | Status | Notes |
|-------|--------|-------|
| Migration failure | ⚠️ WARN | If any migration block fails, the entire startup aborts. No partial migration tracking |

**Finding C-MIG-02 (MEDIUM):** No migration version tracking. If a new ALTER TABLE is added and the first half of `incremental_sql` succeeds but the second half fails, re-running applies the first half again (safe due to IF NOT EXISTS guards) but there's no way to know which migrations succeeded.

---

## 4. Schema Design Issues

| Check | Status | Notes |
|-------|--------|-------|
| `chat_sessions.id` is TEXT | ⚠️ WARN | Primary key is TEXT (UUID string), not SERIAL. This is intentional (client-generated UUIDs) but has indexing implications |
| `hire_requests.department_id` nullable | ⚠️ WARN | Rule #1 says dept-scoped tables must have `department_id NOT NULL`, but `hire_requests.department_id` is nullable (`REFERENCES departments(id)` without NOT NULL). This allows org-wide hire requests |

**Finding C-MIG-03 (MEDIUM):** `hire_requests.department_id` is nullable, which violates rule #1 ("Tables scoped to a department MUST also have department_id INTEGER NOT NULL"). However, the product spec allows org-wide requests. **Decision needed:** Is `hire_requests` dept-scoped or org-scoped?

| Check | Status | Notes |
|-------|--------|-------|
| `candidate_sessions` references | ⚠️ WARN | `candidate_sessions.candidate_id REFERENCES candidates(id)` — but `candidates` table is created AFTER `candidate_sessions` in the SQL (CHAT_TABLES before HIRING_TABLES). This works because of IF NOT EXISTS + deferred FK checks in PostgreSQL |
| Backfill `status_token` | ✅ PASS | `UPDATE candidate_applications SET status_token = gen_random_uuid()::text WHERE status_token IS NULL` — backfills existing rows |

---

## 5. Idempotency

| Check | Status | Notes |
|-------|--------|-------|
| Full migration rerun | ✅ PASS | All statements are idempotent — safe to run on every startup |
| Role rename rerun | ✅ PASS | `UPDATE users SET role = 'org_head' WHERE role = 'admin'` — no-op if already renamed |
| Policy recreation | ✅ PASS | Guarded by `IF NOT EXISTS` |

---

## 6. Missing Tables/Columns (vs. product spec)

| Check | Status | Notes |
|-------|--------|-------|
| `consumed_magic_links` table | ❌ MISSING | Referenced in code_review_findings.md but not in migrations.py. If panel feedback single-use tracking relies on `interview_panel.feedback_submitted` instead, this is fine |
| `organizations.ai_behavior_config` | ❌ MISSING | Settings page references AI behavior configuration but no column for it exists. Currently stored in... nowhere? |

**Finding C-MIG-04 (MEDIUM):** AI behavior settings from the Settings page have no database storage. Need `organizations.ai_behavior_config TEXT` (JSON) or a dedicated `ai_settings` table.

---

## 7. Performance

| Check | Status | Notes |
|-------|--------|-------|
| Key indexes | ✅ PASS | 18 indexes created covering primary query patterns |
| Talent pool partial index | ✅ PASS | `WHERE in_talent_pool = TRUE` — efficient for talent pool queries |
| Missing index: applications by org | ⚠️ WARN | No index on `candidate_applications(org_id)` — needed for org-wide stats queries |

**Finding C-MIG-05 (LOW):** Add `CREATE INDEX IF NOT EXISTS idx_applications_org ON candidate_applications(org_id)`.

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 3 (C-MIG-02, C-MIG-03, C-MIG-04) |
| LOW | 2 (C-MIG-01, C-MIG-05) |
