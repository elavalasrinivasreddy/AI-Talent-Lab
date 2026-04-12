"""
config.py – LLM provider configuration
Switching providers = change LLM_PROVIDER in .env
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load from root .env
ROOT_ENV = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ROOT_ENV)

# ── Active provider ────────────────────────────────────────────────────────────
LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "groq").lower()
DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

# ── Groq ───────────────────────────────────────────────────────────────────────
GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "").strip().strip('"').strip("'")
GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama3-8b-8192")

# ── OpenAI ─────────────────────────────────────────────────────────────────────
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "").strip().strip('"').strip("'")
OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o")

# ── Google Gemini ──────────────────────────────────────────────────────────────
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "").strip().strip('"').strip("'")
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-pro")

# ── App ────────────────────────────────────────────────────────────────────────
BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", 8000))
FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

# ── Mock user (phase-1) ────────────────────────────────────────────────────────
USER_NAME: str = os.getenv("USER_NAME", "Admin")
USER_EMAIL: str = os.getenv("USER_EMAIL", "admin@aitalentlab.com")

def get_llm(streaming: bool = False):
    """
    Returns the configured LangChain LLM instance.
    To switch provider: set LLM_PROVIDER env var.
    """
    if LLM_PROVIDER == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=OPENAI_MODEL,
            api_key=OPENAI_API_KEY,
            streaming=streaming,
            temperature=0.7,
        )
    elif LLM_PROVIDER == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=GEMINI_MODEL,
            google_api_key=GEMINI_API_KEY,
            streaming=streaming,
            temperature=0.7,
        )
    else:  # Default: groq
        from langchain_groq import ChatGroq
        # model = ChatGroq(
        #     model="openai/gpt-oss-120b",
        #     api_key="your_groq_api_key_here",
        # )
        model = ChatGroq(
            model = GROQ_MODEL,
            api_key = GROQ_API_KEY,
            streaming=streaming,
            temperature=0.5,
        )
        return model
