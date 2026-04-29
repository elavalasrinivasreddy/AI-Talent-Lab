import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
    const { token } = useAuth();

    // ── Core state ────────────────────────────────────────────
    const [sessions, setSessions] = useState([]);
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [sessionTitle, setSessionTitle] = useState('New Hire');
    const [isTitleAnimating, setIsTitleAnimating] = useState(false);

    const [messages, setMessages] = useState([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [workflowStage, setWorkflowStage] = useState('intake');

    // ── Interactive card states ────────────────────────────────
    const [internalCard, setInternalCard] = useState(null);
    const [marketCard, setMarketCard] = useState(null);
    const [variantsCard, setVariantsCard] = useState(null);
    const [finalJdMarkdown, setFinalJdMarkdown] = useState(null);
    const [streamingJdText, setStreamingJdText] = useState('');
    const [isJdStreaming, setIsJdStreaming] = useState(false);
    const [biasCard, setBiasCard] = useState(null);

    const [error, setError] = useState(null);

    // ── Fetch sessions list ───────────────────────────────────
    const fetchSessions = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch('/api/v1/chat/sessions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSessions(data.sessions || []);
            }
        } catch (err) {
            console.error("Failed to fetch sessions", err);
        }
    }, [token]);

    // ── Load a specific session ───────────────────────────────
    const loadSession = useCallback(async (sessionId) => {
        if (!token) return;
        // Reset all card states on load
        setInternalCard(null);
        setMarketCard(null);
        setVariantsCard(null);
        setFinalJdMarkdown(null);
        setStreamingJdText('');
        setBiasCard(null);
        setError(null);

        try {
            const res = await fetch(`/api/v1/chat/sessions/${sessionId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setCurrentSessionId(data.id);
                setSessionTitle(data.title || 'New Hire');
                setWorkflowStage(data.workflow_stage || 'intake');

                // Restore messages from DB
                const dbMessages = (data.messages || []).map(m => ({
                    role: m.role,
                    content: m.content,
                    isComplete: true
                }));
                setMessages(dbMessages);

                // Restore interactive cards from graph_state_parsed
                const gs = data.graph_state_parsed || {};

                if (gs.awaiting_user_input) {
                    if (gs.stage === 'internal_check' && gs.internal_skills_found?.length) {
                        setInternalCard(gs.internal_skills_found);
                    } else if (gs.stage === 'market_research' && gs.market_skills_found?.length) {
                        setMarketCard({
                            skills: gs.market_skills_found,
                            competitors: gs.competitors_used || []
                        });
                    } else if (gs.stage === 'jd_variants' && gs.jd_variants?.length) {
                        setVariantsCard(gs.jd_variants);
                    }
                }

                if (gs.final_jd) {
                    setFinalJdMarkdown(gs.final_jd);
                }
                if (gs.bias_issues !== undefined) {
                    setBiasCard({ issues: gs.bias_issues, clean: (gs.bias_issues || []).length === 0 });
                }
            } else if (res.status === 404) {
                // Session doesn't exist yet — fresh chat
                setCurrentSessionId(sessionId);
                setMessages([]);
                setWorkflowStage('intake');
                setSessionTitle('New Hire');
            }
        } catch (err) {
            console.error("Failed to load session", err);
            setCurrentSessionId(sessionId);
        }
    }, [token]);

    // ── Delete a session ──────────────────────────────────────
    const deleteSession = useCallback(async (sessionId) => {
        if (!token) return;
        try {
            await fetch(`/api/v1/chat/sessions/${sessionId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setSessions(prev => prev.filter(s => s.id !== sessionId));
        } catch (err) {
            console.error("Failed to delete session", err);
        }
    }, [token]);

    // ── Title animation ───────────────────────────────────────
    const handleTitleAnimation = useCallback((newTitle) => {
        setIsTitleAnimating(true);
        setSessionTitle(newTitle);
        setTimeout(() => setIsTitleAnimating(false), 1500);
    }, []);

    // ── Main SSE streaming endpoint ───────────────────────────
    const sendMessage = useCallback(async (payload) => {
        setError(null);
        setIsStreaming(true);

        let activeSessionId = currentSessionId;

        // Generate session ID on first message (not on page load)
        if (!activeSessionId) {
            activeSessionId = crypto.randomUUID();
            setCurrentSessionId(activeSessionId);
            window.history.replaceState({}, '', `/chat/${activeSessionId}`);
        }

        if (payload.message) {
            setMessages(prev => [...prev, { role: 'user', content: payload.message, isComplete: true }]);
        }

        // Reset streaming JD text if we're generating a new one
        if (payload.action === 'select_variant') {
            setStreamingJdText('');
            setFinalJdMarkdown(null);
            setIsJdStreaming(true);
        }

        try {
            const response = await fetch('/api/v1/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    session_id: activeSessionId,
                    ...payload
                })
            });

            if (!response.ok) {
                const errBody = await response.text();
                throw new Error(`Stream failed: ${response.status} ${errBody}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const blocks = buffer.split('\n\n');
                buffer = blocks.pop(); // Keep incomplete chunk in buffer

                for (const block of blocks) {
                    if (!block.trim()) continue;

                    const eventMatch = block.match(/event:\s*([^\n]+)/);
                    const dataLines = block.split('\n').filter(l => l.startsWith('data: '));
                    const rawData = dataLines.map(l => l.slice(6)).join('\n');

                    if (eventMatch && rawData) {
                        const eventName = eventMatch[1].trim();
                        let parsed = {};
                        try {
                            parsed = JSON.parse(rawData);
                        } catch (e) {
                            console.warn('SSE JSON Parse Error', e, rawData);
                        }
                        handleStreamEvent(eventName, parsed);
                    }
                }
            }
        } catch (err) {
            console.error("Streaming error:", err);
            setError("Connection interrupted. Please try again.");
        } finally {
            setIsStreaming(false);
            setIsJdStreaming(false);
            // Refresh sidebar sessions after any stream completes
            fetchSessions();
        }
    }, [currentSessionId, token, fetchSessions]);

    // ── SSE event dispatcher ──────────────────────────────────
    const handleStreamEvent = useCallback((event, data) => {
        switch (event) {
            case 'token':
                setMessages(prev => {
                    const newMsgs = [...prev];
                    const lastMsg = newMsgs[newMsgs.length - 1];
                    if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.isComplete) {
                        return [...prev.slice(0, -1), { ...lastMsg, content: lastMsg.content + (data.content || '') }];
                    } else {
                        return [...prev, { role: 'assistant', content: data.content || '', isComplete: false }];
                    }
                });
                break;

            case 'stage_change':
                setWorkflowStage(data.stage);
                break;

            case 'title_update':
                if (data.title) handleTitleAnimation(data.title);
                break;

            case 'card_internal':
                setInternalCard(data.skills);
                break;

            case 'card_market':
                setMarketCard({ skills: data.skills, competitors: data.competitors });
                break;

            case 'card_variants':
                setVariantsCard(data.variants);
                break;

            case 'jd_token':
                setIsJdStreaming(true);
                setStreamingJdText(prev => prev + (data.content || ''));
                break;

            case 'card_bias':
                setBiasCard({ issues: data.issues, clean: data.clean });
                break;

            case 'stage_skipped':
                // Could show a system message
                setMessages(prev => [...prev, {
                    role: 'system',
                    content: data.reason || `${data.stage} was skipped.`,
                    isComplete: true
                }]);
                break;

            case 'error':
                setError(data.message || data.code);
                break;

            case 'done':
                // Finalize streaming text
                setMessages(prev => {
                    const newMsgs = [...prev];
                    const lastMsg = newMsgs[newMsgs.length - 1];
                    if (lastMsg && !lastMsg.isComplete) {
                        return [...prev.slice(0, -1), { ...lastMsg, isComplete: true }];
                    }
                    return prev;
                });
                // Promote streaming JD to final card
                setStreamingJdText(prev => {
                    if (prev) setFinalJdMarkdown(prev);
                    return '';
                });
                setIsJdStreaming(false);
                setIsStreaming(false);
                break;

            default:
                console.log('Unknown SSE event:', event, data);
                break;
        }
    }, [handleTitleAnimation]);

    // ── Clear cards after user acts on them ────────────────────
    const dismissInternalCard = useCallback(() => setInternalCard(null), []);
    const dismissMarketCard = useCallback(() => setMarketCard(null), []);
    const dismissVariantsCard = useCallback(() => setVariantsCard(null), []);

    const value = {
        sessions, fetchSessions,
        currentSessionId, loadSession, setCurrentSessionId,
        sessionTitle, setSessionTitle, isTitleAnimating,
        messages, workflowStage, isStreaming, error,
        sendMessage, deleteSession,
        internalCard, setInternalCard, dismissInternalCard,
        marketCard, setMarketCard, dismissMarketCard,
        variantsCard, setVariantsCard, dismissVariantsCard,
        finalJdMarkdown, streamingJdText, isJdStreaming,
        setFinalJdMarkdown,
        biasCard, setBiasCard
    };

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
