"""
services/analytics/query_engine.py — compile a validated widget spec into ONE safe,
parameterized SQL statement and run it.

Safety contract (this is the tenant-isolation boundary — treat changes as security-sensitive):
  1. Every identifier (dataset / measure / dimension / field / filter field / viz / op /
     date bucket) is looked up in the in-code registry or a fixed allowlist. Anything
     unknown raises AnalyticsSpecError (HTTP 400) — the client cannot name a raw table
     or column.
  2. `org_col = <caller org_id>` is ALWAYS appended to WHERE, from the JWT, never the request.
  3. Non-admin callers are pinned to their own department; admins may optionally pass a
     (validated, integer) department_id.
  4. All user-supplied VALUES are bound parameters ($1, $2, …) — never string-concatenated.
  5. Result rows and statement time are capped.

`build_sql()` is pure (no DB) so the safety properties are unit-testable; `run_query()`
executes it.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from backend.db.connection import get_connection
from backend.services.analytics.registry import (
    ADMIN_ROLES,
    CROSS_DEPT_ROLES,
    Dataset,
    get_dataset,
)

logger = logging.getLogger(__name__)

# Visualisation families.
_AGG_VIZ = {"bar", "line", "area", "pie", "time_series", "table"}
VIZ_TYPES = _AGG_VIZ | {"number", "histogram", "scatter"}

FILTER_OPS = {"=", "!=", ">", "<", ">=", "<=", "in", "between", "contains"}
DATE_BUCKETS = {"day", "week", "month", "quarter", "year"}

# preset -> number of days back from now (None = special handling)
_PRESET_DAYS = {
    "last_7_days": 7,
    "last_30_days": 30,
    "last_90_days": 90,
    "last_quarter": 90,
    "last_6_months": 180,
    "last_year": 365,
}

_AGG_ROW_LIMIT = (1, 200, 50)        # (min, max, default) for grouped/number queries
_RAW_ROW_LIMIT = (1, 5000, 2000)     # (min, max, default) for histogram/scatter raw pulls


class AnalyticsSpecError(ValueError):
    """Raised when a widget spec references something not in the catalog or is malformed.
    Routers translate this to HTTP 400."""


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _clamp_int(value: Any, lo: int, hi: int, default: int) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, n))


def _as_int(value: Any, label: str) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        raise AnalyticsSpecError(f"{label} must be an integer")


def _now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _parse_dt(value: Any, label: str) -> datetime:
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "")).replace(tzinfo=None)
        except ValueError:
            pass
    raise AnalyticsSpecError(f"{label} must be an ISO date/datetime")


def _resolve_range(date_range: dict) -> Optional[tuple]:
    """Return (start, end) naive datetimes, or None for all-time."""
    preset = (date_range or {}).get("preset", "last_90_days")
    if preset == "all_time":
        return None
    now = _now_naive()
    if preset == "custom":
        start = _parse_dt(date_range.get("from"), "date_range.from")
        end = _parse_dt(date_range.get("to"), "date_range.to")
        if start > end:
            start, end = end, start
        return start, end
    if preset == "this_month":
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0), now
    if preset == "ytd":
        return now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0), now
    days = _PRESET_DAYS.get(preset)
    if days is None:
        raise AnalyticsSpecError(f"Unknown date range preset: {preset}")
    return now - timedelta(days=days), now


def _measure(ds: Dataset, key: Optional[str], role: str):
    if not key:
        raise AnalyticsSpecError("A measure is required for this chart")
    m = ds.measures.get(key)
    if m is None or (m.roles and role not in m.roles):
        raise AnalyticsSpecError(f"Unknown or not-permitted measure: {key}")
    return m


def _dimension(ds: Dataset, key: Optional[str], role: str):
    if not key:
        raise AnalyticsSpecError("A group-by dimension is required for this chart")
    d = ds.dimensions.get(key)
    if d is None or (d.roles and role not in d.roles):
        raise AnalyticsSpecError(f"Unknown or not-permitted dimension: {key}")
    return d


def _field(ds: Dataset, key: Optional[str], role: str, label: str):
    if not key:
        raise AnalyticsSpecError(f"{label} is required for this chart")
    f = ds.fields.get(key)
    if f is None or (f.roles and role not in f.roles):
        raise AnalyticsSpecError(f"Unknown or not-permitted field: {key}")
    return f


def _dim_expr(ds: Dataset, dim, spec: dict) -> str:
    """SQL expression for a dimension, applying a validated date bucket when relevant."""
    if dim.date_bucket:
        bucket = spec.get("bucket", "month")
        if bucket not in DATE_BUCKETS:
            raise AnalyticsSpecError(f"Unknown date bucket: {bucket}")
        return f"DATE_TRUNC('{bucket}', {ds.date_col})"  # bucket is a vetted constant
    return dim.sql


def _filter_expr(ds: Dataset, fieldkey: str, role: str) -> str:
    """Resolve a filterable field to its SQL expression (from dimensions or numeric fields)."""
    d = ds.dimensions.get(fieldkey)
    if d is not None and not d.date_bucket:
        if d.roles and role not in d.roles:
            raise AnalyticsSpecError(f"Not permitted to filter on: {fieldkey}")
        return d.sql
    f = ds.fields.get(fieldkey)
    if f is not None:
        if f.roles and role not in f.roles:
            raise AnalyticsSpecError(f"Not permitted to filter on: {fieldkey}")
        return f.sql
    raise AnalyticsSpecError(f"Cannot filter on unknown field: {fieldkey}")


# ─────────────────────────────────────────────────────────────────────────────
# Core: build_sql (pure — no DB, fully unit-testable)
# ─────────────────────────────────────────────────────────────────────────────
def build_sql(spec: dict, current_user: dict) -> tuple:
    """Compile a widget spec into (sql, params, meta). Raises AnalyticsSpecError on bad input."""
    role = current_user.get("role", "")
    org_id = current_user.get("org_id")
    if org_id is None:
        raise AnalyticsSpecError("Missing org context")

    ds = get_dataset(spec.get("dataset", "applications"), role)
    if ds is None:
        raise AnalyticsSpecError(f"Unknown or not-permitted dataset: {spec.get('dataset')}")

    viz = spec.get("viz", "bar")
    if viz not in VIZ_TYPES:
        raise AnalyticsSpecError(f"Unknown visualisation: {viz}")

    params: list = []

    def bind(value: Any) -> str:
        params.append(value)
        return f"${len(params)}"

    # (2) org guard — always, from the JWT.
    where = [f"{ds.org_col} = {bind(org_id)}"]
    # (3) department scoping.
    where += _dept_clause(ds, spec, current_user, bind)
    # date range.
    where += _date_clause(ds, spec, bind)
    # filters.
    where += _filter_clauses(ds, spec.get("filters") or [], role, bind)

    where_sql = " AND ".join(where)
    frm = ds.from_sql

    if viz == "number":
        m = _measure(ds, spec.get("measure"), role)
        sql = f'SELECT {m.sql} AS "v0" FROM {frm} WHERE {where_sql}'
        meta = {"viz": viz, "measures": [_meta_measure(m)]}
        return sql, params, meta

    if viz in _AGG_VIZ:
        dim = _dimension(ds, spec.get("dimension"), role)
        dim_expr = _dim_expr(ds, dim, spec)
        # table may request several measures; single-series charts use the first.
        measure_keys = spec.get("measures") if viz == "table" else None
        if not measure_keys:
            measure_keys = [spec.get("measure")]
        measure_keys = measure_keys[:6]
        measures = [_measure(ds, k, role) for k in measure_keys]
        selects = [f'{dim_expr} AS "label"'] + [f'{m.sql} AS "v{i}"' for i, m in enumerate(measures)]
        limit = _clamp_int(spec.get("limit"), *_AGG_ROW_LIMIT)
        order = '"label" ASC' if (dim.date_bucket or viz == "time_series") else '"v0" DESC NULLS LAST'
        sql = (
            f'SELECT {", ".join(selects)} FROM {frm} WHERE {where_sql} '
            f"GROUP BY {dim_expr} ORDER BY {order} LIMIT {limit}"
        )
        meta = {
            "viz": viz,
            "dimension": {"key": dim.key, "label": dim.label, "date": dim.date_bucket},
            "measures": [_meta_measure(m) for m in measures],
        }
        return sql, params, meta

    if viz == "histogram":
        f = _field(ds, spec.get("field"), role, "field")
        limit = _clamp_int(spec.get("limit"), *_RAW_ROW_LIMIT)
        sql = (
            f'SELECT {f.sql} AS "x" FROM {frm} '
            f"WHERE {where_sql} AND {f.sql} IS NOT NULL LIMIT {limit}"
        )
        bins = _clamp_int(spec.get("bins"), 2, 50, 12)
        meta = {"viz": viz, "field": _meta_field(f), "bins": bins}
        return sql, params, meta

    if viz == "scatter":
        xf = _field(ds, spec.get("x_field"), role, "x_field")
        yf = _field(ds, spec.get("y_field"), role, "y_field")
        selects = [f'{xf.sql} AS "x"', f'{yf.sql} AS "y"']
        series_meta = None
        series_key = spec.get("series")
        if series_key:
            sdim = _dimension(ds, series_key, role)
            if sdim.date_bucket:
                raise AnalyticsSpecError("Scatter series must be a categorical dimension")
            selects.append(f'{sdim.sql} AS "series"')
            series_meta = {"key": sdim.key, "label": sdim.label}
        limit = _clamp_int(spec.get("limit"), *_RAW_ROW_LIMIT)
        sql = (
            f'SELECT {", ".join(selects)} FROM {frm} '
            f"WHERE {where_sql} AND {xf.sql} IS NOT NULL AND {yf.sql} IS NOT NULL LIMIT {limit}"
        )
        meta = {"viz": viz, "x": _meta_field(xf), "y": _meta_field(yf), "series": series_meta}
        return sql, params, meta

    raise AnalyticsSpecError(f"Unsupported visualisation: {viz}")  # pragma: no cover


def _dept_clause(ds: Dataset, spec: dict, user: dict, bind) -> list:
    if ds.dept_col is None:
        return []
    role = user.get("role", "")
    # org_head / platform_admin see org-wide and may filter to a chosen department.
    if role in CROSS_DEPT_ROLES:
        dep = spec.get("department_id")
        if dep in (None, "", "all"):
            return []
        return [f"{ds.dept_col} = {bind(_as_int(dep, 'department_id'))}"]
    # Everyone else (incl. dept_admin) is pinned to their own department.
    dep = user.get("dept_id")
    if dep is not None:
        return [f"{ds.dept_col} = {bind(int(dep))}"]
    return []


def _date_clause(ds: Dataset, spec: dict, bind) -> list:
    rng = _resolve_range(spec.get("date_range") or {})
    if rng is None:
        return []
    start, end = rng
    return [f"{ds.date_col} BETWEEN {bind(start)} AND {bind(end)}"]


def _filter_clauses(ds: Dataset, filters: list, role: str, bind) -> list:
    out = []
    if not isinstance(filters, list):
        raise AnalyticsSpecError("filters must be a list")
    for f in filters[:20]:
        if not isinstance(f, dict):
            raise AnalyticsSpecError("each filter must be an object")
        expr = _filter_expr(ds, f.get("field"), role)
        op = f.get("op", "=")
        if op not in FILTER_OPS:
            raise AnalyticsSpecError(f"Unsupported filter op: {op}")
        value = f.get("value")
        if op == "in":
            vals = value if isinstance(value, list) else [value]
            vals = [v for v in vals if v is not None]
            if not vals:
                raise AnalyticsSpecError("'in' filter needs at least one value")
            placeholders = ", ".join(bind(v) for v in vals[:100])
            out.append(f"{expr} IN ({placeholders})")
        elif op == "between":
            if not isinstance(value, (list, tuple)) or len(value) != 2:
                raise AnalyticsSpecError("'between' filter needs [low, high]")
            out.append(f"{expr} BETWEEN {bind(value[0])} AND {bind(value[1])}")
        elif op == "contains":
            out.append(f"{expr} ILIKE {bind('%' + str(value) + '%')}")
        else:
            out.append(f"{expr} {op} {bind(value)}")
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Result shaping
# ─────────────────────────────────────────────────────────────────────────────
def _meta_measure(m) -> dict:
    return {"key": m.key, "label": m.label, "unit": m.unit}


def _meta_field(f) -> dict:
    return {"key": f.key, "label": f.label, "unit": f.unit}


def _coerce(v: Any) -> Any:
    if isinstance(v, datetime):
        return v.isoformat()
    # asyncpg returns Decimal for NUMERIC; make JSON-friendly.
    if v is not None and v.__class__.__name__ == "Decimal":
        return float(v)
    return v


def _shape(rows: list, meta: dict) -> dict:
    viz = meta["viz"]
    if viz == "number":
        value = _coerce(rows[0]["v0"]) if rows else None
        return {"viz": viz, "value": value, "meta": meta}
    if viz in _AGG_VIZ:
        n = len(meta["measures"])
        data = []
        for r in rows:
            row = {"label": _coerce(r["label"])}
            for i in range(n):
                row[meta["measures"][i]["key"]] = _coerce(r[f"v{i}"])
            data.append(row)
        return {"viz": viz, "data": data, "meta": meta}
    if viz == "histogram":
        return {"viz": viz, "values": [_coerce(r["x"]) for r in rows], "meta": meta}
    if viz == "scatter":
        has_series = meta.get("series") is not None
        points = [
            {
                "x": _coerce(r["x"]),
                "y": _coerce(r["y"]),
                **({"series": _coerce(r["series"])} if has_series else {}),
            }
            for r in rows
        ]
        return {"viz": viz, "points": points, "meta": meta}
    return {"viz": viz, "meta": meta}  # pragma: no cover


# ─────────────────────────────────────────────────────────────────────────────
# Execution
# ─────────────────────────────────────────────────────────────────────────────
async def run_query(spec: dict, current_user: dict) -> dict:
    """Validate + compile + execute a widget spec; return chart-ready data."""
    sql, params, meta = build_sql(spec, current_user)
    async with get_connection() as conn:
        rows = await conn.fetch(sql, *params, timeout=12)
    return _shape(rows, meta)
