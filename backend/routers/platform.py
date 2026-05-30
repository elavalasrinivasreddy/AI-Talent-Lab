"""
routers/platform.py – Platform owner (SaaS admin) analytics.
All routes under /api/v1/platform/ — requires platform_admin role.
No org_id scoping — queries span all tenants.
"""
import logging
import asyncpg
from fastapi import APIRouter, Depends

from backend.dependencies import require_platform_admin, get_db

router = APIRouter(prefix="/api/v1/platform", tags=["Platform"])
logger = logging.getLogger(__name__)


@router.get("/stats")
async def get_platform_stats(
    _=Depends(require_platform_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """Aggregate metrics across all organisations."""
    row = await db.fetchrow(
        """
        SELECT
          (SELECT COUNT(*) FROM organizations)                               AS total_orgs,
          (SELECT COUNT(*) FROM users WHERE is_active = TRUE)                AS total_users,
          (SELECT COUNT(*) FROM positions)                                   AS total_positions,
          (SELECT COUNT(*) FROM positions WHERE status = 'open')             AS active_positions,
          (SELECT COUNT(*) FROM candidates)                                  AS total_candidates,
          (SELECT COUNT(*) FROM candidate_applications)                      AS total_applications,
          (SELECT COUNT(*) FROM chat_sessions)                               AS total_jd_sessions,
          (SELECT COUNT(*) FROM organizations
            WHERE created_at >= NOW() - INTERVAL '30 days')                 AS new_orgs_30d,
          (SELECT COUNT(*) FROM users
            WHERE created_at >= NOW() - INTERVAL '30 days')                 AS new_users_30d,
          (SELECT COUNT(*) FROM positions
            WHERE created_at >= NOW() - INTERVAL '30 days')                 AS new_positions_30d,
          (SELECT COUNT(*) FROM candidate_applications
            WHERE created_at >= NOW() - INTERVAL '7 days')                  AS applications_7d
        """
    )
    return dict(row) if row else {}


@router.get("/orgs")
async def list_platform_orgs(
    _=Depends(require_platform_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """List all organisations with their usage metrics."""
    rows = await db.fetch(
        """
        SELECT
          o.id, o.name, o.slug, o.segment, o.size,
          o.created_at,
          COUNT(DISTINCT u.id)                                          AS user_count,
          COUNT(DISTINCT p.id)                                          AS position_count,
          COUNT(DISTINCT CASE WHEN p.status = 'open' THEN p.id END)    AS active_positions,
          COUNT(DISTINCT ca.id)                                         AS application_count,
          MAX(p.created_at)                                             AS last_position_at
        FROM organizations o
        LEFT JOIN users u  ON u.org_id = o.id  AND u.is_active = TRUE
        LEFT JOIN positions p ON p.org_id = o.id
        LEFT JOIN candidate_applications ca ON ca.org_id = o.id
        GROUP BY o.id, o.name, o.slug, o.segment, o.size, o.created_at
        ORDER BY o.created_at DESC
        """
    )
    return {"orgs": [dict(r) for r in rows]}


@router.get("/activity")
async def get_platform_activity(
    _=Depends(require_platform_admin),
    db: asyncpg.Connection = Depends(get_db),
):
    """Recent activity stream across all orgs (last 50 events)."""
    rows = await db.fetch(
        """
        SELECT pe.event_type, pe.created_at,
               o.name AS org_name,
               pos.role_name AS position_title,
               c.name AS candidate_name
        FROM pipeline_events pe
        LEFT JOIN organizations o ON o.id = pe.org_id
        LEFT JOIN positions pos ON pos.id = pe.position_id
        LEFT JOIN candidates c ON c.id = pe.candidate_id
        ORDER BY pe.created_at DESC
        LIMIT 50
        """
    )
    return {"activity": [dict(r) for r in rows]}
