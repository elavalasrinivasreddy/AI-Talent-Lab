/**
 * DashboardPage.jsx — v3 redesign
 * Route: /dashboard
 *
 * Layout (top to bottom):
 *   TopBar: greeting + role suffix + period switcher + New Hire button
 *   DeptChipBar (admin only)
 *   HealthStrip  (admin only)
 *   CopilotBar
 *   TodaysBriefing (NOW / NEXT / PULSE lanes)
 *   Bottom row: VelocitySparkline (2/3) + PositionPulse (1/3)
 *
 * Legacy fallback: add ?legacy_dashboard=1 to URL to see old dashboard.
 *
 * Roles: org_head | dept_admin | hr | team_lead | platform_admin
 * See backend/models/auth.py for canonical role list.
 */
import { useState, useMemo, lazy, Suspense } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

// Legacy dashboard — loaded lazily only when ?legacy_dashboard=1
const LegacyDashboard = lazy(() => import('./legacy/LegacyDashboard'))

import RoleGate         from '../common/RoleGate'
import Icon             from '../common/Icon'

import useDashboardData from './useDashboardData'
import TodaysBriefing   from './TodaysBriefing'
import CopilotBar       from './CopilotBar'
import DeptChipBar      from './DeptChipBar'
import HealthStrip      from './HealthStrip'
import PositionPulse    from './PositionPulse'
import VelocitySparkline from './VelocitySparkline'

import '../../styles/dashboard.css'

// ── Role display helpers ──────────────────────────────────────────────────────

const ROLE_LABELS = {
  org_head:       'Org Head',
  dept_admin:     'Dept Admin',
  hr:             'Recruiter',
  team_lead:      'Hiring Manager',
  platform_admin: 'Admin',
}

// Spec §5 — topbar greeting suffixes
function greetingSuffix(role, data) {
  const { positions, health, lanes } = data
  const pendingApprovalCount = 0 // not fetched at page level; can wire later
  if (role === 'org_head' || role === 'dept_admin') {
    const openReqs = health?.open_reqs ?? health?.active_positions ?? (positions?.length || 0)
    const scope = role === 'org_head' ? 'Org-wide' : 'Department'
    return `${scope} health · ${openReqs} open req${openReqs !== 1 ? 's' : ''}`
  }
  if (role === 'hr') {
    const nowCount  = lanes?.now?.rows?.length  || 0
    const pulseCount = lanes?.pulse?.rows?.length || 0
    return `${nowCount} thing${nowCount !== 1 ? 's' : ''} need you · AI working on ${pulseCount}`
  }
  if (role === 'team_lead') {
    const openPos = positions?.filter(p => p.status === 'open' || p.status === 'active').length || 0
    const nextCount = lanes?.next?.rows?.length || 0
    return `${openPos} open req${openPos !== 1 ? 's' : ''} · ${nextCount} interview${nextCount !== 1 ? 's' : ''} this week`
  }
  return null
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// Derive unique dept names from positions list
function deriveDepts(positions) {
  const seen = new Set()
  const depts = []
  for (const p of positions) {
    const d = p.department_name
    if (d && !seen.has(d)) { seen.add(d); depts.push(d) }
  }
  return depts.sort()
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()

  // Legacy fallback
  const legacyMode = searchParams.get('legacy_dashboard') === '1'

  const role   = user?.role || 'hr'
  const [period, setPeriod] = useState('week')
  const [selectedDept, setSelectedDept] = useState('all')

  const data = useDashboardData(role, period, selectedDept)
  const { lanes, suggestions, positions, health, loading, error, dismiss, dismissAll } = data

  const depts   = useMemo(() => deriveDepts(positions), [positions])
  const suffix  = greetingSuffix(role, { positions, health, lanes })
  const roleLabel = ROLE_LABELS[role] || role

  // New Hire button label per spec §5
  const newHireLabel = role === 'team_lead' ? 'File Hire Request' : 'New Hire'
  const newHireTo    = role === 'team_lead' ? '/hire-requests/new' : '/chat'

  if (legacyMode) {
    return (
      <Suspense fallback={<div style={{ padding: 'var(--space-8)', color: 'var(--color-text-secondary, #94A3B8)' }}>Loading…</div>}>
        <LegacyDashboard />
      </Suspense>
    )
  }

  return (
    <div className="dash-v3">

      {/* ── TopBar ── */}
      <div className="dash-topbar">
        <div className="dash-greeting">
          <h1 className="dash-greeting-title">
            {getGreeting()}, {user?.name?.split(' ')[0] || 'there'}
            <span className="dash-role-badge">{roleLabel}</span>
          </h1>
          {suffix && <p className="dash-greeting-sub">{suffix}</p>}
        </div>

        <div className="dash-topbar-actions">
          <Link to={newHireTo} className="dash-new-hire-btn">
            <Icon name="plus" size={14} />
            {newHireLabel}
          </Link>
          <div className="dash-period-switcher">
            {['today', 'week', 'month'].map(p => (
              <button
                key={p}
                className={`dash-period-btn${period === p ? ' active' : ''}`}
                onClick={() => setPeriod(p)}
                type="button"
              >
                {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Dept Chip Bar — admin only ── */}
      <RoleGate roles={['org_head', 'dept_admin', 'platform_admin']}>
        <DeptChipBar
          departments={depts}
          selected={selectedDept}
          onChange={setSelectedDept}
        />
      </RoleGate>

      {/* ── Health Strip — admin only ── */}
      <RoleGate roles={['org_head', 'dept_admin', 'platform_admin']}>
        <HealthStrip
          health={health}
          loading={loading.health}
          error={error.health}
        />
      </RoleGate>

      {/* ── AI Copilot Bar ── */}
      <CopilotBar
        suggestions={suggestions}
        onDismiss={dismiss}
        onDismissAll={dismissAll}
      />

      {/* ── Today's Briefing — 3 lanes ── */}
      <TodaysBriefing
        lanes={lanes}
        positions={positions}
        role={role}
      />

      {/* ── Bottom row: Velocity + Position Pulse ── */}
      <div className="dash-bottom-row">
        <VelocitySparkline
          activity={lanes.pulse.rows}
          health={health}
        />
        <PositionPulse
          positions={positions}
          loading={loading.positions}
          error={error.positions}
        />
      </div>

    </div>
  )
}
