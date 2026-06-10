from fastapi import APIRouter, Depends, HTTPException, Request
import asyncpg
from pydantic import BaseModel

from backend.db.repositories.candidates import CandidateRepository
from backend.utils.security import create_access_token, verify_password
from backend.dependencies import get_db, get_current_candidate

router = APIRouter(prefix="/api/v1/candidate", tags=["Candidate Portal"])

# Consent text version shown to candidates on talent-pool opt-in. Bump when wording changes.
TALENT_POOL_CONSENT_VERSION = "v1-2026-06"

class CandidateLoginBody(BaseModel):
    email: str
    password: str
    org_id: int

@router.post("/login")
async def login_candidate(body: CandidateLoginBody, db: asyncpg.Connection = Depends(get_db)):
    candidate = await CandidateRepository.get_by_email(db, body.email, body.org_id)

    # Same generic error for "no candidate", "no password set", and "wrong password"
    # to avoid leaking which emails exist in which org.
    if (
        not candidate
        or not candidate.get("password_hash")
        or not verify_password(body.password, candidate["password_hash"])
    ):
        raise HTTPException(status_code=401, detail={"code": "INVALID_CREDENTIALS", "message": "Invalid email or password."})

    # Generate token
    token = create_access_token(
        user_id=candidate["id"],
        org_id=candidate["org_id"],
        role="candidate"
    )
    
    return {
        "status": "success",
        "access_token": token,
        "candidate": {
            "id": candidate["id"],
            "name": candidate["name"],
            "email": candidate["email"]
        }
    }

@router.get("/timeline")
async def get_timeline(candidate: dict = Depends(get_current_candidate), db: asyncpg.Connection = Depends(get_db)):
    candidate_id = candidate["candidate_id"]
    org_id = candidate["org_id"]
    
    # Get all applications for this candidate, including pre-eval token when available
    apps = await db.fetch(
        """
        SELECT ca.id, ca.status, ca.applied_at, p.role_name, p.location,
               pe.token AS pre_eval_token
        FROM candidate_applications ca
        JOIN positions p ON p.id = ca.position_id
        LEFT JOIN pre_evaluations pe
               ON pe.application_id = ca.id
              AND pe.status IN ('pending', 'submitted')
        WHERE ca.candidate_id = $1 AND ca.org_id = $2
        """,
        candidate_id, org_id
    )
    
    # Get all pipeline events
    events = await db.fetch(
        """
        SELECT event_type, event_data, created_at, position_id
        FROM pipeline_events
        WHERE candidate_id = $1 AND org_id = $2
        ORDER BY created_at DESC
        """,
        candidate_id, org_id
    )
    
    # Get upcoming interviews
    interviews = await db.fetch(
        """
        SELECT round_name, scheduled_at, status, duration_minutes, position_id
        FROM interviews
        WHERE candidate_id = $1 AND org_id = $2
        ORDER BY scheduled_at ASC
        """,
        candidate_id, org_id
    )
    
    return {
        "applications": [dict(a) for a in apps],
        "timeline": [dict(e) for e in events],
        "interviews": [dict(i) for i in interviews]
    }

class SetPasswordBody(BaseModel):
    token: str
    password: str

@router.post("/set-password")
async def set_password(body: SetPasswordBody, db: asyncpg.Connection = Depends(get_db)):
    from backend.utils.security import verify_magic_link_token, hash_password

    try:
        # Dedicated candidate-setup token type — distinct from internal-user 'auth_magic'
        # so a candidate link can never be replayed against the staff sign-in flow.
        payload = verify_magic_link_token(body.token, "candidate_setup")
    except Exception:
        raise HTTPException(status_code=400, detail={"code": "INVALID_TOKEN", "message": "Invalid or expired token."})

    candidate_id = payload["entity_id"]
    jti = payload.get("jti")
    if not jti:
        raise HTTPException(status_code=400, detail={"code": "INVALID_TOKEN", "message": "Token is missing required fields."})

    # Enforce single-use: insert the jti; a UNIQUE violation means the link was already used.
    try:
        await db.execute(
            "INSERT INTO consumed_magic_links (jti, token_type, entity_id) VALUES ($1, $2, $3)",
            jti, "candidate_setup", candidate_id,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=400, detail={"code": "TOKEN_USED", "message": "This link has already been used."})

    # Server-side password policy: minimum 8 characters, not all digits
    if len(body.password) < 8 or body.password.isdigit():
        raise HTTPException(status_code=422, detail={"code": "WEAK_PASSWORD", "message": "Password must be at least 8 characters and not all digits."})

    hashed = hash_password(body.password)
    await db.execute(
        "UPDATE candidates SET password_hash = $1, updated_at = NOW() WHERE id = $2",
        hashed, candidate_id
    )

    return {"status": "success", "message": "Password set successfully. You may now log in."}

class OptInBody(BaseModel):
    opt_in: bool

@router.post("/opt-in-talent-pool")
async def opt_in_talent_pool(
    body: OptInBody,
    request: Request,
    candidate: dict = Depends(get_current_candidate),
    db: asyncpg.Connection = Depends(get_db),
):
    candidate_id = candidate["candidate_id"]
    org_id = candidate["org_id"]

    # talent_pool_reason is 'opt_in' only when actually opting in; cleared on opt-out.
    reason = "opt_in" if body.opt_in else None
    await db.execute(
        """
        UPDATE candidates
        SET in_talent_pool = $1,
            talent_pool_reason = $2,
            talent_pool_added_at = CASE WHEN $1 THEN NOW() ELSE talent_pool_added_at END,
            consent_to_store = $1,
            consent_to_contact = $1,
            consent_timestamp = NOW(),
            updated_at = NOW()
        WHERE id = $3 AND org_id = $4
        """,
        body.opt_in, reason, candidate_id, org_id
    )

    # GDPR/DPDP audit trail: record the consent event itself.
    ip_address = request.client.host if request.client else None
    await db.execute(
        """
        INSERT INTO consent_records
            (org_id, candidate_id, consent_type, consent_given, consent_text, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6)
        """,
        org_id, candidate_id, "talent_pool",
        body.opt_in,
        f"Talent pool opt-in ({TALENT_POOL_CONSENT_VERSION})",
        ip_address,
    )

    return {"status": "success", "message": "Preferences updated successfully."}
