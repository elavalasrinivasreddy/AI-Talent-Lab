"""
services/analytics/registry.py — the analytics semantic layer (the safe "menu").

Defines, in code, every dataset a user can query and the measures / dimensions /
numeric fields available on each. The query engine reads ONLY from here — user input
is matched against these keys, and the SQL fragments below are the single source of
truth for what actually runs. Nothing the client sends is ever concatenated into SQL.

Tables referenced (see backend/db/migrations.py for authoritative columns):
  candidate_applications(org_id, department_id, candidate_id, position_id,
                         skill_match_score, status, created_at, updated_at, applied_at)
  candidates(id, org_id, source, experience_years, created_at)
  positions(id, org_id, department_id, role_name, status, priority, work_type,
            employment_type, headcount, ats_threshold, assigned_to, created_at, closed_at)
  departments(id, org_id, name)
  users(id, org_id, name, role)
  interviews(org_id, department_id, position_id, status, overall_result,
             round_number, round_type, created_at)
  llm_usage_log(org_id, operation, model, cost_usd, input_tokens, output_tokens,
                duration_ms, success, created_at)
"""
from dataclasses import dataclass, field
from typing import Optional

# Roles allowed to see admin-only measures/dimensions/datasets (recruiter, LLM cost).
ADMIN_ROLES = ("org_head", "dept_admin", "platform_admin")

# Roles that may see ACROSS departments (org-wide) and choose a department filter.
# dept_admin is intentionally excluded — they are pinned to their own department,
# so a dept_admin always gets department-level analytics, an org_head gets org-wide.
CROSS_DEPT_ROLES = ("org_head", "platform_admin")

# AI-sourcing marker values on candidates.source (the sourcing agent writes these).
AI_SOURCES = ("simulation", "ai_agent", "ai_sourced")
_AI_SQL = "c.source IN ('simulation', 'ai_agent', 'ai_sourced')"
_HIRED_SQL = "ca.status IN ('selected', 'hired')"


@dataclass(frozen=True)
class Measure:
    """An aggregate ('Y axis' / the number)."""
    key: str
    label: str
    sql: str               # aggregate expression, e.g. "COUNT(*)"
    unit: str = ""         # "", "%", "days", "score", "$", "tokens"
    roles: tuple = ()      # () = everyone; else restricted to these roles


@dataclass(frozen=True)
class Dimension:
    """A categorical/time group-by ('X axis' / the slice)."""
    key: str
    label: str
    sql: str = ""          # group expression, e.g. "d.name" (ignored when date_bucket)
    date_bucket: bool = False  # if True, engine wraps the dataset date_col in DATE_TRUNC
    roles: tuple = ()


@dataclass(frozen=True)
class NumericField:
    """A per-row numeric column for histograms (one axis) and scatter (two axes)."""
    key: str
    label: str
    sql: str
    unit: str = ""
    roles: tuple = ()


@dataclass(frozen=True)
class Dataset:
    key: str
    label: str
    description: str
    from_sql: str          # FROM ... JOIN ... (no WHERE)
    org_col: str           # column the engine pins to the caller's org_id
    date_col: str          # default date column for range filter + time bucketing
    measures: dict = field(default_factory=dict)
    dimensions: dict = field(default_factory=dict)
    fields: dict = field(default_factory=dict)
    dept_col: Optional[str] = None   # department column (None = not dept-scoped)
    roles: tuple = ()                # () = everyone; else restricted to these roles


def _m(*measures: Measure) -> dict:
    return {x.key: x for x in measures}


def _d(*dims: Dimension) -> dict:
    return {x.key: x for x in dims}


def _f(*fields_: NumericField) -> dict:
    return {x.key: x for x in fields_}


# ─────────────────────────────────────────────────────────────────────────────
# Dataset: applications (the primary hiring fact table)
# ─────────────────────────────────────────────────────────────────────────────
_APPLICATIONS = Dataset(
    key="applications",
    label="Applications",
    description="Candidates and their progress through the hiring pipeline.",
    from_sql=(
        "candidate_applications ca "
        "JOIN candidates c ON c.id = ca.candidate_id "
        "JOIN positions p ON p.id = ca.position_id "
        "LEFT JOIN departments d ON d.id = ca.department_id "
        "LEFT JOIN users u ON u.id = p.assigned_to"
    ),
    org_col="ca.org_id",
    dept_col="ca.department_id",
    date_col="ca.created_at",
    measures=_m(
        Measure("applications", "Applications", "COUNT(*)"),
        Measure("hires", "Hires", f"COUNT(*) FILTER (WHERE {_HIRED_SQL})"),
        Measure("rejections", "Rejections", "COUNT(*) FILTER (WHERE ca.status = 'rejected')"),
        Measure(
            "in_pipeline", "In Pipeline",
            "COUNT(*) FILTER (WHERE ca.status IN "
            "('sourced','emailed','applied','screening','interview'))",
        ),
        Measure(
            "hire_rate", "Hire Rate",
            f"ROUND(100.0 * COUNT(*) FILTER (WHERE {_HIRED_SQL}) / NULLIF(COUNT(*), 0), 1)",
            unit="%",
        ),
        Measure("avg_match_score", "Avg Match Score", "ROUND(AVG(ca.skill_match_score)::numeric, 1)", unit="score"),
        Measure(
            "avg_time_to_hire", "Avg Time to Hire",
            "ROUND(AVG(EXTRACT(EPOCH FROM (ca.updated_at - ca.created_at)) / 86400.0) "
            f"FILTER (WHERE {_HIRED_SQL})::numeric, 1)",
            unit="days",
        ),
        Measure("ai_sourced", "AI-Sourced", f"COUNT(*) FILTER (WHERE {_AI_SQL})"),
        Measure(
            "ai_sourced_share", "AI-Sourced Share",
            f"ROUND(100.0 * COUNT(*) FILTER (WHERE {_AI_SQL}) / NULLIF(COUNT(*), 0), 1)",
            unit="%",
        ),
    ),
    dimensions=_d(
        Dimension("date", "Date", date_bucket=True),
        Dimension("department", "Department", "COALESCE(d.name, 'Unassigned')"),
        Dimension("status", "Pipeline Stage", "ca.status"),
        Dimension("source", "Candidate Source", "COALESCE(c.source, 'unknown')"),
        Dimension("position", "Position", "p.role_name"),
        Dimension("work_type", "Work Type", "COALESCE(p.work_type, 'unknown')"),
        Dimension("priority", "Priority", "COALESCE(p.priority, 'normal')"),
        Dimension("recruiter", "Recruiter", "COALESCE(u.name, 'Unassigned')", roles=ADMIN_ROLES),
    ),
    fields=_f(
        NumericField("match_score", "Match Score", "ca.skill_match_score", unit="score"),
        NumericField(
            "time_to_hire_days", "Time to Hire (days)",
            "EXTRACT(EPOCH FROM (ca.updated_at - ca.created_at)) / 86400.0", unit="days",
        ),
        NumericField("experience_years", "Experience (years)", "c.experience_years", unit="years"),
    ),
)

# ─────────────────────────────────────────────────────────────────────────────
# Dataset: interviews
# ─────────────────────────────────────────────────────────────────────────────
_INTERVIEWS = Dataset(
    key="interviews",
    label="Interviews",
    description="Interview rounds, outcomes, and throughput.",
    from_sql=(
        "interviews iv "
        "LEFT JOIN departments d ON d.id = iv.department_id "
        "LEFT JOIN positions p ON p.id = iv.position_id"
    ),
    org_col="iv.org_id",
    dept_col="iv.department_id",
    date_col="iv.created_at",
    measures=_m(
        Measure("interviews", "Interviews", "COUNT(*)"),
        Measure("completed", "Completed", "COUNT(*) FILTER (WHERE iv.status = 'completed')"),
        Measure("passed", "Passed", "COUNT(*) FILTER (WHERE iv.overall_result = 'passed')"),
        Measure(
            "pass_rate", "Pass Rate",
            "ROUND(100.0 * COUNT(*) FILTER (WHERE iv.overall_result = 'passed') "
            "/ NULLIF(COUNT(*) FILTER (WHERE iv.overall_result IN ('passed','rejected')), 0), 1)",
            unit="%",
        ),
    ),
    dimensions=_d(
        Dimension("date", "Date", date_bucket=True),
        Dimension("department", "Department", "COALESCE(d.name, 'Unassigned')"),
        Dimension("status", "Status", "iv.status"),
        Dimension("round_type", "Round Type", "COALESCE(iv.round_type, 'unknown')"),
        Dimension("result", "Result", "COALESCE(iv.overall_result, 'pending')"),
        Dimension("position", "Position", "p.role_name"),
    ),
    fields=_f(
        NumericField("round_number", "Round Number", "iv.round_number"),
    ),
)

# ─────────────────────────────────────────────────────────────────────────────
# Dataset: positions
# ─────────────────────────────────────────────────────────────────────────────
_POSITIONS = Dataset(
    key="positions",
    label="Positions",
    description="Open roles, lifecycle, and time-to-fill.",
    from_sql="positions p LEFT JOIN departments d ON d.id = p.department_id",
    org_col="p.org_id",
    dept_col="p.department_id",
    date_col="p.created_at",
    measures=_m(
        Measure("positions", "Positions", "COUNT(*)"),
        Measure("open", "Open", "COUNT(*) FILTER (WHERE p.status = 'open')"),
        Measure("closed", "Closed", "COUNT(*) FILTER (WHERE p.status = 'closed')"),
        Measure("total_headcount", "Total Headcount", "COALESCE(SUM(p.headcount), 0)"),
        Measure(
            "avg_days_open", "Avg Days Open",
            "ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(p.closed_at, NOW()) - p.created_at)) "
            "/ 86400.0)::numeric, 1)",
            unit="days",
        ),
    ),
    dimensions=_d(
        Dimension("date", "Date", date_bucket=True),
        Dimension("department", "Department", "COALESCE(d.name, 'Unassigned')"),
        Dimension("status", "Status", "p.status"),
        Dimension("priority", "Priority", "COALESCE(p.priority, 'normal')"),
        Dimension("work_type", "Work Type", "COALESCE(p.work_type, 'unknown')"),
        Dimension("employment_type", "Employment Type", "COALESCE(p.employment_type, 'unknown')"),
    ),
    fields=_f(
        NumericField("headcount", "Headcount", "p.headcount"),
        NumericField("ats_threshold", "ATS Threshold", "p.ats_threshold", unit="score"),
        NumericField("salary_min", "Salary (min)", "p.salary_min", unit="$"),
        NumericField("salary_max", "Salary (max)", "p.salary_max", unit="$"),
    ),
)

# ─────────────────────────────────────────────────────────────────────────────
# Dataset: llm (cost/usage telemetry — admin only)
# ─────────────────────────────────────────────────────────────────────────────
_LLM = Dataset(
    key="llm",
    label="AI Cost & Usage",
    description="LLM spend and call volume by operation/model (admin only).",
    from_sql="llm_usage_log l",
    org_col="l.org_id",
    dept_col=None,
    date_col="l.created_at",
    roles=ADMIN_ROLES,
    measures=_m(
        Measure("llm_cost", "LLM Cost", "ROUND(SUM(l.cost_usd)::numeric, 2)", unit="$"),
        Measure("llm_calls", "LLM Calls", "COUNT(*)"),
        Measure("failed_calls", "Failed Calls", "COUNT(*) FILTER (WHERE NOT l.success)"),
        Measure("input_tokens", "Input Tokens", "COALESCE(SUM(l.input_tokens), 0)", unit="tokens"),
        Measure("output_tokens", "Output Tokens", "COALESCE(SUM(l.output_tokens), 0)", unit="tokens"),
        Measure("avg_cost", "Avg Cost / Call", "ROUND(AVG(l.cost_usd)::numeric, 4)", unit="$"),
    ),
    dimensions=_d(
        Dimension("date", "Date", date_bucket=True),
        Dimension("operation", "Operation", "l.operation"),
        Dimension("model", "Model", "l.model"),
        Dimension("success", "Success", "CASE WHEN l.success THEN 'success' ELSE 'failed' END"),
    ),
    fields=_f(
        NumericField("cost_usd", "Cost (USD)", "l.cost_usd", unit="$"),
        NumericField("duration_ms", "Duration (ms)", "l.duration_ms", unit="ms"),
    ),
)


DATASETS: dict = {
    ds.key: ds for ds in (_APPLICATIONS, _INTERVIEWS, _POSITIONS, _LLM)
}


def _allowed(roles: tuple, user_role: str) -> bool:
    """An item is visible if it has no role restriction or the user's role is listed."""
    return (not roles) or (user_role in roles)


def get_dataset(key: str, user_role: str) -> Optional[Dataset]:
    """Return a dataset only if it exists and the role may access it."""
    ds = DATASETS.get(key)
    if ds is None or not _allowed(ds.roles, user_role):
        return None
    return ds


def catalog_for_role(user_role: str) -> dict:
    """The full catalog filtered to what `user_role` may use — drives the builder UI."""
    out = {"datasets": []}
    for ds in DATASETS.values():
        if not _allowed(ds.roles, user_role):
            continue
        out["datasets"].append({
            "key": ds.key,
            "label": ds.label,
            "description": ds.description,
            "dept_scoped": ds.dept_col is not None,
            "measures": [
                {"key": m.key, "label": m.label, "unit": m.unit}
                for m in ds.measures.values() if _allowed(m.roles, user_role)
            ],
            "dimensions": [
                {"key": d.key, "label": d.label, "date_bucket": d.date_bucket}
                for d in ds.dimensions.values() if _allowed(d.roles, user_role)
            ],
            "fields": [
                {"key": f.key, "label": f.label, "unit": f.unit}
                for f in ds.fields.values() if _allowed(f.roles, user_role)
            ],
        })
    return out
