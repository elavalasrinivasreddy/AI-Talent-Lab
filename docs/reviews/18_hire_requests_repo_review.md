# Code Review: 18 — Hire Requests Repository

> **Surface:** db/repositories/hire_requests.py
> **Reviewer:** Automated GA pass (2026-05-29)
> **Status:** REVIEW COMPLETE

---

## 1. Authorization (org_id Scoping)

| Check | Status | Notes |
|-------|--------|-------|
| `get_by_id` | ✅ PASS | `WHERE hr.id = $1 AND hr.org_id = $2` — scoped |
| `list_for_org` | ✅ PASS | `WHERE hr.org_id = $1` as first filter — scoped |
| `count_pending_for_org` | ✅ PASS | `WHERE org_id = $1` — scoped |
| `create` | ✅ PASS | `org_id` is a required parameter, inserted directly |
| `update` | ✅ PASS | `WHERE id = $N AND org_id = $N` — scoped |
| `approve` | ✅ PASS | `WHERE id = $2 AND org_id = $3` — scoped |
| `reject` | ✅ PASS | `WHERE id = $2 AND org_id = $3` — scoped |
| `accept` | ✅ PASS | `WHERE id = $3 AND org_id = $4` — scoped |
| `link_position` | ✅ PASS | `WHERE id = $2 AND org_id = $3` — scoped |
| `cancel` | ✅ PASS | `WHERE id = $1 AND org_id = $2` — scoped |

**All 10 methods correctly scope by org_id. No tenant isolation violations.**

---

## 2. SQL / Query Safety

| Check | Status | Notes |
|-------|--------|-------|
| Parameterized queries | ✅ PASS | All queries use `$N` parameterization |
| Dynamic column building in `update()` | ✅ PASS | Uses `allowed` whitelist set: `{"department_id", "role_name", "headcount", ...}`. Only whitelisted columns can be updated — prevents SQL injection via field names |
| `_LIST_SELECT` f-string | ✅ PASS | Static string constant, not dynamic. `_BASE_RETURN` is also static |
| No raw string interpolation | ✅ PASS | No f-strings in SQL WHERE clauses |

---

## 3. Error Handling

| Check | Status | Notes |
|-------|--------|-------|
| Entity not found | ✅ PASS | `get_by_id` returns `None` if not found. Service layer raises 404 |
| `update` with no changes | ✅ PASS | Returns current entity if `sanitized` dict is empty |
| `update` target missing | ✅ PASS | `RETURNING id` returns no row → returns `None` → service raises 404 |
| `create` RETURNING | ✅ PASS | Returns `RETURNING id` then fetches via `get_by_id` for full display fields |

---

## 4. Status Transitions

| Check | Status | Notes |
|-------|--------|-------|
| Documented lifecycle | ✅ PASS | Header docstring documents: `pending → approved → accepted → fulfilled` and `pending → rejected` and `→ cancelled` |
| Transition guards | ⚠️ INFO | Repository methods do NOT check current status before transitioning. This is by design: "Status transitions are intentionally guarded at the service layer, not here" (per docstring) |
| `cancel` from any state | ⚠️ WARN | `cancel()` has no status check — can cancel `fulfilled` requests (raised as C-HR-02 in hire_requests review) |
| `approve` without pending check | ✅ INFO | Service layer checks `status == 'pending'` before calling |

---

## 5. Idempotency

| Check | Status | Notes |
|-------|--------|-------|
| `approve` twice | ✅ SAFE | Sets same values again — DB update is idempotent at SQL level. Service layer prevents reaching this |
| `create` duplicate | ⚠️ WARN | No unique constraint on `(org_id, role_name)` — duplicate hire requests are allowed (intentional per product) |

---

## 6. Performance

| Check | Status | Notes |
|-------|--------|-------|
| `_LIST_SELECT` joins | ✅ OK | 4 LEFT JOINs + 2 correlated subqueries. For a list endpoint with `LIMIT 100`, acceptable |
| Correlated subqueries | ⚠️ WARN | `(SELECT COUNT(*) FROM candidate_applications WHERE position_id = hr.position_id)` runs per-row. Fine for small result sets but could be slow with 1000+ requests |

**Finding C-REPO-01 (LOW):** Consider materializing `candidate_count` and `interview_count` for hire requests that have a linked `position_id`, or switching to JOIN-based aggregation, if list performance degrades.

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 1 (C-REPO-01) |

**This is one of the cleanest surfaces reviewed.** Every method is correctly org-scoped, uses parameterized queries, and handles entity-not-found cases. The `update()` column whitelist is a particularly good pattern.
