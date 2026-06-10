from abc import ABC, abstractmethod
from typing import Optional

class BaseEnrichmentAdapter(ABC):
    """Base interface for candidate data enrichment."""
    
    @abstractmethod
    async def enrich_profile(self, name: str, company: Optional[str] = None, profile_url: Optional[str] = None) -> dict:
        """
        Enrich a candidate profile to find missing data (like email).
        Should return a dictionary with discovered fields, e.g. {"email": "found@email.com"}
        """
        pass
