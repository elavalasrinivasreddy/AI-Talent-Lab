"""
adapters/billing/simulation.py – Simulation billing adapter.

Default in dev and until Razorpay KYC clears. Every "payment" succeeds instantly
and is logged so the full flow — checkout → invoice row → plan assignment — works
end-to-end with no external account. Generates deterministic-looking refs so logs
and tests are readable.
"""
import logging
import secrets
from typing import Optional

from backend.adapters.billing.base import (
    BillingProvider,
    CheckoutSession,
    PaymentResult,
)

logger = logging.getLogger(__name__)


class SimulationBilling(BillingProvider):
    name = "simulation"

    async def create_checkout(
        self, org_id: int, plan: str, amount: float, currency: str = "INR"
    ) -> CheckoutSession:
        ref = f"sim_order_{org_id}_{secrets.token_hex(6)}"
        logger.info(
            "--- BILLING SIMULATION (checkout) ---------------------\n"
            "  Org: %s · Plan: %s · Amount: %s %s · Ref: %s",
            org_id, plan, amount, currency, ref,
        )
        return CheckoutSession(
            provider=self.name,
            provider_ref=ref,
            amount=amount,
            currency=currency,
            checkout_url=None,   # nothing to redirect to in simulation
            status="created",
        )

    async def confirm_payment(self, provider_ref: str, payload: Optional[dict] = None) -> PaymentResult:
        logger.info("--- BILLING SIMULATION (confirm) · Ref: %s · → paid", provider_ref)
        return PaymentResult(provider_ref=provider_ref, status="paid", paid=True)

    def verify_webhook(self, body: bytes, signature: Optional[str]) -> bool:
        # No signing secret in simulation — accept everything.
        return True
