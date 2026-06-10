# Cross-Organization Candidate Data Schema

## 1. Context and Problem Statement
Currently, candidates are strictly isolated per tenant (`org_id`). This guarantees data privacy and prevents cross-tenant data leakage. However, as AI Talent Lab grows, we aim to build a **product-level Talent Pool** — an aggregated, opt-in database of candidates that any organization on the platform can tap into (a "Zero Cost" sourcing layer).

To accomplish this legally (GDPR/CCPA) and technically, candidates must be able to **consent** to having their data shared globally, and we must decouple their identity from a single organization.

## 2. Consent Capture
The lawful basis for sharing candidate profiles globally is explicit consent. We capture this during the candidate's portal experience (e.g., when they opt into an organization's talent pool, we prompt them to optionally join the "Global AI Talent Pool").

**Fields on `candidates` table (Tenant-local):**
* `consent_to_store` (BOOLEAN): Consent to keep their data in the localized org DB.
* `consent_to_contact` (BOOLEAN): Consent for the org to reach out for future roles.
* `global_pool_opt_in` (BOOLEAN): (Future) Consent to sync to the Global Pool.
* `consent_timestamp` (TIMESTAMP): When consent was granted.

## 3. The Cross-Org Datastore (Global DB)
The Global Talent Pool must live in a **separate schema or physical database** (`global_talent_pool`) to maintain strict separation of concerns from the multi-tenant SaaS schema.

### Global DB Entities

**`global_candidates`**
The canonical identity of a candidate.
* `id` (UUID PRIMARY KEY)
* `email` (UNIQUE TEXT, Indexed)
* `phone` (TEXT)
* `normalized_skills` (TEXT[])
* `experience_years` (INTEGER)
* `resume_parsed_cache` (JSONB)
* `global_embedding` (VECTOR/TEXT) - The universal matching vector.

**`global_candidate_provenance`**
Tracks *which* organizations uploaded or sourced this candidate and their explicit consent receipts.
* `id` (UUID)
* `global_candidate_id` (UUID FK)
* `source_org_id` (INTEGER) - The org that originally brought the candidate to the platform.
* `consent_receipt` (JSONB) - A snapshot of the consent granted (IP, timestamp, scope).
* `revoked_at` (TIMESTAMP) - Nullable. If a candidate revokes consent in Org A, we mark this row.

## 4. Deletion Propagation (GDPR)
When a candidate requests "Delete My Data" (e.g., via the privacy page):
1. **Local Deletion:** The candidate is hard-deleted or anonymized in the origin `candidates` table.
2. **Provenance Revocation:** We update `global_candidate_provenance.revoked_at = NOW()` for that org's receipt.
3. **Global Sweeper:** A nightly background job evaluates `global_candidates`. If a candidate has NO active (unrevoked) provenance records, they are completely purged from the `global_candidates` table.

## 5. Sync Strategy
We will NOT write directly to the Global DB from SaaS API routes. 
Instead, we use a **CDC (Change Data Capture)** pattern or an asynchronous Celery worker:
* When a candidate updates their profile or grants consent locally, emit a `CandidateConsentGrantedEvent`.
* An independent worker processes this event, upserts the `global_candidates` record, and writes the `global_candidate_provenance`.

## 6. Access Control
When Org B runs an "AI Match" search, the search queries the `global_candidates` vector index. If Org B wants to contact a global candidate, they spend a "credit" to unlock the contact info, which then copies the candidate profile into Org B's local `candidates` table (thus creating a local tenant instance of the candidate).
