import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from '../../context/ChatContext';
import { IconUser, IconBot } from './icons';

/**
 * Supplementary chat feed (right rail, middle section).
 *
 * Primary interaction happens on the canvas. This rail is for:
 *   - Intake Q&A
 *   - Asking for variant refinement or section rewrites
 *   - Trigger phrases like "check for bias"
 *
 * Spec: docs/design/pages/05_jd_chat.md §6.B.
 */
export default function RailConversation() {
  const { messages, isStreaming, workflowStage, finalJdMarkdown } = useChat();
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isStreaming]);

  const lastMsg = messages[messages.length - 1];
  const showTyping =
    isStreaming &&
    (!lastMsg || lastMsg.role === 'user' || lastMsg.isComplete);

  const hint = getStageHint(workflowStage, finalJdMarkdown);

  return (
    <div className="rail-convo">
      {hint && <div className="rail-convo-hint">{hint}</div>}
      <ul className="rail-convo-list">
        {messages.map((m, i) => (
          <Bubble key={i} message={m} />
        ))}
        {showTyping && <TypingRow />}
      </ul>
      <div ref={endRef} />
    </div>
  );
}

function getStageHint(stage, finalJdMarkdown) {
  if (stage === 'jd_variants') {
    return 'Type a refinement to regenerate variants, or pick one on the canvas.';
  }
  if ((stage === 'final_jd' || stage === 'bias_check') && finalJdMarkdown) {
    return 'Type an instruction to rewrite a section, or use the Apply buttons on bias issues.';
  }
  return null;
}

function Bubble({ message }) {
  const role = message.role;

  if (role === 'system') {
    return <li className="rail-msg rail-msg--system">{message.content}</li>;
  }

  // Strip embedded JSON blocks that the agent sometimes emits in its
  // assistant response (e.g. action confirmations). Same logic as the old
  // MessageList — keeping behavior parity to avoid surprises.
  const cleaned =
    role === 'assistant'
      ? (message.content || '').replace(/```json[\s\S]*?```/g, '').trim()
      : message.content;

  if (!cleaned && role !== 'user') return null;

  return (
    <li className={`rail-msg rail-msg--${role}`}>
      <div className="rail-msg-avatar">
        {role === 'user' ? <IconUser size={16} /> : <IconBot size={16} />}
      </div>
      <div className="rail-msg-bubble">
        <div className="rail-msg-meta">{role === 'user' ? 'You' : 'AI'}</div>
        <div className="rail-msg-body">
          {role === 'assistant' ? (
            <>
              <ReactMarkdown>{cleaned}</ReactMarkdown>
              {!message.isComplete && <span className="rail-stream-cursor" aria-hidden="true" />}
            </>
          ) : (
            cleaned
          )}
        </div>
      </div>
    </li>
  );
}

function TypingRow() {
  return (
    <li className="rail-msg rail-msg--assistant">
      <div className="rail-msg-avatar">
        <IconBot size={16} />
      </div>
      <div className="rail-msg-bubble">
        <div className="rail-msg-meta">AI</div>
        <div className="rail-typing">
          <span /><span /><span />
        </div>
      </div>
    </li>
  );
}
