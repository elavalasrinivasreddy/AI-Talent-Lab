import React from 'react';
import AgentBlockShell from './AgentBlockShell';

/**
 * Stage 1 — Intake.
 *
 * Renders captured fields as a tight grid once we have enough info to leave
 * the intake stage. Source: AgentState (role_name, experience_min/max, etc.)
 * Phase 1 read-only; Phase 2 may add inline edit.
 */
export default function AgentBlockIntake({ state }) {
  if (!state) return null;

  // Build the list of captured fields. We render any non-empty entry — empty
  // strings, nulls, and empty lists are excluded so the grid doesn't look like
  // a half-filled form.
  const rows = [];
  if (state.role_name)
    rows.push({ label: 'Role', value: state.role_name });
  if (state.experience_min != null || state.experience_max != null) {
    const min = state.experience_min ?? 0;
    const max = state.experience_max != null ? `${state.experience_max} yrs` : 'open';
    rows.push({ label: 'Experience', value: `${min}–${max}` });
  }
  if (state.location) rows.push({ label: 'Location', value: state.location });
  if (state.work_type) rows.push({ label: 'Work type', value: capitalize(state.work_type) });
  if (state.employment_type)
    rows.push({ label: 'Employment', value: capitalize(state.employment_type) });
  if (state.skills_required && state.skills_required.length)
    rows.push({ label: 'Must-have', value: state.skills_required.join(', ') });
  if (state.additional_requirements)
    rows.push({ label: 'Notes', value: state.additional_requirements });

  if (!rows.length) return null;

  return (
    <AgentBlockShell
      stage="intake"
      number={1}
      title="Intake"
      subtitle={`${rows.length} field${rows.length === 1 ? '' : 's'} captured`}
      status="done"
    >
      <dl className="intake-grid">
        {rows.map((r) => (
          <div key={r.label} className="intake-cell">
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </AgentBlockShell>
  );
}

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}
