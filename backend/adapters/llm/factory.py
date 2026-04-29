"""
adapters/llm/factory.py – LLM factory with per-agent temperature tuning.
Returns the correct LLM based on LLM_PROVIDER env var.
Supports: groq, openai, gemini.
See docs/BACKEND_PLAN.md §6, §15.
"""
import logging
from typing import Optional

from backend.config import settings

logger = logging.getLogger(__name__)


def get_llm(
    temperature: float = 0.7,
    streaming: bool = False,
    max_tokens: Optional[int] = None,
    model: Optional[str] = None,
):
    """
    Return a LangChain chat model based on LLM_PROVIDER env var.

    Args:
        temperature: Per-node temperature override (0.0 = deterministic, 1.0 = creative).
        streaming: Enable token-by-token streaming.
        max_tokens: Optional max output tokens.
        model: Optional model name override.

    Returns:
        A LangChain BaseChatModel instance.
    """
    provider = settings.LLM_PROVIDER.lower()

    common_kwargs = {
        "temperature": temperature,
        "streaming": streaming,
    }
    if max_tokens:
        common_kwargs["max_tokens"] = max_tokens

    if provider == "groq":
        from langchain_groq import ChatGroq

        return ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model_name=model or "llama-3.3-70b-versatile",
            **common_kwargs,
        )

    elif provider == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            api_key=settings.OPENAI_API_KEY,
            model=model or "gpt-4o-mini",
            **common_kwargs,
        )

    elif provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            google_api_key=settings.GEMINI_API_KEY,
            model=model or "gemini-2.0-flash",
            **common_kwargs,
        )

    else:
        raise ValueError(
            f"Unsupported LLM_PROVIDER: '{provider}'. "
            "Must be one of: groq, openai, gemini."
        )


def get_embedding_model():
    """
    Return a LangChain embedding model for JD/resume embeddings.
    Uses the same provider as the chat model.
    """
    provider = settings.LLM_PROVIDER.lower()

    if provider == "groq":
        # Groq doesn't have its own embedding model — use OpenAI or fallback
        # If OPENAI_API_KEY is set, use OpenAI embeddings; else use HuggingFace
        if settings.OPENAI_API_KEY:
            from langchain_openai import OpenAIEmbeddings

            return OpenAIEmbeddings(
                api_key=settings.OPENAI_API_KEY,
                model="text-embedding-3-small",
            )
        else:
            # Fallback: use a local sentence-transformer via chromadb default
            logger.warning(
                "Groq has no embedding model. Set OPENAI_API_KEY for embeddings, "
                "or ChromaDB will use its default embedding function."
            )
            return None

    elif provider == "openai":
        from langchain_openai import OpenAIEmbeddings

        return OpenAIEmbeddings(
            api_key=settings.OPENAI_API_KEY,
            model="text-embedding-3-small",
        )

    elif provider == "gemini":
        from langchain_google_genai import GoogleGenerativeAIEmbeddings

        return GoogleGenerativeAIEmbeddings(
            google_api_key=settings.GEMINI_API_KEY,
            model="models/text-embedding-004",
        )

    else:
        raise ValueError(
            f"Unsupported LLM_PROVIDER for embeddings: '{provider}'."
        )
