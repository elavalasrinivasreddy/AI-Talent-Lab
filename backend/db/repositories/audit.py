"""
db/repositories/audit.py – AuditLogRepository.
Writes to audit_log table. All mutations go through here.
"""
from typing import Optional
import json
import asyncpg


class AuditLogRepository:
    """Data access for the audit_log table."""

    @staticmethod
    async def create(
        conn: asyncpg.Connection,
        org_id: int,
        action: str,
        user_id: Optional[int] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        details: Optional[dict] = None,
        ip_address: Optional[str] = None,
    ) -> dict:
        """Create an audit log entry."""
        row = await conn.fetchrow(
            """
            INSERT INTO audit_log (org_id, user_id, action, entity_type, entity_id, details, ip_address)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, org_id, user_id, action, entity_type, entity_id, details, ip_address, created_at
            """,
            org_id,
            user_id,
            action,
            entity_type,
            entity_id,
            json.dumps(details) if details else None,
            ip_address,
        )
        return dict(row)
