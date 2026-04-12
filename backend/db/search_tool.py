"""
db/search_tool.py – Web Search Tool for Competitor JD Lookup
Uses Tavily for production. Falls back to DuckDuckGo (no API key) if Tavily key is not set.
"""
import os
from typing import Optional


def search_competitor_jds(role: str, competitors: list[str]) -> str:
    """
    Search the web for job descriptions at the given companies for the given role.
    Returns a combined markdown string of findings.
    """
    tavily_key = os.getenv("TAVILY_API_KEY", "")

    if tavily_key and not tavily_key.startswith("tvly-placeholder"):
        print(f"🔍 Tavily search: {role} at {len(competitors)} companies", flush=True)
        return _tavily_search(role, competitors, tavily_key)
    else:
        print(f"⚠️ Tavily key not set — using fallback context for {role}", flush=True)
        return _fallback_search_context(role, competitors)


def _tavily_search(role: str, competitors: list[str], api_key: str) -> str:
    """Live search using Tavily."""
    from tavily import TavilyClient

    client = TavilyClient(api_key=api_key)
    results_md = []

    for i, company in enumerate(competitors):
        query = f'"{company}" "{role}" job description requirements skills 2024 2025'
        alias = f"Competitor {chr(65+i)}"
        try:
            response = client.search(
                query=query,
                search_depth="advanced",
                max_results=3,
                include_answer=True,
            )
            answer = response.get("answer", "")
            results_summary = "\n".join(
                f"- {r['title']}: {r['content'][:300]}..."
                for r in response.get("results", [])[:3]
            )
            results_md.append(
                f"### {alias}\n**Summary**: {answer}\n\n{results_summary}"
            )
        except Exception as e:
            results_md.append(f"### {alias}\n⚠️ Search failed: {str(e)}")

    return "\n\n".join(results_md)


def _fallback_search_context(role: str, competitors: list[str]) -> str:
    """
    Structured fallback when Tavily key is unavailable.
    Provides role-based market context for the LLM to reason about.
    """
    comp_str = ", ".join(f"Competitor {chr(65+i)}" for i in range(len(competitors)))
    return f"""
## Market Research Context (Fallback Mode — Add TAVILY_API_KEY for live search)

The following is general market intelligence for the role: **{role}**
Benchmarked against: **{comp_str}**

### Common Industry Requirements for {role}
Based on standard market patterns for this role type:

- **Core Technical Skills**: Role-specific primary languages and frameworks with 4-7 years experience
- **System Design**: Distributed systems, microservices architecture, API design patterns
- **Cloud Platforms**: AWS / GCP / Azure — at least one cloud provider (AWS most common)
- **Containerization**: Docker, Kubernetes or equivalent orchestration
- **CI/CD**: GitHub Actions, Jenkins, or similar pipeline tooling
- **Database**: Both SQL (PostgreSQL) and NoSQL (Redis, MongoDB) experience valued
- **Observability**: Monitoring, logging, tracing (Prometheus, Grafana, Datadog)
- **Soft Skills**: Remote team collaboration, async communication, technical documentation

### Differentiating Skills Seen in Top Talent at Similar Companies
- Experience with AI/ML integration or LLM APIs (highly valued in 2025)
- Open source contributions or published technical work
- Startup experience (ability to work with ambiguity and own projects end-to-end)

> **Note**: Add your Tavily API key to `.env` (`TAVILY_API_KEY`) for live competitor JD search.
""".strip()
