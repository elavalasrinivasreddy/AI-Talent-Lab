// context/ChatContext.jsx – Global app state with SSE streaming support
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import * as api from '../api/client';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [chatTitle, setChatTitle] = useState(null);
    const [titleAnimating, setTitleAnimating] = useState(false);
    const [fullJD, setFullJD] = useState(null);

    // Workflow state
    const [workflowStage, setWorkflowStage] = useState('intake');
    const [internalRecommendations, setInternalRecommendations] = useState(null);
    const [marketRecommendations, setMarketRecommendations] = useState(null);
    const [competitors, setCompetitors] = useState(null);
    const [baselineRequirements, setBaselineRequirements] = useState(null);
    const [jdOverviews, setJdOverviews] = useState(null);
    const [selectedOverview, setSelectedOverview] = useState(null);

    // Accepted skills
    const [acceptedInternalSkills, setAcceptedInternalSkills] = useState(null);
    const [acceptedMarketSkills, setAcceptedMarketSkills] = useState(null);

    // Ref to track the current streaming message ID
    const streamingMsgIdRef = useRef(null);
    const sessionIdRef = useRef(null);
    const firstTokenReceivedRef = useRef(false);

    const appendMessage = useCallback((role, content, extra = {}) => {
        const id = Date.now() + Math.random();
        setMessages(prev => [...prev, { role, content, id, ...extra }]);
        return id;
    }, []);

    // ── Streaming message sender ──────────────────────────────────────────
    const sendMessage = useCallback(async (text) => {
        if (!text.trim()) return;

        appendMessage('user', text);
        setIsTyping(true);
        firstTokenReceivedRef.current = false;

        // Create placeholder for the assistant reply
        let assistantMsgId = Date.now() + Math.random();
        streamingMsgIdRef.current = assistantMsgId;
        setMessages(prev => [...prev, {
            role: 'assistant',
            content: '',
            id: assistantMsgId,
            isStreaming: true,
        }]);

        try {
            await api.streamMessage(text, activeSessionId || sessionIdRef.current, {
                onToken: (token) => {
                    // Hide typing dots as soon as first token arrives
                    if (!firstTokenReceivedRef.current) {
                        firstTokenReceivedRef.current = true;
                        setIsTyping(false);
                    }
                    // Append token to the streaming message
                    setMessages(prev => prev.map(m =>
                        m.id === assistantMsgId
                            ? { ...m, content: m.content + token }
                            : m
                    ));
                },

                onJDToken: (token) => {
                    // JD tokens go to finalJD field (for JD card), NOT content (chat bubble)
                    if (!firstTokenReceivedRef.current) {
                        firstTokenReceivedRef.current = true;
                        setIsTyping(false);
                    }
                    setMessages(prev => prev.map(m =>
                        m.id === assistantMsgId
                            ? { ...m, finalJD: (m.finalJD || '') + token, isStreamingJD: true }
                            : m
                    ));
                    setFullJD(prev => (prev || '') + token);
                },

                onCardText: (text) => {
                    // Card text creates a NEW separate message (not appended to current bubble)
                    if (!firstTokenReceivedRef.current) {
                        firstTokenReceivedRef.current = true;
                        setIsTyping(false);
                    }
                    // Finalize the current streaming message
                    setMessages(prev => prev.map(m =>
                        m.id === assistantMsgId
                            ? { ...m, isStreaming: false }
                            : m
                    ));
                    // Create a new message with the card text
                    const cardMsgId = `card-${Date.now()}`;
                    streamingMsgIdRef.current = cardMsgId;
                    // Update assistantMsgId for subsequent metadata events
                    assistantMsgId = cardMsgId;
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: text,
                        id: cardMsgId,
                        isStreaming: true,
                    }]);
                },

                onMetadata: (data) => {
                    // Hide typing dots on metadata too
                    if (!firstTokenReceivedRef.current) {
                        firstTokenReceivedRef.current = true;
                        setIsTyping(false);
                    }

                    // Update session ID if this is a new session
                    if (data.session_id && !activeSessionId) {
                        setActiveSessionId(data.session_id);
                        sessionIdRef.current = data.session_id;
                    }

                    // Handle title update
                    if (data.title_updated && data.title) {
                        setChatTitle(data.title);
                        setTitleAnimating(true);
                        setTimeout(() => setTitleAnimating(false), 1800);
                        setSessions(prev => {
                            const sid = data.session_id || sessionIdRef.current;
                            const exists = prev.find(s => s.id === sid);
                            if (exists) return prev.map(s => s.id === sid ? { ...s, title: data.title } : s);
                            return [{ id: sid, title: data.title, created_at: new Date().toISOString() }, ...prev].slice(0, 20);
                        });
                    }

                    // Handle JD streaming start — mark message so JD card appears immediately
                    if (data.jd_streaming_start) {
                        setMessages(prev => prev.map(m =>
                            m.id === assistantMsgId
                                ? { ...m, finalJD: '', isStreamingJD: true, workflow_stage: 'done' }
                                : m
                        ));
                    }

                    // Handle workflow stage metadata
                    if (data.workflow_stage) setWorkflowStage(data.workflow_stage);
                    if (data.internal_recommendations) {
                        setInternalRecommendations(data.internal_recommendations);
                        setMessages(prev => prev.map(m =>
                            m.id === assistantMsgId
                                ? { ...m, internalRecommendations: data.internal_recommendations, workflow_stage: data.workflow_stage }
                                : m
                        ));
                    }
                    if (data.market_recommendations) {
                        setMarketRecommendations(data.market_recommendations);
                        if (data.competitors) setCompetitors(data.competitors);
                        setMessages(prev => prev.map(m =>
                            m.id === assistantMsgId
                                ? { ...m, marketRecommendations: data.market_recommendations, competitors: data.competitors, workflow_stage: data.workflow_stage }
                                : m
                        ));
                    }
                    if (data.jd_overviews) {
                        setJdOverviews(data.jd_overviews);
                        setMessages(prev => prev.map(m =>
                            m.id === assistantMsgId
                                ? { ...m, overviews: data.jd_overviews, workflow_stage: data.workflow_stage }
                                : m
                        ));
                    }
                    if (data.final_jd_markdown) {
                        setFullJD(data.final_jd_markdown);
                        setMessages(prev => prev.map(m =>
                            m.id === assistantMsgId
                                ? { ...m, finalJD: data.final_jd_markdown, workflow_stage: 'done', ready_to_generate: true, isStreamingJD: false }
                                : m
                        ));
                    }
                    if (data.baseline_requirements) {
                        setBaselineRequirements(data.baseline_requirements);
                    }
                },

                onDone: (data) => {
                    // Mark message as done streaming
                    setMessages(prev => prev.map(m =>
                        m.id === assistantMsgId
                            ? { ...m, isStreaming: false, isStreamingJD: false }
                            : m
                    ));
                    streamingMsgIdRef.current = null;
                    setIsTyping(false);
                },

                onError: (errorMsg) => {
                    console.error('Stream error:', errorMsg);
                    setMessages(prev => prev.map(m =>
                        m.id === assistantMsgId
                            ? { ...m, content: '⚠️ Something went wrong. Please try again.', isStreaming: false, isStreamingJD: false }
                            : m
                    ));
                    setIsTyping(false);
                },
            });
        } catch (err) {
            console.error('Stream fetch error:', err);
            setMessages(prev => prev.map(m =>
                m.id === assistantMsgId
                    ? { ...m, content: '⚠️ Connection failed. Please check the backend.', isStreaming: false }
                    : m
            ));
        } finally {
            setIsTyping(false);
            streamingMsgIdRef.current = null;
        }
    }, [activeSessionId, appendMessage]);

    // Handle internal skill selection complete
    const handleInternalComplete = useCallback(async (acceptedSkills, decision) => {
        setAcceptedInternalSkills(acceptedSkills);
        const skillNames = acceptedSkills.map(s => s.name);
        const msg = decision === 'accepted'
            ? `Internal skills accepted: ${skillNames.join(', ')}. Proceed to market benchmarking.`
            : 'Internal skills skipped. Proceed to market benchmarking.';
        await sendMessage(msg);
    }, [sendMessage]);

    // Handle market skill selection complete
    const handleMarketComplete = useCallback(async (acceptedSkills, decision) => {
        setAcceptedMarketSkills(acceptedSkills);
        const skillNames = acceptedSkills.map(s => s.name);
        const msg = decision === 'accepted'
            ? `Market skills accepted: ${skillNames.join(', ')}. Please generate JD overviews.`
            : 'Market skills skipped. Please generate JD overviews.';
        await sendMessage(msg);
    }, [sendMessage]);

    // Generate full JD from selected overview
    const generateJD = useCallback(async (selectedOverviewText) => {
        setSelectedOverview(selectedOverviewText);
        const allAccepted = [
            ...(acceptedInternalSkills || []).map(s => s.name),
            ...(acceptedMarketSkills || []).map(s => s.name),
        ];
        const msg = `Selected JD overview style: ${selectedOverviewText}\n\nAll accepted additional skills: ${allAccepted.join(', ') || 'None'}\n\nPlease draft the final Job Description.`;
        await sendMessage(msg);
    }, [sendMessage, acceptedInternalSkills, acceptedMarketSkills]);

    const startNewChat = useCallback(() => {
        setActiveSessionId(null);
        sessionIdRef.current = null;
        setMessages([]);
        setChatTitle(null);
        setFullJD(null);
        setTitleAnimating(false);
        setWorkflowStage('intake');
        setInternalRecommendations(null);
        setMarketRecommendations(null);
        setCompetitors(null);
        setBaselineRequirements(null);
        setJdOverviews(null);
        setSelectedOverview(null);
        setAcceptedInternalSkills(null);
        setAcceptedMarketSkills(null);
    }, []);

    const loadSession = useCallback(async (sessionId) => {
        try {
            const data = await api.fetchSession(sessionId);
            setActiveSessionId(sessionId);
            sessionIdRef.current = sessionId;
            setChatTitle(data.title);

            // Restore messages with workflow card data attached
            const jdContent = data.full_jd || data.final_jd_markdown || null;
            let messagesList = data.messages.map((m, i) => ({
                id: `history-${i}`,
                role: m.role,
                content: m.content,
                isHistory: true,
                isReadOnly: true,
            }));

            // Attach workflow cards to the appropriate assistant messages based on content patterns
            const internalRecs = data.internal_recommendations;
            const marketRecs = data.market_recommendations;
            const competitors = data.competitors;
            const overviews = data.jd_overviews;
            const acceptedInternal = data.accepted_internal_skills || [];
            const acceptedMarket = data.accepted_market_skills || [];

            // Find assistant messages with internal check content
            if (internalRecs) {
                const internalIdx = messagesList.findIndex(m =>
                    m.role === 'assistant' && (
                        m.content.includes('Requirements captured') ||
                        m.content.includes('internal') ||
                        m.content.includes('past hires')
                    )
                );
                if (internalIdx >= 0) {
                    messagesList[internalIdx] = {
                        ...messagesList[internalIdx],
                        internalRecommendations: internalRecs,
                        acceptedSkillNames: acceptedInternal,
                        workflow_stage: 'internal_review',
                    };
                }
            }

            // Find assistant messages with market analysis content
            if (marketRecs) {
                const marketIdx = messagesList.findIndex(m =>
                    m.role === 'assistant' && (
                        m.content.includes('Market Benchmarking') ||
                        m.content.includes('competitor') ||
                        m.content.includes('market')
                    )
                );
                if (marketIdx >= 0) {
                    messagesList[marketIdx] = {
                        ...messagesList[marketIdx],
                        marketRecommendations: marketRecs,
                        competitors: competitors,
                        acceptedSkillNames: acceptedMarket,
                        workflow_stage: 'market_review',
                    };
                }
            }

            // Find assistant messages with JD variant content
            if (overviews) {
                const overviewIdx = messagesList.findIndex(m =>
                    m.role === 'assistant' && (
                        m.content.includes('Choose a JD Style') ||
                        m.content.includes('JD Style') ||
                        m.content.includes('variations')
                    )
                );
                if (overviewIdx >= 0) {
                    messagesList[overviewIdx] = {
                        ...messagesList[overviewIdx],
                        overviews: overviews,
                        workflow_stage: 'jd_variants',
                    };
                }
            }

            // If there's a generated JD, attach it to the last assistant message
            if (jdContent && messagesList.length > 0) {
                const lastAssistantIdx = messagesList.findLastIndex(m => m.role === 'assistant');
                if (lastAssistantIdx >= 0) {
                    messagesList[lastAssistantIdx] = {
                        ...messagesList[lastAssistantIdx],
                        finalJD: jdContent,
                        workflow_stage: 'done',
                    };
                }
            }

            setMessages(messagesList);
            setJdOverviews(overviews || null);
            setSelectedOverview(data.selected_overview || null);
            setFullJD(jdContent);
            setTitleAnimating(false);
            setInternalRecommendations(internalRecs || null);
            setMarketRecommendations(marketRecs || null);
            setCompetitors(competitors || null);

            // Restore workflow stage
            if (data.workflow_stage) {
                setWorkflowStage(data.workflow_stage);
            } else if (jdContent) {
                setWorkflowStage('done');
            }
        } catch (err) {
            console.error('Failed to load session:', err);
        }
    }, []);

    const removeSession = useCallback(async (sessionId, e) => {
        e.stopPropagation();
        try {
            await api.deleteSession(sessionId);
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            if (activeSessionId === sessionId) startNewChat();
        } catch (err) {
            console.error('Failed to delete session:', err);
        }
    }, [activeSessionId, startNewChat]);

    const renameSessionContext = useCallback(async (sessionId, newTitle) => {
        if (!newTitle.trim()) return;
        try {
            await api.renameSession(sessionId, newTitle);
            setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: newTitle } : s));
            if (activeSessionId === sessionId) {
                setChatTitle(newTitle);
            }
        } catch (err) {
            console.error('Failed to rename session:', err);
        }
    }, [activeSessionId]);

    const loadSessions = useCallback(async () => {
        try {
            const list = await api.fetchSessions();
            setSessions(list.slice(0, 20));
        } catch (err) { /* Backend might not be up yet */ }
    }, []);

    return (
        <ChatContext.Provider value={{
            sessions, activeSessionId, messages, isTyping,
            chatTitle, titleAnimating,
            jdOverviews, selectedOverview, fullJD, setFullJD,
            workflowStage,
            internalRecommendations, marketRecommendations, competitors, baselineRequirements,
            acceptedInternalSkills, acceptedMarketSkills,
            sendMessage, startNewChat, loadSession, removeSession, renameSession: renameSessionContext, loadSessions,
            generateJD, handleInternalComplete, handleMarketComplete,
        }}>
            {children}
        </ChatContext.Provider>
    );
}

export const useChat = () => useContext(ChatContext);
