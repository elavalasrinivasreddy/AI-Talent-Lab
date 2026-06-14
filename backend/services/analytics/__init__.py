"""
services/analytics — Self-serve analytics ("Explore" tab).

The semantic layer that powers user-built dashboards: a fixed, in-code catalog of
datasets / measures / dimensions / numeric fields (`registry.py`) and a safe query
compiler (`query_engine.py`) that turns a validated widget spec into ONE parameterized
SQL statement, always scoped to the caller's org (and department for non-admins).

Design rule: the client only ever sends whitelisted keys from the catalog. The SQL text
is owned entirely by the registry; user-supplied values are bound parameters, never
concatenated. See docs/plans/2026-06-14-self-serve-analytics.md.
"""
from backend.services.analytics.registry import (
    DATASETS,
    catalog_for_role,
    get_dataset,
)
from backend.services.analytics.query_engine import (
    run_query,
    build_sql,
    AnalyticsSpecError,
)

__all__ = [
    "DATASETS",
    "catalog_for_role",
    "get_dataset",
    "run_query",
    "build_sql",
    "AnalyticsSpecError",
]
