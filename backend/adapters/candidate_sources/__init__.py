"""Candidate source adapters — simulation, tavily, LinkedIn, Naukri"""
"""
adapters/candidate_sources/__init__.py
Factory for selecting the right candidate source adapter from env config.
"""
from backend.config import settings
from backend.adapters.candidate_sources.base import CandidateSourceAdapter
from backend.adapters.candidate_sources.simulation import SimulationAdapter


def get_candidate_source_adapter() -> CandidateSourceAdapter:
    """Return the configured candidate source adapter."""
    adapter_name = settings.CANDIDATE_SOURCE_ADAPTER
    if adapter_name == "simulation":
        return SimulationAdapter()
    elif adapter_name == "tavily":
        from backend.adapters.candidate_sources.tavily import TavilyAdapter
        return TavilyAdapter()
    # Future: linkedin, naukri
    # Fallback to simulation so the pipeline never hard-crashes on a bad config value
    return SimulationAdapter()
