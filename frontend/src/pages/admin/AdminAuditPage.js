import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../context/ApiContext';
import '../../styles/AdminAudit.css';

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
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const navigate = useNavigate();

  useEffect(() => {
    if (role && role !== 'admin') {
      navigate('/');
    }
  }, [role, navigate]);

  useEffect(() => {
    if (!apiBaseUrl) return;
    if (!token) {
      setError('Not authenticated. Please log in as admin.');
      return;
    }
    fetchAuditLogs();
  }, [apiBaseUrl, filters]);

  const fetchAuditLogs = async () => {
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
  };

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

  return (
    <div className="admin-audit-page">
      <header className="admin-audit-header">
        <h1>Admin Audit Trail</h1>
        <p>View system activity, session events, and export audit reports.</p>
      </header>

      <section className="admin-audit-controls">
        <div className="admin-filter-row">
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
