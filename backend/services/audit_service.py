"""
services/audit_service.py – Business logic for audit logs.
"""
import logging
from typing import Optional, List, Dict, Any

from backend.db.connection import get_connection

logger = logging.getLogger(__name__)


class AuditService:
    @staticmethod
    async def get_logs(
        org_id: int, 
        limit: int = 50, 
        offset: int = 0,
        user_id_filter: Optional[int] = None,
        action_filter: Optional[str] = None,
        search_filter: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fetch audit logs for an organization.
        Join with users table to get the user name.
        """
        filters = ["a.org_id = $1"]
        params = [org_id]
        param_idx = 2

        if user_id_filter:
            filters.append(f"a.user_id = ${param_idx}")
            params.append(user_id_filter)
            param_idx += 1

        if action_filter:
            filters.append(f"a.action = ${param_idx}")
            params.append(action_filter)
            param_idx += 1

        if search_filter:
            filters.append(f"(COALESCE(u.name, 'System') ILIKE ${param_idx} OR u.email ILIKE ${param_idx} OR a.action ILIKE ${param_idx} OR a.ip_address ILIKE ${param_idx} OR COALESCE(a.entity_type || ' #' || a.entity_id::TEXT, a.entity_type) ILIKE ${param_idx} OR to_char(a.created_at, 'Mon DD, YYYY') ILIKE ${param_idx} OR to_char(a.created_at, 'FMMonth DD, YYYY') ILIKE ${param_idx} OR CAST(a.created_at AS TEXT) ILIKE ${param_idx})")
            params.append(f"%{search_filter}%")
            param_idx += 1

        where_clause = " AND ".join(filters)

        query = f"""
            SELECT 
                a.id, a.org_id, a.user_id, a.action, a.entity_type, a.entity_id, 
                a.details, a.ip_address, a.created_at,
                u.name as user_name, u.email as user_email
            FROM audit_log a
            LEFT JOIN users u ON u.id = a.user_id
            WHERE {where_clause}
            ORDER BY a.created_at DESC
            LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """
        
        count_query = f"""
            SELECT COUNT(*) 
            FROM audit_log a
            LEFT JOIN users u ON u.id = a.user_id
            WHERE {where_clause}
        """

        async with get_connection() as conn:
            total_count = await conn.fetchval(count_query, *params)
            
            # Add limit and offset
            params.extend([limit, offset])
            rows = await conn.fetch(query, *params)

        return {
            "total": total_count or 0,
            "logs": [dict(r) for r in rows],
            "limit": limit,
            "offset": offset
        }
