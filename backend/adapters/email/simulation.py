"""
adapters/email/simulation.py – Simulation email adapter.

Logs every send to the application log so developers can copy magic-link URLs
out of the terminal during development. Logs both the plain-text body (which
typically contains the actionable URL) and a short HTML preview, keeping noise
manageable while keeping the link reachable.
"""
import logging
from typing import Optional
from backend.adapters.email.base import EmailProvider

logger = logging.getLogger(__name__)


class SimulationProvider(EmailProvider):
    async def send_email(
        self,
        to_email: str,
        subject: str,
        body_html: str,
        body_text: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
    ) -> bool:
        logger.info("--- EMAIL SIMULATION -----------------------------------")
        logger.info("  From: %s <%s>", from_name or "", from_email or "")
        logger.info("  To:   %s", to_email)
        logger.info("  Subject: %s", subject)
        if body_text:
            for line in body_text.splitlines():
                logger.info("  | %s", line)
        else:
            logger.info("  (no plain-text body — html length=%d)", len(body_html))
        logger.info("--------------------------------------------------------")
        return True
