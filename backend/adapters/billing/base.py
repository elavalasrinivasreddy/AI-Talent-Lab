"""
adapters/billing/base.py – Abstract base class for billing providers.

Mirrors the email-adapter pattern (adapters/email/base.py): one ABC, swappable
implementations selected by config. ``SimulationBilling`` works end-to-end today;
``RazorpayBilling`` activates when BILLING_PROVIDER=razorpay + keys are set.

The adapter only talks to the payment provider. Persisting invoice rows and
assigning the org's plan is the service's job (services/billing_service.py), so
the simulation and live paths share identical bookkeeping.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class CheckoutSession:
    """Provider-agnostic result of starting a subscription/checkout."""
    provider: str
    provider_ref: str          # order/subscription id from the provider
    amount: float
    currency: str
    checkout_url: Optional[str] = None  # where to send the buyer (None in sim)
    status: str = "created"


@dataclass
class PaymentResult:
    """Outcome of confirming/capturing a payment."""
    provider_ref: str
    status: str                # "paid" | "failed"
    paid: bool


class BillingProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def create_checkout(
        self,
        org_id: int,
        plan: str,
        amount: float,
        currency: str = "INR",
    ) -> CheckoutSession:
        """Start a checkout/subscription for a plan. Returns a CheckoutSession."""

    @abstractmethod
    async def confirm_payment(self, provider_ref: str, payload: Optional[dict] = None) -> PaymentResult:
        """Confirm/capture a payment (or process a webhook). Returns a PaymentResult."""

    @abstractmethod
    def verify_webhook(self, body: bytes, signature: Optional[str]) -> bool:
        """Verify a provider webhook signature. Simulation trusts all; live checks HMAC."""
