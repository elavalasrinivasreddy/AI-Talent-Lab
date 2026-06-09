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

  const fetchLogs = async (pageNum) => {
    setLoading(true);
    setError(null);
    try {
      const offset = (pageNum - 1) * limit;
      // We assume /api/v1/settings/audit-logs exists
      const res = await api.get(`/api/v1/settings/audit-logs?limit=${limit}&offset=${offset}`);
      setLogs(res.logs);
      setTotal(res.total);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError('Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(page);
  }, [page]);

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
        {loading && logs.length === 0 ? (
          <div style={{ padding: '2rem' }}><SkeletonCard lines={10} /></div>
        ) : error ? (
          <div className="st-error-state">
            <Icon name="alert-circle" /> {error}
          </div>
        ) : logs.length === 0 ? (
          <div className="st-empty-state">
            <Icon name="clock" size={48} />
            <p>No audit logs found.</p>
          </div>
        ) : (
          <>
            <div className="st-table-container">
              <table className="st-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{new Date(log.created_at).toLocaleString()}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span>{log.user_name || 'System'}</span>
                          {log.user_email && <span className="st-text-muted" style={{ fontSize: '12px' }}>{log.user_email}</span>}
                        </div>
                      </td>
                      <td>
                        <span className="st-badge" style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text)' }}>
                          {log.action}
                        </span>
                      </td>
                      <td>
                        {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ''}
                      </td>
                      <td className="st-text-muted" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
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
