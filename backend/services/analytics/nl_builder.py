"""
services/analytics/nl_builder.py — natural-language → widget spec.

The user types a request ("hires by department this quarter as a bar chart"); we ask the
LLM to translate it into a widget spec using ONLY the catalog keys, then validate that spec
through the query engine. Because the engine is the same safety boundary used everywhere,
the model physically cannot invent a table/column or escape tenant isolation — at worst it
produces an invalid spec, which we reject and turn into a clarifying question.
"""
import json
import logging

from backend.services.analytics.registry import catalog_for_role
from backend.services.analytics.query_engine import build_sql, VIZ_TYPES, AnalyticsSpecError

logger = logging.getLogger(__name__)

_PRESETS = [
    "last_7_days", "last_30_days", "last_90_days", "last_6_months",
    "last_year", "this_month", "ytd", "all_time",
]


def _catalog_text(catalog: dict) -> str:
    lines = []
    for ds in catalog.get("datasets", []):
        lines.append(f'- dataset "{ds["key"]}" ({ds["label"]}):')
        lines.append("    measures: " + ", ".join(m["key"] for m in ds["measures"]))
        dims = ", ".join(d["key"] + ("[date]" if d.get("date_bucket") else "") for d in ds["dimensions"])
        lines.append("    dimensions: " + dims)
        if ds["fields"]:
            lines.append("    numeric_fields: " + ", ".join(f["key"] for f in ds["fields"]))
    return "\n".join(lines)


def _build_system(catalog: dict) -> str:
    return (
        "You are an analytics assistant for a hiring-operations platform. Convert the user's "
        "request into ONE chart widget for our dashboard builder.\n\n"
        "Use ONLY these datasets and their exact measure/dimension/field keys:\n"
        + _catalog_text(catalog) + "\n\n"
        "Chart types (viz): " + ", ".join(sorted(VIZ_TYPES)) + "\n"
        "  - number: one measure, no dimension (a single KPI).\n"
        "  - bar / pie / table: a measure grouped by a categorical dimension.\n"
        "  - line / area: a measure grouped by a dimension.\n"
        "  - time_series: a measure over time — set dimension=\"date\" and bucket (day/week/month/quarter/year).\n"
        "  - histogram: distribution of ONE numeric field — set \"field\".\n"
        "  - scatter: two numeric fields — set \"x_field\" and \"y_field\"; optional \"series\" (categorical).\n"
        "Date range presets: " + ", ".join(_PRESETS) + "\n\n"
        "Respond with STRICT JSON only (no prose), in ONE of these shapes:\n"
        '  {"action":"create","widget":{"title":"<short title>","spec":{ ... }}}\n'
        '  {"action":"clarify","question":"<one short question>"}\n\n'
        "The spec keys are: dataset, viz, measure, dimension, bucket, field, x_field, y_field, "
        "series, filters (list of {field, op, value}; op in =,!=,>,<,in,contains), date_range ({\"preset\":\"...\"}).\n"
        "Rules:\n"
        "- Never invent dataset/measure/dimension/field names — use only keys listed above.\n"
        "- If the request is ambiguous, or needs data not in the catalog, return action=\"clarify\" with ONE short question.\n"
        "- Heuristics: 'over time'/'trend' → time_series; 'share'/'breakdown'/'split' → pie; "
        "'by <category>' → bar; a single KPI → number; 'distribution' → histogram; 'X vs Y' → scatter."
    )


def _parse_json(text: str) -> dict:
    text = (text or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text[:4].lower() == "json":
            text = text[4:]
    return json.loads(text)


async def nl_to_widget(query: str, history, current_user: dict) -> dict:
    """Return {action: 'create'|'clarify'|'error', ...}."""
    if not query or not query.strip():
        return {"action": "clarify", "question": "What would you like to chart?"}

    catalog = catalog_for_role(current_user.get("role", ""))
    system = _build_system(catalog)

    convo = ""
    if history:
        convo = "\n".join(
            f'{h.get("role", "user")}: {h.get("content", "")}' for h in history[-6:]
        ) + "\n"
    user_msg = f'{convo}User request: "{query.strip()}"'

    try:
        from backend.adapters.llm.factory import get_llm
        from langchain_core.messages import SystemMessage, HumanMessage

        llm = get_llm(temperature=0, json_mode=True, max_tokens=700)
        resp = await llm.ainvoke([SystemMessage(content=system), HumanMessage(content=user_msg)])
        data = _parse_json(resp.content)
    except Exception:
        logger.exception("nl_to_widget: LLM/parse failure")
        return {"action": "error", "message": "The assistant is unavailable right now — you can add the widget manually."}

    if data.get("action") == "clarify":
        return {"action": "clarify", "question": data.get("question") or "Could you clarify what you'd like to see?"}

    widget = data.get("widget") or {}
    spec = widget.get("spec") or {}
    # The engine is the safety net: catalog-only + tenant isolation. Reject anything it won't accept.
    try:
        build_sql(spec, current_user)
    except AnalyticsSpecError as exc:
        return {
            "action": "clarify",
            "question": f"I couldn't map that to the available data ({exc}). Could you rephrase, or use the manual builder?",
        }

    title = (widget.get("title") or query.strip())[:48]
    return {"action": "create", "widget": {"title": title, "spec": spec}}
