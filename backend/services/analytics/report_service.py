"""
services/analytics/report_service.py — turn a saved dashboard into an emailed report.

For each widget we re-run the SAME query engine (so the report matches the on-screen
numbers and stays tenant-safe), render an email-safe HTML section, then ask the LLM for a
short "what changed / what matters" narrative over the *computed* facts (never raw tables).
The insight summary goes in the email body; the full report + insights go in the HTML body.
"""
import json
import logging
from datetime import datetime, timezone

from backend.db.connection import set_org_context, reset_org_context
from backend.services.analytics.query_engine import run_query
from backend.services.email_service import get_email_provider, _wrap_html

logger = logging.getLogger(__name__)

_TEAL = "#0D9488"


def _fmt(v, unit=""):
    if v is None or v == "":
        return "—"
    try:
        n = float(v)
    except (TypeError, ValueError):
        return str(v)
    n = round(n, 1) if abs(n) < 100 else round(n)
    if unit == "$":
        return f"${n:,}"
    if unit == "%":
        return f"{n}%"
    if unit == "days":
        return f"{n}d"
    return f"{n:,}"


def _label(v):
    if isinstance(v, str) and len(v) >= 10 and v[4] == "-" and "T" in v:
        return v[:10]
    return str(v)


def _section(title, result):
    """Email-safe HTML for one widget + a compact fact string for the insight model."""
    th = f'<h3 style="margin:18px 0 8px;font-size:15px;color:#0F172A;">{title}</h3>'
    viz = (result or {}).get("viz")
    fact = title + ": "

    if viz == "number":
        unit = (result["meta"]["measures"][0] or {}).get("unit", "")
        val = _fmt(result.get("value"), unit)
        fact += val
        return th + f'<div style="font-size:28px;font-weight:700;color:{_TEAL};">{val}</div>', fact

    if viz in ("bar", "line", "area", "time_series", "pie", "table"):
        measures = result["meta"]["measures"]
        rows = result.get("data", [])[:12]
        head = "".join(f'<th style="text-align:right;padding:4px 10px;color:#64748B;font-size:12px;">{m["label"]}</th>' for m in measures)
        body = ""
        for r in rows:
            cells = "".join(f'<td style="text-align:right;padding:4px 10px;font-size:13px;">{_fmt(r.get(m["key"]), m.get("unit",""))}</td>' for m in measures)
            body += f'<tr><td style="padding:4px 10px;font-size:13px;">{_label(r.get("label"))}</td>{cells}</tr>'
        table = (
            '<table style="border-collapse:collapse;width:100%;border-top:1px solid #E2E8F0;">'
            f'<tr><th style="text-align:left;padding:4px 10px;color:#64748B;font-size:12px;">Group</th>{head}</tr>'
            f'{body}</table>'
        )
        top = ", ".join(f'{_label(r.get("label"))} {_fmt(r.get(measures[0]["key"]))}' for r in rows[:5])
        fact += top or "no data"
        return th + table, fact

    if viz == "histogram":
        vals = result.get("values", [])
        fact += f"{len(vals)} values"
        return th + f'<p style="font-size:13px;color:#475569;">Distribution of {len(vals)} records.</p>', fact

    if viz == "scatter":
        pts = result.get("points", [])
        fact += f"{len(pts)} points"
        return th + f'<p style="font-size:13px;color:#475569;">{len(pts)} plotted points.</p>', fact

    return th, fact + "—"


async def _insights(dashboard_name, facts):
    """Return (summary_text, insights_html). Best-effort — skipped on any error."""
    if not facts:
        return "", ""
    try:
        from backend.adapters.llm.factory import get_llm
        from langchain_core.messages import SystemMessage, HumanMessage

        system = (
            "You are a hiring-operations analyst. Given these metric facts for a dashboard, "
            "write a short executive read-out. Respond with STRICT JSON: "
            '{"summary":"<=200 chars","insights":["<=3 bullets, specific, reference the numbers given"]}. '
            "Do not invent any number not present in the facts."
        )
        user = f"Dashboard: {dashboard_name}\nFacts:\n- " + "\n- ".join(facts)
        llm = get_llm(temperature=0.2, json_mode=True, max_tokens=500)
        resp = await llm.ainvoke([SystemMessage(content=system), HumanMessage(content=user)])
        data = json.loads(resp.content)
        summary = (data.get("summary") or "").strip()
        bullets = data.get("insights") or []
        items = "".join(f'<li style="margin:4px 0;">{b}</li>' for b in bullets if b)
        html = (
            f'<div style="background:#F1F5F9;border-left:3px solid {_TEAL};padding:12px 16px;border-radius:8px;">'
            f'<div style="font-weight:700;font-size:13px;color:#0F172A;margin-bottom:6px;">AI insights</div>'
            f'<p style="margin:0 0 6px;font-size:13px;color:#334155;">{summary}</p>'
            f'<ul style="margin:0;padding-left:18px;color:#334155;font-size:13px;">{items}</ul></div>'
        ) if (summary or items) else ""
        return summary, html
    except Exception:
        logger.exception("report insights generation failed")
        return "", ""


async def render_report(dashboard: dict, current_user: dict, date_window: str) -> dict:
    """Build {subject, html, summary} for a dashboard at the given date window."""
    widgets = dashboard.get("widgets")
    if isinstance(widgets, str):
        try:
            widgets = json.loads(widgets)
        except (ValueError, TypeError):
            widgets = []
    widgets = widgets or []

    token = set_org_context(current_user["org_id"])
    sections, facts = [], []
    try:
        for w in widgets:
            spec = dict(w.get("spec") or {})
            spec["date_range"] = {"preset": date_window}
            try:
                result = await run_query(spec, current_user)
            except Exception:
                logger.warning("report widget query failed: %s", w.get("title"))
                continue
            html, fact = _section(w.get("title") or "Widget", result)
            sections.append(html)
            facts.append(fact)
    finally:
        reset_org_context(token)

    summary, insights_html = await _insights(dashboard.get("name", "Dashboard"), facts)
    when = datetime.now(timezone.utc).strftime("%b %d, %Y")
    header = (
        f'<h2 style="margin:0 0 4px;font-size:20px;color:#0F172A;">{dashboard.get("name", "Dashboard")}</h2>'
        f'<p style="margin:0 0 16px;color:#64748B;font-size:13px;">Analytics report · {when}</p>'
    )
    body = header + insights_html + "".join(sections)
    return {
        "subject": f'{dashboard.get("name", "Dashboard")} — analytics report ({when})',
        "html": _wrap_html(body),
        "summary": summary or f'Your "{dashboard.get("name", "Dashboard")}" report is attached.',
    }


async def render_and_send(schedule: dict, dashboard: dict, creator: dict) -> dict:
    """Render and email a scheduled report. `creator` provides the scope (role + dept)."""
    current_user = {
        "user_id": creator["id"],
        "org_id": dashboard["org_id"],
        "role": creator.get("role", "org_head"),
        "dept_id": creator.get("department_id"),
    }
    recipients = schedule.get("recipients") or []
    if not recipients:
        return {"status": "no_recipients", "sent": 0}

    report = await render_report(dashboard, current_user, schedule.get("date_window", "last_30_days"))
    provider = get_email_provider()
    sent = 0
    for to in recipients:
        try:
            ok = await provider.send_email(
                to_email=to, subject=report["subject"],
                body_html=report["html"], body_text=report["summary"],
            )
            sent += 1 if ok else 0
        except Exception:
            logger.exception("report send failed to %s", to)
    return {"status": "sent" if sent else "failed", "sent": sent, "recipients": len(recipients)}
