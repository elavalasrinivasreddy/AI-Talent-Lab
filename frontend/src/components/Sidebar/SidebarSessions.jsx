import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useChat } from '../../context/ChatContext';

const SidebarSessions = () => {
    const { sessions, fetchSessions, deleteSession } = useChat();
    const [contextMenu, setContextMenu] = useState(null);

    useEffect(() => {
        fetchSessions();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleContextMenu = (e, session) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            sessionId: session.id,
            title: session.title
        });
    };

    const handleDelete = async () => {
        if (contextMenu) {
            await deleteSession(contextMenu.sessionId);
            setContextMenu(null);
        }
    };

    // Close context menu on any click
    useEffect(() => {
        const close = () => setContextMenu(null);
        if (contextMenu) {
            document.addEventListener('click', close);
            return () => document.removeEventListener('click', close);
        }
    }, [contextMenu]);

    if (!sessions || sessions.length === 0) return null;

    return (
        <div className="sidebar-section" style={{ marginTop: 'var(--space-4)' }}>
            <div style={{
                fontSize: 'var(--font-size-xs)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-text-muted)',
                fontWeight: 600,
                padding: '0 var(--space-3)',
                marginBottom: 'var(--space-2)'
            }}>
                Recent Drafts
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {sessions.map(session => (
                    <NavLink
                        key={session.id}
                        to={`/chat/${session.id}`}
                        className={({ isActive }) =>
                            `sidebar-link ${isActive ? 'active' : ''}`
                        }
                        style={({ isActive }) => ({
                            display: 'flex',
                            alignItems: 'center',
                            padding: '6px var(--space-3)',
                            borderRadius: 'var(--radius-sm)',
                            textDecoration: 'none',
                            fontSize: 'var(--font-size-sm)',
                            color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                            background: isActive ? 'var(--color-primary-bg)' : 'transparent',
                            fontWeight: isActive ? 600 : 400,
                            transition: 'background var(--transition-fast)'
                        })}
                        onContextMenu={(e) => handleContextMenu(e, session)}
                    >
                        <span
                            style={{
                                width: 6,
                                height: 6,
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
                        <span className="truncate" style={{ flex: 1 }} title={session.title}>
                            {session.title || 'New Hire'}
                        </span>
                    </NavLink>
                ))}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div style={{
                    position: 'fixed',
                    left: contextMenu.x,
                    top: contextMenu.y,
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 'var(--z-dropdown)',
                    padding: 'var(--space-1)',
                    minWidth: 120
                }}>
                    <button
                        style={{
                            display: 'block',
                            width: '100%',
                            padding: '6px var(--space-3)',
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--color-danger)',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            textAlign: 'left'
                        }}
                        onClick={handleDelete}
                        onMouseEnter={(e) => e.target.style.background = 'var(--color-danger-bg)'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    >
                        🗑️ Delete
                    </button>
                </div>
            )}
        </div>
    );
};

export default SidebarSessions;
