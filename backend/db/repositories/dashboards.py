"""
db/repositories/dashboards.py – DashboardRepository.

CRUD for saved analytics dashboards (the "Explore" tab), scoped by org_id. `layout`
(react-grid-layout positions) and `widgets` ([{key,title,spec}]) are stored as JSON
text and (de)serialised here, matching the codebase's TEXT-JSON convention.
"""
import json
from typing import Optional, List
import asyncpg

_ADMIN_ROLES = {"org_head", "dept_admin", "platform_admin"}
_JSON_FIELDS = ("layout", "widgets")


def _hydrate(row) -> dict:
    d = dict(row)
    for k in _JSON_FIELDS:
        if isinstance(d.get(k), str):
            try:
                d[k] = json.loads(d[k])
            except (ValueError, TypeError):
                d[k] = []
    return d


class DashboardRepository:
    """Data access for the dashboards table."""

    @staticmethod
    async def list_for_user(
        conn: asyncpg.Connection, org_id: int, user_id: int, role: str, dept_id: Optional[int],
    ) -> List[dict]:
        """Dashboards visible to the caller: presets + org-shared + own + dept-shared."""
        if role in _ADMIN_ROLES:
            rows = await conn.fetch(
                "SELECT * FROM dashboards WHERE org_id = $1 "
                "ORDER BY is_preset DESC, updated_at DESC",
                org_id,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT * FROM dashboards
                WHERE org_id = $1 AND (
                    is_preset = TRUE
                    OR scope = 'org'
                    OR owner_user_id = $2
                    OR (scope = 'dept' AND department_id IS NOT DISTINCT FROM $3)
                )
                ORDER BY is_preset DESC, updated_at DESC
                """,
                org_id, user_id, dept_id,
            )
        return [_hydrate(r) for r in rows]

    @staticmethod
    async def get(conn: asyncpg.Connection, dashboard_id: int, org_id: int) -> Optional[dict]:
        row = await conn.fetchrow(
            "SELECT * FROM dashboards WHERE id = $1 AND org_id = $2", dashboard_id, org_id,
        )
        return _hydrate(row) if row else None

    @staticmethod
    async def create(
        conn: asyncpg.Connection, org_id: int, user_id: int, name: str,
        description: Optional[str], scope: str, department_id: Optional[int],
        layout: list, widgets: list,
    ) -> dict:
        row = await conn.fetchrow(
            """
            INSERT INTO dashboards
                (org_id, owner_user_id, name, description, scope, department_id, layout, widgets)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            """,
            org_id, user_id, (name or "Untitled dashboard").strip(), description,
            scope, department_id, json.dumps(layout or []), json.dumps(widgets or []),
        )
        return _hydrate(row)

    @staticmethod
    async def update(
        conn: asyncpg.Connection, dashboard_id: int, org_id: int, **fields,
    ) -> Optional[dict]:
        if not fields:
            return await DashboardRepository.get(conn, dashboard_id, org_id)
        for k in _JSON_FIELDS:
            if k in fields:
                fields[k] = json.dumps(fields[k] or [])

        set_clauses, values = [], []
        for i, (key, val) in enumerate(fields.items(), start=1):
            set_clauses.append(f"{key} = ${i}")
            values.append(val)
        set_clauses.append("updated_at = NOW()")
        values.extend([dashboard_id, org_id])
        query = (
            f"UPDATE dashboards SET {', '.join(set_clauses)} "
            f"WHERE id = ${len(values) - 1} AND org_id = ${len(values)} RETURNING *"
        )
        row = await conn.fetchrow(query, *values)
        return _hydrate(row) if row else None

    @staticmethod
    async def delete(conn: asyncpg.Connection, dashboard_id: int, org_id: int) -> bool:
        result = await conn.execute(
            "DELETE FROM dashboards WHERE id = $1 AND org_id = $2", dashboard_id, org_id,
        )
        return result == "DELETE 1"
