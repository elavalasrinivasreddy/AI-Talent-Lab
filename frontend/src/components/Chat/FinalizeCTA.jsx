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
 * Spec: docs/design/pages/05_jd_chat.md §6.C.
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
        className="btn btn-primary btn-sm"
        onClick={() => setOpen(true)}
        disabled={!canFinalize}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '24px', padding: '6px 16px', fontWeight: 500, fontSize: '13px' }}
      >
        {isComplete ? <IconCheck size={14} /> : null}
        <span>Save & find candidates</span>
      </button>

      <PositionSetupModal
        show={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
