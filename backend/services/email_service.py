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

    # ── Auth: user invite ─────────────────────────────────────────────────────

    @staticmethod
    async def send_user_invite(
        to_email: str,
        invitee_name: str,
        inviter_name: str,
        org_name: str,
        role_label: str,
        set_password_url: str,
    ) -> bool:
        """
        Send an invite email to a new team member so they can set their own
        password and activate their account.
        """
        greeting = f"Hi {invitee_name},"
        content_html = f"""\
<p style="margin:0 0 16px;">{greeting}</p>
<p style="margin:0 0 16px;">
  <strong>{inviter_name}</strong> has invited you to join
  <strong>{org_name}</strong> on AI Talent Lab as <strong>{role_label}</strong>.
</p>
<p style="margin:0 0 16px;">
  Click the button below to set your password and activate your account.
  The link expires in 24 hours and can only be used once.
</p>
{_button("Set Your Password", set_password_url)}
<p style="margin:16px 0 8px;font-size:13px;color:#64748B;">
  Or paste this link into your browser:
</p>
<p style="margin:0 0 16px;font-size:12px;color:#0D9488;word-break:break-all;">
  <a href="{set_password_url}" style="color:#0D9488;text-decoration:none;">{set_password_url}</a>
</p>
<p style="margin:0;font-size:13px;color:#64748B;">
  If you weren't expecting this invite, you can safely ignore this email.
  Your account will not be active until you set a password.
</p>"""
        body_text = (
            f"{greeting}\n\n"
            f"{inviter_name} has invited you to join {org_name} on AI Talent Lab "
            f"as {role_label}.\n\n"
            f"Set your password here: {set_password_url}\n\n"
            f"This link expires in 24 hours and can only be used once.\n\n"
            f"If you weren't expecting this invite, you can safely ignore this email."
        )
        logger.info(
            "[email] Sending user invite to %s for org %s (role=%s)",
            to_email, org_name, role_label,
        )
        return await EmailService._send(
            to_email=to_email,
            subject=f"You've been invited to {org_name} on AI Talent Lab",
            body_html=_wrap_html(content_html),
            body_text=body_text,
        )

    # ── Candidate: outreach (magic link) ──────────────────────────────────────

    @staticmethod
    async def send_candidate_outreach(
        to_email: str,
        candidate_name: Optional[str],
        role_name: str,
        org_name: str,
        apply_url: str,
    ) -> bool:
        greeting = f"Hi {candidate_name}," if candidate_name else "Hi,"
        content_html = f"""\
<p style="margin:0 0 16px;">{greeting}</p>
<p style="margin:0 0 16px;">
  We found your profile and think you'd be a great fit for the
  <strong>{role_name}</strong> position at <strong>{org_name}</strong>.
</p>
<p style="margin:0 0 16px;">
  We've prepared a quick, chat-based application — it takes less than 5 minutes.
  No account needed, just click the link below:
</p>
{_button("Apply Now", apply_url)}
<p style="margin:0;font-size:13px;color:#64748B;">
  This link expires in 72 hours. If you're not interested, simply ignore this email.
</p>"""
        body_text = (
            f"{greeting}\n\nWe found your profile and think you'd be a great fit for "
            f"{role_name} at {org_name}.\n\nApply here: {apply_url}\n\n"
            f"This link expires in 72 hours."
        )
        return await EmailService._send(
            to_email=to_email,
            subject=f"{org_name} — You've been invited to apply for {role_name}",
            body_html=_wrap_html(content_html),
            body_text=body_text,
        )

    # ── Candidate: follow-up reminder ─────────────────────────────────────────

    @staticmethod
    async def send_candidate_followup(
        to_email: str,
        candidate_name: Optional[str],
        role_name: str,
        org_name: str,
        apply_url: str,
    ) -> bool:
        greeting = f"Hi {candidate_name}," if candidate_name else "Hi,"
        content_html = f"""\
<p style="margin:0 0 16px;">{greeting}</p>
<p style="margin:0 0 16px;">
  Just a friendly reminder — we'd love to hear from you about the
  <strong>{role_name}</strong> role at <strong>{org_name}</strong>.
</p>
<p style="margin:0 0 16px;">
  The application is quick and chat-based. Click below to get started:
</p>
{_button("Complete Your Application", apply_url)}
<p style="margin:0;font-size:13px;color:#64748B;">
  This is a one-time reminder. If this role isn't for you, no action is needed.
</p>"""
        body_text = (
            f"{greeting}\n\nReminder: We'd love to hear from you about the {role_name} "
            f"role at {org_name}.\n\nApply: {apply_url}"
        )
        return await EmailService._send(
            to_email=to_email,
            subject=f"Reminder: {org_name} is waiting for your application — {role_name}",
            body_html=_wrap_html(content_html),
            body_text=body_text,
        )

    # ── Candidate: interview invitation ───────────────────────────────────────

    @staticmethod
    async def send_interview_invite(
        to_email: str,
        candidate_name: Optional[str],
        role_name: str,
        org_name: str,
        round_name: str,
        scheduled_at: Optional["datetime"] = None,
        duration_minutes: int = 60,
        meeting_link: Optional[str] = None,
    ) -> bool:
        from datetime import datetime as dt
        greeting = f"Hi {candidate_name}," if candidate_name else "Hi,"
        when = ""
        if scheduled_at:
            if isinstance(scheduled_at, str):
                scheduled_at = dt.fromisoformat(scheduled_at)
            when = scheduled_at.strftime("%A, %B %d, %Y at %I:%M %p")

        meet_section = ""
        if meeting_link:
            meet_section = f"""
<p style="margin:16px 0 8px;font-size:13px;color:#64748B;">Meeting link:</p>
<p style="margin:0 0 16px;">
  <a href="{meeting_link}" style="color:{_BRAND_TEAL};font-weight:600;text-decoration:none;">{meeting_link}</a>
</p>"""

        content_html = f"""\
<p style="margin:0 0 16px;">{greeting}</p>
<p style="margin:0 0 16px;">
  Great news! You've been selected for the next step in the interview process
  for <strong>{role_name}</strong> at <strong>{org_name}</strong>.
</p>
<table style="margin:16px 0;width:100%;border-collapse:collapse;">
  <tr>
    <td style="padding:8px 0;font-size:13px;color:#64748B;">Round</td>
    <td style="padding:8px 0;font-weight:600;">{round_name}</td>
  </tr>
  <tr>
    <td style="padding:8px 0;font-size:13px;color:#64748B;">When</td>
    <td style="padding:8px 0;font-weight:600;">{when or 'To be confirmed'}</td>
  </tr>
  <tr>
    <td style="padding:8px 0;font-size:13px;color:#64748B;">Duration</td>
    <td style="padding:8px 0;font-weight:600;">{duration_minutes} minutes</td>
  </tr>
</table>
{meet_section}
<p style="margin:0;font-size:13px;color:#64748B;">
  Please reply to this email if you need to reschedule or have any questions.
</p>"""
        body_text = (
            f"{greeting}\n\nYou've been selected for {round_name} for {role_name} "
            f"at {org_name}.\n\nWhen: {when or 'TBC'}\nDuration: {duration_minutes} min"
            f"\n\n{'Meeting: ' + meeting_link if meeting_link else ''}"
        )
        return await EmailService._send(
            to_email=to_email,
            subject=f"Interview Invitation: {round_name} — {role_name} at {org_name}",
            body_html=_wrap_html(content_html),
            body_text=body_text,
        )

    # ── Panel: feedback link ──────────────────────────────────────────────────

    @staticmethod
    async def send_panel_feedback_link(
        to_email: str,
        panelist_name: Optional[str],
        candidate_name: str,
        role_name: str,
        org_name: str,
        round_name: str,
        feedback_url: str,
    ) -> bool:
        greeting = f"Hi {panelist_name}," if panelist_name else "Hi,"
        content_html = f"""\
<p style="margin:0 0 16px;">{greeting}</p>
<p style="margin:0 0 16px;">
  You've been assigned as an interviewer for <strong>{candidate_name}</strong>
  applying for <strong>{role_name}</strong> at <strong>{org_name}</strong>.
</p>
<p style="margin:0 0 16px;">
  Please submit your feedback using the secure link below. No login required —
  the link is unique to you.
</p>
{_button("Submit Feedback", feedback_url)}
<p style="margin:16px 0 0;font-size:13px;color:#64748B;">
  <strong>Round:</strong> {round_name}<br>
  This link expires in 7 days and can only be submitted once.
</p>"""
        body_text = (
            f"{greeting}\n\nPlease submit your interview feedback for {candidate_name} "
            f"({role_name} at {org_name}).\n\n{round_name}\n\n"
            f"Submit: {feedback_url}\n\nThis link expires in 7 days."
        )
        return await EmailService._send(
            to_email=to_email,
            subject=f"Feedback Requested: {candidate_name} — {round_name}",
            body_html=_wrap_html(content_html),
            body_text=body_text,
        )

    # ── Candidate: rejection ──────────────────────────────────────────────────

    @staticmethod
    async def send_rejection(
        to_email: str,
        candidate_name: Optional[str],
        role_name: str,
        org_name: str,
        rejection_message: Optional[str] = None,
    ) -> bool:
        greeting = f"Dear {candidate_name}," if candidate_name else "Dear Applicant,"
        custom_msg = ""
        if rejection_message:
            custom_msg = f'<p style="margin:16px 0;padding:12px 16px;background:#F8FAFC;border-left:3px solid #E2E8F0;border-radius:4px;font-size:14px;color:#334155;">{rejection_message}</p>'

        content_html = f"""\
<p style="margin:0 0 16px;">{greeting}</p>
<p style="margin:0 0 16px;">
  Thank you for your interest in the <strong>{role_name}</strong> position
  at <strong>{org_name}</strong> and for taking the time to apply.
</p>
<p style="margin:0 0 16px;">
  After careful consideration, we've decided to move forward with other
  candidates whose qualifications more closely match our current needs.
</p>
{custom_msg}
<p style="margin:0 0 16px;">
  This decision doesn't reflect on your abilities, and we encourage you to
  apply for future positions that align with your experience.
</p>
<p style="margin:0;font-size:13px;color:#64748B;">
  We wish you the best in your career. If you'd like your data removed from
  our system, visit <a href="https://app.aitalentlab.com/delete-my-data" style="color:{_BRAND_TEAL};">our privacy page</a>.
</p>"""
        body_text = (
            f"{greeting}\n\nThank you for your interest in {role_name} at {org_name}.\n\n"
            f"After careful consideration, we've decided to move forward with other candidates.\n\n"
            f"We wish you the best in your career."
        )
        return await EmailService._send(
            to_email=to_email,
            subject=f"Update on your application — {role_name} at {org_name}",
            body_html=_wrap_html(content_html),
            body_text=body_text,
        )
