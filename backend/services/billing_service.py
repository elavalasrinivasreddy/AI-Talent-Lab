"""
services/billing_service.py – Billing business logic (provider-agnostic).

Picks the adapter per `settings.BILLING_PROVIDER` (simulation in dev, Razorpay in
prod), caches it, and owns all the bookkeeping the adapter does NOT do:
  • write/finalise invoice rows
  • assign the org's plan once a payment is confirmed

Mirrors services/email_service.py's factory so the two SaaS-layer adapters behave
the same way. Plan assignment is the only thing that changes quota enforcement,
so it lives in one place here.
"""
import logging
from datetime import date
from typing import Optional

import asyncpg

from backend.config import settings
from backend.adapters.billing.base import BillingProvider, CheckoutSession, PaymentResult
from backend.adapters.billing.simulation import SimulationBilling
from backend.adapters.billing.razorpay import RazorpayBilling
from backend.exceptions import BillingError, ValidationError
from backend.services import plans

logger = logging.getLogger(__name__)

_provider: Optional[BillingProvider] = None


def get_billing_provider() -> BillingProvider:
    """Return the configured billing provider, instantiated lazily and cached."""
    global _provider
    if _provider is not None:
        return _provider

    name = (settings.BILLING_PROVIDER or "simulation").strip().lower()
    if name == "razorpay":
        _provider = RazorpayBilling(
            key_id=settings.RAZORPAY_KEY_ID,
            key_secret=settings.RAZORPAY_KEY_SECRET,
            webhook_secret=settings.RAZORPAY_WEBHOOK_SECRET,
        )
    else:
        if name not in ("simulation", ""):
            logger.warning(f"Unknown BILLING_PROVIDER={name!r} — falling back to simulation")
        _provider = SimulationBilling()
    return _provider


def _reset_provider_cache():
    """Test hook — drop the cached provider so config changes take effect."""
    global _provider
    _provider = None


class BillingService:
    """Checkout → invoice → plan assignment, independent of the provider."""

    @staticmethod
    async def list_plans() -> list[dict]:
        return [
            {
                "plan": p,
                "label": plans.PLAN_LIMITS[p]["label"],
                "price_inr": plans.PLAN_PRICING_INR[p],
                "limits": {
                    k: v for k, v in plans.PLAN_LIMITS[p].items() if k != "label"
                },
            }
            for p in plans.VALID_PLANS
        ]

    @staticmethod
    async def start_checkout(conn: asyncpg.Connection, org_id: int, plan: str) -> dict:
        """Begin a subscription for ``plan``; records a 'created' invoice row."""
        # Validate BEFORE normalising — normalize silently defaults invalid inputs to
        # Starter, which would let a caller purchase any string as "starter" free plan.
        plan_key = str(plan or "").strip().lower()
        if plan_key not in plans.VALID_PLANS:
            raise ValidationError(f"Unknown plan: {plan_key!r}. Valid: {list(plans.VALID_PLANS)}")
        plan = plan_key

        amount = float(plans.PLAN_PRICING_INR[plan])
        provider = get_billing_provider()
        session: CheckoutSession = await provider.create_checkout(
            org_id=org_id, plan=plan, amount=amount, currency="INR"
        )

        today = date.today()
        invoice = await conn.fetchrow(
            """
            INSERT INTO invoices (org_id, plan, amount, currency, status, provider,
                                  provider_ref, period_start)
            VALUES ($1, $2, $3, $4, 'created', $5, $6, $7)
            RETURNING id, org_id, plan, amount, currency, status, provider, provider_ref, created_at
            """,
            org_id, plan, amount, session.currency, session.provider,
            session.provider_ref, today,
        )
        return {
            "invoice": dict(invoice),
            "checkout_url": session.checkout_url,
            "provider": session.provider,
            "provider_ref": session.provider_ref,
            "amount": amount,
            "currency": session.currency,
        }

    @staticmethod
    async def confirm(conn: asyncpg.Connection, org_id: int, provider_ref: str) -> dict:
        """Confirm a payment, mark the invoice paid, and assign the plan to the org."""
        invoice = await conn.fetchrow(
            "SELECT * FROM invoices WHERE provider_ref = $1 AND org_id = $2",
            provider_ref, org_id,
        )
        if not invoice:
            raise BillingError("Invoice not found for this reference")

        # Idempotency guard: webhook retries or double-clicks must not re-confirm.
        if invoice["status"] == "paid":
            return {"status": "paid", "plan": invoice["plan"], "invoice_id": invoice["id"]}

        provider = get_billing_provider()
        result: PaymentResult = await provider.confirm_payment(provider_ref)
        if not result.paid:
            await conn.execute(
                "UPDATE invoices SET status = 'failed' WHERE id = $1", invoice["id"]
            )
            raise BillingError("Payment was not completed")

        await conn.execute(
            "UPDATE invoices SET status = 'paid', paid_at = NOW() WHERE id = $1",
            invoice["id"],
        )
        # The single place a plan changes — keeps quota enforcement coherent.
        await conn.execute(
            "UPDATE organizations SET plan = $1, plan_started_at = NOW() WHERE id = $2",
            invoice["plan"], org_id,
        )
        logger.info("Org %s upgraded to plan=%s (invoice %s)", org_id, invoice["plan"], invoice["id"])
        return {"status": "paid", "plan": invoice["plan"], "invoice_id": invoice["id"]}

    @staticmethod
    async def list_invoices(conn: asyncpg.Connection, org_id: int) -> list[dict]:
        rows = await conn.fetch(
            "SELECT * FROM invoices WHERE org_id = $1 ORDER BY created_at DESC LIMIT 100",
            org_id,
        )
        return [dict(r) for r in rows]
