from typing import Optional
from backend.adapters.enrichment.base import BaseEnrichmentAdapter

class SimulationEnrichmentAdapter(BaseEnrichmentAdapter):
    """Stub adapter for enrichment that generates fake emails."""
    
    async def enrich_profile(self, name: str, company: Optional[str] = None, profile_url: Optional[str] = None) -> dict:
        """Return a simulated email based on the candidate's name."""
        import uuid
        
        # Strip spaces and non-alphanumeric
        clean_name = ''.join(e for e in name if e.isalnum()) or f"candidate_{str(uuid.uuid4())[:8]}"
        domain = "example.com"
        
        if company:
            clean_company = ''.join(e for e in company if e.isalnum())
            if clean_company:
                domain = f"{clean_company.lower()}.com"
                
        email = f"{clean_name.lower()}@{domain}"
        
        return {
            "email": email
        }
