"""
adapters/email/resend.py – Resend API email adapter.
"""
import logging
import httpx
from typing import Optional
from backend.adapters.email.base import EmailProvider
from backend.config import settings

logger = logging.getLogger(__name__)


class ResendProvider(EmailProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.url = "https://api.resend.com/emails"

    async def send_email(
        self,
        to_email: str,
        subject: str,
        body_html: str,
        body_text: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
    ) -> bool:
        if not self.api_key:
            logger.warning("Resend API key missing — skipping email")
            return False

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        
        sender = f"{from_name or settings.FROM_NAME} <{from_email or settings.FROM_EMAIL}>"
        
        payload = {
            "from": sender,
            "to": [to_email],
            "subject": subject,
            "html": body_html,
        }
        if body_text:
            payload["text"] = body_text

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(self.url, headers=headers, json=payload)
                resp.raise_for_status()
                logger.info(f"Email sent via Resend to {to_email}")
                return True
        except Exception as e:
            logger.error(f"Resend email failed: {e}")
            return False
