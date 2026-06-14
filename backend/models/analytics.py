"""
models/analytics.py – request schemas for the self-serve analytics ("Explore") API.

These are permissive on purpose: the query engine (services/analytics/query_engine.py)
is the real validation + safety boundary. Pydantic here only shapes the request and
gives FastAPI a clean OpenAPI surface.
"""
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field


class QuerySpec(BaseModel):
    """A single widget specification — composed by the builder from the catalog."""
    dataset: str = "applications"
    viz: str = "bar"                       # number|bar|line|area|pie|time_series|histogram|scatter|table
    measure: Optional[str] = None          # aggregate viz: the Y value
    measures: Optional[List[str]] = None   # table: multiple measures
    dimension: Optional[str] = None        # aggregate viz: the X group-by
    field: Optional[str] = None            # histogram: numeric field to bin
    x_field: Optional[str] = None          # scatter: X axis (numeric)
    y_field: Optional[str] = None          # scatter: Y axis (numeric)
    series: Optional[str] = None           # scatter: optional categorical colour
    bucket: Optional[str] = None           # time grouping: day|week|month|quarter|year
    bins: Optional[int] = None             # histogram bin count
    date_range: Optional[Dict[str, Any]] = None   # {"preset": "..."} or {"preset":"custom","from","to"}
    filters: Optional[List[Dict[str, Any]]] = None  # [{"field","op","value"}]
    department_id: Optional[int] = None    # admin-only cross-dept filter
    limit: Optional[int] = None


class BatchItem(BaseModel):
    key: str
    spec: QuerySpec


class BatchQueryRequest(BaseModel):
    items: List[BatchItem]


class DashboardCreate(BaseModel):
    name: str
    description: Optional[str] = None
    scope: str = "private"                 # private | dept | org
    department_id: Optional[int] = None
    layout: List[Dict[str, Any]] = Field(default_factory=list)
    widgets: List[Dict[str, Any]] = Field(default_factory=list)


class NlWidgetRequest(BaseModel):
    """Natural-language → widget request for the Explore assistant."""
    query: str
    history: Optional[List[Dict[str, Any]]] = None


class ScheduleCreate(BaseModel):
    dashboard_id: int
    name: str
    cadence: str = "weekly"                 # daily | every_12h | weekly | monthly
    hour: int = 8
    weekday: Optional[int] = None           # 0=Mon..6=Sun for weekly
    recipients: List[str] = Field(default_factory=list)
    date_window: str = "last_30_days"
    format: str = "html"


class ScheduleUpdate(BaseModel):
    name: Optional[str] = None
    cadence: Optional[str] = None
    hour: Optional[int] = None
    weekday: Optional[int] = None
    recipients: Optional[List[str]] = None
    date_window: Optional[str] = None
    enabled: Optional[bool] = None


class DashboardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    scope: Optional[str] = None
    department_id: Optional[int] = None
    layout: Optional[List[Dict[str, Any]]] = None
    widgets: Optional[List[Dict[str, Any]]] = None
