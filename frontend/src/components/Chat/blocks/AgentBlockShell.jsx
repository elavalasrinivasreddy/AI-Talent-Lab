import React from 'react';
import { IconCheck, IconLoader, IconX } from '../icons';

/**
 * Common frame for every inline agent block in the JD canvas.
 *
 * Provides the left-accent border (tinted per stage), the header row
 * (number badge · stage name · status pill · short tagline), and a body
 * slot for stage-specific content.
 *
 * Props:
 *   - stage     ('intake' | 'internal_check' | 'market_research' |
 *                'jd_variants' | 'bias_check')      — used for data-stage + color accent
 *   - number    (1-5)                — circle badge content
 *   - title     (string)             — stage display name ("Internal skills check")
 *   - subtitle  (string)             — short tagline under the title
 *   - status    ('done'|'active'|'pending'|'skipped')
 *   - children                       — block body
 */
export default function AgentBlockShell({
  stage,
  number,
  title,
  subtitle,
  status = 'done',
  children,
}) {
  return (
    <section
      className="agent-block"
      data-stage={stage}
      data-status={status}
      aria-labelledby={`agent-block-${stage}-title`}
    >
      <header className="agent-block-head">
        <span className="agent-block-num" aria-hidden="true">{number}</span>
        <div className="agent-block-titlewrap">
          <h3 className="agent-block-title" id={`agent-block-${stage}-title`}>
            {title}
          </h3>
          {subtitle && (
            <p className="agent-block-sub">{subtitle}</p>
          )}
        </div>
        <StatusBadge status={status} />
      </header>
      <div className="agent-block-body">{children}</div>
    </section>
  );
}

function StatusBadge({ status }) {
  if (status === 'done') {
    return (
      <span className="agent-block-status tone-done" title="Stage complete">
        <IconCheck size={12} /> Done
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="agent-block-status tone-active" title="Waiting on you">
        <IconLoader size={12} /> Active
      </span>
    );
  }
  if (status === 'skipped') {
    return (
      <span className="agent-block-status tone-skipped" title="Soft-skipped">
        <IconX size={12} /> Skipped
      </span>
    );
  }
  return (
    <span className="agent-block-status tone-pending" title="Not yet run">
      Pending
    </span>
  );
}
