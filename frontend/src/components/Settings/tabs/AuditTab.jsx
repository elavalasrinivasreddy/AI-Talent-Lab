import React, { useState, useEffect } from 'react';
import api from '../../../utils/api';
import Icon from '../../common/Icon';
import SkeletonCard from '../../common/SkeletonCard';

export default function AuditTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const limit = 50;
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  // Distinct action types seen so far, accumulated across loads so the dropdown
  // doesn't lose options when a filter narrows the current page.
  const [knownActions, setKnownActions] = useState([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchLogs = async (pageNum, search = '', action = '') => {
    setLoading(true);
    setError(null);
    try {
      const offset = (pageNum - 1) * limit;
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
      const actionParam = action ? `&action=${encodeURIComponent(action)}` : '';
      // We assume /settings/audit-logs exists
      const res = await api.get(`/settings/audit-logs?limit=${limit}&offset=${offset}${searchParam}${actionParam}`);
      const rows = res.data?.logs || [];
      setLogs(rows);
      setTotal(res.data?.total || 0);
      setKnownActions(prev => Array.from(
        new Set([...prev, ...rows.map(l => l.action).filter(Boolean)])
      ).sort());
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError('Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, actionFilter]);

  useEffect(() => {
    fetchLogs(page, debouncedSearch, actionFilter);
  }, [page, debouncedSearch, actionFilter]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="st-settings-section">
      <div className="st-settings-header">
        <div>
          <h2>Audit Log</h2>
          <p className="st-settings-desc">
            View all organization actions and events for security and compliance.
          </p>
        </div>
      </div>

      <div className="st-card">
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flex: 1 }}>
            <div className="st-input-icon" style={{ flex: 1, maxWidth: '400px' }}>
              <Icon name="search" />
              <input
                type="text"
                className="st-input"
                placeholder="Search by user, action, entity, IP or date..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="st-input"
              style={{ maxWidth: '200px' }}
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              aria-label="Filter by action"
            >
              <option value="">All actions</option>
              {knownActions.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <button
            className="st-btn st-btn-secondary" 
            onClick={() => {
              const headers = ['Timestamp', 'User Name', 'User Email', 'Action', 'Entity Type', 'Entity ID', 'IP Address'];
              const csvContent = [
                headers.join(','),
                ...logs.map(l => [
                  `"${new Date(l.created_at).toISOString()}"`,
                  `"${l.user_name || 'System'}"`,
                  `"${l.user_email || ''}"`,
                  `"${l.action}"`,
                  `"${l.entity_type || ''}"`,
                  `"${l.entity_id || ''}"`,
                  `"${l.ip_address || ''}"`
                ].join(','))
              ].join('\n');
              const blob = new Blob([csvContent], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
            }}
            disabled={logs.length === 0}
          >
            <Icon name="download" /> Export Page to CSV
          </button>
        </div>

        {loading && logs.length === 0 ? (
          <div style={{ padding: '2rem' }}><SkeletonCard lines={10} /></div>
        ) : error ? (
          <div className="st-error-state">
            <Icon name="alert-circle" /> {error}
          </div>
        ) : logs.length === 0 && !loading ? (
          <div className="st-empty-state">
            <Icon name="clock" size={48} />
            <p>{searchTerm ? 'No audit logs found matching your search.' : 'No audit logs found.'}</p>
          </div>
        ) : (
          <>
            <div className="st-table-container" style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
              <table className="st-table" style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--color-bg-secondary)', padding: '1rem', textAlign: 'left', boxShadow: '0 1px 0 var(--color-border)' }}>Timestamp</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--color-bg-secondary)', padding: '1rem', textAlign: 'left', boxShadow: '0 1px 0 var(--color-border)' }}>User</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--color-bg-secondary)', padding: '1rem', textAlign: 'left', boxShadow: '0 1px 0 var(--color-border)' }}>Action</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--color-bg-secondary)', padding: '1rem', textAlign: 'left', boxShadow: '0 1px 0 var(--color-border)' }}>Entity</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--color-bg-secondary)', padding: '1rem', textAlign: 'left', boxShadow: '0 1px 0 var(--color-border)' }}>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border-light, rgba(255,255,255,0.05))' }}>
                      <td style={{ whiteSpace: 'nowrap', padding: '1rem', textAlign: 'left' }}>
                        {new Date(log.created_at).toLocaleString([], { 
                          month: 'short', day: 'numeric', year: 'numeric', 
                          hour: '2-digit', minute: '2-digit' 
                        })}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'left' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>
                            {log.user_name || 'System'}
                          </span>
                          {log.user_email && <span className="st-text-muted" style={{ fontSize: '12px' }}>{log.user_email}</span>}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'left' }}>
                        <span className="st-badge" style={{ 
                          backgroundColor: 'var(--color-bg-tertiary)', 
                          color: 'var(--color-text)',
                          border: '1px solid var(--color-border)',
                          fontWeight: 500
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--color-text-secondary)', textAlign: 'left' }}>
                        {log.entity_type} {log.entity_id ? <span style={{ opacity: 0.7 }}>#{log.entity_id}</span> : ''}
                      </td>
                      <td className="st-text-muted" style={{ padding: '1rem', fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace', fontSize: '12px', textAlign: 'left' }}>
                        {log.ip_address || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {total > limit && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid var(--color-border)' }}>
                <span className="st-text-muted">
                  Showing {(page - 1) * limit + 1} - {Math.min(page * limit, total)} of {total}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="st-btn st-btn-secondary st-btn-sm" 
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </button>
                  <button 
                    className="st-btn st-btn-secondary st-btn-sm" 
                    disabled={page === totalPages || totalPages === 0}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
