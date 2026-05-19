import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from '../../context/ChatContext';
import InternalCheckCard from './cards/InternalCheckCard';
import MarketResearchCard from './cards/MarketResearchCard';
import JDVariantsCard from './cards/JDVariantsCard';
import BiasCheckCard from './cards/BiasCheckCard';
import { IconArrowRight, IconAlertCircle } from './icons';

const SAMPLE_PROMPTS = [
    'I need a Senior Python Developer with FastAPI experience.',
    'Hiring a Product Designer for our growth team.',
    'Looking for a Staff Engineer to lead our platform team.',
];

const IntakeWelcome = ({ onPrompt }) => (
    <div className="intake-welcome">
        <div className="intake-welcome-eyebrow">Step 1 of 5 — Intake</div>
        <h1 className="intake-welcome-headline">
            Tell me what you're hiring for.
        </h1>
        <p className="intake-welcome-body">
            Describe the role in plain language — title, team, must-have skills, anything specific.
            I'll draft the job description with you, side-by-side, and source matching candidates the moment it's saved.
        </p>
        <div className="intake-prompts">
            {SAMPLE_PROMPTS.map((p, i) => (
                <button key={i} className="intake-prompt" onClick={() => onPrompt(p)}>
                    <span>{p}</span>
                    <IconArrowRight size={14} />
                </button>
            ))}
        </div>
    </div>
);

const MessageBubble = ({ message }) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';

    if (isSystem) {
        return <div className="msg msg--system">{message.content}</div>;
    }

    const cleanContent = message.role === 'assistant'
        ? message.content.replace(/```json[\s\S]*?```/g, '').trim()
        : message.content;

    if (!cleanContent && !isUser) return null;

    return (
        <div className={`msg ${isUser ? 'msg--user' : 'msg--ai'}`}>
            <div className="msg-meta">{isUser ? 'You' : 'AI Assistant'}</div>
            <div className="msg-body">
                {isUser ? (
                    cleanContent
                ) : (
                    <>
                        <ReactMarkdown>{cleanContent}</ReactMarkdown>
                        {!message.isComplete && <span className="stream-cursor" aria-hidden="true" />}
                    </>
                )}
            </div>
        </div>
    );
};

const TypingRow = () => (
    <div className="msg msg--ai">
        <div className="msg-meta">AI Assistant</div>
        <div className="typing-row">
            <span className="typing-dots" aria-hidden="true">
                <span /><span /><span />
            </span>
            <span className="typing-label">Thinking</span>
        </div>
    </div>
);

const MessageList = ({ previewVariantType, setPreviewVariantType }) => {
    const {
        messages,
        isStreaming,
        internalCard,
        marketCard,
        variantsCard,
        biasCard,
        biasIssues,
        workflowStage,
        error,
        sendMessage,
    } = useChat();

    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [messages, internalCard, marketCard, variantsCard, isStreaming]);

    const isFreshIntake =
        workflowStage === 'intake' &&
        (!messages.length ||
            (messages.length === 1 && messages[0].role === 'assistant'));

    const lastMsg = messages[messages.length - 1];
    const showTyping =
        isStreaming &&
        (!lastMsg || lastMsg.role === 'user' || lastMsg.isComplete);

    // Inclusivity-passed pill shown once a clean check completes (rail-side echo of canvas state).
    const showInclusivityPill = biasCard?.clean === true && (biasIssues?.length ?? 0) === 0;

    return (
        <div className="chat-stream">
            <div className="chat-stream-inner">
                {isFreshIntake && (
                    <IntakeWelcome onPrompt={(p) => sendMessage({ message: p })} />
                )}

                {messages.map((msg, i) => (
                    <MessageBubble key={i} message={msg} />
                ))}

                {showTyping && <TypingRow />}

                {internalCard && <InternalCheckCard skills={internalCard} />}
                {marketCard && <MarketResearchCard data={marketCard} />}
                {variantsCard && (
                    <JDVariantsCard
                        data={variantsCard}
                        previewVariantType={previewVariantType}
                        setPreviewVariantType={setPreviewVariantType}
                    />
                )}

                {showInclusivityPill && <BiasCheckCard data={biasCard} />}

                {error && (
                    <div className="chat-error" role="alert">
                        <IconAlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                <div ref={endRef} />
            </div>
        </div>
    );
};

export default MessageList;
