import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from '../../context/ChatContext';
import AgentBlockIntake from './blocks/AgentBlockIntake';
import AgentBlockInternal from './blocks/AgentBlockInternal';
import AgentBlockMarket from './blocks/AgentBlockMarket';
import AgentBlockVariants from './blocks/AgentBlockVariants';
import AgentBlockBias from './blocks/AgentBlockBias';
import { IconFileText, IconSparkles } from './icons';

/**
 * JDCanvas — the document-first surface (~65% of the chat page).
 *
 * Renders inline agent blocks in pipeline order plus the JD body that gets
 * streamed in once the user picks a variant. The whole thing is one long
 * vertical doc — that's the entire point of the redesign: the JD IS the
 * canvas, chat is a side rail.
 *
 * Per docs/redesign/05_jd_chat.md §5.
 */
export default function JDCanvas() {
  const {
    graphState,
    sessionTitle,
    internalCard,
    marketCard,
    variantsCard,
    finalJdMarkdown,
    streamingJdText,
    isJdStreaming,
    workflowStage,
  } = useChat();

  const hasContent =
    Boolean(internalCard) ||
    Boolean(marketCard) ||
    Boolean(variantsCard) ||
    Boolean(finalJdMarkdown) ||
    Boolean(streamingJdText) ||
    Boolean(graphState?.role_name);

  if (!hasContent) {
    return <EmptyCanvas />;
  }

  // The streaming text takes precedence — once it's promoted to finalJdMarkdown
  // by the `done` event, we render the saved markdown instead.
  const jdBody = finalJdMarkdown || streamingJdText;

  return (
    <div className="jd-doc">
      <CanvasHeader title={sessionTitle} graphState={graphState} />

      <AgentBlockIntake state={graphState} />
      {internalCard && <AgentBlockInternal />}
      {marketCard && <AgentBlockMarket />}
      {variantsCard && <AgentBlockVariants />}

      {jdBody && (
        <article className="jd-body">
          <ReactMarkdown>{jdBody}</ReactMarkdown>
          {isJdStreaming && <span className="jd-stream-cursor" aria-hidden="true" />}
        </article>
      )}

      {/* Bias block renders itself only when there's a final JD to check. */}
      <AgentBlockBias />
    </div>
  );
}

function CanvasHeader({ title, graphState }) {
  const meta = [];
  if (graphState?.location) meta.push(graphState.location);
  if (graphState?.work_type) {
    const wt = graphState.work_type.charAt(0).toUpperCase() + graphState.work_type.slice(1);
    meta.push(wt);
  }
  if (graphState?.experience_min != null || graphState?.experience_max != null) {
    const min = graphState.experience_min ?? 0;
    const max = graphState.experience_max != null ? `${graphState.experience_max} yrs` : 'open';
    meta.push(`${min}–${max}`);
  }

  return (
    <header className="jd-doc-header">
      <span className="jd-doc-eyebrow">
        <IconFileText size={12} /> Job description
      </span>
      <h1 className="jd-doc-title">{title || graphState?.role_name || 'New role'}</h1>
      {meta.length > 0 && (
        <p className="jd-doc-meta">{meta.join(' · ')}</p>
      )}
    </header>
  );
}

function EmptyCanvas() {
  return (
    <div className="jd-doc jd-doc--empty">
      <div className="jd-empty-card">
        <span className="jd-empty-eyebrow">
          <IconSparkles size={12} /> Empty canvas
        </span>
        <h2>Your job description will appear here.</h2>
        <p>
          Start by telling the AI which role you&apos;re hiring for in the chat on
          the right. The JD will build itself in this space as we go — skills,
          variants, bias check, all inline.
        </p>
        <ul className="jd-empty-points">
          <li>The agent records intake fields as a captured-data block.</li>
          <li>Internal + market skills appear as chip clouds you can toggle.</li>
          <li>Variants render side-by-side; pick one and the full JD streams in.</li>
        </ul>
      </div>
    </div>
  );
}
