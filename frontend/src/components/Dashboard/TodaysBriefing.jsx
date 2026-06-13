/**
 * TodaysBriefing.jsx
 * The 3-lane grid: NOW (red) · NEXT (amber) · PULSE (teal).
 *
 * Props:
 *   lanes    — { now, next, pulse } — each has { rows, loading, error, retry }
 *   positions — full positions list (to determine onboarding state)
 */
import BriefingLane from './BriefingLane'
import OnboardingChecklist from './OnboardingChecklist'

// Lane tints — semantic, not arbitrary colors
const TINTS = {
  now:   'var(--color-danger, #EF4444)',
  next:  'var(--color-warning, #D97706)',
  pulse: 'var(--color-primary, #0D9488)',
}

// Empty messages from spec §6 verbatim
const EMPTY_MESSAGES = {
  now:   'All clear. Nothing’s blocked.',
  next:  'No interviews or deadlines scheduled. Quiet day ahead.',
  pulse: 'AI hasn’t run yet today. Background sourcing kicks in at 6 AM IST.',
}

export default function TodaysBriefing({ lanes, positions, role }) {
  // Onboarding hero: no active positions at all
  const hasPositions = Array.isArray(positions) && positions.some(p => p.status === 'open' || p.status === 'active')
  const allLanesLoading = lanes.now.loading && lanes.next.loading && lanes.pulse.loading

  if (!allLanesLoading && !hasPositions && positions !== undefined && positions.length === 0) {
    return <OnboardingChecklist role={role} positions={positions} />
  }

  return (
    <section className="tb-grid" aria-label="Today's Briefing">
      <BriefingLane
        label="NOW"
        tint={TINTS.now}
        rows={lanes.now.rows}
        loading={lanes.now.loading}
        error={lanes.now.error}
        onRetry={lanes.now.retry}
        emptyMessage={EMPTY_MESSAGES.now}
        maxRows={5}
      />
      <BriefingLane
        label="NEXT"
        tint={TINTS.next}
        rows={lanes.next.rows}
        loading={lanes.next.loading}
        error={lanes.next.error}
        onRetry={lanes.next.retry}
        emptyMessage={EMPTY_MESSAGES.next}
        maxRows={8}
      />
      <BriefingLane
        label="PULSE"
        tint={TINTS.pulse}
        rows={lanes.pulse.rows}
        loading={lanes.pulse.loading}
        error={lanes.pulse.error}
        onRetry={lanes.pulse.retry}
        emptyMessage={EMPTY_MESSAGES.pulse}
        maxRows={12}
      />
    </section>
  )
}
