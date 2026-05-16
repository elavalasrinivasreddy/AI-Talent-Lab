"""
services/copilot_service.py – AI Copilot suggestion engine.

Runs as a Celery task (hourly) to analyse pipeline data and write
actionable suggestions to the copilot_suggestions table.
Also exposes CRUD helpers for the router.
"""
import logging
from datetime import datetime, timezone, timedelta
from backend.db.connection import get_connection

logger = logging.getLogger(__name__)


class CopilotService:

    # ── Read ──────────────────────────────────────────────────────────────────

    @staticmethod
    async def get_suggestions(org_id: int, user_id: int) -> list[dict]:
        """Return active (non-dismissed) suggestions for this org/user."""
        async with get_connection() as conn:
            rows = await conn.fetch(
                """
                SELECT id, type, title, action_url, action_label,
                       entity_id, entity_type, created_at
                FROM copilot_suggestions
                WHERE org_id = $1
                  AND (user_id IS NULL OR user_id = $2)
                  AND is_dismissed = FALSE
                ORDER BY created_at DESC
                LIMIT 10
                """,
                org_id, user_id,
            )
        return [dict(r) for r in rows]

    @staticmethod
    async def dismiss(suggestion_id: int, org_id: int) -> bool:
        async with get_connection() as conn:
            result = await conn.execute(
                "UPDATE copilot_suggestions SET is_dismissed=TRUE WHERE id=$1 AND org_id=$2",
                suggestion_id, org_id,
            )
        return result != "UPDATE 0"

    @staticmethod
    async def dismiss_all(org_id: int, user_id: int) -> None:
        async with get_connection() as conn:
            await conn.execute(
                """
                UPDATE copilot_suggestions
                SET is_dismissed = TRUE
                WHERE org_id = $1 AND (user_id IS NULL OR user_id = $2)
                """,
                org_id, user_id,
            )

    # ── Generation ────────────────────────────────────────────────────────────

    @staticmethod
    async def generate_for_org(org_id: int) -> int:
        """
        Analyse pipeline data for org_id and upsert fresh suggestions.
        Returns the number of suggestions created.
        Called by the Celery task every hour.
        """
        suggestions = []
        now = datetime.now(timezone.utc)

        async with get_connection() as conn:
            # 1. High-score candidates never contacted (>48 h since sourced)
            uncontacted = await conn.fetch(
                """
                SELECT ca.id, ca.position_id, p.role_name,
                       COUNT(*) FILTER (WHERE ca.skill_match_score >= 80) AS high_count
                FROM candidate_applications ca
                JOIN positions p ON p.id = ca.position_id
                WHERE ca.org_id = $1
                  AND ca.status = 'sourced'
                  AND ca.skill_match_score >= 80
                  AND ca.created_at < NOW() - INTERVAL '48 hours'
                GROUP BY ca.position_id, p.role_name, ca.id
                HAVING COUNT(*) >= 1
                LIMIT 5
                """,
                org_id,
            )
            for row in uncontacted:
                suggestions.append({
                    "org_id": org_id,
                    "type": "uncontacted_high_score",
                    "title": f"{row['high_count']} candidate(s) scored 80%+ for \"{row['role_name']}\" — none contacted yet",
                    "action_url": f"/positions/{row['position_id']}?tab=pipeline",
                    "action_label": "Send Outreach →",
                    "entity_id": row["position_id"],
                    "entity_type": "position",
                })

            # 2. Panel feedback overdue (>72 h since invite sent, no scorecard)
            overdue = await conn.fetch(
                """
                SELECT ip.id, ip.panelist_name, c.name AS candidate_name,
                       i.application_id, i.position_id
                FROM interview_panel ip
                JOIN interviews i ON i.id = ip.interview_id
                JOIN candidates c ON c.id = i.candidate_id
                WHERE i.org_id = $1
                  AND ip.feedback_submitted = FALSE
                  AND ip.invite_sent_at < NOW() - INTERVAL '72 hours'
                  AND ip.not_attended = FALSE
                LIMIT 5
                """,
                org_id,
            )
            for row in overdue:
                suggestions.append({
                    "org_id": org_id,
                    "type": "overdue_feedback",
                    "title": f"Panel feedback overdue: {row['panelist_name']} hasn't submitted for {row['candidate_name']}",
                    "action_url": f"/positions/{row['position_id']}?tab=pipeline",
                    "action_label": "Send Reminder →",
                    "entity_id": row["application_id"],
                    "entity_type": "application",
                })

            # 3. Stale open positions (no pipeline event in 7 days)
            stale = await conn.fetch(
                """
                SELECT p.id, p.role_name
                FROM positions p
                WHERE p.org_id = $1
                  AND p.status = 'active'
                  AND NOT EXISTS (
                      SELECT 1 FROM pipeline_events pe
                      WHERE pe.position_id = p.id
                        AND pe.created_at > NOW() - INTERVAL '7 days'
                  )
                LIMIT 3
                """,
                org_id,
            )
            for row in stale:
                suggestions.append({
                    "org_id": org_id,
                    "type": "stale_position",
                    "title": f"\"{row['role_name']}\" has had no activity in 7 days — consider adjusting the JD",
                    "action_url": f"/positions/{row['id']}",
                    "action_label": "Review Position →",
                    "entity_id": row["id"],
                    "entity_type": "position",
                })

            # 4. Interviews scheduled today
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            today_end = today_start + timedelta(days=1)
            interviews_today = await conn.fetch(
                """
                SELECT i.id, i.position_id, c.name AS candidate_name, p.role_name
                FROM interviews i
                JOIN candidates c ON c.id = i.candidate_id
                JOIN positions p ON p.id = i.position_id
                WHERE i.org_id = $1
                  AND i.scheduled_at >= $2
                  AND i.scheduled_at < $3
                  AND i.status = 'scheduled'
                LIMIT 5
                """,
                org_id, today_start, today_end,
            )
            for row in interviews_today:
                suggestions.append({
                    "org_id": org_id,
                    "type": "interview_today",
                    "title": f"Interview today: {row['candidate_name']} for \"{row['role_name']}\"",
                    "action_url": f"/positions/{row['position_id']}?tab=pipeline",
                    "action_label": "View Details →",
                    "entity_id": row["id"],
                    "entity_type": "interview",
                })

            # 5. Talent pool matches for new positions
            pool_matches = await conn.fetch(
                """
                SELECT tps.position_id, p.role_name, COUNT(*) AS match_count
                FROM talent_pool_suggestions tps
                JOIN positions p ON p.id = tps.position_id
                WHERE tps.org_id = $1
                  AND tps.actioned = FALSE
                  AND tps.suggested_at > NOW() - INTERVAL '24 hours'
                GROUP BY tps.position_id, p.role_name
                LIMIT 3
                """,
                org_id,
            )
            for row in pool_matches:
                suggestions.append({
                    "org_id": org_id,
                    "type": "pool_match",
                    "title": f"{row['match_count']} talent pool candidate(s) match \"{row['role_name']}\"",
                    "action_url": f"/talent-pool?position={row['position_id']}",
                    "action_label": "View Matches →",
                    "entity_id": row["position_id"],
                    "entity_type": "position",
                })

            if not suggestions:
                return 0

            # Clear old undismissed suggestions for this org before inserting fresh ones
            await conn.execute(
                "DELETE FROM copilot_suggestions WHERE org_id=$1 AND is_dismissed=FALSE",
                org_id,
            )

            await conn.executemany(
                """
                INSERT INTO copilot_suggestions
                    (org_id, type, title, action_url, action_label, entity_id, entity_type)
                VALUES ($1,$2,$3,$4,$5,$6,$7)
                """,
                [
                    (s["org_id"], s["type"], s["title"], s.get("action_url"),
                     s.get("action_label"), s.get("entity_id"), s.get("entity_type"))
                    for s in suggestions
                ],
            )

        logger.info(f"Copilot: generated {len(suggestions)} suggestions for org {org_id}")
        return len(suggestions)
