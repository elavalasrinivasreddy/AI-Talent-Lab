// components/ChatWindow/MessageList.jsx
import { useEffect, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import MessageBubble from './MessageBubble';
import JDFullView from '../JD/JDFullView';
import InternalReviewCard, { MarketReviewCard } from '../JD/AgentRecommendations';
import CandidatesPanel from '../JD/CandidatesPanel';

const STATIC_GREETING = {
    id: 'static-greeting',
    role: 'assistant',
    content: `👋 **Hi! I'm your AI Hiring Assistant.**\n\nTell me about the role you're looking to hire for — the job title, and any details you already have in mind. You can also **upload an existing JD** using the 📎 button below.\n\nI'll ask a few quick follow-up questions and help you craft the perfect **Job Description**.`,
};

export default function MessageList() {
    const {
        messages, isTyping, fullJD,
        internalRecommendations, marketRecommendations,
        competitors, workflowStage,
        handleInternalComplete, handleMarketComplete,
    } = useChat();
    const bottomRef = useRef(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        return () => clearTimeout(timer);
    }, [messages, isTyping, fullJD, workflowStage]);

    const allMessages = messages.length === 0 ? [STATIC_GREETING] : messages;

    return (
        <div className="messages-area">
            {allMessages.map((msg) => (
                <div key={msg.id}>
                    <MessageBubble message={msg} />

                    {/* Internal Review Card — only after streaming is done */}
                    {msg.role === 'assistant' && !msg.isStreaming && msg.internalRecommendations && (
                        <InternalReviewCard
                            data={msg.internalRecommendations}
                            onComplete={handleInternalComplete}
                            isReadOnly={msg.isReadOnly}
                            acceptedSkillNames={msg.acceptedSkillNames}
                        />
                    )}

                    {/* Market Review Card — only after streaming is done */}
                    {msg.role === 'assistant' && !msg.isStreaming && msg.marketRecommendations && (
                        <MarketReviewCard
                            data={msg.marketRecommendations}
                            competitors={msg.competitors || competitors}
                            onComplete={handleMarketComplete}
                            isReadOnly={msg.isReadOnly}
                            acceptedSkillNames={msg.acceptedSkillNames}
                        />
                    )}

                    {/* Full JD — show during streaming OR after done */}
                    {msg.role === 'assistant' && (msg.isStreamingJD || (!msg.isStreaming && msg.finalJD)) && (
                        <>
                            <JDFullView jdFromMessage={msg.finalJD} isStreamingJD={msg.isStreamingJD} />
                            {!msg.isStreamingJD && workflowStage === 'done' && (
                                <CandidatesPanel />
                            )}
                        </>
                    )}
                </div>
            ))}

            {/* Typing indicator removed from here to prevent duplicate bubbles; it is handled organically inside MessageBubble. */}

            <div ref={bottomRef} />
        </div>
    );
}
