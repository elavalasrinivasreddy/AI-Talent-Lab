import React from 'react';
import RailStateCard from './RailStateCard';
import RailConversation from './RailConversation';
import MessageInput from './MessageInput';
import FinalizeCTA from './FinalizeCTA';

/**
 * Right rail container — 320px fixed width per spec.
 *
 * Vertical stack:
 *   A — RailStateCard       (current stage + retry state)
 *   B — RailConversation    (supplementary chat feed)
 *   C — MessageInput + FinalizeCTA
 *
 * Spec: docs/design/pages/05_jd_chat.md §6.
 */
export default function JDRail() {
  return (
    <aside className="jd-rail" aria-label="Stage and conversation">
      <header className="jd-rail-head">
        <span className="jd-rail-head-label">State &amp; chat</span>
      </header>

      <RailStateCard />

      <RailConversation />

      <footer className="jd-rail-foot">
        <MessageInput />
        <FinalizeCTA />
      </footer>
    </aside>
  );
}
