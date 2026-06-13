"""
adapters/billing/razorpay.py – Razorpay billing adapter (activates with keys).

Kept deliberately thin and dependency-light: the `razorpay` SDK is imported
lazily so the module loads fine without it (simulation stays the default until
BILLING_PROVIDER=razorpay + RAZORPAY_KEY_ID/SECRET are set). Webhook verification
uses HMAC-SHA256 over the raw body with RAZORPAY_WEBHOOK_SECRET, which needs no
SDK.

Until Razorpay KYC clears, this path is exercised only by config wiring; the
simulation adapter carries the live behaviour. See docs/TODO.md "Blocked" table —
start KYC now, it takes days.
"""
import hashlib
import hmac
import logging
from typing import Optional

from backend.adapters.billing.base import (
    BillingProvider,
    CheckoutSession,
    PaymentResult,
)
from backend.exceptions import BillingError

logger = logging.getLogger(__name__)


class RazorpayBilling(BillingProvider):
    name = "razorpay"

    def __init__(self, key_id: str = "", key_secret: str = "", webhook_secret: str = ""):
        self.key_id = key_id
        self.key_secret = key_secret
        self.webhook_secret = webhook_secret
        self._client = None

    def _get_client(self):
        if self._client is not None:
            return self._client
        if not (self.key_id and self.key_secret):
            raise BillingError("Razorpay keys not configured")
        try:
            import razorpay  # lazy — only needed on the live path
        except ImportError as exc:  # pragma: no cover - depends on optional dep
            raise BillingError("razorpay SDK not installed") from exc
        self._client = razorpay.Client(auth=(self.key_id, self.key_secret))
        return self._client

    async def create_checkout(
        self, org_id: int, plan: str, amount: float, currency: str = "INR"
    ) -> CheckoutSession:
        client = self._get_client()
        # Razorpay amounts are in the smallest currency unit (paise for INR).
        order = client.order.create({
            "amount": int(round(amount * 100)),
            "currency": currency,
            "notes": {"org_id": str(org_id), "plan": plan},
        })
        return CheckoutSession(
            provider=self.name,
            provider_ref=order["id"],
            amount=amount,
            currency=currency,
            checkout_url=None,  # Razorpay Checkout is rendered client-side with the order id
            status=order.get("status", "created"),
        )

    async def confirm_payment(self, provider_ref: str, payload: Optional[dict] = None) -> PaymentResult:
        client = self._get_client()
        order = client.order.fetch(provider_ref)
        paid = order.get("status") == "paid"
        return PaymentResult(
            provider_ref=provider_ref,
            status="paid" if paid else "failed",
            paid=paid,
        )

    def verify_webhook(self, body: bytes, signature: Optional[str]) -> bool:
        if not (self.webhook_secret and signature):
            return False
        expected = hmac.new(
            self.webhook_secret.encode(), body, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
