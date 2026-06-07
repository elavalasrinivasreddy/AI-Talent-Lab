"""
adapters/candidate_sources/tavily.py – TavilyAdapter
Real candidate sourcing via Tavily web search + LLM dossier extraction.

Steps:
  1. Build a profile-biased search query from the position.
  2. Call Tavily with that query.
  3. For each result ask the LLM to extract a candidate dossier (or null).
  4. Dedup by name+source_url, return up to `limit` records.

Known limitation (Phase 5): most web results don't carry an email address.
email is set to None, which means candidate_pipeline.py (line ~155) will
drop those rows. The email plumbing is deferred to Phase 5.
"""
import json
import logging
import re
from typing import Optional

from backend.adapters.candidate_sources.base import CandidateSourceAdapter
from backend.adapters.llm.factory import get_llm
from backend.agents.tools.search import tavily_search, SearchError

logger = logging.getLogger(__name__)

# Profile-page site filters — bias Tavily toward actual person pages
PROFILE_SITE_FILTER = (
    "(site:github.com OR site:linkedin.com/in OR site:medium.com "
    "OR site:dev.to OR site:stackoverflow.com/users OR site:twitter.com "
    "OR site:about.me OR site:xing.com/profile)"
)


def _build_query(position: dict) -> str:
    """Build a Tavily search query from a position record."""
    role = position.get("role_name") or "Software Engineer"
    location = position.get("location") or ""

    # Gather top 4 skills from skills_required (list or comma-string)
    raw_skills = position.get("skills_required") or []
    if isinstance(raw_skills, str):
        raw_skills = [s.strip() for s in raw_skills.split(",") if s.strip()]
    top_skills = raw_skills[:4]

    parts = [role]
    if location:
        parts.append(location)
    if top_skills:
        parts.append(" ".join(top_skills))
    parts.append("developer profile portfolio")
    parts.append(PROFILE_SITE_FILTER)

    return " ".join(parts)


def _parse_llm_json(content: str) -> Optional[dict]:
    """
    Parse the LLM response. Returns a dict if a valid dossier is present,
    None if the LLM signalled null / no person found.
    """
    text = content.strip()

    # Strip markdown fences
    if "```json" in text:
        text = text.split("```json")[-1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].strip()

    # Explicit null signal
    lower = text.lower()
    if lower in ("null", "none", "{}") or lower.startswith("null"):
        return None

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Try to extract the first {...} block
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if not m:
            return None
        try:
            data = json.loads(m.group(0))
        except json.JSONDecodeError:
            return None

    if not isinstance(data, dict) or not data.get("name"):
        return None
    return data


def _build_dossier_prompt(result: dict, role_name: str) -> str:
    return f"""You are a candidate sourcing assistant. Given the web search result below, extract a candidate dossier ONLY IF the result genuinely describes a real individual who could be a candidate for the role: {role_name}.

If the result is a job posting, a company page, a news article, a product page, or does not clearly describe a specific person, return exactly: null

Search result:
  title: {result.get('title', '')}
  url:   {result.get('url', '')}
  content: {result.get('content', '')[:800]}

If this IS a person's profile, return ONLY valid JSON (no markdown, no explanation):
{{
  "name": "Full Name",
  "headline": "Current job title / professional headline",
  "current_company": "Company name or null",
  "location": "City, Country or null",
  "summary": "2-3 sentence professional summary drawn strictly from the result",
  "source_url": "{result.get('url', '')}",
  "skill_tags": ["skill1", "skill2"]
}}

Return null if unsure. Do not fabricate details."""


class TavilyAdapter(CandidateSourceAdapter):
    """
    Candidate sourcing adapter backed by Tavily web search.

    For each open position it:
      - Builds a profile-biased search query (role + location + top skills).
      - Fetches web results via Tavily.
      - Asks an LLM to parse each result into a structured candidate dossier.
      - Deduplicates and returns up to `limit` normalised records.
    """

    async def search(self, position: dict, org: dict, limit: int = 10) -> list[dict]:
        role_name = position.get("role_name") or "Software Engineer"
        query = _build_query(position)

        logger.info(f"TavilyAdapter: searching for '{role_name}' — query: {query[:120]}")

        # Fetch results (2× limit so we have headroom after filtering)
        try:
            raw_results = await tavily_search(
                query=query,
                max_results=limit * 2,
                search_depth="advanced",
            )
        except SearchError as e:
            logger.error(f"TavilyAdapter: Tavily search failed: {e}")
            return []

        if not raw_results:
            logger.warning("TavilyAdapter: Tavily returned no results.")
            return []

        logger.info(f"TavilyAdapter: {len(raw_results)} raw results, extracting dossiers…")

        # LLM for structured extraction — use 8b-instant to avoid rate limits during parallel scraping
        llm = get_llm(model="llama-3.1-8b-instant", temperature=0.1, max_tokens=512)

        seen: set[tuple[str, str]] = set()
        candidates: list[dict] = []

        for result in raw_results:
            if len(candidates) >= limit:
                break

            prompt = _build_dossier_prompt(result, role_name)
            try:
                response = await llm.ainvoke([{"role": "user", "content": prompt}])
                dossier = _parse_llm_json(response.content)
            except Exception as e:
                logger.warning(f"TavilyAdapter: LLM extraction failed for {result.get('url')}: {e}")
                continue

            if dossier is None:
                logger.debug(f"TavilyAdapter: skipped (no person) — {result.get('url')}")
                continue

            name = (dossier.get("name") or "").strip()
            source_url = (dossier.get("source_url") or result.get("url") or "").strip()

            if not name:
                continue

            # Dedup by (name, source_url)
            dedup_key = (name.lower(), source_url.lower())
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            skill_tags = dossier.get("skill_tags") or []
            if isinstance(skill_tags, str):
                skill_tags = [s.strip() for s in skill_tags.split(",") if s.strip()]

            candidates.append({
                # ── Required by CandidateSourceAdapter contract ──────────
                "name": name,
                "email": None,              # Most web profiles don't expose email.
                                            # candidate_pipeline drops emailless rows.
                                            # Plumbing deferred to Phase 5.
                "phone": None,
                "current_title": dossier.get("headline"),
                "current_company": dossier.get("current_company"),
                "experience_years": None,   # Not reliably extractable from web snippets
                "location": dossier.get("location"),
                "source": "tavily_web",
                "source_profile_url": source_url or None,
                "resume_text": dossier.get("summary"),
                # ── Tavily-specific extras ───────────────────────────────
                "skill_tags": skill_tags,
                "headline": dossier.get("headline"),
                "summary": dossier.get("summary"),
            })

        logger.info(
            f"TavilyAdapter: returning {len(candidates)} candidates "
            f"(from {len(raw_results)} Tavily results)"
        )
        return candidates
