"""
adapters/email/resend.py – Resend API email adapter.
"""
import logging
import httpx
from typing import Optional
from backend.adapters.email.base import EmailProvider
from backend.config import settings

logger = logging.getLogger(__name__)

_RESEND_SANDBOX_SENDER = "onboarding@resend.dev"


def _normalize_gmail_recipient(email: str) -> str:
    """
    Strip Gmail's dot/plus aliasing so all dotted/plus-tagged variants of a
    single Gmail address resolve to the same canonical inbox.

    Gmail treats `a.b.c@gmail.com` and `abc+tag@gmail.com` as the same mailbox
    on its end. Resend (and most providers) do exact-string matching on the
    `to:` field, so on the free tier without a verified domain Resend rejects
    every variant that isn't the literal account-owner address.

    Used only when sending from Resend's sandbox sender. With a verified domain
    in production we pass through untouched.
    """
    local, _, domain = email.partition("@")
    if domain.lower() not in {"gmail.com", "googlemail.com"}:
        return email
    local = local.split("+", 1)[0].replace(".", "")
    return f"{local}@{domain.lower()}"


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

        sender_addr = from_email or settings.FROM_EMAIL
        sender = f"{from_name or settings.FROM_NAME} <{sender_addr}>"

        # On Resend's sandbox sender, every recipient must equal the verified
        # account-owner address. Collapse Gmail aliases so per-role dotted
        # addresses (head@, dept.admin@, etc.) all reach the one verified inbox.
        canonical_to = (
            _normalize_gmail_recipient(to_email)
            if sender_addr == _RESEND_SANDBOX_SENDER
            else to_email
        )

        payload = {
            "from": sender,
            "to": [canonical_to],
            "subject": subject,
            "html": body_html,
        }
        if body_text:
            payload["text"] = body_text

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(self.url, headers=headers, json=payload)
            if resp.status_code >= 400:
                logger.error(
                    "Resend rejected email to %s (canonical=%s): HTTP %s — %s",
                    to_email, canonical_to, resp.status_code, resp.text,
                )
                return False
            logger.info(
                "Email sent via Resend to %s%s",
                to_email,
                f" (canonical={canonical_to})" if canonical_to != to_email else "",
            )
            return True
        except Exception as e:
            logger.exception("Resend transport error to %s: %s", to_email, e)
            return False
