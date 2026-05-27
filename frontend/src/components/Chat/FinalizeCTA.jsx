import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import PositionSetupModal from './PositionSetupModal';
import { IconCheck, IconArrowRight } from './icons';

/**
 * Rail footer — Finalize CTA.
 *
 * Disabled until there's a final JD. Clicking opens the existing
 * `PositionSetupModal` which collects department / headcount / priority /
 * ATS threshold and calls `POST /chat/sessions/{id}/save-position`.
 *
 * Spec: docs/redesign/05_jd_chat.md §6.C.
 */
export default function FinalizeCTA() {
  const { workflowStage, finalJdMarkdown } = useChat();
  const [open, setOpen] = useState(false);

  // Allow saving once we have a final JD — the orchestrator marks stage as
  // `complete` on explicit `finalize_jd`, but we let the user finalize as
  // soon as the JD exists, matching today's behavior.
  const canFinalize = Boolean(finalJdMarkdown) && workflowStage !== 'intake';
  const isComplete = workflowStage === 'complete';

  return (
    <>
      <button
        type="button"
        className="rail-finalize"
        data-ready={canFinalize || undefined}
        onClick={() => setOpen(true)}
        disabled={!canFinalize}
      >
        <span className="rail-finalize-icon" aria-hidden="true">
          {isComplete ? <IconCheck size={14} /> : <IconArrowRight size={14} />}
        </span>
        <span className="rail-finalize-body">
          <strong>Save &amp; find candidates</strong>
          <small>
            {canFinalize
              ? 'Creates the position and starts sourcing.'
              : 'Enabled once the JD is drafted.'}
          </small>
        </span>
      </button>

      <PositionSetupModal
        show={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
