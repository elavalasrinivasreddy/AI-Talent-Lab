"""
services/email_service.py – Email sending business logic.

Picks the provider per `settings.EMAIL_PROVIDER` (simulation in dev, Resend in prod),
caches the adapter instance, and exposes templated send helpers:

    await EmailService.send_magic_link(email, magic_link_url, user_name, org_name)
    await EmailService.send_password_reset(email, reset_url, user_name)

Every helper goes through the same `_send()` path so logging, error handling and
the from-address default are consistent.
"""
from datetime import datetime
import html
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



def _safe_url(url: str) -> str:
    """Resolve a relative path to a full URL using FRONTEND_URL and HTML-escape it."""
    if not url:
        return ""
    # Auto-resolve relative paths (e.g. /hire-requests/8) to absolute URLs.
    if url.startswith("/"):
        url = f"{settings.FRONTEND_URL}{url}"
    if not url.startswith(("http://", "https://")):
        raise ValueError(f"Unsafe URL scheme: {url}")
    return html.escape(url, quote=True)

def _button(label: str, url: str) -> str:
    _url = _safe_url(url)
    _label = html.escape(label)
    return f"""\
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td style="background:{_BRAND_TEAL};border-radius:8px;">
      <a href="{_url}" style="display:inline-block;padding:12px 24px;color:#FFFFFF;font-weight:600;font-size:15px;text-decoration:none;">
        {_label}
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
        _user_name = html.escape(user_name) if user_name else None
        _org_name = html.escape(org_name) if org_name else None
        _magic_link_url = _safe_url(magic_link_url)
        greeting = f"Hi {_user_name}," if _user_name else "Hi,"
        org_line = (
            f"You're signing in to <strong>{_org_name}</strong> on AI Talent Lab."
            if _org_name
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
  <a href="{_magic_link_url}" style="color:#0D9488;text-decoration:none;">{_magic_link_url}</a>
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
        _user_name = html.escape(user_name) if user_name else None
        _reset_url = _safe_url(reset_url)
        greeting = f"Hi {_user_name}," if _user_name else "Hi,"
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
  <a href="{_reset_url}" style="color:#0D9488;text-decoration:none;">{_reset_url}</a>
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
        _invitee_name = html.escape(invitee_name)
        _inviter_name = html.escape(inviter_name)
        _org_name = html.escape(org_name)
        _role_label = html.escape(role_label)
        _set_password_url = _safe_url(set_password_url)
        greeting = f"Hi {_invitee_name},"
        content_html = f"""\
<p style="margin:0 0 16px;">{greeting}</p>
<p style="margin:0 0 16px;">
  <strong>{_inviter_name}</strong> has invited you to join
  <strong>{_org_name}</strong> on AI Talent Lab as <strong>{_role_label}</strong>.
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
  <a href="{_set_password_url}" style="color:#0D9488;text-decoration:none;">{_set_password_url}</a>
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
        _candidate_name = html.escape(candidate_name) if candidate_name else None
        _role_name = html.escape(role_name)
        _org_name = html.escape(org_name)
        _apply_url = _safe_url(apply_url)
        greeting = f"Hi {_candidate_name}," if _candidate_name else "Hi,"
        content_html = f"""\
<p style="margin:0 0 16px;">{greeting}</p>
<p style="margin:0 0 16px;">
  We found your profile and think you'd be a great fit for the
  <strong>{_role_name}</strong> position at <strong>{_org_name}</strong>.
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
        _candidate_name = html.escape(candidate_name) if candidate_name else None
        _role_name = html.escape(role_name)
        _org_name = html.escape(org_name)
        _apply_url = _safe_url(apply_url)
        greeting = f"Hi {_candidate_name}," if _candidate_name else "Hi,"
        content_html = f"""\
<p style="margin:0 0 16px;">{greeting}</p>
<p style="margin:0 0 16px;">
  Just a friendly reminder — we'd love to hear from you about the
  <strong>{_role_name}</strong> role at <strong>{_org_name}</strong>.
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
        scheduled_at: Optional[datetime] = None,
        duration_minutes: int = 60,
        meeting_link: Optional[str] = None,
    ) -> bool:
        from datetime import datetime as dt
        _candidate_name = html.escape(candidate_name) if candidate_name else None
        _role_name = html.escape(role_name)
        _org_name = html.escape(org_name)
        _round_name = html.escape(round_name)
        greeting = f"Hi {_candidate_name}," if _candidate_name else "Hi,"
        when = ""
        if scheduled_at:
            if isinstance(scheduled_at, str):
                scheduled_at = dt.fromisoformat(scheduled_at)
            when = scheduled_at.strftime("%A, %B %d, %Y at %I:%M %p")

        meet_section = ""
        if meeting_link:
            _meeting_link = _safe_url(meeting_link)
            meet_section = f"""
<p style="margin:16px 0 8px;font-size:13px;color:#64748B;">Meeting link:</p>
<p style="margin:0 0 16px;">
  <a href="{_meeting_link}" style="color:{_BRAND_TEAL};font-weight:600;text-decoration:none;">{_meeting_link}</a>
</p>"""

        content_html = f"""\
<p style="margin:0 0 16px;">{greeting}</p>
<p style="margin:0 0 16px;">
  Great news! You've been selected for the next step in the interview process
  for <strong>{_role_name}</strong> at <strong>{_org_name}</strong>.
</p>
<table style="margin:16px 0;width:100%;border-collapse:collapse;">
  <tr>
    <td style="padding:8px 0;font-size:13px;color:#64748B;">Round</td>
    <td style="padding:8px 0;font-weight:600;">{_round_name}</td>
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
        _panelist_name = html.escape(panelist_name) if panelist_name else None
        _candidate_name = html.escape(candidate_name)
        _role_name = html.escape(role_name)
        _org_name = html.escape(org_name)
        _round_name = html.escape(round_name)
        greeting = f"Hi {_panelist_name}," if _panelist_name else "Hi,"
        content_html = f"""\
<p style="margin:0 0 16px;">{greeting}</p>
<p style="margin:0 0 16px;">
  You've been assigned as an interviewer for <strong>{_candidate_name}</strong>
  applying for <strong>{_role_name}</strong> at <strong>{_org_name}</strong>.
</p>
<p style="margin:0 0 16px;">
  Please submit your feedback using the secure link below. No login required —
  the link is unique to you.
</p>
{_button("Submit Feedback", feedback_url)}
<p style="margin:16px 0 0;font-size:13px;color:#64748B;">
  <strong>Round:</strong> {_round_name}<br>
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

    # ── JD Approval: ready for review (to team_lead) ─────────────────────────

    @staticmethod
    async def send_jd_ready_for_review(
        to_email: str,
        team_lead_name: str,
        role_name: str,
        hr_name: str,
        review_url: str,
    ) -> bool:
        """Notify team_lead that an HR-authored JD is waiting for their approval."""
        _team_lead_name = html.escape(team_lead_name)
        _hr_name = html.escape(hr_name)
        _role_name = html.escape(role_name)
        content_html = f"""\
<p style="margin:0 0 16px;">Hi {_team_lead_name},</p>
<p style="margin:0 0 16px;">
  <strong>{_hr_name}</strong> has finished the job description for
  <strong>{_role_name}</strong> and submitted it for your approval.
</p>
<p style="margin:0 0 16px;">
  Candidate sourcing is paused until you review and approve the JD.
  Please take a moment to review it and either approve or request changes.
</p>
{_button("Review JD", review_url)}
<p style="margin:0;font-size:13px;color:#64748B;">
  You can also find this position in your dashboard under <em>My Hire Requests</em>.
</p>"""
        body_text = (
            f"Hi {team_lead_name},\n\n"
            f"{hr_name} has submitted the JD for {role_name} and is waiting for your approval.\n\n"
            f"Review it here: {review_url}\n\n"
            f"Candidate sourcing is paused until you approve."
        )
        return await EmailService._send(
            to_email=to_email,
            subject=f"JD ready for your approval — {role_name}",
            body_html=_wrap_html(content_html),
            body_text=body_text,
        )

    # ── JD Approval: approved (to HR) ────────────────────────────────────────

    @staticmethod
    async def send_jd_approved(
        to_email: str,
        hr_name: str,
        role_name: str,
        team_lead_name: str,
        position_url: str,
    ) -> bool:
        """Notify HR that the team_lead approved the JD and sourcing has started."""
        _hr_name = html.escape(hr_name)
        _team_lead_name = html.escape(team_lead_name)
        _role_name = html.escape(role_name)
        content_html = f"""\
<p style="margin:0 0 16px;">Hi {_hr_name},</p>
<p style="margin:0 0 16px;">
  Great news — <strong>{_team_lead_name}</strong> has approved the JD for
  <strong>{_role_name}</strong>.
</p>
<p style="margin:0 0 16px;">
  Candidate sourcing has started automatically. Candidates will begin appearing
  in the pipeline shortly.
</p>
{_button("View Position", position_url)}"""
        body_text = (
            f"Hi {hr_name},\n\n"
            f"{team_lead_name} approved the JD for {role_name}.\n\n"
            f"Candidate sourcing is now running.\n\nView: {position_url}"
        )
        return await EmailService._send(
            to_email=to_email,
            subject=f"JD approved — sourcing started for {role_name}",
            body_html=_wrap_html(content_html),
            body_text=body_text,
        )

    # ── JD Approval: changes requested (to HR) ────────────────────────────────

    @staticmethod
    async def send_jd_changes_requested(
        to_email: str,
        hr_name: str,
        role_name: str,
        team_lead_name: str,
        reason: str,
        position_url: str,
    ) -> bool:
        """Notify HR that the team_lead requested changes to the JD."""
        _hr_name = html.escape(hr_name)
        _team_lead_name = html.escape(team_lead_name)
        _role_name = html.escape(role_name)
        reason_section = ""
        if reason:
            _reason = html.escape(reason)
            reason_section = f"""\
<p style="margin:16px 0 8px;font-size:13px;color:#64748B;">Feedback from {_team_lead_name}:</p>
<p style="margin:0 0 16px;padding:12px 16px;background:#FEF2F2;border-left:3px solid #EF4444;border-radius:4px;font-size:14px;color:#334155;">
  {_reason}
</p>"""
        content_html = f"""\
<p style="margin:0 0 16px;">Hi {_hr_name},</p>
<p style="margin:0 0 16px;">
  <strong>{_team_lead_name}</strong> has reviewed the JD for
  <strong>{_role_name}</strong> and requested some changes before approval.
</p>
{reason_section}
<p style="margin:0 0 16px;">
  Please update the JD via the AI chat and resubmit it for approval.
  Candidate sourcing remains paused until the JD is approved.
</p>
{_button("Update JD", position_url)}"""
        body_text = (
            f"Hi {hr_name},\n\n"
            f"{team_lead_name} requested changes to the JD for {role_name}.\n\n"
            f"{'Feedback: ' + reason + chr(10) + chr(10) if reason else ''}"
            f"Please update the JD and resubmit.\n\nView: {position_url}"
        )
        return await EmailService._send(
            to_email=to_email,
            subject=f"Changes requested on JD — {role_name}",
            body_html=_wrap_html(content_html),
            body_text=body_text,
        )

    # ── Hire Request: raised (to dept_admin / org_head) ──────────────────────

    @staticmethod
    async def send_hire_request_raised(
        to_email: str,
        dept_admin_name: Optional[str],
        raiser_name: str,
        role_name: str,
        dept_name: str,
        request_url: str,
    ) -> bool:
        """Notify dept_admin (or org_head) that a new hire request needs approval."""
        _dept_admin_name = html.escape(dept_admin_name) if dept_admin_name else None
        _raiser_name = html.escape(raiser_name)
        _role_name = html.escape(role_name)
        _dept_name = html.escape(dept_name)
        greeting = f"Hi {_dept_admin_name}," if _dept_admin_name else "Hi,"
        content_html = f"""\
<p style="margin:0 0 16px;">{greeting}</p>
<p style="margin:0 0 16px;">
  <strong>{_raiser_name}</strong> has submitted a new hire request that needs your approval.
</p>
<table style="margin:16px 0;width:100%;border-collapse:collapse;">
  <tr>
    <td style="padding:8px 0;font-size:13px;color:#64748B;">Role</td>
    <td style="padding:8px 0;font-weight:600;">{_role_name}</td>
  </tr>
  <tr>
    <td style="padding:8px 0;font-size:13px;color:#64748B;">Department</td>
    <td style="padding:8px 0;font-weight:600;">{_dept_name}</td>
  </tr>
  <tr>
    <td style="padding:8px 0;font-size:13px;color:#64748B;">Requested by</td>
    <td style="padding:8px 0;font-weight:600;">{_raiser_name}</td>
  </tr>
</table>
<p style="margin:0 0 16px;">
  Please review the request details and approve or reject it at your earliest convenience.
</p>
{_button("Review Request", request_url)}
<p style="margin:0;font-size:13px;color:#64748B;">
  You can also find this in the <em>Pending Approvals</em> widget on your dashboard.
</p>"""
        body_text = (
            f"{greeting}\n\n{raiser_name} submitted a hire request for {role_name} "
            f"in {dept_name}.\n\nReview it here: {request_url}"
        )
        return await EmailService._send(
            to_email=to_email,
            subject=f"Hire request pending your approval — {role_name}",
            body_html=_wrap_html(content_html),
            body_text=body_text,
        )

    # ── Hire Request: approved (to raiser + HR) ───────────────────────────────

    @staticmethod
    async def send_hire_request_approved(
        to_email: str,
        recipient_name: Optional[str],
        role_name: str,
        dept_name: str,
        approver_name: str,
        request_url: str,
        note: Optional[str] = None,
    ) -> bool:
        """Notify raiser (and HR users) that the request has been approved.

        When `note` is supplied (the approver modified the request before approving),
        it is rendered as a highlighted block so the requester sees what changed."""
        _recipient_name = html.escape(recipient_name) if recipient_name else None
        _role_name = html.escape(role_name)
        _dept_name = html.escape(dept_name)
        _approver_name = html.escape(approver_name)
        greeting = f"Hi {_recipient_name}," if _recipient_name else "Hi,"
        note_html = ""
        if note and note.strip():
            _note = html.escape(note.strip())
            note_html = f"""
<p style="margin:0 0 16px;padding:12px 16px;background:#F1F5F9;border-radius:8px;border-left:3px solid {_BRAND_TEAL};">
  <strong>Note from {_approver_name}:</strong><br/>{_note}
</p>"""
        content_html = f"""\
<p style="margin:0 0 16px;">{greeting}</p>
<p style="margin:0 0 16px;">
  Great news — the hire request for <strong>{_role_name}</strong> in
  <strong>{_dept_name}</strong> has been
  <span style="color:{_BRAND_TEAL};font-weight:600;">approved</span>
  by <strong>{_approver_name}</strong>.
</p>
{note_html}
<p style="margin:0 0 16px;">
  The request is now in the HR queue and will be picked up shortly to begin the
  job description process.
</p>
{_button("View Request", request_url)}
<p style="margin:0;font-size:13px;color:#64748B;">
  You'll receive another update when HR picks up the request and begins drafting the JD.
</p>"""
        _note_text = f"\n\nNote from {approver_name}: {note.strip()}" if note and note.strip() else ""
        body_text = (
            f"{greeting}\n\nThe hire request for {role_name} in {dept_name} has been "
            f"approved by {approver_name}.{_note_text}\n\nView it: {request_url}"
        )
        return await EmailService._send(
            to_email=to_email,
            subject=f"Hire request approved — {role_name}",
            body_html=_wrap_html(content_html),
            body_text=body_text,
        )

    # ── Hire Request: rejected (to raiser) ────────────────────────────────────

    @staticmethod
    async def send_hire_request_rejected(
        to_email: str,
        raiser_name: Optional[str],
        role_name: str,
        reason: str,
        approver_name: str,
    ) -> bool:
        """Notify raiser that their hire request was rejected, with reason."""
        _raiser_name = html.escape(raiser_name) if raiser_name else None
        _role_name = html.escape(role_name)
        _approver_name = html.escape(approver_name)
        _reason = html.escape(reason) if reason else ""
        greeting = f"Hi {_raiser_name}," if _raiser_name else "Hi,"
        content_html = f"""\
<p style="margin:0 0 16px;">{greeting}</p>
<p style="margin:0 0 16px;">
  Your hire request for <strong>{_role_name}</strong> was reviewed by
  <strong>{_approver_name}</strong> and was
  <span style="color:#EF4444;font-weight:600;">not approved</span>.
</p>
<p style="margin:0 0 8px;font-size:14px;font-weight:600;">Reason provided:</p>
<p style="margin:0 0 16px;padding:12px 16px;background:#FEF2F2;border-left:3px solid #EF4444;border-radius:4px;font-size:14px;color:#991B1B;">
  {_reason}
</p>
<p style="margin:0 0 16px;">
  If you believe this decision should be revisited, please reach out to
  <strong>{_approver_name}</strong> directly or raise a new request with updated details.
</p>
<p style="margin:0;font-size:13px;color:#64748B;">
  Thank you for using AI Talent Lab.
</p>"""
        body_text = (
            f"{greeting}\n\nYour hire request for {role_name} was not approved by "
            f"{approver_name}.\n\nReason: {reason}\n\n"
            f"Please reach out to {approver_name} if you'd like to discuss further."
        )
        return await EmailService._send(
            to_email=to_email,
            subject=f"Hire request not approved — {role_name}",
            body_html=_wrap_html(content_html),
            body_text=body_text,
        )

    # ── Hire Request: picked up by HR (to raiser) ─────────────────────────────

    @staticmethod
    async def send_hire_request_picked_up(
        to_email: str,
        raiser_name: Optional[str],
        role_name: str,
        hr_name: str,
        request_url: str,
    ) -> bool:
        """Notify raiser that HR has picked up their approved request."""
        _raiser_name = html.escape(raiser_name) if raiser_name else None
        _hr_name = html.escape(hr_name)
        _role_name = html.escape(role_name)
        greeting = f"Hi {_raiser_name}," if _raiser_name else "Hi,"
        content_html = f"""\
<p style="margin:0 0 16px;">{greeting}</p>
<p style="margin:0 0 16px;">
  <strong>{_hr_name}</strong> from HR has picked up your hire request for
  <strong>{_role_name}</strong> and is now drafting the job description.
</p>
<p style="margin:0 0 16px;">
  You'll be notified when the JD is ready for your review and approval. In the
  meantime, you can track progress on the request page.
</p>
{_button("Track Request", request_url)}
<p style="margin:0;font-size:13px;color:#64748B;">
  If you have additional context that would help with the JD, reach out to
  <strong>{_hr_name}</strong> directly.
</p>"""
        body_text = (
            f"{greeting}\n\n{hr_name} has picked up your hire request for {role_name} "
            f"and is now drafting the job description.\n\nTrack progress: {request_url}"
        )
        return await EmailService._send(
            to_email=to_email,
            subject=f"HR is now drafting the JD for {role_name}",
            body_html=_wrap_html(content_html),
            body_text=body_text,
        )

    @staticmethod
    async def send_pre_evaluation_invite(
        to_email: str,
        candidate_name: str,
        role_name: str,
        org_name: str,
        setup_url: str,
    ) -> bool:
        _candidate_name = html.escape(candidate_name) if candidate_name else None
        _role_name = html.escape(role_name)
        _org_name = html.escape(org_name)
        greeting = f"Dear {_candidate_name}," if _candidate_name else "Dear Applicant,"
        content_html = f"""\
<p style="margin:0 0 16px;">{greeting}</p>
<p style="margin:0 0 16px;">
  Thank you for your application for the <strong>{_role_name}</strong> position
  at <strong>{_org_name}</strong>. We were impressed by your resume and would like to
  invite you to the next stage of our process: a written pre-evaluation.
</p>
<p style="margin:0 0 16px;">
  Please click the button below to set up your candidate portal password and complete
  the evaluation. You will have 7 days to complete it.
</p>
{_button("Set up password and start evaluation", setup_url)}
<p style="margin:0;font-size:13px;color:#64748B;">
  If you have any questions, feel free to reply to this email.
</p>"""
        body_text = (
            f"{greeting}\n\nThank you for applying for {role_name} at {org_name}. "
            f"Please complete your written pre-evaluation here: {setup_url}"
        )
        return await EmailService._send(
            to_email=to_email,
            subject=f"Action Required: Pre-evaluation for {role_name} at {org_name}",
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
        _candidate_name = html.escape(candidate_name) if candidate_name else None
        _role_name = html.escape(role_name)
        _org_name = html.escape(org_name)
        greeting = f"Dear {_candidate_name}," if _candidate_name else "Dear Applicant,"
        custom_msg = ""
        if rejection_message:
            _rejection_message = html.escape(rejection_message)
            custom_msg = f'<p style="margin:16px 0;padding:12px 16px;background:#F8FAFC;border-left:3px solid #E2E8F0;border-radius:4px;font-size:14px;color:#334155;">{_rejection_message}</p>'

        content_html = f"""\
<p style="margin:0 0 16px;">{greeting}</p>
<p style="margin:0 0 16px;">
  Thank you for your interest in the <strong>{_role_name}</strong> position
  at <strong>{_org_name}</strong> and for taking the time to apply.
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
