import React from 'react';
import { IconCheck } from './icons';

/**
 * Shared skill-chip atom for Internal / Market agent blocks.
 *
 * Renders the skill name on the left and a smaller provenance label on the
 * right, separated by a thin divider. Clickable to toggle accepted state.
 *
 * Props:
 *   - skill (string)         — skill name
 *   - source (string)        — where it came from (past JD title, competitor)
 *   - year (number|null)     — optional source year
 *   - selected (bool)        — whether user has accepted it
 *   - tone ('internal'|'market') — drives color accent
 *   - onToggle (fn)          — click handler
 */
export default function ProvenanceChip({ skill, source, year, selected, tone = 'internal', onToggle }) {
  const provenanceText = year ? `${source} · ${year}` : source;

  return (
    <button
      type="button"
      className={`prov-chip ${selected ? 'prov-chip--on' : ''}`}
      data-tone={tone}
      onClick={onToggle}
      aria-pressed={selected}
    >
      <span className="prov-chip-tick" aria-hidden="true">
        {selected ? <IconCheck size={11} /> : null}
      </span>
      <span className="prov-chip-skill">{skill}</span>
      {source && (
        <span className="prov-chip-source" title={provenanceText}>
          {provenanceText}
        </span>
      )}
    </button>
  );
}
