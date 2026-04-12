import ReactMarkdown from 'react-markdown';
import JDOverviewCards from '../JD/JDOverviewCards';

const USER_INITIALS = (import.meta.env.VITE_USER_NAME || 'Elavala').slice(0, 2).toUpperCase();

export default function MessageBubble({ message }) {
    const isUser = message.role === 'user';
    const isBot = message.role === 'assistant';
    const isStreaming = message.isStreaming;

    // Hide empty assistant bubbles (no content + not actively streaming + no attached cards)
    if (isBot && !isStreaming && !message.content?.trim() &&
        !message.internalRecommendations && !message.marketRecommendations &&
        !message.overviews && !message.finalJD) {
        return null;
    }

    return (
        <>
            <div className={`message-row ${isUser ? 'user' : 'bot'}`}>
                {isBot && (
                    <div className="msg-avatar bot">🤖</div>
                )}
                <div className={`message-bubble ${isUser ? 'user' : 'bot'}`}>
                    {isUser ? (
                        message.content
                    ) : isStreaming && !message.content ? (
                        <div className="typing-indicator">
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                        </div>
                    ) : (
                        <div className={`markdown-body ${isStreaming ? 'streaming-active' : ''}`}>
                            <ReactMarkdown>
                                {message.content + (isStreaming ? ' ▋' : '')}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>
                {isUser && (
                    <div className="msg-avatar user">{USER_INITIALS}</div>
                )}
            </div>

            {/* JD Overview Cards — only show after streaming is done */}
            {isBot && !isStreaming && message.overviews && (
                <JDOverviewCards overviews={message.overviews} />
            )}
        </>
    );
}
