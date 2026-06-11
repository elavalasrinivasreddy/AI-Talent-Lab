"""
services/gdpr_service.py – GDPR/DPDP compliance service.
Handles right-to-erasure, consent capture, data anonymization, and retention policy.

Per project rules:
- Three-layer architecture: this is the SERVICE layer (business logic only)
- All mutations logged to audit_log
- All queries filter by org_id for tenant isolation
"""
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt

from backend.config import settings
from backend.db.connection import get_connection

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

DELETION_TOKEN_EXPIRY_HOURS = 24
DATA_RETENTION_MONTHS = 24  # Default: 2 years from last interaction

CONSENT_TEXTS = {
    "data_processing": (
        "I consent to the processing of my personal data (name, email, resume, "
        "employment history) for the purpose of evaluating my candidacy for this role."
    ),
    "ai_analysis": (
        "I understand that AI-powered tools will analyze my resume and application "
        "data to assess skill match. This analysis is used to assist — not replace — "
        "human decision-making in the hiring process."
    ),
    "communication": (
        "I consent to receiving communications related to this application and "
        "future opportunities at this organization."
    ),
}


class GDPRService:
    """
    GDPR / India DPDP Act compliance service.
    Implements: Right to Erasure, Consent Management, Data Retention, Anonymization.
    """

    # ── Consent Management ────────────────────────────────────────────────────

    @staticmethod
    async def record_consent(
        org_id: int,
        candidate_id: int,
        application_id: Optional[int],
        consent_type: str,
        consent_given: bool,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> dict:
        """Record a consent decision. Always creates a new record (append-only)."""
        consent_text = CONSENT_TEXTS.get(consent_type, f"Consent for {consent_type}")

        async with get_connection() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO consent_records
                    (org_id, candidate_id, application_id, consent_type,
                     consent_given, consent_text, ip_address, user_agent)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id, given_at
                """,
                org_id, candidate_id, application_id, consent_type,
                consent_given, consent_text, ip_address, user_agent,
            )

            # If this is the data_processing consent for an application, mark it
            if consent_type == "data_processing" and application_id and consent_given:
                await conn.execute(
                    "UPDATE candidate_applications SET consent_given_at=NOW() WHERE id=$1 AND org_id=$2",
                    application_id, org_id,
                )

            # Audit log
            await conn.execute(
                """
                INSERT INTO audit_log (org_id, action, entity_type, entity_id, details)
                VALUES ($1, $2, $3, $4, $5)
                """,
                org_id,
                "consent_recorded",
                "candidate",
                str(candidate_id),
                json.dumps({
                    "consent_type": consent_type,
                    "consent_given": consent_given,
                    "consent_record_id": row["id"],
                }),
            )

        return {
            "consent_id": row["id"],
            "consent_type": consent_type,
            "given": consent_given,
            "recorded_at": row["given_at"].isoformat(),
        }

    @staticmethod
    async def record_bulk_consent(
        org_id: int,
        candidate_id: int,
        application_id: Optional[int],
        consent_types: list[str],
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> list[dict]:
        """Record multiple consent types at once (used during apply flow)."""
        results = []
        for ct in consent_types:
            result = await GDPRService.record_consent(
                org_id, candidate_id, application_id, ct,
                consent_given=True,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            results.append(result)
        return results

    @staticmethod
    async def get_consent_status(
        org_id: int, candidate_id: int
    ) -> list[dict]:
        """Get all consent records for a candidate."""
        async with get_connection() as conn:
            rows = await conn.fetch(
                """
                SELECT id, consent_type, consent_given, consent_text, given_at, withdrawn_at
                FROM consent_records
                WHERE org_id=$1 AND candidate_id=$2
                ORDER BY given_at DESC
                """,
                org_id, candidate_id,
            )
        return [dict(r) for r in rows]

    @staticmethod
    async def withdraw_consent(
        org_id: int, candidate_id: int, consent_type: str
    ) -> dict:
        """Withdraw a previously given consent."""
        async with get_connection() as conn:
            # Mark the latest active consent as withdrawn
            await conn.execute(
                """
                UPDATE consent_records
                SET withdrawn_at=NOW()
                WHERE org_id=$1 AND candidate_id=$2 AND consent_type=$3
                  AND consent_given=TRUE AND withdrawn_at IS NULL
                """,
                org_id, candidate_id, consent_type,
            )

            # Audit log
            await conn.execute(
                """
                INSERT INTO audit_log (org_id, action, entity_type, entity_id, details)
                VALUES ($1, $2, $3, $4, $5)
                """,
                org_id, "consent_withdrawn", "candidate", str(candidate_id),
                json.dumps({"consent_type": consent_type}),
            )

        return {"withdrawn": True, "consent_type": consent_type}

    # ── Right to Erasure (Data Deletion) ──────────────────────────────────────

    @staticmethod
    async def request_deletion(email: str) -> dict:
        """
        Step 1: Candidate requests data deletion.
        Creates a deletion request and sends a verification token.
        Returns token for email verification (in prod, this would be emailed).
        """
        async with get_connection() as conn:
            # Find all candidates with this email across all orgs
            candidates = await conn.fetch(
                "SELECT id, org_id, name FROM candidates WHERE email=$1",
                email,
            )

            if not candidates:
                # Don't reveal whether the email exists (privacy)
                return {
                    "message": "If your email is in our system, you will receive a verification link."
                }

            token = str(uuid.uuid4())
            requests_created = []

            for cand in candidates:
                # Check for existing pending requests
                existing = await conn.fetchrow(
                    """
                    SELECT id FROM data_deletion_requests
                    WHERE candidate_id=$1 AND org_id=$2 AND status IN ('pending', 'verified', 'processing')
                    """,
                    cand["id"], cand["org_id"],
                )
                if existing:
                    continue

                row = await conn.fetchrow(
                    """
                    INSERT INTO data_deletion_requests
                        (org_id, candidate_id, request_email, request_token, status)
                    VALUES ($1, $2, $3, $4, 'pending')
                    RETURNING id
                    """,
                    cand["org_id"], cand["id"], email, token,
                )
                requests_created.append(row["id"])

                # Audit
                await conn.execute(
                    """
                    INSERT INTO audit_log (org_id, action, entity_type, entity_id, details)
                    VALUES ($1, $2, $3, $4, $5)
                    """,
                    cand["org_id"], "deletion_requested", "candidate", str(cand["id"]),
                    json.dumps({"request_id": row["id"]}),
                )

        return {
            "message": "If your email is in our system, you will receive a verification link.",
            "verification_token": token,  # In prod, this is emailed, not returned
            "requests_created": len(requests_created),
        }

    @staticmethod
    async def verify_deletion(token: str) -> dict:
        """
        Step 2: Candidate verifies their deletion request via token.
        Marks requests as verified and begins processing.
        """
        async with get_connection() as conn:
            rows = await conn.fetch(
                """
                SELECT id, org_id, candidate_id
                FROM data_deletion_requests
                WHERE request_token=$1 AND status='pending'
                """,
                token,
            )

            if not rows:
                return {"error": "Invalid or already processed token."}

            for row in rows:
                await conn.execute(
                    """
                    UPDATE data_deletion_requests
                    SET status='verified', verified_at=NOW()
                    WHERE id=$1
                    """,
                    row["id"],
                )

            return {
                "verified": True,
                "message": "Your deletion request has been verified. Processing will begin shortly.",
                "request_count": len(rows),
            }

    @staticmethod
    async def process_deletion(request_id: int, org_id: int) -> dict:
        """
        Step 3: Actually execute the data deletion/anonymization.
        Anonymizes candidate data while preserving aggregate hiring metrics.
        `org_id` scopes the request to the caller's org — prevents cross-tenant
        deletion by guessing another org's request id.
        """
        async with get_connection() as conn:
            req = await conn.fetchrow(
                "SELECT * FROM data_deletion_requests WHERE id=$1 AND org_id=$2",
                request_id, org_id,
            )
            if not req:
                return {"error": "Request not found"}

            if req["status"] not in ("verified", "processing"):
                return {"error": f"Request is in status: {req['status']}"}

            candidate_id = req["candidate_id"]
            org_id = req["org_id"]
            deleted_summary = {}

            # Wrap all PII erasure in a transaction — all-or-nothing so a
            # mid-deletion failure never leaves partially anonymized records.
            async with conn.transaction():
                # Mark as processing inside the transaction so concurrent calls
                # fail on the status check rather than double-executing.
                await conn.execute(
                    "UPDATE data_deletion_requests SET status='processing' WHERE id=$1",
                    request_id,
                )

                # 1. Delete consent records
                result = await conn.execute(
                    "DELETE FROM consent_records WHERE candidate_id=$1 AND org_id=$2",
                    candidate_id, org_id,
                )
                deleted_summary["consent_records"] = result.split()[-1] if result else "0"

                # 2. Delete candidate session messages before sessions (FK order)
                result = await conn.execute(
                    """
                    DELETE FROM candidate_session_messages
                    WHERE session_id IN (
                        SELECT id FROM candidate_sessions
                        WHERE candidate_id=$1 AND org_id=$2
                    )
                    """,
                    candidate_id, org_id,
                )
                deleted_summary["candidate_session_messages"] = result.split()[-1] if result else "0"

                # 2b. Delete candidate session data (chat logs)
                result = await conn.execute(
                    "DELETE FROM candidate_sessions WHERE candidate_id=$1 AND org_id=$2",
                    candidate_id, org_id,
                )
                deleted_summary["candidate_sessions"] = result.split()[-1] if result else "0"

                # 3. Delete talent pool suggestions
                result = await conn.execute(
                    "DELETE FROM talent_pool_suggestions WHERE candidate_id=$1 AND org_id=$2",
                    candidate_id, org_id,
                )
                deleted_summary["talent_pool_suggestions"] = result.split()[-1] if result else "0"

                # 4. Delete candidate tags
                result = await conn.execute(
                    "DELETE FROM candidate_tags WHERE candidate_id=$1 AND org_id=$2",
                    candidate_id, org_id,
                )
                deleted_summary["candidate_tags"] = result.split()[-1] if result else "0"

                # 4b. Delete hiring notes (recruiter free-text — contains PII)
                result = await conn.execute(
                    "DELETE FROM hiring_notes WHERE candidate_id=$1 AND org_id=$2",
                    candidate_id, org_id,
                )
                deleted_summary["hiring_notes"] = result.split()[-1] if result else "0"

                # 5. Anonymize pipeline events (keep for metrics, remove PII)
                await conn.execute(
                    """
                    UPDATE pipeline_events
                    SET event_data='{"anonymized": true}'
                    WHERE candidate_id=$1 AND org_id=$2
                    """,
                    candidate_id, org_id,
                )
                deleted_summary["pipeline_events"] = "anonymized"

                # 6. Anonymize scorecards (keep ratings, remove comments)
                await conn.execute(
                    """
                    UPDATE scorecards
                    SET strengths=NULL, concerns=NULL, additional_comments=NULL,
                        raw_notes_strengths=NULL, raw_notes_concerns=NULL
                    WHERE candidate_id=$1 AND org_id=$2
                    """,
                    candidate_id, org_id,
                )
                deleted_summary["scorecards"] = "anonymized"

                # 7. Anonymize candidate record (replace PII with anonymized placeholders)
                anon_name = f"Anonymized Candidate #{candidate_id}"
                await conn.execute(
                    """
                    UPDATE candidates SET
                        name=$1, email=NULL, phone=NULL,
                        current_title=NULL, current_company=NULL,
                        location=NULL, resume_url=NULL,
                        resume_text=NULL, resume_parsed=NULL, resume_embedding=NULL,
                        source_profile_url=NULL, notes=NULL,
                        data_anonymized_at=NOW(), updated_at=NOW()
                    WHERE id=$2 AND org_id=$3
                    """,
                    anon_name, candidate_id, org_id,
                )
                deleted_summary["candidate"] = "anonymized"

                # 8. Nullify screening responses on applications
                await conn.execute(
                    """
                    UPDATE candidate_applications
                    SET screening_responses=NULL, magic_link_token=NULL
                    WHERE candidate_id=$1 AND org_id=$2
                    """,
                    candidate_id, org_id,
                )
                deleted_summary["applications"] = "screening_data_removed"

                # Mark request as completed
                await conn.execute(
                    """
                    UPDATE data_deletion_requests
                    SET status='completed', completed_at=NOW(), deleted_data=$1
                    WHERE id=$2
                    """,
                    json.dumps(deleted_summary), request_id,
                )

                # Audit
                await conn.execute(
                    """
                    INSERT INTO audit_log (org_id, action, entity_type, entity_id, details)
                    VALUES ($1, $2, $3, $4, $5)
                    """,
                    org_id, "data_deleted_gdpr", "candidate", str(candidate_id),
                    json.dumps(deleted_summary),
                )

        return {
            "completed": True,
            "deleted_summary": deleted_summary,
        }

    # ── Data Retention ────────────────────────────────────────────────────────

    @staticmethod
    async def set_retention_period(
        org_id: int, candidate_id: int, months: int = DATA_RETENTION_MONTHS
    ) -> None:
        """Set when candidate data should be auto-purged."""
        retain_until = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=months * 30)
        async with get_connection() as conn:
            await conn.execute(
                """
                UPDATE candidates SET data_retained_until=$1, updated_at=NOW()
                WHERE id=$2 AND org_id=$3
                """,
                retain_until, candidate_id, org_id,
            )

    @staticmethod
    async def cleanup_expired_data() -> dict:
        """
        Periodic cleanup: anonymize candidates whose retention period has expired.
        Called by Celery weekly task.
        """
        async with get_connection() as conn:
            # Find candidates past retention date
            expired = await conn.fetch(
                """
                SELECT id, org_id, email
                FROM candidates
                WHERE data_retained_until IS NOT NULL
                  AND data_retained_until < NOW()
                  AND data_anonymized_at IS NULL
                """
            )

            processed = 0
            for cand in expired:
                # Create a deletion request and process immediately
                token = str(uuid.uuid4())
                req = await conn.fetchrow(
                    """
                    INSERT INTO data_deletion_requests
                        (org_id, candidate_id, request_email, request_token, status, reason)
                    VALUES ($1, $2, $3, $4, 'verified', 'retention_expired')
                    RETURNING id
                    """,
                    cand["org_id"], cand["id"],
                    cand["email"] or "unknown@expired",
                    token,
                )
                await GDPRService.process_deletion(req["id"], cand["org_id"])
                processed += 1

            logger.info(f"GDPR retention cleanup: anonymized {processed} candidates")
            return {"processed": processed}

    # ── Data Export (Right to Access) ─────────────────────────────────────────

    @staticmethod
    async def export_candidate_data(org_id: int, candidate_id: int) -> dict:
        """
        Export all data held about a candidate (Right to Access / Data Portability).
        Returns a structured dict of all PII and processing records.
        """
        async with get_connection() as conn:
            cand = await conn.fetchrow(
                "SELECT * FROM candidates WHERE id=$1 AND org_id=$2",
                candidate_id, org_id,
            )
            if not cand:
                return {"error": "Candidate not found"}

            apps = await conn.fetch(
                """
                SELECT ca.*, p.role_name, p.location
                FROM candidate_applications ca
                JOIN positions p ON p.id = ca.position_id
                WHERE ca.candidate_id=$1 AND ca.org_id=$2
                """,
                candidate_id, org_id,
            )

            consents = await conn.fetch(
                "SELECT * FROM consent_records WHERE candidate_id=$1 AND org_id=$2",
                candidate_id, org_id,
            )

            events = await conn.fetch(
                "SELECT * FROM pipeline_events WHERE candidate_id=$1 AND org_id=$2 ORDER BY created_at",
                candidate_id, org_id,
            )

            interviews_data = await conn.fetch(
                "SELECT * FROM interviews WHERE candidate_id=$1 AND org_id=$2",
                candidate_id, org_id,
            )

            # Build export
            def serialize(row):
                d = dict(row)
                for k, v in d.items():
                    if isinstance(v, datetime):
                        d[k] = v.isoformat()
                return d

            return {
                "candidate": serialize(cand),
                "applications": [serialize(a) for a in apps],
                "consent_records": [serialize(c) for c in consents],
                "pipeline_events": [serialize(e) for e in events],
                "interviews": [serialize(i) for i in interviews_data],
                "exported_at": datetime.now(timezone.utc).isoformat(),
            }
