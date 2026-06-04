import React, { useEffect, useRef, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { hireRequestsApi } from '../../utils/api';
import ChatTopBar from './ChatTopBar';
import JDStepper from './JDStepper';
import JDCanvas from './JDCanvas';
import JDRail from './JDRail';
import '../../styles/chat.css';

/**
 * /chat — the JD generation surface.
 *
 * Top: title bar + 8-stage stepper.
 * Body: JDCanvas (~65%) on the left, JDRail (320px) on the right.
 *
 * Per docs/design/pages/05_jd_chat.md.
 */
const ChatPage = () => {
    const { sessionId } = useParams();
    const location = useLocation();
    const { user } = useAuth();
    const {
        loadSession,
        setCurrentSessionId,
        currentSessionId,
        fetchSessions,
        resetChat,
        sendMessage,
        workflowStage,
        messages,
        sessionLoaded,
    } = useChat();

    const loadedRef = useRef(null);
    const initKeyRef = useRef(null);   // StrictMode-safe guard: fresh-chat init runs once per navigation
    const seedKeyRef = useRef(null);   // StrictMode-safe guard: hire-request seed runs once per navigation
    const linkSentRef = useRef(false);
    const [isRailOpen, setIsRailOpen] = useState(true);
    const [railWidth, setRailWidth] = useState(360);
    const isResizing = useRef(false);

    const startResizing = React.useCallback((e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = railWidth;
        
        const handleMouseMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            // moving left (negative deltaX) increases rail width
            const newWidth = Math.max(320, Math.min(800, startWidth - deltaX));
            setRailWidth(newWidth);
        };
        
        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            isResizing.current = false;
        };
        
        isResizing.current = true;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [railWidth]);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    useEffect(() => {
        if (!sessionId) {
            // Fresh chat (New Hire or hire-request pickup). StrictMode double-invokes
            // effects in dev; gate on location.key so this setup runs exactly once per
            // navigation. Without the guard, the second pass re-ran resetChat (nulling
            // currentSessionId) and the seed effect fired again, minting a duplicate
            // session and a second bot reply (#6/#8).
            if (initKeyRef.current === location.key) return;
            initKeyRef.current = location.key;
            loadedRef.current = null;
            // Pass the real user so the greeting is identical from both entry points (#5).
            resetChat(user, location.state);
            return;
        }

        if (sessionId !== loadedRef.current) {
            loadedRef.current = sessionId;
            initKeyRef.current = null;
            setCurrentSessionId(sessionId);
            loadSession(sessionId);
        }
    }, [sessionId, location.key, user, setCurrentSessionId, loadSession, resetChat]);

    // Auto-send hire-request context to the chat when the user picked up a
    // request from /hire-requests/:id, OR resumed a chat whose session was
    // deleted (position detail → Resume Chat). Builds a single intake message
    // that the agent uses to skip ahead.
    useEffect(() => {
        const req = location.state?.hireRequest;
        if (!req) return;

        // For sessionId routes, wait until loadSession has fully completed so we
        // know whether the session has real history before deciding to seed.
        if (sessionId && !sessionLoaded) return;

        // Only seed if there are no real user messages yet (GREETING-only is fine).
        const hasUserMessages = messages.some(m => m.role === 'user');
        if (workflowStage !== 'intake' || hasUserMessages) return;

        // StrictMode double-invokes effects; gate on location.key so the seed fires
        // exactly once per navigation. Otherwise two streams launch and two sessions
        // are created from a single pickup (#6/#8).
        if (seedKeyRef.current === location.key) return;
        seedKeyRef.current = location.key;

        // Only the fields that shape the JD. Approval/ops metadata (requester name,
        // target start date) is intentionally left out — it's noise for intake (#7).
        const lines = [`I need to hire a ${req.role_name}.`];
        if (req.department_name) lines.push(`Department: ${req.department_name}`);
        if (req.headcount && req.headcount > 1) lines.push(`Headcount: ${req.headcount}`);
        if (req.work_type) lines.push(`Work type: ${req.work_type}`);
        if (req.location) lines.push(`Location: ${req.location}`);
        if (req.experience_min != null || req.experience_max != null) {
            const min = req.experience_min ?? 0;
            const max = req.experience_max ? `${req.experience_max} years` : 'open';
            lines.push(`Experience: ${min}–${max}`);
        }
        if (req.comp_min != null || req.comp_max != null) {
            const cmin = req.comp_min ?? 0;
            const cmax = req.comp_max != null ? req.comp_max : 'open';
            lines.push(`Compensation: ₹${cmin}–${cmax} LPA`);
        }
        if (req.requirements) lines.push(`\nKey requirements from the hiring manager:\n${req.requirements}`);

        sendMessage({ message: lines.join('\n') });
    }, [sessionId, sessionLoaded, location.key, location.state, workflowStage, sendMessage, messages]);

    // Link the created position back to the hire request once JD generation completes.
    useEffect(() => {
        const req = location.state?.hireRequest;
        if (!req || !currentSessionId || workflowStage !== 'complete' || linkSentRef.current) return;
        linkSentRef.current = true;
        hireRequestsApi.linkSession(req.id, currentSessionId).catch(err => console.error('linkSession failed:', err));
    }, [location.state, workflowStage, currentSessionId]);

    return (
        <div className="chat-page chat-page--v3">
            <ChatTopBar />
            <JDStepper isRailOpen={isRailOpen} onToggleRail={() => setIsRailOpen(!isRailOpen)} />
            <div 
                className={`chat-body ${!isRailOpen ? 'rail-closed' : ''}`}
                style={{ gridTemplateColumns: isRailOpen ? `minmax(0, 1fr) 4px ${railWidth}px` : `minmax(0, 1fr) 0px 0px` }}
            >
                <section className="chat-body-canvas" aria-label="JD canvas">
                    <JDCanvas />
                </section>
                <div 
                    className="rail-resizer"
                    onMouseDown={startResizing}
                    aria-hidden="true"
                />
                <JDRail />
            </div>
        </div>
    );
};

export default ChatPage;
