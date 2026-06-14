"""
routers/analytics.py – Self-serve analytics ("Explore" tab). All routes under
/api/v1/analytics.

  GET  /catalog            — the measures/dimensions/fields menu (role-filtered) + departments
  POST /query              — run one widget spec, return chart-ready data
  POST /query/batch        — run all widgets on a dashboard in one round-trip
  GET/POST/GET/PUT/DELETE  /dashboards[/{id}]  — saved dashboard CRUD

The query engine enforces org/department isolation and validates every identifier; this
router is a thin transport layer that maps spec errors to HTTP 400.
"""
import logging

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from backend.dependencies import get_current_user, get_db
from backend.db.repositories.dashboards import DashboardRepository
from backend.db.repositories.departments import DeptRepository
from backend.db.repositories.report_schedules import ReportScheduleRepository
from backend.models.analytics import (
    QuerySpec, BatchQueryRequest, DashboardCreate, DashboardUpdate, NlWidgetRequest,
    ScheduleCreate, ScheduleUpdate,
)
from backend.services.analytics import catalog_for_role, run_query, AnalyticsSpecError
from backend.services.analytics.nl_builder import nl_to_widget
from backend.services.analytics.report_service import render_and_send

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])
logger = logging.getLogger(__name__)

_ADMIN_ROLES = {"org_head", "dept_admin", "platform_admin"}
# Only these may pick a department to view; dept_admin is pinned to their own dept.
_CROSS_DEPT_ROLES = {"org_head", "platform_admin"}

_DATE_PRESETS = [
    {"key": "last_7_days", "label": "Last 7 days"},
    {"key": "last_30_days", "label": "Last 30 days"},
    {"key": "last_90_days", "label": "Last 90 days"},
    {"key": "last_6_months", "label": "Last 6 months"},
    {"key": "last_year", "label": "Last year"},
    {"key": "this_month", "label": "This month"},
    {"key": "ytd", "label": "Year to date"},
    {"key": "all_time", "label": "All time"},
]


@router.get("/catalog")
async def get_catalog(
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Datasets/measures/dimensions/fields the caller may use, plus dept list + date presets."""
    catalog = catalog_for_role(current_user["role"])
    departments = []
    if current_user["role"] in _CROSS_DEPT_ROLES:
        rows = await DeptRepository.list_by_org(db, current_user["org_id"])
        departments = [{"id": r["id"], "name": r["name"]} for r in rows]
    catalog["departments"] = departments
    catalog["date_presets"] = _DATE_PRESETS
    return catalog


@router.post("/query")
async def run_widget_query(spec: QuerySpec, current_user=Depends(get_current_user)):
    """Compile + execute one widget spec; returns chart-ready data."""
    try:
        return await run_query(spec.model_dump(), current_user)
    except AnalyticsSpecError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/nl-widget")
async def nl_widget(req: NlWidgetRequest, current_user=Depends(get_current_user)):
    """Translate a natural-language request into a validated widget (or a clarifying question)."""
    return await nl_to_widget(req.query, req.history, current_user)


@router.post("/query/batch")
async def run_batch_query(req: BatchQueryRequest, current_user=Depends(get_current_user)):
    """Run every widget on a dashboard; failures are isolated per widget."""
    results: dict = {}
    for item in req.items[:30]:
        try:
            results[item.key] = {
                "ok": True,
                "result": await run_query(item.spec.model_dump(), current_user),
            }
        except AnalyticsSpecError as exc:
            results[item.key] = {"ok": False, "error": str(exc)}
        except Exception:  # noqa: BLE001 — never let one bad widget 500 the whole board
            logger.exception("batch widget query failed: key=%s", item.key)
            results[item.key] = {"ok": False, "error": "Query failed"}
    return {"results": results}


# ── Saved dashboards ─────────────────────────────────────────────────────────
@router.get("/dashboards")
async def list_dashboards(
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    items = await DashboardRepository.list_for_user(
        db, current_user["org_id"], current_user["user_id"],
        current_user["role"], current_user.get("dept_id"),
    )
    return {"dashboards": items}


@router.post("/dashboards", status_code=201)
async def create_dashboard(
    body: DashboardCreate,
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    scope = body.scope if body.scope in ("private", "dept", "org") else "private"
    is_admin = current_user["role"] in _ADMIN_ROLES
    if scope in ("dept", "org") and not is_admin:
        scope = "private"
    department_id = body.department_id if is_admin else current_user.get("dept_id")
    return await DashboardRepository.create(
        db, current_user["org_id"], current_user["user_id"], body.name,
        body.description, scope, department_id, body.layout, body.widgets,
    )


@router.get("/dashboards/{dashboard_id}")
async def get_dashboard(
    dashboard_id: int,
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    dash = await DashboardRepository.get(db, dashboard_id, current_user["org_id"])
    if not dash:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dash


@router.put("/dashboards/{dashboard_id}")
async def update_dashboard(
    dashboard_id: int,
    body: DashboardUpdate,
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    existing = await DashboardRepository.get(db, dashboard_id, current_user["org_id"])
    if not existing:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    is_admin = current_user["role"] in _ADMIN_ROLES
    if existing["owner_user_id"] != current_user["user_id"] and not is_admin:
        raise HTTPException(status_code=403, detail="Not allowed to edit this dashboard")

    fields = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if existing.get("is_preset") and not is_admin:
        raise HTTPException(status_code=403, detail="Preset dashboards are read-only")
    if fields.get("scope") in ("dept", "org") and not is_admin:
        fields["scope"] = "private"
    updated = await DashboardRepository.update(db, dashboard_id, current_user["org_id"], **fields)
    return updated


@router.delete("/dashboards/{dashboard_id}", status_code=204)
async def delete_dashboard(
    dashboard_id: int,
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    existing = await DashboardRepository.get(db, dashboard_id, current_user["org_id"])
    if not existing:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    is_admin = current_user["role"] in _ADMIN_ROLES
    if existing["owner_user_id"] != current_user["user_id"] and not is_admin:
        raise HTTPException(status_code=403, detail="Not allowed to delete this dashboard")
    await DashboardRepository.delete(db, dashboard_id, current_user["org_id"])
    return None


# ── Scheduled reports ────────────────────────────────────────────────────────
@router.get("/dashboards/{dashboard_id}/schedules")
async def list_schedules(
    dashboard_id: int,
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    items = await ReportScheduleRepository.list_for_dashboard(db, current_user["org_id"], dashboard_id)
    return {"schedules": items}


@router.post("/schedules", status_code=201)
async def create_schedule(
    body: ScheduleCreate,
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    dash = await DashboardRepository.get(db, body.dashboard_id, current_user["org_id"])
    if not dash:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return await ReportScheduleRepository.create(
        db, current_user["org_id"], current_user["user_id"], **body.model_dump(),
    )


@router.put("/schedules/{schedule_id}")
async def update_schedule(
    schedule_id: int,
    body: ScheduleUpdate,
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    existing = await ReportScheduleRepository.get(db, schedule_id, current_user["org_id"])
    if not existing:
        raise HTTPException(status_code=404, detail="Schedule not found")
    fields = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    return await ReportScheduleRepository.update(db, schedule_id, current_user["org_id"], **fields)


@router.delete("/schedules/{schedule_id}", status_code=204)
async def delete_schedule(
    schedule_id: int,
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    existing = await ReportScheduleRepository.get(db, schedule_id, current_user["org_id"])
    if not existing:
        raise HTTPException(status_code=404, detail="Schedule not found")
    await ReportScheduleRepository.delete(db, schedule_id, current_user["org_id"])
    return None


@router.post("/schedules/{schedule_id}/run-now")
async def run_schedule_now(
    schedule_id: int,
    current_user=Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Render + email the report immediately (a 'send test now' button), at the caller's scope."""
    sched = await ReportScheduleRepository.get(db, schedule_id, current_user["org_id"])
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    dash = await DashboardRepository.get(db, sched["dashboard_id"], current_user["org_id"])
    if not dash:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    creator = {
        "id": current_user["user_id"],
        "role": current_user["role"],
        "department_id": current_user.get("dept_id"),
    }
    return await render_and_send(sched, dash, creator)
