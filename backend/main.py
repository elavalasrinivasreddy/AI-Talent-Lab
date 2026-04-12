"""
main.py – FastAPI application entry point
"""
import json,os
import sys
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from backend.config import FRONTEND_URL, DEBUG
from backend.routers import chat, jd, auth, candidates, apply, dashboard, notifications

app = FastAPI(
    title="AI Talent Lab API",
    description="AI-powered hiring assistant backend",
    version="1.0.0",
)

# ── Detailed Error Logging ──────────────────────────────────────────────────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    try:
        body = await request.json()
    except:
        body = await request.body()
    print(f"❌ Validation Error: {request.method} {request.url}", file=sys.stderr)
    print(f"  Errors: {exc.errors()}", file=sys.stderr)
    print(f"  Body: {body}", file=sys.stderr)
    return JSONResponse(
        status_code=400,
        content={"detail": exc.errors(), "body": str(body)},
    )

@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"DEBUG: {request.method} {request.url}")
    response = await call_next(request)
    print(f"DEBUG Response: {response.status_code}")
    return response

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permissive for debugging
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(jd.router)
app.include_router(candidates.router)
app.include_router(apply.router)
app.include_router(dashboard.router)
app.include_router(notifications.router)


@app.get("/")
async def health():
    return {
        "status": "ok",
        "app": "AI Talent Lab API",
        "version": "1.0.0",
        "debug": DEBUG,
        "llm_provider": os.getenv("LLM_PROVIDER", "unknown")
    }
