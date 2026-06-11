"""
routers/gdpr.py – GDPR/DPDP compliance endpoints.
Mix of public (candidate-facing) and authenticated (admin) endpoints.

Public endpoints (no auth):
  POST /api/v1/gdpr/delete-my-data           — Request data deletion
  POST /api/v1/gdpr/verify-deletion/{token}  — Verify deletion request

Authenticated endpoints (admin only):
  GET  /api/v1/gdpr/deletion-requests         — List all deletion requests
  POST /api/v1/gdpr/process-deletion/{id}     — Process a verified request
  GET  /api/v1/gdpr/export/{candidate_id}     — Export candidate data
  GET  /api/v1/gdpr/consent/{candidate_id}    — View consent records
"""
import logging

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, EmailStr
from typing import Optional

from backend.dependencies import get_current_user, require_org_head
from backend.middleware.rate_limiter import limiter
from backend.services.gdpr_service import GDPRService

router = APIRouter(prefix="/api/v1/gdpr", tags=["GDPR / Privacy"])
logger = logging.getLogger(__name__)


# ── Schemas ───────────────────────────────────────────────────────────────────

class DeletionRequest(BaseModel):
    email: EmailStr


class ConsentRequest(BaseModel):
    candidate_id: int
    application_id: Optional[int] = None
    consent_types: list[str]  # ['data_processing', 'ai_analysis', 'communication']


# ── Public Endpoints (no auth) ────────────────────────────────────────────────

@router.post("/delete-my-data")
@limiter.limit("5/hour")
async def request_data_deletion(request: Request, body: DeletionRequest):
    """
    Candidate requests deletion of all their data.
    Returns a neutral message regardless of whether the email exists (privacy).
    In production, a verification email is sent.
    Rate-limited to 5 requests/hour per IP to prevent email spam abuse.
    """
    result = await GDPRService.request_deletion(body.email)
    return {
        "message": result["message"],
        # In dev mode, return token for testing; prod would only email it
        "verification_token": result.get("verification_token"),
    }


@router.post("/verify-deletion/{token}")
async def verify_deletion(token: str):
    """Verify a data deletion request via the emailed token."""
    result = await GDPRService.verify_deletion(token)
    if result.get("error"):
        raise HTTPException(status_code=400, detail={
            "code": "INVALID_TOKEN",
            "message": result["error"],
        })
    return result


# ── Authenticated Endpoints (admin only) ──────────────────────────────────────

@router.get("/deletion-requests")
async def list_deletion_requests(user=Depends(require_org_head)):
    """List all data deletion requests for the organization."""
    from backend.db.connection import get_connection
    async with get_connection() as conn:
        rows = await conn.fetch(
            """
            SELECT dr.*, c.name AS candidate_name
            FROM data_deletion_requests dr
            LEFT JOIN candidates c ON c.id = dr.candidate_id
            WHERE dr.org_id=$1
            ORDER BY dr.created_at DESC
            """,
            user["org_id"],
        )
    return {"requests": [dict(r) for r in rows]}


@router.post("/process-deletion/{request_id}")
@limiter.limit("10/hour")
async def process_deletion(request_id: int, request: Request, user=Depends(require_org_head)):
    """
    Process a verified deletion request.
    Anonymizes all candidate PII while preserving aggregate metrics.
    Scoped to the caller's org — an org_head cannot process another org's request.
    """
    result = await GDPRService.process_deletion(request_id, user["org_id"])
    if result.get("error"):
        raise HTTPException(status_code=400, detail={
            "code": "PROCESSING_ERROR",
            "message": result["error"],
        })
    return result


@router.get("/export/{candidate_id}")
async def export_candidate_data(candidate_id: int, user=Depends(require_org_head)):
    """Export all data held about a candidate (Right to Access / Portability)."""
    result = await GDPRService.export_candidate_data(user["org_id"], candidate_id)
    if result.get("error"):
        raise HTTPException(status_code=404, detail={
            "code": "NOT_FOUND",
            "message": result["error"],
        })
    return result


@router.get("/consent/{candidate_id}")
async def get_consent_records(candidate_id: int, user=Depends(require_org_head)):
    """View all consent records for a candidate."""
    records = await GDPRService.get_consent_status(user["org_id"], candidate_id)
    return {"consent_records": records}


@router.post("/consent")
async def record_consent(body: ConsentRequest, request: Request, user=Depends(get_current_user)):
    """Record consent from the apply flow (authenticated recruiter context)."""
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    results = await GDPRService.record_bulk_consent(
        org_id=user["org_id"],
        candidate_id=body.candidate_id,
        application_id=body.application_id,
        consent_types=body.consent_types,
        ip_address=ip,
        user_agent=ua,
    )
    return {"consents": results}
