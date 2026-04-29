"""
agents/tools/search.py – Tavily API wrapper for market intelligence.
Used by market_intelligence node to search for competitor JDs.
Handles errors gracefully — raises SearchError for caller to handle soft skip.
"""
import logging
from typing import Optional

from backend.config import settings

logger = logging.getLogger(__name__)


class SearchError(Exception):
    """Raised when Tavily search fails. Caller handles soft skip."""
    pass


async def tavily_search(
    query: str,
    max_results: int = 5,
    search_depth: str = "basic",
    include_domains: Optional[list[str]] = None,
) -> list[dict]:
    """
    Search the web using Tavily API.

    Args:
        query: Search query string (e.g., "Senior Python Developer job description Google")
        max_results: Maximum number of results to return.
        search_depth: "basic" (fast) or "advanced" (deeper, more expensive).
        include_domains: Optional list of domains to restrict search to.

    Returns:
        List of dicts with keys: title, url, content, score.

    Raises:
        SearchError: On any Tavily API failure (caller handles soft skip).
    """
    if not settings.TAVILY_API_KEY:
        raise SearchError("TAVILY_API_KEY not configured. Market research skipped.")

    try:
        from tavily import TavilyClient

        client = TavilyClient(api_key=settings.TAVILY_API_KEY)

        search_kwargs = {
            "query": query,
            "max_results": max_results,
            "search_depth": search_depth,
        }
        if include_domains:
            search_kwargs["include_domains"] = include_domains

        response = client.search(**search_kwargs)

        results = []
        for item in response.get("results", []):
            results.append({
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "content": item.get("content", ""),
                "score": item.get("score", 0.0),
            })

        logger.info(f"Tavily search returned {len(results)} results for: {query[:80]}")
        return results

    except ImportError:
        raise SearchError("tavily-python package not installed.")
    except Exception as e:
        logger.error(f"Tavily search failed: {e}")
        raise SearchError(f"Web search failed: {str(e)}")


async def search_competitor_jds(
    role_name: str,
    competitor_names: list[str],
    max_results_per_competitor: int = 3,
) -> list[dict]:
    """
    Search for job descriptions from specific competitor companies.

    Args:
        role_name: The role to search for (e.g., "Senior Python Developer").
        competitor_names: List of competitor company names.
        max_results_per_competitor: Results per competitor.

    Returns:
        Aggregated list of search results with competitor attribution.

    Raises:
        SearchError: If all searches fail.
    """
    if not competitor_names:
        raise SearchError("No competitor companies configured.")

    all_results = []
    errors = []

    for competitor in competitor_names[:5]:  # Cap at 5 competitors
        try:
            query = f"{role_name} job description requirements {competitor}"
            results = await tavily_search(
                query=query,
                max_results=max_results_per_competitor,
            )
            for r in results:
                r["competitor"] = competitor
            all_results.extend(results)
        except SearchError as e:
            errors.append(f"{competitor}: {e}")
            logger.warning(f"Search failed for competitor {competitor}: {e}")
            continue

    if not all_results and errors:
        raise SearchError(f"All competitor searches failed: {'; '.join(errors)}")

    logger.info(
        f"Competitor JD search: {len(all_results)} results "
        f"from {len(competitor_names)} competitors"
    )
    return all_results
