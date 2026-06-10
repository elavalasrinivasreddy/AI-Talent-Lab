"""Candidate source adapters — simulation, tavily, LinkedIn, Naukri"""
"""
adapters/candidate_sources/__init__.py
Factory for selecting the right candidate source adapter from env config.
"""
from backend.config import settings
from backend.adapters.candidate_sources.base import CandidateSourceAdapter
from backend.adapters.candidate_sources.simulation import SimulationAdapter


def get_candidate_source_adapter(adapter_name: str | None = None) -> CandidateSourceAdapter:
    """
    Return the candidate source adapter.

    Selection precedence:
      1. explicit `adapter_name` (resolved per-org from the Sourcing settings tab)
      2. settings.DEFAULT_SOURCE_ADAPTER (env default — 'tavily' in prod, 'simulation' in dev)
      3. legacy settings.CANDIDATE_SOURCE_ADAPTER
    """
    adapter_name = (
        adapter_name
        or getattr(settings, "DEFAULT_SOURCE_ADAPTER", None)
        or settings.CANDIDATE_SOURCE_ADAPTER
    )
    if adapter_name == "tavily":
        from backend.adapters.candidate_sources.tavily import TavilyAdapter
        return TavilyAdapter()
    if adapter_name == "simulation":
        return SimulationAdapter()
    # Future: linkedin, naukri.
    # Fallback to simulation so the pipeline never hard-crashes on a bad config value.
    return SimulationAdapter()
