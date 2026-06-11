# P0-2 — Real RLS Implementation Plan (execute next session)

> Closes the inert-RLS hole in [PRODUCT_STATUS.md](PRODUCT_STATUS.md). The 18 policies exist but
> `SET LOCAL app.current_org_id` is never run, so they evaluate against NULL and do nothing.
> This is architectural — `get_connection()` is shared by request handlers, Celery, login, platform
> admin, and dev tools. Do it deliberately, with the gotchas below, then test before committing.

## Step 0 — ✅ DONE (2026-06-11, static check) — RLS is inert TWO ways, not one

Confirmed without touching the live DB:
- App connects as **`talentlab`** (`.env:21`), which is `POSTGRES_USER` (`docker-compose.yml:8`) → **superuser AND table owner**.
- `backend/db/migrations.py`: `ENABLE ROW LEVEL SECURITY` ×19, **`FORCE ROW LEVEL SECURITY` ×0**, no app role / GRANTs.

**Therefore wiring `set_config('app.current_org_id')` alone does NOTHING.** Two independent bypasses are active:
1. **Superusers bypass RLS unconditionally** — always, regardless of policies or GUC.
2. **Table owners bypass RLS** unless `FORCE ROW LEVEL SECURITY` is set (it isn't).

So the dead `SET LOCAL` found in the audit is only HALF the problem. **The real fix is bigger than the plan below —
it needs a DB-role migration first:**
- (a) `CREATE ROLE talentlab_app LOGIN PASSWORD ...;` (NOT superuser, NOT owner, no BYPASSRLS).
- (b) `GRANT` it `SELECT/INSERT/UPDATE/DELETE` on the app tables (+ `USAGE` on sequences).
- (c) Either `ALTER TABLE <t> FORCE ROW LEVEL SECURITY;` on the 18 tables, or ensure `talentlab_app` is not the owner.
- (d) Switch `DATABASE_URL` to `talentlab_app`. Keep a separate superuser/owner connection for migrations + the
  `platform_admin`/`dev` cross-org bypass (see Step 2).
- (e) THEN do Steps 1–3 below (set_config wiring).

Verify on the live DB when available: `SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;`

## Step 1 — Pick the mechanism: contextvar + per-transaction set_config
1. In `middleware/tenant_context.py`, after decoding the JWT, store org_id in a `contextvars.ContextVar`
   (not just `request.state` — Celery/services don't have `request`).
2. In `db/connection.py` `get_connection()`, after acquiring a pooled connection, set the GUC **inside a
   transaction** so it's scoped and auto-resets on release (avoids cross-request leak on pooled conns):
   ```python
   org_id = current_org_id_var.get(None)
   async with conn.transaction():
       if org_id is not None:
           await conn.execute("SELECT set_config('app.current_org_id', $1, true)", str(org_id))
       yield conn   # all queries run inside this txn → GUC stays set
   ```
   `true` = transaction-local (resets at txn end). Do NOT use `false` (session-local) — it leaks across
   the next request that reuses the pooled connection.

## Step 2 — Handle every no-org / cross-org caller (the part that breaks if skipped)
- **Login / register / magic-link verify** — happen before an org is known. They query `users`, `organizations`,
  `consumed_magic_links` (none of which have RLS policies — confirm). They run with `org_id=None` → no
  set_config → fine, as long as those tables stay policy-free.
- **Celery tasks** (`candidate_pipeline`, `pre_eval_grade`, `email_outreach`, `scheduled_search`, etc.) — they
  KNOW their org_id (passed as task arg). Set the contextvar at task entry, or call set_config explicitly. Audit
  each task: it must set org context or it will read zero rows once RLS is live.
- **platform_admin cross-org reads** (`routers/platform.py`, `dev_admin.py`) — intentionally span orgs. Give them
  a **bypass**: run these under a separate BYPASSRLS role/connection, OR add policy exceptions, OR keep them on a
  superuser pool. Decide one approach and apply consistently.
- **GDPR retention cleanup** (`gdpr_service` batch) — loops over orgs; set context per-iteration.

## Step 3 — Test before committing (non-negotiable for this change)
1. Seed 2 orgs with candidates.
2. As Org A user, run a query that **omits** `WHERE org_id` (temporarily) → must return only Org A rows.
3. Cross-org fetch by id from Org B → must return empty/404.
4. Smoke every surface: login, dashboard, a Celery sourcing run, platform admin list, a candidate apply.
   If any returns empty where it shouldn't, that caller is missing org context (Step 2).

## Fallback (if Step 0–2 prove too invasive this cycle)
**Do not keep the illusion.** Either ship real RLS or `DROP POLICY ... ; ALTER TABLE ... DISABLE ROW LEVEL
SECURITY;` on the 18 tables and document **WHERE-clause isolation as the explicit, tested model** — with a
repo-layer rule that every query takes `org_id`. False security (current state) is worse than honest app-layer
isolation.

## Files in scope
`backend/middleware/tenant_context.py`, `backend/db/connection.py`, `backend/dependencies.py` (fix the lying
docstring), every file in `backend/tasks/`, `backend/routers/platform.py`, `backend/routers/dev_admin.py`,
the DB role/connection string. ~1 focused day with testing.
