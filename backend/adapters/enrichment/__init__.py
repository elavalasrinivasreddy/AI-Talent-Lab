from .base import BaseEnrichmentAdapter
from .simulation import SimulationEnrichmentAdapter

def get_enrichment_adapter(provider_name: str) -> BaseEnrichmentAdapter:
    """Factory to get the configured enrichment adapter."""
    if provider_name.lower() == "simulation":
        return SimulationEnrichmentAdapter()
    
    # We can add Apollo, Hunter, Proxycurl etc. here in Phase 2
    return SimulationEnrichmentAdapter()
