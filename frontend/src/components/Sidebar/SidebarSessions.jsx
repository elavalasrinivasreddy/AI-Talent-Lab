/**
 * SidebarSessions.jsx – Recent Hire Drafts in sidebar
 * Shows visible 🗑 delete icon on hover. Confirm before delete.
 * Soft-delete: backend sets status='deleted', not physically removed.
 */
import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useChat } from '../../context/ChatContext';

const SidebarSessions = () => {
    const { sessions, fetchSessions, deleteSession } = useChat();
    const navigate = useNavigate();
    const [confirmId, setConfirmId] = useState(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        fetchSessions();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleDeleteClick = (e, sessionId) => {
        e.preventDefault();
        e.stopPropagation();
        setConfirmId(sessionId);
    };

    const handleConfirmDelete = async () => {
        if (!confirmId) return;
        setDeleting(true);
        await deleteSession(confirmId);
        setConfirmId(null);
        setDeleting(false);
        // If currently viewing this session, go back to fresh chat
        if (window.location.pathname.includes(confirmId)) {
            navigate('/chat', { replace: true });
        }
    };

    if (!sessions || sessions.length === 0) return null;

    return (
        <div className="sidebar-section" style={{ marginTop: 'var(--space-4)' }}>
            <div className="sidebar-section-label">Recent Drafts</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {sessions.map(session => (
                    <div key={session.id} className="session-item-row">
                        <NavLink
                            to={`/chat/${session.id}`}
                            className={({ isActive }) =>
                                `sidebar-link ${isActive ? 'active' : ''}`
                            }
                            style={{ flex: 1, paddingRight: 28 }}
                        >
                            <span
                                style={{
                                    width: 6, height: 6,
                                    borderRadius: '50%',
                                    backgroundColor: session.position_id
                                        ? 'var(--color-success)'
                                        : session.workflow_stage === 'complete'
                                            ? 'var(--color-success)'
                                            : 'var(--color-text-muted)',
                                    marginRight: 'var(--space-2)',
                                    flexShrink: 0
                                }}
                            />
                            <span
                                className="truncate"
                                style={{ flex: 1 }}
                                title={session.title}
                            >
                                {session.title || 'New Hire'}
                            </span>
                        </NavLink>

                        {/* Visible on row hover */}
                        <button
                            className="session-delete-btn"
                            title="Delete this draft"
                            onClick={(e) => handleDeleteClick(e, session.id)}
                        >
                            🗑
                        </button>
                    </div>
                ))}
            </div>

            {/* Confirm Delete Modal */}
            {confirmId && (
                <div
                    style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(0,0,0,0.55)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 'var(--z-modal)'
                    }}
                    onClick={() => setConfirmId(null)}
                >
                    <div
                        style={{
                            background: 'var(--color-bg-card)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '24px 28px',
                            maxWidth: 320, width: '90%',
                            boxShadow: 'var(--shadow-lg)',
                            textAlign: 'center'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ fontSize: '2rem', marginBottom: 8 }}>🗑️</div>
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                            Delete this draft? It will be archived and removed from your list.
                        </p>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                            <button
                                style={{
                                    padding: '7px 16px',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'none',
                                    color: 'var(--color-text-secondary)',
                                    cursor: 'pointer', fontSize: 'var(--font-size-sm)'
                                }}
                                onClick={() => setConfirmId(null)}
                            >
                                Cancel
                            </button>
                            <button
                                style={{
                                    padding: '7px 16px',
                                    background: 'var(--color-danger)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: deleting ? 'not-allowed' : 'pointer',
                                    opacity: deleting ? 0.6 : 1,
                                    fontSize: 'var(--font-size-sm)'
                                }}
                                onClick={handleConfirmDelete}
                                disabled={deleting}
                            >
                                {deleting ? 'Deleting…' : 'Yes, Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SidebarSessions;
