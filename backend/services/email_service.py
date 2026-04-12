"""
services/email_service.py – Email Outreach Service (Provider-Agnostic)

Handles magic link generation, email template rendering, and sending.
Currently supports: Resend (default), SMTP fallback, Simulation mode.
"""
import os
import uuid
import jwt
from datetime import datetime, timedelta
from typing import Optional
from backend.db.database import get_connection

# Config
EMAIL_PROVIDER = os.environ.get("EMAIL_PROVIDER", "simulation")  # simulation | resend | smtp
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "noreply@aitalentlab.com")
APP_URL = os.environ.get("APP_URL", "http://localhost:5173")

MAGIC_LINK_SECRET = os.environ.get("MAGIC_LINK_SECRET", "magic-link-secret-change-in-prod")


# ── Magic Link ────────────────────────────────────────────────────────────────

def generate_magic_link(candidate_id: int, position_id: int, expires_hours: int = 72) -> str:
    """Generate a signed magic link token for candidate application."""
    payload = {
        "candidate_id": candidate_id,
        "position_id": position_id,
        "exp": datetime.utcnow() + timedelta(hours=expires_hours),
        "iat": datetime.utcnow(),
        "jti": uuid.uuid4().hex,
    }
    token = jwt.encode(payload, MAGIC_LINK_SECRET, algorithm="HS256")
    return f"{APP_URL}/apply/{token}"


def verify_magic_link(token: str) -> dict:
    """Verify and decode a magic link token."""
    try:
        payload = jwt.decode(token, MAGIC_LINK_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("This link has expired")
    except jwt.InvalidTokenError:
        raise ValueError("Invalid link")


# ── Email Templates ───────────────────────────────────────────────────────────

def _render_outreach_email(candidate_name: str, role_name: str, org_name: str,
                           match_score: float, magic_link: str) -> tuple[str, str]:
    """Render the candidate outreach email. Returns (subject, html_body)."""
    subject = f"Exciting opportunity: {role_name} at {org_name}"

    body = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">🤖 {org_name}</h1>
        </div>
        <div style="background: #1a1a2e; padding: 24px; border: 1px solid #2a2a4a; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #e8e8f0; font-size: 16px;">Hi {candidate_name},</p>
            <p style="color: #b8b8d0; font-size: 14px; line-height: 1.6;">
                We found your profile interesting and believe you'd be a great fit for our
                <strong style="color: #667eea;">{role_name}</strong> position.
            </p>
            <div style="background: rgba(102, 126, 234, 0.1); border: 1px solid rgba(102, 126, 234, 0.3); border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
                <span style="color: #667eea; font-size: 28px; font-weight: 700;">{match_score:.0f}%</span>
                <br>
                <span style="color: #b8b8d0; font-size: 12px;">Skill Match Score</span>
            </div>
            <p style="color: #b8b8d0; font-size: 14px; line-height: 1.6;">
                If you're interested, click the button below to learn more and apply.
                This link is unique to you and will expire in 72 hours.
            </p>
            <div style="text-align: center; margin: 24px 0;">
                <a href="{magic_link}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
                    View Role & Apply →
                </a>
            </div>
            <p style="color: #666; font-size: 12px; text-align: center; margin-top: 24px;">
                This is an automated message from {org_name}'s AI recruitment system.
            </p>
        </div>
    </div>
    """

    return subject, body


# ── Sending ───────────────────────────────────────────────────────────────────

async def send_outreach_email(candidate_id: int, candidate_name: str,
                              candidate_email: str, role_name: str,
                              org_name: str, match_score: float,
                              position_id: int) -> dict:
    """
    Send an outreach email with magic link to a candidate.
    Returns: { success: bool, magic_link: str, message: str }
    """
    magic_link = generate_magic_link(candidate_id, position_id)
    subject, body = _render_outreach_email(candidate_name, role_name, org_name, match_score, magic_link)

    result = {"success": False, "magic_link": magic_link, "message": ""}

    if EMAIL_PROVIDER == "simulation":
        # Simulation mode — just log and record
        print(f"📧 [SIMULATION] Email to {candidate_email}: {subject}")
        result["success"] = True
        result["message"] = f"Simulated email sent to {candidate_email}"

    elif EMAIL_PROVIDER == "resend":
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {RESEND_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "from": FROM_EMAIL,
                        "to": [candidate_email],
                        "subject": subject,
                        "html": body,
                    }
                )
                if resp.status_code == 200:
                    result["success"] = True
                    result["message"] = "Email sent via Resend"
                else:
                    result["message"] = f"Resend error: {resp.text}"
        except Exception as e:
            result["message"] = f"Resend error: {str(e)}"

    elif EMAIL_PROVIDER == "smtp":
        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = FROM_EMAIL
            msg["To"] = candidate_email
            msg.attach(MIMEText(body, "html"))

            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASS)
                server.sendmail(FROM_EMAIL, candidate_email, msg.as_string())

            result["success"] = True
            result["message"] = "Email sent via SMTP"
        except Exception as e:
            result["message"] = f"SMTP error: {str(e)}"

    # Record in database
    with get_connection() as conn:
        conn.execute("""
            INSERT INTO candidate_emails (candidate_id, email_type, subject, body, sent_at, magic_link)
            VALUES (?, 'outreach', ?, ?, ?, ?)
        """, (
            candidate_id, subject, body,
            datetime.utcnow().isoformat() if result["success"] else None,
            magic_link,
        ))

    return result
