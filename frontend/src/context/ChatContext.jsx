import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

/**
 * Item 15: Dynamic greeting — replaces static GREETING constant.
 * Uses time-of-day, user name, and session context.
 */
function buildGreeting(user, locationState, sessionData) {
    const hour = new Date().getHours();
    let timeGreet = 'Hi';
    if (hour >= 5 && hour < 12) timeGreet = 'Good morning';
    else if (hour >= 12 && hour < 17) timeGreet = 'Good afternoon';
    else if (hour >= 17 && hour < 22) timeGreet = 'Good evening';

    const firstName = user?.name?.split(' ')[0];
    const nameGreet = firstName ? `${timeGreet}, ${firstName}!` : `${timeGreet}!`;

    // Context-aware greeting body.
    // Note: the greeting is intentionally identical for the "New Hire" tab and the
    // hire-request pickup — a SaaS product should feel consistent across entry points.
    // The only contextual variant is a session resumed for revision.
    let body;
    if (sessionData?.position_status === 'draft_needs_revision') {
        body = `Your JD has feedback from the reviewer. Let's revise it together.`;
    } else {
        body = `Tell me about the role you're hiring for. I'll help you craft the perfect job description.`;
    }

    return { role: 'assistant', content: `${nameGreet} ${body}`, isComplete: true };
}

const DEFAULT_GREETING = { role: 'assistant', content: "Hi! Tell me about the role you're hiring for.", isComplete: true };

const ChatContext = createContext();

export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
    const { token } = useAuth();

    // ── Core state ────────────────────────────────────────────
    const [sessions, setSessions] = useState([]);
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [sessionTitle, setSessionTitle] = useState('New Hire');
    const [isTitleAnimating, setIsTitleAnimating] = useState(false);

    const [messages, setMessages] = useState([DEFAULT_GREETING]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [workflowStage, setWorkflowStage] = useState('intake');
    const [isReadOnly, setIsReadOnly] = useState(false);

    // ── Interactive card states ────────────────────────────────
    const [internalCard, setInternalCard] = useState(null);
    const [marketCard, setMarketCard] = useState(null);
    const [variantsCard, setVariantsCard] = useState(null);
    const [finalJdMarkdown, setFinalJdMarkdown] = useState(null);
    const [streamingJdText, setStreamingJdText] = useState('');
    const [isJdStreaming, setIsJdStreaming] = useState(false);
    const [biasCard, setBiasCard] = useState(null);
    const [biasIssues, setBiasIssues] = useState([]); // Store issues for highlighting
    const [stageSkipped, setStageSkipped] = useState([]); // stages soft-skipped during this session
    const [graphState, setGraphState] = useState({});     // mirror of backend graph_state_parsed (for intake block etc.)
    const [error, setError] = useState(null);
    const [sessionLoaded, setSessionLoaded] = useState(false);

    // ── Reset all chat state ──────────────────────────────────
    const resetChat = useCallback((user, locationState) => {
        setCurrentSessionId(null);
        setSessionTitle('New Hire');
        // Item 15: Dynamic greeting based on context
        const greeting = buildGreeting(user, locationState);
        setMessages([greeting]);
        setIsStreaming(false);
        setWorkflowStage('intake');
        setIsReadOnly(false);
        setInternalCard(null);
        setMarketCard(null);
        setVariantsCard(null);
        setFinalJdMarkdown(null);
        setStreamingJdText('');
        setIsJdStreaming(false);
        setBiasCard(null);
        setBiasIssues([]);
        setStageSkipped([]);
        setGraphState({});
        setError(null);
        setSessionLoaded(true);
    }, []);

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
        setSessionLoaded(false);
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
                
                // Read-only when position is submitted for approval (approval_status='pending')
                // or already live (status not in editable set: draft/jd_in_progress/rejected/draft_needs_revision).
                const pendingApproval = data.position_approval_status === 'pending';
                const statusLocked = data.position_status && !['draft', 'jd_in_progress', 'rejected', 'draft_needs_revision'].includes(data.position_status);
                setIsReadOnly(pendingApproval || !!statusLocked);

                // Restore messages from DB
                const dbMessages = (data.messages || []).map(m => ({
                    role: m.role,
                    content: m.content,
                    isComplete: true,
                    // Item 14: Preserve message_type for feedback_injection rendering
                    message_type: m.message_type || null,
                    revision_cycle: m.revision_cycle || null,
                }));
                if (dbMessages.length === 0 && (!data.workflow_stage || data.workflow_stage === 'intake')) {
                    setMessages([buildGreeting(null, null, data)]);
                } else {
                    setMessages(dbMessages);
                }

                // Restore interactive cards from graph_state_parsed
                // Show cards even if already acted upon (they render in dismissed state)
                const gs = data.graph_state_parsed || {};
                setGraphState(gs);

                // Internal check card — show if stage reached and user hasn't acted yet
                if (Array.isArray(gs.internal_skills_found) && !gs.internal_skipped && !(gs.internal_skills_accepted?.length)) {
                    setInternalCard(gs.internal_skills_found);
                }

                // Market research card — show if data exists
                if (gs.market_skills_found?.length) {
                    setMarketCard({
                        skills: gs.market_skills_found,
                        competitors: gs.competitors_used || []
                    });
                }

                // JD variants card — show if data exists
                if (gs.jd_variants?.length) {
                    setVariantsCard({
                        variants: gs.jd_variants,
                        selected: gs.selected_variant || null
                    });
                }

                // Final JD
                if (gs.final_jd) {
                    setFinalJdMarkdown(gs.final_jd);
                }

                // Bias check state
                if (gs.bias_issues !== undefined) {
                    setBiasCard({ issues: gs.bias_issues, clean: (gs.bias_issues || []).length === 0 });
                    setBiasIssues(gs.bias_issues || []);
                }

                // Restore skipped-stages — derived from state booleans, since SSE
                // `stage_skipped` events only fire during the run that skipped them.
                const skips = [];
                if (gs.internal_skipped) skips.push('internal_check');
                if (gs.market_skipped) skips.push('market_research');
                if (gs.bias_skipped) skips.push('bias_check');
                setStageSkipped(skips);
            } else if (res.status === 404) {
                setCurrentSessionId(sessionId);
                setMessages([buildGreeting(null, null)]);
                setWorkflowStage('intake');
                setSessionTitle('New Hire');
            }
        } catch (err) {
            console.error("Failed to load session", err);
            setCurrentSessionId(sessionId);
            setMessages([DEFAULT_GREETING]);
        } finally {
            setSessionLoaded(true);
        }
    }, [token]);

    // ── Lightweight refresh of graphState only (doesn't reset cards) ──
    const refreshGraphState = useCallback(async (sessionId) => {
        if (!token || !sessionId) return;
        try {
            const res = await fetch(`/api/v1/chat/sessions/${sessionId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.graph_state_parsed) setGraphState(data.graph_state_parsed);
            }
        } catch {
            // Silent — best-effort refresh
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
            // Fetch sessions immediately so it appears in sidebar
            fetchSessions();
        }

        if (payload.message) {
            setMessages(prev => [...prev, { role: 'user', content: payload.message, isComplete: true }]);
        }

        // Reset streaming JD text if we're generating a new one
        if (payload.action === 'select_variant' || payload.action === 'rewrite_section' || (workflowStage === 'final_jd' && payload.message)) {
            setStreamingJdText('');
            setFinalJdMarkdown(null);
            setIsJdStreaming(true);
        }
        if (payload.action === 'regenerate_variants') {
            setVariantsCard(null);
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
                setVariantsCard({ variants: data.variants, selected: null });
                break;

            case 'jd_token':
                setIsJdStreaming(true);
                setStreamingJdText(prev => prev + (data.content || ''));
                break;

            case 'card_bias':
                setBiasCard({ issues: data.issues, clean: data.clean });
                setBiasIssues(data.issues || []);
                break;

            case 'stage_skipped':
                // Track for the stepper so the pill renders as 'skipped'.
                if (data.stage) {
                    setStageSkipped(prev => prev.includes(data.stage) ? prev : [...prev, data.stage]);
                }
                // Surface a system message so the rail conversation shows what happened.
                setMessages(prev => [...prev, {
                    role: 'system',
                    content: data.reason || `${data.stage} was skipped.`,
                    isComplete: true
                }]);
                break;

            case 'metadata':
                if (typeof data.final_jd === 'string') {
                    setFinalJdMarkdown(data.final_jd);
                    setStreamingJdText('');
                }
                break;

            case 'draft_saved':
                // Draft was saved — don't change stage to complete
                // Just refresh sessions to show updated draft indicator
                fetchSessions();
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
                // Refresh sessions list to update titles/history
                fetchSessions();
                // Refresh canonical graph state so the Intake / agent blocks
                // reflect any fields captured during the turn.
                if (currentSessionId) refreshGraphState(currentSessionId);
                break;

            default:
                console.log('Unknown SSE event:', event, data);
                break;
        }
    }, [handleTitleAnimation, fetchSessions, refreshGraphState, currentSessionId]);

    // ── Clear cards after user acts on them ────────────────────
    const dismissInternalCard = useCallback(() => setInternalCard(null), []);
    const dismissMarketCard = useCallback(() => setMarketCard(null), []);
    const dismissVariantsCard = useCallback(() => setVariantsCard(null), []);

    const value = {
        sessions, fetchSessions,
        currentSessionId, loadSession, setCurrentSessionId, sessionLoaded,
        sessionTitle, setSessionTitle, isTitleAnimating,
        messages, workflowStage, isStreaming, error, isReadOnly,
        sendMessage, deleteSession, resetChat,
        internalCard, setInternalCard, dismissInternalCard,
        marketCard, setMarketCard, dismissMarketCard,
        variantsCard, setVariantsCard, dismissVariantsCard,
        finalJdMarkdown, streamingJdText, isJdStreaming,
        setFinalJdMarkdown,
        biasCard, setBiasCard, biasIssues, setBiasIssues,
        stageSkipped,
        graphState, refreshGraphState,
    };

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
