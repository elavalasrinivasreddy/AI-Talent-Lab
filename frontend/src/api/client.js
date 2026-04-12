// api/client.js – API calls + SSE streaming support (with auth)
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const TOKEN_KEY = 'aitl_token';

const api = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Auto-logout on 401 (expired/invalid token)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            console.warn('🔒 Token expired — logging out');
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem('aitl_user');
            window.location.reload();
        }
        return Promise.reject(error);
    }
);

function getAuthHeaders() {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

// ── Non-streaming (legacy) ────────────────────────────────────────────────────
export const sendMessage = (message, sessionId = null) =>
    api.post('/api/chat/message', { message, session_id: sessionId }).then(r => r.data);

// ── SSE Streaming ─────────────────────────────────────────────────────────────
/**
 * Stream a message via SSE. Calls callbacks as events arrive.
 * @param {string} message - User message
 * @param {string|null} sessionId - Session ID (null for new session)
 * @param {object} callbacks - { onToken, onMetadata, onDone, onError }
 * @returns {Promise<void>}
 */
export async function streamMessage(message, sessionId = null, callbacks = {}) {
    const { onToken, onJDToken, onCardText, onMetadata, onDone, onError } = callbacks;

    const response = await fetch(`${BASE_URL}/api/chat/stream`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ message, session_id: sessionId }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        if (onError) onError(errorText);
        return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = ''; // Reset buffer

        let currentEvent = 'token';
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.startsWith('event: ')) {
                currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
                const dataStr = line.slice(6);

                if (currentEvent === 'token') {
                    if (onToken) onToken(dataStr);
                } else if (currentEvent === 'jd_token') {
                    if (onJDToken) onJDToken(dataStr);
                } else if (currentEvent === 'card_text') {
                    if (onCardText) onCardText(dataStr);
                } else if (currentEvent === 'metadata') {
                    try {
                        const data = JSON.parse(dataStr);
                        if (onMetadata) onMetadata(data);
                    } catch (e) {
                        console.warn('Failed to parse metadata:', dataStr);
                    }
                } else if (currentEvent === 'done') {
                    try {
                        const data = JSON.parse(dataStr);
                        if (onDone) onDone(data);
                    } catch (e) {
                        console.warn('Failed to parse done event:', dataStr);
                    }
                } else if (currentEvent === 'error') {
                    try {
                        const data = JSON.parse(dataStr);
                        if (onError) onError(data.error || dataStr);
                    } catch (e) {
                        if (onError) onError(dataStr);
                    }
                } else if (currentEvent === 'close') {
                    // Stream ended
                    return;
                }
            } else if (line === '') {
                // Empty line = end of SSE event block, reset
                currentEvent = 'token';
            } else {
                // Incomplete line — put back in buffer
                buffer += line;
                if (i < lines.length - 1) buffer += '\n';
            }
        }
    }
}

// ── Sessions ──────────────────────────────────────────────────────────────────
export const fetchSessions = () =>
    api.get('/api/chat/sessions').then(r => r.data.sessions);

export const fetchSession = (sessionId) =>
    api.get(`/api/chat/sessions/${sessionId}`).then(r => r.data);

export const deleteSession = (sessionId) =>
    api.delete(`/api/chat/sessions/${sessionId}`).then(r => r.data);

export const renameSession = (sessionId, title) =>
    api.patch(`/api/chat/sessions/${sessionId}/title`, { title }).then(r => r.data);

// ── File Upload ───────────────────────────────────────────────────────────────
export const uploadFile = (sessionId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/api/chat/sessions/${sessionId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data);
};

export const generateFullJD = (sessionId, selectedOverview) =>
    api.post('/api/jd/generate', {
        session_id: sessionId,
        selected_overview: selectedOverview,
    }).then(r => r.data);

export const saveJD = (sessionId, jdMarkdown) =>
    api.put(`/api/chat/sessions/${sessionId}/jd`, {
        jd_markdown: jdMarkdown,
    }).then(r => r.data);

// ── Candidates ─────────────────────────────────────────────────────────────
export const fetchCandidates = (sessionId) =>
    api.get(`/api/candidates/session/${sessionId}`).then(r => r.data.candidates);

export const searchCandidates = (sessionId) =>
    api.post(`/api/candidates/search-async`, { session_id: sessionId }).then(r => r.data);

export const sendOutreachEmails = (candidateIds, positionId, roleName, sessionId) =>
    api.post('/api/candidates/send-emails-async', {
        candidate_ids: candidateIds,
        position_id: positionId,
        role_name: roleName,
        session_id: sessionId
    }).then(r => r.data);

// ── Application ────────────────────────────────────────────────────────────
export const verifyApplicationLink = (token) =>
    api.get(`/api/apply/${token}`).then(r => r.data);

export const submitApplication = (token, formData) =>
    api.post(`/api/apply/${token}`, formData).then(r => r.data);

export default api;
