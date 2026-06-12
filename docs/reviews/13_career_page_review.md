# Code Review: 13 — Career Page

> **Surface:** CareerPage (frontend), public careers endpoint (backend)
> **Reviewer:** Automated GA pass (2026-05-29)
> **Status:** REVIEW COMPLETE

---

## 1. Authorization

| Check | Status | Notes |
|-------|--------|-------|
| Public surface | ✅ PASS | Career page is intentionally public — no auth required |
| Org lookup by slug | ✅ PASS | `GET /api/v1/careers/:org_slug` returns only public-facing data (name, about, culture) |
| Position visibility | ✅ PASS | Only positions with `is_on_career_page = TRUE` and `status = 'open'` are returned |
| No internal data leaked | ✅ PASS | Career API does not expose `assigned_to`, `ats_threshold`, `salary_min/max`, or candidate counts |

---

## 2. SQL / Query Safety

| Check | Status | Notes |
|-------|--------|-------|
| Frontend | ✅ N/A | No SQL |
| Backend careers query | ✅ PASS | `WHERE o.slug = $1 AND p.is_on_career_page = TRUE AND p.status = 'open'` — fully parameterized |
| Org slug input | ✅ PASS | Slug is alphanumeric + hyphens only (validated at org creation time) |

---

## 3. Error Handling

| Check | Status | Notes |
|-------|--------|-------|
| Org not found | ✅ PASS | Returns 404 with "Company not found" |
| No open positions | ✅ PASS | Returns empty array, frontend shows "No open positions" |
| Network error | ✅ PASS | Frontend shows retry-friendly error state |

---

## 4. Status Transitions

| Check | Status | Notes |
|-------|--------|-------|
| No mutations | ✅ N/A | Career page is read-only |

---

## 5. Idempotency

| Check | Status | Notes |
|-------|--------|-------|
| Read-only | ✅ N/A | No mutations |

---

## 6. Email HTML Escaping

| Check | Status | Notes |
|-------|--------|-------|
| Not applicable | ✅ N/A | Career page doesn't send emails. Apply links lead to Apply Page (reviewed separately) |

---

## 7. Frontend Loading/Error States

| Check | Status | Notes |
|-------|--------|-------|
| Loading state | ✅ PASS | Shows branded skeleton with org name placeholder |
| Error state | ✅ PASS | Shows "Unable to load company page" with retry |
| Empty positions | ✅ PASS | "No open positions right now — check back soon!" message |
| Mobile responsive | ✅ PASS | Cards stack in single column on mobile |
| Department grouping | ✅ PASS | Positions grouped by department name |
| Apply button | ✅ PASS | Links to magic link apply URL |

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 0 |

Career page is the cleanest surface — public read-only with no auth, mutations, or email concerns.
