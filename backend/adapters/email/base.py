"""
adapters/email/base.py – Abstract base class for email providers.
"""
from abc import ABC, abstractmethod
from typing import Optional


class EmailProvider(ABC):
    @abstractmethod
    async def send_email(
        self,
        to_email: str,
        subject: str,
        body_html: str,
        body_text: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
    ) -> bool:
        pass
