"""
routers/dashboard.py – Dashboard & analytics endpoints
"""
from fastapi import APIRouter, Depends
from backend.routers.auth import get_current_user
from backend.db.database import get_connection

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    """Aggregate dashboard statistics for the org."""
    org_id = user["org_id"]
    with get_connection() as conn:
        open_positions = conn.execute(
            "SELECT COUNT(*) as c FROM positions WHERE org_id = ? AND status = 'open'",
            (org_id,)
        ).fetchone()["c"]

        total_candidates = conn.execute(
            "SELECT COUNT(*) as c FROM candidates WHERE org_id = ?",
            (org_id,)
        ).fetchone()["c"]

        emails_sent = conn.execute("""
            SELECT COUNT(*) as c FROM candidate_emails ce
            JOIN candidates c ON ce.candidate_id = c.id
            WHERE c.org_id = ? AND ce.sent_at IS NOT NULL
        """, (org_id,)).fetchone()["c"]

        applications = conn.execute("""
            SELECT COUNT(*) as c FROM applications a
            JOIN candidates c ON a.candidate_id = c.id
            WHERE c.org_id = ?
        """, (org_id,)).fetchone()["c"]

    return {
        "open_positions": open_positions,
        "total_candidates": total_candidates,
        "emails_sent": emails_sent,
        "applications": applications,
    }


@router.get("/positions")
async def dashboard_positions(user: dict = Depends(get_current_user)):
    """All positions with candidate counts for the org."""
    with get_connection() as conn:
        positions = conn.execute("""
            SELECT p.id, p.role_name, p.status, p.jd_markdown IS NOT NULL as has_jd,
                   p.created_at, p.ats_threshold,
                   COUNT(c.id) as candidate_count,
                   SUM(CASE WHEN c.status = 'applied' THEN 1 ELSE 0 END) as applied_count,
                   SUM(CASE WHEN c.status = 'interview' THEN 1 ELSE 0 END) as interview_count,
                   SUM(CASE WHEN c.status = 'selected' THEN 1 ELSE 0 END) as selected_count
            FROM positions p
            LEFT JOIN candidates c ON c.position_id = p.id
            WHERE p.org_id = ?
            GROUP BY p.id
            ORDER BY p.created_at DESC
        """, (user["org_id"],)).fetchall()

    return {"positions": [dict(p) for p in positions]}


@router.get("/pipeline/{position_id}")
async def pipeline_view(position_id: int, user: dict = Depends(get_current_user)):
    """Candidates grouped by pipeline stage for a position."""
    with get_connection() as conn:
        candidates = conn.execute("""
            SELECT c.id, c.name, c.email, c.phone, c.source,
                   c.skill_match_score, c.status, c.created_at,
                   a.applied_at, a.prev_company, a.notice_period,
                   a.total_experience, a.relevant_experience,
                   a.current_salary, a.expected_salary
            FROM candidates c
            LEFT JOIN applications a ON a.candidate_id = c.id AND a.position_id = c.position_id
            WHERE c.position_id = ? AND c.org_id = ?
            ORDER BY c.skill_match_score DESC
        """, (position_id, user["org_id"])).fetchall()

    # Group by status
    pipeline = {}
    for c in candidates:
        status = c["status"]
        if status not in pipeline:
            pipeline[status] = []
        pipeline[status].append(dict(c))

    return {
        "position_id": position_id,
        "total": len(candidates),
        "pipeline": pipeline,
    }


@router.get("/funnel")
async def hiring_funnel(user: dict = Depends(get_current_user)):
    """Hiring funnel data for charts."""
    with get_connection() as conn:
        funnel = conn.execute("""
            SELECT c.status, COUNT(*) as count
            FROM candidates c
            WHERE c.org_id = ?
            GROUP BY c.status
            ORDER BY CASE c.status
                WHEN 'sourced' THEN 1
                WHEN 'emailed' THEN 2
                WHEN 'applied' THEN 3
                WHEN 'screening' THEN 4
                WHEN 'interview' THEN 5
                WHEN 'selected' THEN 6
                WHEN 'rejected' THEN 7
                WHEN 'on_hold' THEN 8
            END
        """, (user["org_id"],)).fetchall()

    return {"funnel": [dict(f) for f in funnel]}
