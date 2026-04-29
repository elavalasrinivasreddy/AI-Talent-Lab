import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from '../../context/ChatContext';
import InternalCheckCard from './cards/InternalCheckCard';
import MarketResearchCard from './cards/MarketResearchCard';
import JDVariantsCard from './cards/JDVariantsCard';
import FinalJDCard from './cards/FinalJDCard';
import BiasCheckCard from './cards/BiasCheckCard';

const MessageBubble = ({ message }) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';

    if (isSystem) {
        return (
            <div style={{
                textAlign: 'center',
                padding: 'var(--space-2) var(--space-4)',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-muted)',
                fontStyle: 'italic'
            }}>
                {message.content}
            </div>
        );
    }

    return (
        <div className={`message-bubble ${isUser ? 'message-user' : 'message-ai'}`}>
            {isUser ? (
                <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
            ) : (
                <>
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                    {!message.isComplete && (
                        <span className="blinking-cursor">▌</span>
                    )}
                </>
            )}
        </div>
    );
};

const TypingIndicator = () => (
    <div className="message-bubble message-ai typing-indicator">
        <div className="dot"></div>
        <div className="dot"></div>
        <div className="dot"></div>
    </div>
);

const MessageList = () => {
    const {
        messages,
        isStreaming,
        internalCard,
        marketCard,
        variantsCard,
        finalJdMarkdown,
        streamingJdText,
        isJdStreaming,
        biasCard,
        error
    } = useChat();

    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, internalCard, marketCard, variantsCard, finalJdMarkdown, streamingJdText, biasCard, isStreaming]);

    // Show greeting for empty fresh chat
    const showWelcome = !messages.length && !isStreaming;

    return (
        <div className="chat-content">
            {showWelcome && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                    color: 'var(--color-text-muted)',
                    gap: 'var(--space-3)',
                    paddingTop: 'var(--space-16)'
                }}>
                    <div style={{ fontSize: '2.5rem' }}>🤖</div>
                    <h5 style={{ fontWeight: 600 }}>AI Hiring Assistant</h5>
                    <p style={{ maxWidth: 400, textAlign: 'center', fontSize: 'var(--font-size-sm)' }}>
                        Start by describing the role you want to hire for, or upload an existing JD.
                    </p>
                </div>
            )}

            {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
            ))}

            {/* Interactive Stage Cards */}
            {internalCard && <InternalCheckCard skills={internalCard} />}
            {marketCard && <MarketResearchCard data={marketCard} />}
            {variantsCard && <JDVariantsCard variants={variantsCard} />}

            {/* Streaming JD text (before finalization) */}
            {streamingJdText && !finalJdMarkdown && (
                <div className="chat-card mb-3" style={{ borderLeft: '4px solid var(--color-primary)' }}>
                    <div className="chat-card-header">
                        📄 Generating Job Description...
                    </div>
                    <div style={{
                        padding: 'var(--space-3)',
                        background: 'var(--color-bg-secondary)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-sm)',
                        maxHeight: 500,
                        overflowY: 'auto'
                    }}>
                        <ReactMarkdown>{streamingJdText}</ReactMarkdown>
                        {isJdStreaming && <span className="blinking-cursor">▌</span>}
                    </div>
                </div>
            )}

            {/* Final JD Card */}
            {finalJdMarkdown && <FinalJDCard markdown={finalJdMarkdown} isStreaming={false} />}

            {/* Bias Check Card */}
            {biasCard && <BiasCheckCard data={biasCard} />}

            {/* Error Display */}
            {error && (
                <div style={{
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'var(--color-danger-bg)',
                    border: '1px solid var(--color-danger)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-danger)',
                    fontSize: 'var(--font-size-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)'
                }}>
                    ⚠️ {error}
                </div>
            )}

            {/* Typing Indicator: Show when streaming text and last message is from user */}
            {isStreaming &&
             !internalCard &&
             !marketCard &&
             !variantsCard &&
             !streamingJdText &&
             (!messages.length || messages[messages.length - 1].role === 'user') && (
                <TypingIndicator />
            )}

            <div ref={endRef} />
        </div>
    );
};

export default MessageList;
