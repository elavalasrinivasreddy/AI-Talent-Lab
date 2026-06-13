"""
config.py – Pydantic BaseSettings for all environment variables.
Validates on startup. App fails if JWT_SECRET is not set.
See docs/architecture/03_backend.md §10.
"""
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional


class Settings(BaseSettings):
    """Application settings — loaded from .env file or environment variables."""

    # ── App ────────────────────────────────────────────────────────────────
    APP_VERSION: str = "1.0.0"
    FRONTEND_URL: str = "http://localhost:5173"
    MAGIC_LINK_BASE_URL: str = "http://localhost:5173"
    DEBUG: bool = False
    DEV_MODE: bool = False  # Fail-safe: /dev/* endpoints OFF unless DEV_MODE=true is explicitly set in .env
    ENVIRONMENT: str = "development"  # development | staging | production (Sentry env tag)
    SENTRY_DSN: str = ""  # Set in prod to enable backend error monitoring; empty = disabled

    # ── Database ───────────────────────────────────────────────────────────
    DATABASE_URL: str
    # Non-superuser role provisioned by migrations for RLS enforcement.
    # Set APP_DATABASE_URL to a talentlab_app DSN to activate RLS on request traffic.
    # When unset, both pools use DATABASE_URL (superuser — policies are inert).
    APP_DB_ROLE: str = "talentlab_app"
    APP_DB_PASSWORD: str
    APP_DATABASE_URL: Optional[str] = None  # e.g. postgresql://talentlab_app:pw@localhost:5432/talentlab_dev

    # ── Redis ──────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── DB Pool Config ─────────────────────────────────────────────────────
    DB_POOL_MIN: int = 2
    DB_POOL_MAX: int = 20

    # ── Auth ───────────────────────────────────────────────────────────────
    JWT_SECRET: str  # REQUIRED — no default, app fails without it
    JWT_EXPIRY_HOURS: int = 24

    # ── LLM ────────────────────────────────────────────────────────────────
    LLM_PROVIDER: str = "groq"
    LLM_MODEL: str = "llama-3.3-70b-versatile"
    EMBEDDING_PROVIDER: str = "openai"
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_API_KEY: str = ""
    WEB_SEARCH_PROVIDER: str = "tavily"
    BRAVE_API_KEY: str = ""
    SERPAPI_API_KEY: str = ""
    EXA_API_KEY: str = ""
    ENRICHMENT_PROVIDER: str = "proxycurl"
    PROXYCURL_API_KEY: str = ""
    APOLLO_API_KEY: str = ""
    HUNTER_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    # LLM cost tracking (USD per 1M tokens, configurable per provider)
    # Defaults match Groq llama-3.3-70b-versatile pricing (2026-06)
    # Override in .env: LLM_PRICE_INPUT_PER_MTOK=0.59 LLM_PRICE_OUTPUT_PER_MTOK=0.79
    LLM_PRICE_INPUT_PER_MTOK: float = 0.59
    LLM_PRICE_OUTPUT_PER_MTOK: float = 0.79

    # ── Web Search ─────────────────────────────────────────────────────────
    TAVILY_API_KEY: str = ""

    # ── Email ──────────────────────────────────────────────────────────────
    EMAIL_PROVIDER: str = "simulation"
    RESEND_API_KEY: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "hiring@aitalentlab.com"
    FROM_NAME: str = "AI Talent Lab"

    # ── Billing (SaaS layer, Sprint 2 / F2) ────────────────────────────────
    # Adapter pattern mirrors email: "simulation" works end-to-end with no
    # account; switch to "razorpay" once KYC clears and keys are set.
    BILLING_PROVIDER: str = "simulation"
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    # ── Candidate Sourcing ─────────────────────────────────────────────────
    CANDIDATE_SOURCE_ADAPTER: str = "simulation"  # legacy global fallback
    # Default adapter when an org hasn't set one in Settings → Sourcing.
    # Set to "tavily" in production .env; "simulation" is dev-only.
    DEFAULT_SOURCE_ADAPTER: str = "simulation"

    # ── Local file uploads (E7) ────────────────────────────────────────────
    # Serves the local ./uploads dir as static files at /uploads. Fine for dev,
    # but in production this exposes user-uploaded resumes/videos as
    # unauthenticated static files. Set SERVE_LOCAL_UPLOADS=false in prod and
    # move uploads to object storage (S3/GCS + signed URLs) before pilots upload
    # real resumes. See docs/architecture/uploads.md.
    SERVE_LOCAL_UPLOADS: bool = True

    # ── Magic Link Expiry ──────────────────────────────────────────────────
    APPLY_LINK_EXPIRY_HOURS: int = 72
    PANEL_LINK_EXPIRY_HOURS: int = 168
    RESET_LINK_EXPIRY_HOURS: int = 24

    # ── Encryption ─────────────────────────────────────────────────────────
    ENCRYPTION_KEY: str = ""

    # ── Celery ─────────────────────────────────────────────────────────────
    CELERY_BROKER_URL: str = ""

    @field_validator("JWT_SECRET")
    @classmethod
    def jwt_secret_must_be_set(cls, v: str) -> str:
        if not v or v == "CHANGE_ME_generate_with_secrets_token_urlsafe_48":
            raise ValueError(
                "JWT_SECRET must be set to a strong random string. "
                "Generate with: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )
        return v

    @property
    def celery_broker(self) -> str:
        """Return Celery broker URL, defaulting to REDIS_URL."""
        return self.CELERY_BROKER_URL or self.REDIS_URL

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


# Singleton — fails on import if JWT_SECRET missing
settings = Settings()
