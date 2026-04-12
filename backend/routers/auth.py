"""
routers/auth.py – Authentication endpoints (JWT-based)
Handles user registration, login, and role management.
"""
import os
import jwt
import bcrypt
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, EmailStr
from typing import Optional
from backend.db.database import get_connection

router = APIRouter(prefix="/api/auth", tags=["auth"])

# JWT Configuration
JWT_SECRET = os.environ.get("JWT_SECRET", "ai-talent-lab-jwt-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 168  # 7 days


# ── Models ────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    org_name: str
    email: str
    password: str
    name: str
    segment: str = "Technology"
    size: str = "startup"
    website: str = ""
    about_us: str = ""

class LoginRequest(BaseModel):
    email: str
    password: str

class AddUserRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str = "recruiter"

class AuthResponse(BaseModel):
    token: str
    user: dict


# ── Helpers ───────────────────────────────────────────────────────────────────

def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def _check_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))

def _create_token(user_id: int, org_id: int, role: str, email: str, name: str) -> str:
    payload = {
        "sub": str(user_id),
        "org_id": org_id,
        "role": role,
        "email": email,
        "name": name,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    """Decode and validate a JWT token."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user(request: Request) -> dict:
    """FastAPI dependency — extracts user from Authorization header."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = auth_header.split(" ", 1)[1]
    return decode_token(token)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest):
    """
    Register a new organization + admin user.
    This is the entry point for new tenants.
    """
    with get_connection() as conn:
        # Check if email already exists
        existing = conn.execute(
            "SELECT id FROM users WHERE email = ?", (req.email,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        # Check if org name already exists
        existing_org = conn.execute(
            "SELECT id FROM organizations WHERE name = ?", (req.org_name,)
        ).fetchone()
        if existing_org:
            raise HTTPException(status_code=409, detail="Organization name already taken")

        # Create organization
        conn.execute("""
            INSERT INTO organizations (name, segment, size, website, about_us)
            VALUES (?, ?, ?, ?, ?)
        """, (req.org_name, req.segment, req.size, req.website, req.about_us))

        org_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

        # Create admin user
        password_hash = _hash_password(req.password)
        conn.execute("""
            INSERT INTO users (org_id, email, password_hash, role, name)
            VALUES (?, ?, ?, 'admin', ?)
        """, (org_id, req.email, password_hash, req.name))

        user_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

    token = _create_token(user_id, org_id, "admin", req.email, req.name)
    return AuthResponse(
        token=token,
        user={
            "id": user_id,
            "org_id": org_id,
            "email": req.email,
            "name": req.name,
            "role": "admin",
            "org_name": req.org_name,
        }
    )


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    """
    Login with email + password. Returns JWT token.
    """
    with get_connection() as conn:
        user = conn.execute("""
            SELECT u.*, o.name as org_name
            FROM users u
            JOIN organizations o ON u.org_id = o.id
            WHERE u.email = ? AND u.is_active = 1
        """, (req.email,)).fetchone()

        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        if not _check_password(req.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")

    token = _create_token(user["id"], user["org_id"], user["role"], user["email"], user["name"])
    return AuthResponse(
        token=token,
        user={
            "id": user["id"],
            "org_id": user["org_id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "org_name": user["org_name"],
        }
    )


@router.post("/add-user")
async def add_user(req: AddUserRequest, current_user: dict = Depends(get_current_user)):
    """
    Admin-only: Add a new recruiter or hiring_manager to the org.
    """
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can add users")

    with get_connection() as conn:
        existing = conn.execute(
            "SELECT id FROM users WHERE email = ?", (req.email,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        password_hash = _hash_password(req.password)
        conn.execute("""
            INSERT INTO users (org_id, email, password_hash, role, name)
            VALUES (?, ?, ?, ?, ?)
        """, (current_user["org_id"], req.email, password_hash, req.role, req.name))

        user_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

    return {
        "success": True,
        "user": {
            "id": user_id,
            "email": req.email,
            "name": req.name,
            "role": req.role,
        }
    }


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return the current user's profile."""
    with get_connection() as conn:
        user = conn.execute("""
            SELECT u.id, u.email, u.name, u.role, u.org_id, o.name as org_name
            FROM users u
            JOIN organizations o ON u.org_id = o.id
            WHERE u.id = ?
        """, (current_user["sub"],)).fetchone()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

    return dict(user)

@router.get("/users")
async def get_org_users(current_user: dict = Depends(get_current_user)):
    """Return all users for the given organization."""
    with get_connection() as conn:
        users = conn.execute("""
            SELECT id, email, name, role
            FROM users
            WHERE org_id = ? AND is_active = 1
        """, (current_user["org_id"],)).fetchall()
    return {"users": [dict(u) for u in users]}

