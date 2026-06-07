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


# ── Organizations List (Public) ────────────────────────────────────────────────

@router.get("/")
async def list_organizations():
    """
    Public endpoint to list all organizations on the platform.
    Typically used for a platform-level job board or directory.
    """
    async with get_connection() as conn:
        orgs = await conn.fetch(
            """
            SELECT slug, name, logo_url, about_us, career_primary_color
            FROM organizations
            ORDER BY name ASC
            """
        )
    return {"organizations": [dict(o) for o in orgs]}


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
                   benefits_text, website, headquarters, size,
                   career_primary_color, career_banner_url, career_tagline
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
                   p.experience_min, p.experience_max, p.created_at,
                   d.name AS department
            FROM positions p
            LEFT JOIN departments d ON d.id = p.department_id
            WHERE {where}
            ORDER BY d.name, p.created_at DESC
            """,
            *params
        )

    pos_list = []
    for p in positions:
        pos_list.append(dict(p))

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
                   p.experience_min, p.experience_max, p.jd_markdown,
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

    pos_dict = dict(pos)

    return {
        "org": dict(org),
        "position": pos_dict,
    }


# ── Start application from career page ────────────────────────────────────────

from pydantic import BaseModel, EmailStr

class StartApplicationRequest(BaseModel):
    name: str
    email: EmailStr

@router.post("/{org_slug}/positions/{position_id}/apply")
async def start_application(org_slug: str, position_id: int, req: StartApplicationRequest):
    """
    Start a candidate application from the career page.
    Creates a candidate (if new) and an application, then returns a standard apply token.
    """
    from backend.services.apply_service import generate_apply_token
    from backend.db.connection import get_connection as gc

    async with gc() as conn:
        org = await conn.fetchrow(
            "SELECT id FROM organizations WHERE slug=$1", org_slug.lower()
        )
        if not org:
            raise HTTPException(status_code=404, detail={"code": "ORG_NOT_FOUND", "message": "Organization not found"})

        pos = await conn.fetchrow(
            "SELECT id, status, department_id FROM positions WHERE id=$1 AND org_id=$2",
            position_id, org["id"]
        )
        if not pos or pos["status"] != "open":
            raise HTTPException(status_code=404, detail={"code": "POSITION_NOT_FOUND", "message": "Position not available"})

        # Find or create candidate
        candidate = await conn.fetchrow(
            "SELECT id FROM candidates WHERE email=$1 AND org_id=$2",
            req.email, org["id"]
        )
        if not candidate:
            candidate = await conn.fetchrow(
                "INSERT INTO candidates (org_id, name, email, source) VALUES ($1, $2, $3, 'career_page') RETURNING id",
                org["id"], req.name, req.email
            )

        # Check if already applied
        app = await conn.fetchrow(
            "SELECT id, status FROM candidate_applications WHERE candidate_id=$1 AND position_id=$2",
            candidate["id"], position_id
        )
        if not app:
            app = await conn.fetchrow(
                "INSERT INTO candidate_applications (org_id, department_id, candidate_id, position_id, status) VALUES ($1, $2, $3, $4, 'sourced') RETURNING id",
                org["id"], pos["department_id"], candidate["id"], position_id
            )

    # Generate the standard apply token
    token = generate_apply_token(
        application_id=app["id"],
        candidate_id=candidate["id"],
        org_id=org["id"],
    )
    return {"apply_token": token, "apply_url": f"/apply/{token}"}


# ── Fit Finder (public) ───────────────────────────────────────────────────────

@router.get("/{org_slug}/fit")
async def get_career_fit(
    org_slug: str,
    func: Optional[str] = Query(None, alias="function"),
    exp: Optional[str] = Query(None),
    values: Optional[str] = Query(None)
):
    """
    Returns ranked positions matching the fit-filter selection.
    """
    async with get_connection() as conn:
        org = await conn.fetchrow("SELECT id FROM organizations WHERE slug=$1", org_slug.lower())
        if not org:
            raise HTTPException(status_code=404, detail={"code": "ORG_NOT_FOUND", "message": "Organization not found"})
        
        # Fetch all open positions for this org
        positions = await conn.fetch(
            """
            SELECT p.id, p.role_name, p.location, p.work_type, p.employment_type,
                   p.experience_min, p.experience_max, p.created_at,
                   p.priority, p.jd_markdown,
                   d.name AS department
            FROM positions p
            LEFT JOIN departments d ON d.id = p.department_id
            WHERE p.org_id=$1 AND p.status='open' AND p.is_on_career_page=TRUE
            """,
            org["id"]
        )

    pos_list = []
    
    has_filters = bool(func or exp or values)
    
    # Very basic scoring logic for MVP
    for p in positions:
        d = dict(p)
        score = 50 # Base score
        
        if has_filters:
            # Function match
            dept = (d.get("department") or "").lower()
            role = (d.get("role_name") or "").lower()
            if func and func.lower() != "all":
                f_lower = func.lower()
                if f_lower in dept or f_lower in role:
                    score += 30
                else:
                    score -= 20
                    
            # Experience match
            exp_min = d.get("experience_min") or 0
            exp_max = d.get("experience_max") or 99
            if exp:
                if exp == "0-3 yrs":
                    if exp_min <= 3: score += 20
                    else: score -= 10
                elif exp == "3-7 yrs":
                    if exp_min <= 7 and exp_max >= 3: score += 20
                    else: score -= 10
                elif exp == "7+ yrs":
                    if exp_min >= 5 or exp_max >= 7: score += 20
                    else: score -= 10
                    
            # Values match (soft score)
            if values:
                val_list = [v.strip().lower() for v in values.split(",")]
                jd_text = (d.get("jd_markdown") or "").lower()
                for v in val_list:
                    if v in jd_text:
                        score += 5
                        
            d["fit_score"] = min(100, max(0, score))
        else:
            d["fit_score"] = 0
        
        # Extract a short pitch
        jd = d.get("jd_markdown") or ""
        lines = [line.strip() for line in jd.split('\\n') if line.strip() and not line.startswith('#')]
        d["jd_pitch"] = lines[0][:120] + "..." if lines else "Join our team to help build the future."
        d["team_pitch"] = "We're a fast-moving team focused on high impact."
        
        pos_list.append(d)
        
    if has_filters:
        # Sort by fit_score descending
        pos_list.sort(key=lambda x: x["fit_score"], reverse=True)
        # Only return top matches (score > 40)
        matches = [p for p in pos_list if p["fit_score"] > 40]
    else:
        matches = pos_list
    
    return {
        "positions": matches,
        "total": len(matches)
    }

