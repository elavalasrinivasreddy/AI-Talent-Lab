import React, { useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChat } from '../../context/ChatContext';
import ChatTopBar from './ChatTopBar';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import '../../styles/chat.css';

const ChatPage = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const {
        loadSession,
        currentSessionId,
        setCurrentSessionId,
        fetchSessions
    } = useChat();
    const loadedRef = useRef(null);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    useEffect(() => {
        if (!sessionId) {
            // At /chat without ID — fresh chat, don't create session yet
            // Session will be created on first message
            setCurrentSessionId(null);
            return;
        }

        // Only load if this is a different session than already loaded
        if (sessionId !== loadedRef.current) {
            loadedRef.current = sessionId;
            setCurrentSessionId(sessionId);
            loadSession(sessionId);
        }
    }, [sessionId, setCurrentSessionId, loadSession]);

    return (
        <div className="chat-page container-fluid p-0">
            <ChatTopBar />
            <MessageList />
            <MessageInput />
        </div>
    );
};

export default ChatPage;
