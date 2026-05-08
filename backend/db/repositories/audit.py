"""
db/repositories/audit.py – AuditLogRepository.
Writes to audit_log table. All mutations go through here.
"""
from typing import Optional, Union
import json
import asyncpg


class AuditLogRepository:
    """Data access for the audit_log table."""

    @staticmethod
    async def create(
        conn: asyncpg.Connection,
        org_id_or_data: Union[int, dict],
        action: Optional[str] = None,
        user_id: Optional[int] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        details: Optional[dict] = None,
        ip_address: Optional[str] = None,
    ) -> dict:
        """
        Create an audit log entry.

        Supports two call styles:
          1. Keyword: create(conn, org_id, action, user_id=..., entity_type=..., ...)
          2. Dict:    create(conn, {"org_id": ..., "action": ..., "user_id": ..., ...})
        """
        # If called with dict as second arg, unpack it
        if isinstance(org_id_or_data, dict):
            data = org_id_or_data
            org_id = data["org_id"]
            action = data.get("action", action)
            user_id = data.get("user_id", user_id)
            entity_type = data.get("entity_type", entity_type)
            entity_id = data.get("entity_id", entity_id)
            details = data.get("details", details)
            ip_address = data.get("ip_address", ip_address)
        else:
            org_id = org_id_or_data

        # Serialize details if it's a dict (callers may pass pre-serialized or raw)
        details_str = None
        if details is not None:
            details_str = json.dumps(details) if isinstance(details, dict) else str(details)

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
            details_str,
            ip_address,
        )
        return dict(row)
