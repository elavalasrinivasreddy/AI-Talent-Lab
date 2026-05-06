"""
config.py – Pydantic BaseSettings for all environment variables.
Validates on startup. App fails if JWT_SECRET is not set.
See docs/BACKEND_PLAN.md §10.
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
    DEV_MODE: bool = True  # Set to False in production — disables /dev/* endpoints

    # ── Database ───────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql://talentlab:talentlab@localhost:5432/talentlab_dev"

    # ── Redis ──────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── Auth ───────────────────────────────────────────────────────────────
    JWT_SECRET: str  # REQUIRED — no default, app fails without it
    JWT_EXPIRY_HOURS: int = 24

    # ── LLM ────────────────────────────────────────────────────────────────
    LLM_PROVIDER: str = "groq"
    GROQ_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""

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

    # ── Candidate Sourcing ─────────────────────────────────────────────────
    CANDIDATE_SOURCE_ADAPTER: str = "simulation"

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
