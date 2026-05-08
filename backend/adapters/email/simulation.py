"""
adapters/email/simulation.py – Simulation email adapter (logs only).
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
        logger.info("--- EMAIL SIMULATION ---")
        logger.info(f"From: {from_name} <{from_email}>")
        logger.info(f"To: {to_email}")
        logger.info(f"Subject: {subject}")
        logger.info(f"Body (HTML): {body_html[:100]}...")
        logger.info("--- END SIMULATION ---")
        return True
