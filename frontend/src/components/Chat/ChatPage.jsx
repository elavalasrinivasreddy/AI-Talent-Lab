import React, { useEffect, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useChat } from '../../context/ChatContext';
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
 * Per docs/redesign/05_jd_chat.md.
 */
const ChatPage = () => {
    const { sessionId } = useParams();
    const location = useLocation();
    const {
        loadSession,
        setCurrentSessionId,
        currentSessionId,
        fetchSessions,
        resetChat,
        sendMessage,
        workflowStage,
    } = useChat();

    const loadedRef = useRef(null);
    const hireRequestSentRef = useRef(false);
    const linkSentRef = useRef(false);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    useEffect(() => {
        if (!sessionId) {
            loadedRef.current = null;
            hireRequestSentRef.current = false;
            resetChat();
            return;
        }

        if (sessionId !== loadedRef.current) {
            loadedRef.current = sessionId;
            hireRequestSentRef.current = false;
            setCurrentSessionId(sessionId);
            loadSession(sessionId);
        }
    }, [sessionId, setCurrentSessionId, loadSession, resetChat]);

    // Auto-send hire-request context to the chat when the user picked up a
    // request from /hire-requests/:id. Builds a single intake message that
    // the agent uses to skip ahead.
    useEffect(() => {
        const req = location.state?.hireRequest;
        if (!req || hireRequestSentRef.current || workflowStage !== 'intake') return;

        hireRequestSentRef.current = true;

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
        if (req.target_start) lines.push(`Target start date: ${req.target_start}`);
        if (req.requirements) lines.push(`\nKey requirements from the hiring manager:\n${req.requirements}`);
        if (req.requested_by_name) lines.push(`\nRequested by: ${req.requested_by_name}`);

        sendMessage({ message: lines.join('\n') });
    }, [location.state, workflowStage, sendMessage]);

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
            <JDStepper />
            <div className="chat-body">
                <section className="chat-body-canvas" aria-label="JD canvas">
                    <JDCanvas />
                </section>
                <JDRail />
            </div>
        </div>
    );
};

export default ChatPage;
