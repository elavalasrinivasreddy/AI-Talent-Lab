"""
RLS enforcement proof — connects as the non-superuser app role (talentlab_app,
provisioned by migrations) and verifies tenant_isolation policies actually hide
cross-org rows. This is the test that would have caught the inert-RLS P0:
the policies existed for months but never enforced because the app ran as a
superuser/owner. Here we exercise them under the enforced role.
"""
from urllib.parse import urlparse

import asyncpg
import pytest
import pytest_asyncio

from backend.config import settings


def _app_role_url() -> str:
    """Same test DB, but authenticated as the non-superuser app role."""
    u = urlparse(settings.DATABASE_URL)
    role = settings.APP_DB_ROLE
    pw = settings.APP_DB_PASSWORD
    return f"postgresql://{role}:{pw}@{u.hostname}:{u.port}{u.path}"


@pytest_asyncio.fixture
async def two_orgs(db_pool):
    """Seed two orgs each with one competitor row (an RLS-protected table)."""
    su = await asyncpg.connect(settings.DATABASE_URL)  # superuser/owner connection
    try:
        a = await su.fetchval(
            "INSERT INTO organizations (name,slug,segment,size) "
            "VALUES ('RLS Org A','rls-org-a','tech','small') RETURNING id"
        )
        b = await su.fetchval(
            "INSERT INTO organizations (name,slug,segment,size) "
            "VALUES ('RLS Org B','rls-org-b','tech','small') RETURNING id"
        )
        await su.execute("INSERT INTO competitors (org_id,name) VALUES ($1,'CompA')", a)
        await su.execute("INSERT INTO competitors (org_id,name) VALUES ($1,'CompB')", b)
        yield a, b
        await su.execute("DELETE FROM competitors WHERE org_id = ANY($1::int[])", [a, b])
        await su.execute("DELETE FROM organizations WHERE id = ANY($1::int[])", [a, b])
    finally:
        await su.close()


@pytest.mark.asyncio
async def test_app_role_is_not_superuser():
    """If this fails, RLS can never enforce — the role bypasses it."""
    conn = await asyncpg.connect(_app_role_url())
    try:
        r = await conn.fetchrow(
            "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user"
        )
        assert r["rolsuper"] is False, "app role must NOT be superuser"
        assert r["rolbypassrls"] is False, "app role must NOT have BYPASSRLS"
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_rls_isolates_rows_by_org_context(two_orgs):
    org_a, org_b = two_orgs
    conn = await asyncpg.connect(_app_role_url())
    try:
        # Context = org A → only org A's competitor visible
        await conn.execute("SELECT set_config('app.current_org_id', $1, false)", str(org_a))
        rows = await conn.fetch("SELECT org_id FROM competitors")
        assert {r["org_id"] for r in rows} == {org_a}

        # Switch context to org B → isolation flips, A is now invisible
        await conn.execute("SELECT set_config('app.current_org_id', $1, false)", str(org_b))
        rows = await conn.fetch("SELECT org_id FROM competitors")
        assert {r["org_id"] for r in rows} == {org_b}

        # No context (NULL) → default-deny, zero rows (NULLIF keeps the cast safe)
        await conn.execute("SELECT set_config('app.current_org_id', NULL, false)")
        rows = await conn.fetch("SELECT org_id FROM competitors")
        assert rows == []
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_rls_join_policy_on_jd_variants(two_orgs):
    """jd_variants has RLS enabled but no org_id column — verify the join-based
    policy resolves through positions (default-deny would return [] otherwise)."""
    org_a, org_b = two_orgs
    su = await asyncpg.connect(settings.DATABASE_URL)
    dept = None
    try:
        # Minimal department + position + jd_variant for org A
        dept = await su.fetchval(
            "INSERT INTO departments (org_id, name) VALUES ($1,'RLS Dept') RETURNING id",
            org_a,
        )
        pos = await su.fetchval(
            "INSERT INTO positions (org_id, department_id, role_name, status) "
            "VALUES ($1,$2,'RLS Eng','open') RETURNING id",
            org_a, dept,
        )
        await su.execute(
            "INSERT INTO jd_variants (position_id, variant_type, summary, content) "
            "VALUES ($1,'balanced','summary','body')",
            pos,
        )
    finally:
        await su.close()

    conn = await asyncpg.connect(_app_role_url())
    try:
        await conn.execute("SELECT set_config('app.current_org_id', $1, false)", str(org_a))
        rows = await conn.fetch("SELECT id FROM jd_variants WHERE position_id=$1", pos)
        assert len(rows) == 1  # visible to owning org via join policy

        await conn.execute("SELECT set_config('app.current_org_id', $1, false)", str(org_b))
        rows = await conn.fetch("SELECT id FROM jd_variants WHERE position_id=$1", pos)
        assert rows == []  # hidden from other org
    finally:
        await conn.close()
        su2 = await asyncpg.connect(settings.DATABASE_URL)
        try:
            await su2.execute("DELETE FROM jd_variants WHERE position_id=$1", pos)
            await su2.execute("DELETE FROM positions WHERE id=$1", pos)
        finally:
            await su2.close()
