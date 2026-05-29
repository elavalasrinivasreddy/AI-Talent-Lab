/**
 * components/common/RoleGate.jsx
 * Renders children only when the current user's role matches.
 * Used for role-adaptive UI on Dashboard, Settings, etc.
 * Spec: docs/design/00_design_system.md §5.
 *
 * Roles (current model, backend/models/auth.py): org_head | dept_admin | hr | team_lead
 * plus platform_admin.
 *
 * Usage:
 *   <RoleGate roles="org_head">...</RoleGate>
 *   <RoleGate roles={['org_head', 'dept_admin']} fallback={<Locked />}>...</RoleGate>
 */
import { useAuth } from '../../context/AuthContext'

export default function RoleGate({ roles, children, fallback = null }) {
  const { user } = useAuth()
  const role = user?.role
  const allowed = Array.isArray(roles) ? roles : [roles]
  return allowed.includes(role) ? <>{children}</> : fallback
}
