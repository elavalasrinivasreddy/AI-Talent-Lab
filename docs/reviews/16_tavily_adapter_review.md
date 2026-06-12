# Code Review: 16 — Tavily Adapter (Candidate Sourcing)

> **Surface:** adapters/candidate_sources/tavily.py, adapters/candidate_sources/base.py, adapters/candidate_sources/simulation.py
> **Reviewer:** Automated GA pass (2026-05-29)
> **Status:** REVIEW COMPLETE

---

## 1. Authorization

| Check | Status | Notes |
|-------|--------|-------|
| API key management | ✅ PASS | Tavily API key loaded from environment via `settings.TAVILY_API_KEY` — not hardcoded |
| No user data in queries | ✅ PASS | Search query constructed from position data only (role_name, skills, location) — no PII sent |
| Org scoping | ✅ N/A | Adapter is stateless — called from Celery task which already validated org context |

---

## 2. SQL / Query Safety

| Check | Status | Notes |
|-------|--------|-------|
| No SQL in adapter | ✅ N/A | Adapter returns candidate dicts. SQL is in `candidate_pipeline.py` which calls the adapter |
| LLM prompt safety | ⚠️ WARN | `_build_dossier_prompt()` injects `result['title']`, `result['url']`, `result['content'][:800]` into the LLM prompt. These come from web search results and could contain adversarial content |

**Finding C-TAV-01 (LOW):** Web search results injected into `_build_dossier_prompt()` are untrusted external data. The LLM is instructed to "Return null if unsure" but a specially crafted web page could attempt prompt injection. Risk is LOW because the output is validated by `_parse_llm_json()` which only accepts well-formed dossier JSON.

---

## 3. Error Handling

| Check | Status | Notes |
|-------|--------|-------|
| Tavily API failure | ✅ PASS | `SearchError` caught → returns empty list with logged warning |
| Empty results | ✅ PASS | Returns empty list |
| LLM extraction failure | ✅ PASS | Individual failures caught per-result with `continue` — doesn't abort entire batch |
| JSON parse failure | ✅ PASS | `_parse_llm_json()` tries multiple strategies: markdown fence removal, regex extraction, null detection. Returns `None` on total failure |
| No name in dossier | ✅ PASS | Filtered out: `if not name: continue` |

---

## 4. Status Transitions

| Check | Status | Notes |
|-------|--------|-------|
| Not applicable | ✅ N/A | Adapter is a pure function — no state transitions |

---

## 5. Idempotency

| Check | Status | Notes |
|-------|--------|-------|
| Deduplication | ✅ PASS | `seen` set tracks `(name.lower(), source_url.lower())` — no duplicate candidates returned |
| Re-run safety | ✅ PASS | Running search twice returns same results (modulo Tavily API response variability). Caller (`candidate_pipeline`) handles dedup against existing DB records |

---

## 6. Email HTML Escaping

| Check | Status | Notes |
|-------|--------|-------|
| Email field | ✅ N/A | `email` is always `None` from Tavily results (web profiles rarely expose email). Outreach emails generated later by `email_service` which escapes properly |

---

## 7. Data Quality

| Check | Status | Notes |
|-------|--------|-------|
| Name validation | ✅ PASS | Strips whitespace, skips empty names |
| URL validation | ⚠️ WARN | `source_url` taken as-is from web results. No URL validation/sanitization |
| `experience_years` | ✅ PASS | Explicitly set to `None` — not reliably extractable |
| `resume_text` fallback | ✅ PASS | Uses `dossier['summary']` as resume_text — adequate for scoring |
| `skill_tags` normalization | ✅ PASS | Handles both list and comma-string formats |
| Limit enforcement | ✅ PASS | `if len(candidates) >= limit: break` — respects caller limit |
| Query construction | ✅ PASS | `_build_query()` uses `PROFILE_SITE_FILTER` to bias toward person pages, reducing false positives |

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 1 (C-TAV-01) |
