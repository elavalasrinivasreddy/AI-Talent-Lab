"""
adapters/candidate_sources/base.py – CandidateSourceAdapter ABC
All sourcing adapters must implement this interface.
"""
from abc import ABC, abstractmethod
from typing import Any


class CandidateSourceAdapter(ABC):
    """
    Abstract base class for all candidate sourcing adapters.
    Adapters produce a list of raw candidate dicts that the pipeline
    service normalises, deduplicates, and scores.
    """

    @abstractmethod
    async def search(self, position: dict, org: dict, limit: int = 50) -> list[dict]:
        """
        Search for candidates matching the position.

        Args:
            position: Position record from DB (role_name, skills, experience, etc.)
            org:      Organization record (name, industry, competitors, etc.)
            limit:    Max candidates to return per run.

        Returns:
            List of raw candidate dicts with at minimum:
            {
                "name": str,
                "email": str,          # must be unique per org for dedup
                "phone": str | None,
                "current_title": str | None,
                "current_company": str | None,
                "experience_years": int | None,
                "location": str | None,
                "source": str,         # adapter identifier
                "source_profile_url": str | None,
                "resume_text": str | None,
            }
        """
        pass
