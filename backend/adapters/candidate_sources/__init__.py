"""Candidate source adapters — simulation, LinkedIn, Naukri"""
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
    # Future: linkedin, naukri
    return SimulationAdapter()
