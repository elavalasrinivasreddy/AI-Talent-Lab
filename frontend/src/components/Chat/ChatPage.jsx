import React, { useEffect, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useChat } from '../../context/ChatContext';
import { positionsApi } from '../../utils/api';
import ChatTopBar from './ChatTopBar';
import MessageList from './MessageList';
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

    // When a recruiter picks up a hire request, auto-send it as the opening message.
    // This gives the AI full context so it can skip basic intake questions.
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

    // When JD generation completes and this session came from a hire request,
    // link the created position back to the request for HM lifecycle tracking.
    useEffect(() => {
        const req = location.state?.hireRequest;
        if (!req || !currentSessionId || workflowStage !== 'complete' || linkSentRef.current) return;
        linkSentRef.current = true;
        positionsApi.linkViaSession(req.id, currentSessionId).catch(() => {});
    }, [location.state, workflowStage, currentSessionId]);

    return (
        <div className="chat-page container-fluid p-0">
            <ChatTopBar />
            <MessageList />
            <MessageInput />
        </div>
    );
};

export default ChatPage;
