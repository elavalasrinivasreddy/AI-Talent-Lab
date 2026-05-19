import React, { useEffect, useRef, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useChat } from '../../context/ChatContext';
import { positionsApi } from '../../utils/api';
import ChatTopBar from './ChatTopBar';
import MessageList from './MessageList';
import JDCanvas from './JDCanvas';
import MessageInput from './MessageInput';
import '../../styles/chat.css';

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

    // Lifted state: which variant is currently being previewed in the canvas.
    // Set by JDVariantsCard on hover/focus, read by JDCanvas.
    const [previewVariantType, setPreviewVariantType] = useState(null);

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
            setPreviewVariantType(null);
            resetChat();
            return;
        }

        if (sessionId !== loadedRef.current) {
            loadedRef.current = sessionId;
            hireRequestSentRef.current = false;
            setPreviewVariantType(null);
            setCurrentSessionId(sessionId);
            loadSession(sessionId);
        }
    }, [sessionId, setCurrentSessionId, loadSession, resetChat]);

    // Auto-send hire request context to chat when picked up from hire requests list.
    useEffect(() => {
        const req = location.state?.hireRequest;
        if (!req || hireRequestSentRef.current || workflowStage !== 'intake') return;

        hireRequestSentRef.current = true;

        const lines = [`I need to hire a ${req.role_name}.`];
        if (req.department_name) lines.push(`Department: ${req.department_name}`);
        if (req.headcount && req.headcount > 1) lines.push(`Headcount: ${req.headcount}`);
        if (req.work_type) lines.push(`Work type: ${req.work_type}`);
        if (req.experience_min != null || req.experience_max != null) {
            const min = req.experience_min ?? 0;
            const max = req.experience_max ? `${req.experience_max} years` : 'open';
            lines.push(`Experience: ${min}–${max}`);
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
        positionsApi.linkViaSession(req.id, currentSessionId).catch(() => {});
    }, [location.state, workflowStage, currentSessionId]);

    return (
        <div className="chat-page">
            <ChatTopBar />
            <div className="chat-split">
                <section className="chat-rail" aria-label="Conversation">
                    <MessageList
                        previewVariantType={previewVariantType}
                        setPreviewVariantType={setPreviewVariantType}
                    />
                    <MessageInput />
                </section>
                <section className="jd-canvas" aria-label="Job description draft">
                    <JDCanvas previewVariantType={previewVariantType} />
                </section>
            </div>
        </div>
    );
};

export default ChatPage;
