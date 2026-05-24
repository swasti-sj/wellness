import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../context/ApiContext';
import '../../styles/admin/AdminAudit.css';

export default function AdminAuditPage() {
  const apiBaseUrl = useApi();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    role: '',
    module: '',
    severity: '',
    startDate: '',
    endDate: '',
    page: 1,
    limit: 25,
  });
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [expandedLogIds, setExpandedLogIds] = useState(new Set());
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const navigate = useNavigate();

  useEffect(() => {
    if (role && role !== 'admin') {
      navigate('/');
    }
  }, [role, navigate]);

  const fetchAuditLogs = useCallback(async () => {
    if (!apiBaseUrl) return;
    if (!token) {
      setError('Not authenticated. Please log in as admin.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (!value) return;
        params.append(key, value);
      });

      const response = await fetch(`${apiBaseUrl}/api/admin/audit?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to fetch audit logs');
      }

      const data = await response.json();
      setLogs(data.logs || []);
      setPagination(data.pagination || { total: 0, page: 1, pages: 1 });
    } catch (err) {
      setError(err.message || 'Unable to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, filters, token]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);



  const exportCsv = async () => {
    if (!token) {
      setError('Not authenticated.');
      return;
    }

    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (!value) return;
        params.append(key, value);
      });

      const response = await fetch(`${apiBaseUrl}/api/admin/audit/export/csv?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || 'Failed to export CSV');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-report-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Unable to export CSV');
    }
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.pages) return;
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const toggleMobileFilters = () => {
    setShowMobileFilters((prev) => !prev);
  };

  const toggleLogExpand = (logId) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  return (
    <div className="admin-audit-page">
      <header className="admin-audit-header">
        <h1>Admin Audit Trail</h1>
        <p>View system activity, session events, and export audit reports.</p>
      </header>

      <section className="admin-audit-controls">
        <button className="admin-filter-toggle" onClick={toggleMobileFilters} type="button">
          {showMobileFilters ? 'Hide Filters' : 'Show Filters'}
        </button>

        <div className={`admin-filter-row${showMobileFilters ? ' open' : ''}`}>
          <input
            name="search"
            value={filters.search}
            onChange={handleFilterChange}
            placeholder="Search users, actions, modules, IP..."
          />
          <input
            type="date"
            name="startDate"
            value={filters.startDate}
            onChange={handleFilterChange}
          />
          <input
            type="date"
            name="endDate"
            value={filters.endDate}
            onChange={handleFilterChange}
          />
          <select name="role" value={filters.role} onChange={handleFilterChange}>
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="doctor">Doctor</option>
            <option value="nurse">Nurse</option>
            <option value="receptionist">Receptionist</option>
            <option value="pharmacist">Pharmacist</option>
            <option value="patient">Patient</option>
          </select>
          <select name="severity" value={filters.severity} onChange={handleFilterChange}>
            <option value="">All severities</option>
            <option value="INFO">INFO</option>
            <option value="WARNING">WARNING</option>
            <option value="ERROR">ERROR</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="AUDIT">AUDIT</option>
          </select>
        </div>

        <div className="admin-audit-actions">
          <button onClick={fetchAuditLogs} disabled={loading}>
            Refresh
          </button>
          <button onClick={exportCsv} disabled={loading}>
            Export CSV
          </button>
        </div>
      </section>

      {error && <div className="admin-audit-error">{error}</div>}

      <section className="admin-audit-table-wrapper">
        {loading ? (
          <div className="admin-audit-loading">Loading audit logs…</div>
        ) : logs.length === 0 ? (
          <div className="admin-audit-empty">No audit logs found.</div>
        ) : (
          <>
            <table className="admin-audit-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>Session ID</th>
                  <th>Role</th>
                  <th>Module</th>
                  <th>Action</th>
                  <th>Description</th>
                  <th>Severity</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id}>
                    <td>
                      <div>{log.createdAt ? new Date(log.createdAt).toLocaleDateString('en-GB') : ''}</div>
                      <div style={{ fontSize: '0.9em', color: '#666' }}>{log.createdAt ? new Date(log.createdAt).toLocaleTimeString('en-GB') : ''}</div>
                    </td>
                    <td>{log.userName || log.userEmail || 'Unknown'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>{log.sessionId || '-'}</td>
                    <td>{log.role || 'Unknown'}</td>
                    <td>{log.module || '-'}</td>
                    <td>{log.action || '-'}</td>
                    <td>{log.description || '-'}</td>
                    <td>{log.severity || 'INFO'}</td>
                    <td>{log.ipAddress || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="admin-audit-card-list">
              {logs.map((log) => {
                const isOpen = expandedLogIds.has(log._id);
                return (
                  <div key={log._id} className={`admin-audit-card${isOpen ? ' open' : ''}`}>
                    <button
                      type="button"
                      className="admin-audit-card-header"
                      onClick={() => toggleLogExpand(log._id)}
                    >
                      <div>
                        <div className="admin-audit-card-title">
                          {log.createdAt ? new Date(log.createdAt).toLocaleDateString('en-GB') : '-'}
                          {' • '}
                          {log.role || 'Unknown'}
                        </div>
                        <div className="admin-audit-card-meta">
                          {log.userName || log.userEmail || 'Unknown'}
                          {' · '}
                          {log.severity || 'INFO'}
                        </div>
                      </div>
                      <span className={`admin-audit-card-chevron${isOpen ? ' open' : ''}`}>›</span>
                    </button>
                    {isOpen && (
                      <div className="admin-audit-card-body">
                        <div className="admin-audit-card-field">
                          <span>Date</span>
                          <strong>{log.createdAt ? new Date(log.createdAt).toLocaleString('en-GB') : '-'}</strong>
                        </div>
                        <div className="admin-audit-card-field">
                          <span>User</span>
                          <strong>{log.userName || log.userEmail || 'Unknown'}</strong>
                        </div>
                        <div className="admin-audit-card-field">
                          <span>Session</span>
                          <strong>{log.sessionId || '-'}</strong>
                        </div>
                        <div className="admin-audit-card-field">
                          <span>Role</span>
                          <strong>{log.role || 'Unknown'}</strong>
                        </div>
                        <div className="admin-audit-card-field">
                          <span>Module</span>
                          <strong>{log.module || '-'}</strong>
                        </div>
                        <div className="admin-audit-card-field">
                          <span>Action</span>
                          <strong>{log.action || '-'}</strong>
                        </div>
                        <div className="admin-audit-card-field">
                          <span>Description</span>
                          <strong>{log.description || '-'}</strong>
                        </div>
                        <div className="admin-audit-card-field">
                          <span>IP</span>
                          <strong>{log.ipAddress || '-'}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="admin-audit-pagination">
        <button onClick={() => handlePageChange(filters.page - 1)} disabled={filters.page <= 1}>
          Previous
        </button>
        <span>
          Page {filters.page} of {pagination.pages}
        </span>
        <button onClick={() => handlePageChange(filters.page + 1)} disabled={filters.page >= pagination.pages}>
          Next
        </button>
      </section>
    </div>
  );
}