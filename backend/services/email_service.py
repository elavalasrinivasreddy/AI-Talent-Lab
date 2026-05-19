"""
services/email_service.py – Email sending business logic.

Picks the provider per `settings.EMAIL_PROVIDER` (simulation in dev, Resend in prod),
caches the adapter instance, and exposes templated send helpers:

    await EmailService.send_magic_link(email, magic_link_url, user_name, org_name)
    await EmailService.send_password_reset(email, reset_url, user_name)

Every helper goes through the same `_send()` path so logging, error handling and
the from-address default are consistent.
"""
import logging
from typing import Optional

from backend.adapters.email.base import EmailProvider
from backend.adapters.email.simulation import SimulationProvider
from backend.adapters.email.resend import ResendProvider
from backend.config import settings

logger = logging.getLogger(__name__)


# ── Provider factory (cached) ─────────────────────────────────────────────────

_provider: Optional[EmailProvider] = None


def get_email_provider() -> EmailProvider:
    """Return the configured email provider, instantiated lazily and cached."""
    global _provider
    if _provider is not None:
        return _provider

    name = (settings.EMAIL_PROVIDER or "simulation").strip().lower()
    if name == "resend":
        _provider = ResendProvider(api_key=settings.RESEND_API_KEY)
    else:
        # Default + explicit "simulation" both fall here.
        if name not in ("simulation", ""):
            logger.warning(
                f"Unknown EMAIL_PROVIDER={name!r} — falling back to simulation"
            )
        _provider = SimulationProvider()
    return _provider


# ── Branded templates ─────────────────────────────────────────────────────────
#
# Templates are intentionally inline (no Jinja dep). They render plain, brand-safe
# HTML with a fallback text body so spam scores stay low.

_BRAND_TEAL = "#0D9488"


def _wrap_html(content_html: str) -> str:
    """Wrap a section of HTML in the standard branded email shell."""
    return f"""\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI Talent Lab</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden;">
          <tr>
            <td style="padding:24px 32px;border-bottom:1px solid #F1F5F9;">
              <span style="font-size:16px;font-weight:700;color:#0F172A;letter-spacing:-0.01em;">
                AI <span style="color:{_BRAND_TEAL};">Talent</span> Lab
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;font-size:15px;line-height:1.6;color:#0F172A;">
              {content_html}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#F8FAFC;border-top:1px solid #F1F5F9;font-size:12px;color:#64748B;line-height:1.5;">
              You're receiving this because someone requested it from AI Talent Lab.
              If that wasn't you, you can safely ignore this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _button(label: str, url: str) -> str:
    return f"""\
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td style="background:{_BRAND_TEAL};border-radius:8px;">
      <a href="{url}" style="display:inline-block;padding:12px 24px;color:#FFFFFF;font-weight:600;font-size:15px;text-decoration:none;">
        {label}
      </a>
    </td>
  </tr>
</table>"""


class EmailService:
    """Templated email sender. All methods return bool (True = sent or simulated)."""

    @staticmethod
    async def _send(
        to_email: str,
        subject: str,
        body_html: str,
        body_text: str,
    ) -> bool:
        try:
            provider = get_email_provider()
            return await provider.send_email(
                to_email=to_email,
                subject=subject,
                body_html=body_html,
                body_text=body_text,
                from_email=settings.FROM_EMAIL,
                from_name=settings.FROM_NAME,
            )
        except Exception as e:
            logger.exception(f"Email send failed for {to_email}: {e}")
            return False

    # ── Auth: magic-link sign-in ──────────────────────────────────────────────

    @staticmethod
    async def send_magic_link(
        to_email: str,
        magic_link_url: str,
        user_name: Optional[str] = None,
        org_name: Optional[str] = None,
        expires_minutes: int = 15,
    ) -> bool:
        greeting = f"Hi {user_name}," if user_name else "Hi,"
        org_line = (
            f"You're signing in to <strong>{org_name}</strong> on AI Talent Lab."
            if org_name
            else "You're signing in to AI Talent Lab."
        )
        content_html = f"""\
<p style="margin:0 0 16px;">{greeting}</p>
<p style="margin:0 0 16px;">{org_line}</p>
{_button("Sign in", magic_link_url)}
<p style="margin:16px 0 8px;font-size:13px;color:#64748B;">
  Or paste this link into your browser:
</p>
<p style="margin:0 0 16px;font-size:12px;color:#0D9488;word-break:break-all;">
  <a href="{magic_link_url}" style="color:#0D9488;text-decoration:none;">{magic_link_url}</a>
</p>
<p style="margin:0;font-size:13px;color:#64748B;">
  This link expires in {expires_minutes} minutes and can only be used once.
  If you didn't request it, ignore this email — your account stays secure.
</p>"""
        body_text = (
            f"{greeting}\n\n{org_line}\n\nSign in: {magic_link_url}\n\n"
            f"This link expires in {expires_minutes} minutes and can only be used once."
        )
        return await EmailService._send(
            to_email=to_email,
            subject="Your sign-in link for AI Talent Lab",
            body_html=_wrap_html(content_html),
            body_text=body_text,
        )

    # ── Auth: password reset ──────────────────────────────────────────────────

    @staticmethod
    async def send_password_reset(
        to_email: str,
        reset_url: str,
        user_name: Optional[str] = None,
        expires_hours: int = 24,
    ) -> bool:
        greeting = f"Hi {user_name}," if user_name else "Hi,"
        content_html = f"""\
<p style="margin:0 0 16px;">{greeting}</p>
<p style="margin:0 0 16px;">
  We received a request to reset your AI Talent Lab password.
</p>
{_button("Reset password", reset_url)}
<p style="margin:16px 0 8px;font-size:13px;color:#64748B;">
  Or paste this link into your browser:
</p>
<p style="margin:0 0 16px;font-size:12px;color:#0D9488;word-break:break-all;">
  <a href="{reset_url}" style="color:#0D9488;text-decoration:none;">{reset_url}</a>
</p>
<p style="margin:0;font-size:13px;color:#64748B;">
  This link expires in {expires_hours} hours and can only be used once.
  If you didn't request a reset, you can ignore this email.
</p>"""
        body_text = (
            f"{greeting}\n\nReset your AI Talent Lab password:\n{reset_url}\n\n"
            f"This link expires in {expires_hours} hours."
        )
        return await EmailService._send(
            to_email=to_email,
            subject="Reset your AI Talent Lab password",
            body_html=_wrap_html(content_html),
            body_text=body_text,
        )
