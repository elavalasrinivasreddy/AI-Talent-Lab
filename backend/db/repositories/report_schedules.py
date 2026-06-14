"""
db/repositories/report_schedules.py – ReportScheduleRepository.

CRUD for scheduled analytics reports + the due-query / advance helpers used by the
Celery dispatcher. `recipients` is stored as JSON text.
"""
import json
from datetime import datetime, timedelta, timezone
from typing import Optional, List
import asyncpg

_CADENCES = {"daily", "every_12h", "weekly", "monthly"}


def _hydrate(row) -> dict:
    d = dict(row)
    if isinstance(d.get("recipients"), str):
        try:
            d["recipients"] = json.loads(d["recipients"])
        except (ValueError, TypeError):
            d["recipients"] = []
    return d


def compute_next_run(cadence: str, hour: int, weekday: Optional[int], frm: Optional[datetime] = None) -> datetime:
    """Next fire time (naive UTC), matching the dispatcher's NOW() comparison."""
    now = frm or datetime.now(timezone.utc).replace(tzinfo=None)
    hour = max(0, min(23, int(hour if hour is not None else 8)))
    if cadence == "every_12h":
        return now + timedelta(hours=12)
    base = now.replace(hour=hour, minute=0, second=0, microsecond=0)
    if cadence == "daily":
        return base if base > now else base + timedelta(days=1)
    if cadence == "weekly":
        wd = 0 if weekday is None else max(0, min(6, int(weekday)))
        ahead = (wd - now.weekday()) % 7
        cand = base + timedelta(days=ahead)
        return cand if cand > now else cand + timedelta(days=7)
    if cadence == "monthly":
        year, month = (now.year, now.month + 1) if now.month < 12 else (now.year + 1, 1)
        return now.replace(year=year, month=month, day=1, hour=hour, minute=0, second=0, microsecond=0)
    # default → daily
    return base if base > now else base + timedelta(days=1)


class ReportScheduleRepository:
    @staticmethod
    async def list_for_dashboard(conn: asyncpg.Connection, org_id: int, dashboard_id: int) -> List[dict]:
        rows = await conn.fetch(
            "SELECT * FROM report_schedules WHERE org_id = $1 AND dashboard_id = $2 ORDER BY created_at DESC",
            org_id, dashboard_id,
        )
        return [_hydrate(r) for r in rows]

    @staticmethod
    async def get(conn: asyncpg.Connection, schedule_id: int, org_id: int) -> Optional[dict]:
        row = await conn.fetchrow(
            "SELECT * FROM report_schedules WHERE id = $1 AND org_id = $2", schedule_id, org_id,
        )
        return _hydrate(row) if row else None

    @staticmethod
    async def create(conn: asyncpg.Connection, org_id: int, created_by: int, **f) -> dict:
        cadence = f["cadence"] if f.get("cadence") in _CADENCES else "weekly"
        next_run = compute_next_run(cadence, f.get("hour", 8), f.get("weekday"))
        row = await conn.fetchrow(
            """
            INSERT INTO report_schedules
                (org_id, dashboard_id, created_by, name, cadence, hour, weekday,
                 recipients, date_window, format, next_run_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
            """,
            org_id, f["dashboard_id"], created_by, (f.get("name") or "Report").strip(),
            cadence, f.get("hour", 8), f.get("weekday"),
            json.dumps(f.get("recipients") or []), f.get("date_window", "last_30_days"),
            f.get("format", "html"), next_run,
        )
        return _hydrate(row)

    @staticmethod
    async def update(conn: asyncpg.Connection, schedule_id: int, org_id: int, **fields) -> Optional[dict]:
        if not fields:
            return await ReportScheduleRepository.get(conn, schedule_id, org_id)
        if "recipients" in fields:
            fields["recipients"] = json.dumps(fields["recipients"] or [])
        # Recompute next_run if cadence/timing changed.
        recompute = any(k in fields for k in ("cadence", "hour", "weekday"))
        set_clauses, values = [], []
        for i, (key, val) in enumerate(fields.items(), start=1):
            set_clauses.append(f"{key} = ${i}")
            values.append(val)
        values.extend([schedule_id, org_id])
        query = (
            f"UPDATE report_schedules SET {', '.join(set_clauses)} "
            f"WHERE id = ${len(values) - 1} AND org_id = ${len(values)} RETURNING *"
        )
        row = await conn.fetchrow(query, *values)
        if row and recompute:
            d = _hydrate(row)
            nxt = compute_next_run(d["cadence"], d["hour"], d["weekday"])
            row = await conn.fetchrow(
                "UPDATE report_schedules SET next_run_at = $2 WHERE id = $1 RETURNING *", schedule_id, nxt,
            )
        return _hydrate(row) if row else None

    @staticmethod
    async def delete(conn: asyncpg.Connection, schedule_id: int, org_id: int) -> bool:
        result = await conn.execute(
            "DELETE FROM report_schedules WHERE id = $1 AND org_id = $2", schedule_id, org_id,
        )
        return result == "DELETE 1"

    # ── dispatcher helpers (admin connection, cross-org) ──
    @staticmethod
    async def list_due(conn: asyncpg.Connection, limit: int = 50) -> List[dict]:
        rows = await conn.fetch(
            "SELECT * FROM report_schedules WHERE enabled AND next_run_at <= NOW() "
            "ORDER BY next_run_at ASC LIMIT $1",
            limit,
        )
        return [_hydrate(r) for r in rows]

    @staticmethod
    async def advance(conn: asyncpg.Connection, schedule_id: int, next_run: datetime) -> None:
        await conn.execute(
            "UPDATE report_schedules SET last_run_at = NOW(), next_run_at = $2 WHERE id = $1",
            schedule_id, next_run,
        )

    @staticmethod
    async def set_status(conn: asyncpg.Connection, schedule_id: int, status: str) -> None:
        await conn.execute(
            "UPDATE report_schedules SET last_status = $2 WHERE id = $1", schedule_id, status,
        )
