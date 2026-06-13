"""
routers/billing.py – Plan, usage, and checkout (the SaaS-layer front door).

Routes under /api/v1/billing/:
  GET  /usage     — current plan + live quota/budget status (any org user)
  GET  /plans     — catalogue of tiers + prices + limits (any org user)
  GET  /invoices  — this org's invoice history (org_head)
  POST /checkout  — start a subscription for a plan (org_head)
  POST /confirm   — confirm a checkout (simulation/manual) → assigns the plan (org_head)
  POST /webhook   — provider webhook (public; signature-verified) → assigns the plan

Quota *enforcement* happens at the action sites (position create, invite, apply,
LLM run); this router is the read + purchase surface.
"""
import logging
import asyncpg
from fastapi import APIRouter, Depends, Request

from backend.dependencies import get_current_user, require_org_head, get_db, get_admin_db
from backend.services.quota_service import QuotaService
from backend.services.billing_service import BillingService, get_billing_provider
from backend.exceptions import BillingError, ValidationError

router = APIRouter(prefix="/api/v1/billing", tags=["Billing"])
logger = logging.getLogger(__name__)


@router.get("/usage")
async def get_usage(
    user: dict = Depends(get_current_user),
    db: asyncpg.Connection = Depends(get_db),
):
    """Current plan + live quota + LLM-budget status for the caller's org."""
    return await QuotaService.usage_summary(db, user["org_id"])


@router.get("/plans")
async def get_plans(_: dict = Depends(get_current_user)):
    """Catalogue of plan tiers, prices, and limits."""
    return {"plans": await BillingService.list_plans()}


@router.get("/invoices")
async def get_invoices(
    user: dict = Depends(require_org_head),
    db: asyncpg.Connection = Depends(get_db),
):
    return {"invoices": await BillingService.list_invoices(db, user["org_id"])}


@router.post("/checkout")
async def start_checkout(
    body: dict,
    user: dict = Depends(require_org_head),
    db: asyncpg.Connection = Depends(get_db),
):
    """Start a subscription for ``body['plan']``. Records a 'created' invoice."""
    plan = (body or {}).get("plan")
    if not plan:
        raise ValidationError("plan is required")
    return await BillingService.start_checkout(db, user["org_id"], plan)


@router.post("/confirm")
async def confirm_checkout(
    body: dict,
    user: dict = Depends(require_org_head),
    db: asyncpg.Connection = Depends(get_db),
):
    """Confirm a checkout by provider_ref → marks invoice paid + assigns the plan."""
    provider_ref = (body or {}).get("provider_ref")
    if not provider_ref:
        raise ValidationError("provider_ref is required")
    return await BillingService.confirm(db, user["org_id"], provider_ref)


@router.post("/webhook")
async def billing_webhook(
    request: Request,
    db: asyncpg.Connection = Depends(get_admin_db),
):
    """Provider webhook. Public but signature-verified. Confirms the payment and
    assigns the plan using the org_id carried on the invoice row."""
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature") or request.headers.get("X-Signature")
    provider = get_billing_provider()
    if not provider.verify_webhook(body, signature):
        raise BillingError("Invalid webhook signature")

    import json
    try:
        payload = json.loads(body or b"{}")
    except ValueError:
        raise ValidationError("Malformed webhook body")

    provider_ref = (
        payload.get("provider_ref")
        or payload.get("order_id")
        or (payload.get("payload", {}).get("order", {}).get("entity", {}) or {}).get("id")
    )
    if not provider_ref:
        raise ValidationError("Webhook missing order reference")

    row = await db.fetchrow("SELECT org_id FROM invoices WHERE provider_ref = $1", provider_ref)
    if not row:
        raise BillingError("No invoice for this reference")
    return await BillingService.confirm(db, row["org_id"], provider_ref)
