"""
routers/apply.py – Public candidate application endpoints (magic link)
No authentication required — candidates access this via the magic link in their email.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from backend.services.email_service import verify_magic_link
from backend.db.database import get_connection

router = APIRouter(prefix="/api/apply", tags=["apply"])


class ApplicationForm(BaseModel):
    prev_company: str = ""
    notice_period: str = ""
    total_experience: str = ""
    relevant_experience: str = ""
    current_salary: str = ""
    expected_salary: str = ""
    availability: str = ""
    interview_availability: str = ""
    additional_info: str = ""


@router.get("/{token}")
async def verify_application_link(token: str):
    """
    Verify a magic link and return position + candidate info.
    This is the landing page data for the application form.
    """
    try:
        payload = verify_magic_link(token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    candidate_id = payload["candidate_id"]
    position_id = payload["position_id"]

    with get_connection() as conn:
        candidate = conn.execute(
            "SELECT name, email FROM candidates WHERE id = ?", (candidate_id,)
        ).fetchone()

        position = conn.execute("""
            SELECT p.role_name, p.jd_markdown, o.name as org_name, o.about_us
            FROM positions p
            JOIN organizations o ON p.org_id = o.id
            WHERE p.id = ?
        """, (position_id,)).fetchone()

        if not candidate or not position:
            raise HTTPException(status_code=404, detail="Position or candidate not found")

        # Track link click
        conn.execute("""
            UPDATE candidate_emails
            SET link_clicked_at = ?
            WHERE candidate_id = ? AND link_clicked_at IS NULL
        """, (datetime.utcnow().isoformat(), candidate_id))

    return {
        "candidate": {"name": candidate["name"], "email": candidate["email"]},
        "position": {
            "role_name": position["role_name"],
            "jd_markdown": position["jd_markdown"],
            "org_name": position["org_name"],
            "about_us": position["about_us"],
        },
    }


@router.post("/{token}")
async def submit_application(token: str, form: ApplicationForm):
    """
    Submit a candidate application via magic link.
    Collects screening data (prev company, notice period, salary, etc.).
    """
    try:
        payload = verify_magic_link(token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    candidate_id = payload["candidate_id"]
    position_id = payload["position_id"]

    with get_connection() as conn:
        # Check if already applied
        existing = conn.execute(
            "SELECT id FROM applications WHERE candidate_id = ? AND position_id = ?",
            (candidate_id, position_id)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="You have already applied for this position")

        # Insert application
        conn.execute("""
            INSERT INTO applications (
                candidate_id, position_id, applied_via,
                prev_company, notice_period,
                total_experience, relevant_experience,
                current_salary, expected_salary,
                availability, interview_availability,
                additional_info
            ) VALUES (?, ?, 'magic_link', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            candidate_id, position_id,
            form.prev_company, form.notice_period,
            form.total_experience, form.relevant_experience,
            form.current_salary, form.expected_salary,
            form.availability, form.interview_availability,
            form.additional_info,
        ))

        # Update candidate status
        conn.execute(
            "UPDATE candidates SET status = 'applied', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (candidate_id,)
        )

    return {"success": True, "message": "Application submitted successfully!"}
