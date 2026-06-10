from fastapi import APIRouter, Depends, HTTPException
import asyncpg
from pydantic import BaseModel
import bcrypt

from backend.db.repositories.candidates import CandidateRepository
from backend.utils.security import create_access_token
from backend.dependencies import get_db, get_current_candidate

router = APIRouter()

class CandidateLoginBody(BaseModel):
    email: str
    password: str
    org_id: int

@router.post("/login")
async def login_candidate(body: CandidateLoginBody, db: asyncpg.Connection = Depends(get_db)):
    candidate = await CandidateRepository.get_by_email(db, body.email, body.org_id)
    
    if not candidate or not candidate.get("password_hash"):
        raise HTTPException(status_code=401, detail={"code": "INVALID_CREDENTIALS", "message": "Invalid email or password."})
        
    # Verify password
    if not bcrypt.checkpw(body.password.encode('utf-8'), candidate["password_hash"].encode('utf-8')):
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
    
    # Get all applications for this candidate
    apps = await db.fetch(
        """
        SELECT ca.id, ca.status, ca.applied_at, p.role_name, p.location
        FROM candidate_applications ca
        JOIN positions p ON p.id = ca.position_id
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
        # Expected to be an 'auth_magic' token
        payload = verify_magic_link_token(body.token, "auth_magic")
    except Exception as e:
        raise HTTPException(status_code=400, detail={"code": "INVALID_TOKEN", "message": "Invalid or expired token."})
        
    candidate_id = payload["entity_id"]
    
    # Hash the password
    hashed = hash_password(body.password)
    
    # Update candidate record
    await db.execute(
        "UPDATE candidates SET password_hash = $1, updated_at = NOW() WHERE id = $2",
        hashed, candidate_id
    )
    
    return {"status": "success", "message": "Password set successfully. You may now log in."}

class OptInBody(BaseModel):
    opt_in: bool

@router.post("/opt-in-talent-pool")
async def opt_in_talent_pool(body: OptInBody, candidate: dict = Depends(get_current_candidate), db: asyncpg.Connection = Depends(get_db)):
    candidate_id = candidate["candidate_id"]
    org_id = candidate["org_id"]
    
    await db.execute(
        """
        UPDATE candidates 
        SET in_talent_pool = $1, 
            talent_pool_reason = 'opt_in', 
            talent_pool_added_at = NOW(),
            consent_to_store = $1,
            consent_to_contact = $1,
            updated_at = NOW()
        WHERE id = $2 AND org_id = $3
        """,
        body.opt_in, candidate_id, org_id
    )
    
    return {"status": "success", "message": "Preferences updated successfully."}
