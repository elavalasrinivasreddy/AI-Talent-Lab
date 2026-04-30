"""
routers/careers.py – Public career page endpoints.
No auth required. SEO-optimized responses.
All routes under /api/v1/careers/
"""
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from backend.db.connection import get_connection

router = APIRouter(prefix="/api/v1/careers", tags=["Careers"])
logger = logging.getLogger(__name__)


# ── Career page (org-level) ────────────────────────────────────────────────────

@router.get("/{org_slug}")
async def get_career_page(
    org_slug: str,
    department: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    work_type: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
):
    """
    Public career page for an organization.
    Returns org info + all open positions that have is_on_career_page=true.
    """
    async with get_connection() as conn:
        org = await conn.fetchrow(
            """
            SELECT id, name, logo_url, about_us, culture_keywords,
                   benefits_text, website, headquarters, size
            FROM organizations
            WHERE slug=$1
            """,
            org_slug.lower()
        )
        if not org:
            raise HTTPException(
                status_code=404,
                detail={"code": "ORG_NOT_FOUND", "message": f"No organization found for '{org_slug}'"}
            )

        org_id = org["id"]

        # Build position filters
        filters = ["p.org_id=$1", "p.status='open'", "p.is_on_career_page=TRUE"]
        params: list = [org_id]
        i = 2

        if department:
            filters.append(f"d.name ILIKE ${i}")
            params.append(f"%{department}%")
            i += 1
        if location:
            filters.append(f"p.location ILIKE ${i}")
            params.append(f"%{location}%")
            i += 1
        if work_type:
            filters.append(f"p.work_type=${i}")
            params.append(work_type)
            i += 1
        if q:
            filters.append(f"p.role_name ILIKE ${i}")
            params.append(f"%{q}%")
            i += 1

        where = " AND ".join(filters)

        positions = await conn.fetch(
            f"""
            SELECT p.id, p.role_name, p.location, p.work_type, p.employment_type,
                   p.experience_min, p.experience_max, p.key_skills, p.created_at,
                   d.name AS department
            FROM positions p
            LEFT JOIN departments d ON d.id = p.department_id
            WHERE {where}
            ORDER BY d.name, p.created_at DESC
            """,
            *params
        )

    import json
    pos_list = []
    for p in positions:
        d = dict(p)
        if d.get("key_skills") and isinstance(d["key_skills"], str):
            try:
                d["key_skills"] = json.loads(d["key_skills"])
            except Exception:
                d["key_skills"] = []
        pos_list.append(d)

    return {
        "org": dict(org),
        "positions": pos_list,
        "total": len(pos_list),
    }


# ── Position detail (public) ───────────────────────────────────────────────────

@router.get("/{org_slug}/positions/{position_id}")
async def get_position_detail(org_slug: str, position_id: int):
    """
    Public job description page for a specific open position.
    Returns full JD markdown, org context, apply info.
    """
    async with get_connection() as conn:
        org = await conn.fetchrow(
            "SELECT id, name, logo_url, about_us FROM organizations WHERE slug=$1",
            org_slug.lower()
        )
        if not org:
            raise HTTPException(status_code=404, detail={"code": "ORG_NOT_FOUND", "message": "Organization not found"})

        pos = await conn.fetchrow(
            """
            SELECT p.id, p.role_name, p.location, p.work_type, p.employment_type,
                   p.experience_min, p.experience_max, p.key_skills, p.jd_markdown,
                   p.created_at, p.status, p.is_on_career_page,
                   d.name AS department
            FROM positions p
            LEFT JOIN departments d ON d.id = p.department_id
            WHERE p.id=$1 AND p.org_id=$2
            """,
            position_id, org["id"]
        )
        if not pos or pos["status"] != "open" or not pos["is_on_career_page"]:
            raise HTTPException(status_code=404, detail={"code": "POSITION_NOT_FOUND", "message": "Position not available"})

    import json
    pos_dict = dict(pos)
    if pos_dict.get("key_skills") and isinstance(pos_dict["key_skills"], str):
        try:
            pos_dict["key_skills"] = json.loads(pos_dict["key_skills"])
        except Exception:
            pos_dict["key_skills"] = []

    return {
        "org": dict(org),
        "position": pos_dict,
    }


# ── Start application from career page ────────────────────────────────────────

@router.post("/{org_slug}/positions/{position_id}/apply")
async def start_application(org_slug: str, position_id: int):
    """
    Start a candidate application from the career page.
    Creates an anonymous candidate session and returns a short-lived apply token.
    """
    from backend.services.apply_service import ApplyService
    from backend.db.connection import get_connection as gc

    async with gc() as conn:
        org = await conn.fetchrow(
            "SELECT id FROM organizations WHERE slug=$1", org_slug.lower()
        )
        if not org:
            raise HTTPException(status_code=404, detail={"code": "ORG_NOT_FOUND", "message": "Organization not found"})

        pos = await conn.fetchrow(
            "SELECT id, status FROM positions WHERE id=$1 AND org_id=$2",
            position_id, org["id"]
        )
        if not pos or pos["status"] != "open":
            raise HTTPException(status_code=404, detail={"code": "POSITION_NOT_FOUND", "message": "Position not available"})

    # Generate a career-page apply token (no candidate yet — will be created during chat)
    token = ApplyService.generate_career_page_token(
        position_id=position_id,
        org_id=org["id"],
    )
    return {"apply_token": token, "apply_url": f"/apply/{token}"}
