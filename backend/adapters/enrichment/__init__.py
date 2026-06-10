import logging
from typing import Optional

from .base import BaseEnrichmentAdapter
from .simulation import SimulationEnrichmentAdapter

logger = logging.getLogger(__name__)


def get_enrichment_adapter(provider_name: str) -> Optional[BaseEnrichmentAdapter]:
    """
    Factory to get the configured enrichment adapter.

    Returns None for real providers that are not yet implemented (Apollo, Hunter,
    Proxycurl). This is deliberate: the simulation adapter FABRICATES emails, which
    is only safe in development. Returning None for unimplemented providers prevents
    production from inventing-and-emailing addresses (spam/deliverability risk).
    """
    name = (provider_name or "").lower()
    if name == "simulation":
        return SimulationEnrichmentAdapter()

    # Real providers — not implemented yet. Do NOT fall back to simulation in prod.
    logger.warning(
        "Enrichment provider '%s' is not implemented; skipping enrichment "
        "(candidate kept as a no-contact lead).", provider_name,
    )
    return None
