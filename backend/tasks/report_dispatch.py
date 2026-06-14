"""
tasks/report_dispatch.py — scheduled analytics reports.

Mirrors the existing `scheduled_search` pattern: one Beat entry runs `dispatch_due_reports`
every 15 min, which finds schedules whose `next_run_at` is due, enqueues a per-schedule
render+send, and advances `next_run_at`. No dynamic/per-user Beat entries needed.
"""
import json
import logging

from backend.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    from backend.utils.async_runner import run_async
    return run_async(coro)


@celery_app.task(name="backend.tasks.report_dispatch.dispatch_due_reports")
def dispatch_due_reports() -> dict:
    """Find due report schedules, enqueue each, and advance their next run time."""
    async def _dispatch():
        from backend.db.connection import get_admin_connection
        from backend.db.repositories.report_schedules import ReportScheduleRepository, compute_next_run

        async with get_admin_connection() as conn:
            due = await ReportScheduleRepository.list_due(conn, limit=50)
            for s in due:
                try:
                    render_and_send_report.delay(s["id"])
                    nxt = compute_next_run(s["cadence"], s["hour"], s["weekday"])
                    await ReportScheduleRepository.advance(conn, s["id"], nxt)
                except Exception:
                    logger.exception("failed to dispatch report schedule %s", s.get("id"))
            return {"dispatched": len(due)}

    result = _run_async(_dispatch())
    logger.info("dispatch_due_reports: %s", result)
    return result


@celery_app.task(name="backend.tasks.report_dispatch.render_and_send_report")
def render_and_send_report(schedule_id: int) -> dict:
    """Render one dashboard report and email it to the schedule's recipients."""
    async def _run():
        from backend.db.connection import get_admin_connection
        from backend.db.repositories.report_schedules import ReportScheduleRepository
        from backend.services.analytics.report_service import render_and_send

        async with get_admin_connection() as conn:
            srow = await conn.fetchrow("SELECT * FROM report_schedules WHERE id = $1", schedule_id)
            if not srow:
                return {"status": "missing"}
            sched = dict(srow)
            if isinstance(sched.get("recipients"), str):
                sched["recipients"] = json.loads(sched["recipients"] or "[]")
            drow = await conn.fetchrow("SELECT * FROM dashboards WHERE id = $1", sched["dashboard_id"])
            crow = await conn.fetchrow(
                "SELECT id, role, department_id FROM users WHERE id = $1", sched["created_by"],
            )

        if not drow or not crow:
            return {"status": "missing_refs"}

        res = await render_and_send(sched, dict(drow), dict(crow))

        async with get_admin_connection() as conn:
            await ReportScheduleRepository.set_status(conn, schedule_id, res.get("status", "?"))
        return res

    result = _run_async(_run())
    logger.info("render_and_send_report(%s): %s", schedule_id, result)
    return result
