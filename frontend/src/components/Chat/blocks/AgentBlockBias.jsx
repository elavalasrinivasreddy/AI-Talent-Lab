import React from 'react';
import { useChat } from '../../../context/ChatContext';
import AgentBlockShell from './AgentBlockShell';
import { IconCheck, IconArrowRight, IconShield } from '../icons';

/**
 * Stage 6 — Inclusivity / Bias check.
 *
 * Three states:
 *   1. Not yet triggered (workflowStage = final_jd, biasCard = null):
 *      shows a "Run inclusivity check" call to action.
 *   2. Clean: shows pass card.
 *   3. Issues found: lists each "find → replace" pair with an Apply button.
 *
 * Phase 1 ships triggers + listing. Per-issue `Apply` patching the canvas
 * JD text in place is deferred to Phase 2 (needs editable canvas content).
 */
export default function AgentBlockBias() {
  const {
    biasCard,
    biasIssues,
    sendMessage,
    finalJdMarkdown,
    workflowStage,
    isStreaming,
  } = useChat();

  // Only show the block once we have a final JD to check against.
  if (!finalJdMarkdown) return null;

  const onRun = () => {
    if (!finalJdMarkdown) return;
    sendMessage({
      action: 'trigger_bias_check',
      action_data: { content: finalJdMarkdown },
    });
  };

  // Not triggered yet
  if (!biasCard) {
    return (
      <AgentBlockShell
        stage="bias_check"
        number={6}
        title="Inclusivity check"
        subtitle="Soft-skippable. Scans the final JD for gendered or exclusionary language."
        status="pending"
      >
        <div className="bias-cta">
          <button
            type="button"
            className="btn btn--primary"
            onClick={onRun}
            disabled={isStreaming || workflowStage === 'bias_check'}
          >
            <IconShield size={14} /> Run inclusivity check
          </button>
        </div>
      </AgentBlockShell>
    );
  }

  // Clean result
  if (biasCard.clean || biasIssues.length === 0) {
    return (
      <AgentBlockShell
        stage="bias_check"
        number={6}
        title="Inclusivity check"
        subtitle="No biased or exclusionary phrasing detected."
        status="done"
      >
        <div className="bias-pass">
          <span className="bias-pass-icon" aria-hidden="true"><IconCheck size={16} /></span>
          <div>
            <strong>JD reads inclusively.</strong>
            <p>Run the check again if you make significant content edits.</p>
          </div>
        </div>
      </AgentBlockShell>
    );
  }

  // Issues found — list fix pairs
  return (
    <AgentBlockShell
      stage="bias_check"
      number={6}
      title="Inclusivity check"
      subtitle={`${biasIssues.length} suggestion${biasIssues.length === 1 ? '' : 's'} to consider`}
      status="active"
    >
      <ul className="bias-issue-list">
        {biasIssues.map((issue, i) => (
          <li key={i} className="bias-issue">
            <div className="bias-issue-pair">
              <span className="bias-issue-from">"{issue.phrase}"</span>
              <IconArrowRight size={14} />
              <span className="bias-issue-to">"{issue.suggestion}"</span>
            </div>
            {issue.reason && (
              <p className="bias-issue-why">{issue.reason}</p>
            )}
          </li>
        ))}
      </ul>
      <p className="bias-issue-foot">
        Suggestions are advisory. Apply by editing the JD body above directly,
        or re-run after manual fixes.
      </p>
    </AgentBlockShell>
  );
}
