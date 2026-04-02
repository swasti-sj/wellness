import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import '../../styles/pharmacist/PharmacistDashboard.css';

const API = 'http://localhost:5000/api';

// ─── date helper ──────────────────────────────────────────────────────────
function getDateRange(period, customFrom, customTo) {
  const now = new Date();
  const fmt = (d) => d.toISOString().split('T')[0];
  if (period === 'custom' && customFrom && customTo) return { from: customFrom, to: customTo };
  if (period === 'today')  return { from: fmt(now), to: fmt(now) };
  if (period === 'week')   return { from: fmt(new Date(now - 7 * 86400000)), to: fmt(now) };
  if (period === 'month')  return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(now) };
  if (period === 'year')   return { from: fmt(new Date(now.getFullYear(), 0, 1)), to: fmt(now) };
  return {};
}

export default function PharmacistMedicineWiseAnalytics() {
  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState('');
  const [sortBy, setSortBy] = useState('totalIssued');
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');

  const [medicineSummary, setMedicineSummary] = useState([]);
  const [selectedMedicineDetails, setSelectedMedicineDetails] = useState(null);
  const [dailyBreakdown, setDailyBreakdown] = useState([]);
  const [issuanceSummary, setIssuanceSummary] = useState(null);
  const [totalStats, setTotalStats] = useState({ totalIssuedOverall: 0, totalAddedOverall: 0 });

  const token = localStorage.getItem('token');
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const loadCompleteMovement = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(period, customFrom, customTo);
      const [movementRes, summaryRes] = await Promise.all([
        axios.get(`${API}/medicines/analytics/complete-medicine-movement`, { ...authHeader, params: { from, to } }),
        axios.get(`${API}/issuances/stats/summary`, authHeader),
      ]);
      setMedicineSummary(movementRes.data.medicineSummary || []);
      setTotalStats({
        totalIssuedOverall: movementRes.data.totalIssuedOverall || 0,
        totalAddedOverall:  movementRes.data.totalAddedOverall  || 0,
      });
      setIssuanceSummary(summaryRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [period, customFrom, customTo]);

  const loadMedicineDailyBreakdown = useCallback(async (medicineId) => {
    setDetailLoading(true);
    try {
      const { from, to } = getDateRange(period, customFrom, customTo);
      const res = await axios.get(`${API}/medicines/analytics/medicine-daily-breakdown`, {
        ...authHeader,
        params: { medicineId, from, to }
      });
      setSelectedMedicineDetails(res.data.medicine);
      setDailyBreakdown(res.data.dailyBreakdown || []);
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  }, [period, customFrom, customTo]);

  useEffect(() => { loadCompleteMovement(); }, [loadCompleteMovement]);

  const handleMedicineSelect = async (medicineId) => {
    setSelectedMedicine(medicineId);
    if (medicineId) await loadMedicineDailyBreakdown(medicineId);
    else { setSelectedMedicineDetails(null); setDailyBreakdown([]); }
  };

  // Sorting + Search on client
  const filtered = medicineSummary
    .filter(m => !search || m.name.toLowerCase().includes(search.toLowerCase()) || (m.brandName || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const v = (x) => {
        if (sortBy === 'name') return x.name;
        if (sortBy === 'totalIssued') return x.totalIssued || 0;
        if (sortBy === 'totalAdded')  return x.totalAdded  || 0;
        if (sortBy === 'netChange')   return x.netChange   || 0;
        if (sortBy === 'currentStock') return x.currentStock || 0;
        return 0;
      };
      const av = v(a), bv = v(b);
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });

  const SortTh = ({ field, label }) => (
    <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
      onClick={() => { setSortBy(field); setSortDir(d => field === sortBy ? (d === 'asc' ? 'desc' : 'asc') : 'desc'); }}>
      {label} {sortBy === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );

  if (loading) return <div className="pharm-loading">⏳ Loading medicine-wise analytics...</div>;

  return (
    <div className="pharm-layout">
      <div className="pharm-root">
        <div className="pharm-header">
          <div>
            <h1 className="pharm-title">🎯 Medicine-Wise Analytics</h1>
            <p className="pharm-subtitle">Track additions & issuances per medicine — full visibility into stock movement</p>
          </div>
          <button className="pharm-btn pharm-btn-ghost" onClick={loadCompleteMovement}>🔄 Refresh</button>
        </div>

        {/* ── Summary stats ── */}
        <div className="pharm-stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          <div className="pharm-stat-card">
            <div className="pharm-stat-label">💊 Today's Issuance</div>
            <div className="pharm-stat-value">{issuanceSummary?.today?.qty || 0}</div>
            <div className="pharm-stat-meta">{issuanceSummary?.today?.transactions || 0} txns</div>
          </div>
          <div className="pharm-stat-card">
            <div className="pharm-stat-label">📅 This Week</div>
            <div className="pharm-stat-value">{issuanceSummary?.week?.qty || 0}</div>
            <div className="pharm-stat-meta">{issuanceSummary?.week?.transactions || 0} txns</div>
          </div>
          <div className="pharm-stat-card">
            <div className="pharm-stat-label">📅 This Month</div>
            <div className="pharm-stat-value">{issuanceSummary?.month?.qty || 0}</div>
            <div className="pharm-stat-meta">{issuanceSummary?.month?.transactions || 0} txns</div>
          </div>
          <div className="pharm-stat-card">
            <div className="pharm-stat-label">💊 Total Issued (period)</div>
            <div className="pharm-stat-value" style={{ color: 'var(--pharm-red)' }}>{totalStats.totalIssuedOverall.toLocaleString()}</div>
          </div>
          <div className="pharm-stat-card">
            <div className="pharm-stat-label">📦 Total Added (period)</div>
            <div className="pharm-stat-value" style={{ color: 'var(--pharm-teal)' }}>+{totalStats.totalAddedOverall.toLocaleString()}</div>
          </div>
        </div>

        {/* ── Period Selector ── */}
        <div className="pharm-section">
          <div className="pharm-filter-bar" style={{ flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
            <span className="pharm-filter-label">Period:</span>
            <div className="pharm-filter-chips">
              {[
                { k: 'today', l: 'Today' },
                { k: 'week',  l: 'This Week' },
                { k: 'month', l: 'This Month' },
                { k: 'year',  l: 'This Year' },
                { k: 'custom', l: 'Custom' },
              ].map(p => (
                <button key={p.k}
                  className={`pharm-chip ${period === p.k ? 'active' : ''}`}
                  onClick={() => setPeriod(p.k)}>
                  {p.l}
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <>
                <input className="pharm-input" type="date" style={{ width: 'auto' }}
                  value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
                <span style={{ color: 'var(--pharm-gray-400)' }}>to</span>
                <input className="pharm-input" type="date" style={{ width: 'auto' }}
                  value={customTo} onChange={e => setCustomTo(e.target.value)} />
                <button className="pharm-btn pharm-btn-teal pharm-btn-sm" onClick={loadCompleteMovement}>Apply</button>
              </>
            )}
            <input className="pharm-input" placeholder="🔍 Search medicine..."
              style={{ marginLeft: 'auto', minWidth: 200 }}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* ── Summary Table ── */}
          <div className="pharm-table-container" style={{ marginTop: '0.5rem' }}>
            {filtered.length === 0 ? (
              <div className="pharm-empty">
                <div className="pharm-empty-icon">📭</div>
                <div className="pharm-empty-text">No movement data for this period</div>
              </div>
            ) : (
              <table className="pharm-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <SortTh field="name"         label="Medicine" />
                    <th>Category</th>
                    <SortTh field="totalIssued"  label="Issued" />
                    <th>Issue Txns</th>
                    <SortTh field="totalAdded"   label="Added" />
                    <th>Add Txns</th>
                    <SortTh field="netChange"    label="Net Change" />
                    <SortTh field="currentStock" label="Stock Now" />
                    <th>Status</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((med, idx) => (
                    <tr key={med._id}
                      style={{ background: selectedMedicine === med._id ? 'rgba(20,184,166,0.06)' : '' }}>
                      <td className="mono" style={{ color: 'var(--pharm-gray-400)', fontSize: '0.72rem' }}>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.87rem' }}>{med.name}</div>
                        {med.brandName && <div style={{ fontSize: '0.72rem', color: 'var(--pharm-gray-400)' }}>{med.brandName}</div>}
                      </td>
                      <td><span className="pharm-badge pharm-badge-navy" style={{ fontSize: '0.68rem' }}>{med.category || 'General'}</span></td>
                      <td style={{ color: 'var(--pharm-red)', fontFamily: 'var(--pharm-mono)', fontWeight: 700, fontSize: '1rem' }}>
                        {med.totalIssued || 0}
                      </td>
                      <td className="mono" style={{ fontSize: '0.82rem' }}>{med.issuanceCount || 0}</td>
                      <td style={{ color: 'var(--pharm-teal)', fontFamily: 'var(--pharm-mono)', fontWeight: 700, fontSize: '1rem' }}>
                        +{med.totalAdded || 0}
                      </td>
                      <td className="mono" style={{ fontSize: '0.82rem' }}>{med.additionCount || 0}</td>
                      <td style={{
                        color: (med.netChange || 0) >= 0 ? 'var(--pharm-green)' : 'var(--pharm-red)',
                        fontFamily: 'var(--pharm-mono)', fontWeight: 700, fontSize: '0.95rem'
                      }}>
                        {(med.netChange || 0) >= 0 ? '+' : ''}{med.netChange || 0}
                      </td>
                      <td>
                        <span className={`pharm-stock-num ${med.currentStock === 0 ? 'out' : med.currentStock < 20 ? 'low' : 'ok'}`}>
                          {med.currentStock || 0}
                        </span>
                      </td>
                      <td>
                        {med.currentStock === 0 ? (
                          <span className="pharm-badge pharm-badge-red">Out of Stock</span>
                        ) : med.currentStock < 20 ? (
                          <span className="pharm-badge pharm-badge-amber">Low</span>
                        ) : (
                          <span className="pharm-badge pharm-badge-green">Good</span>
                        )}
                      </td>
                      <td>
                        <button
                          className={`pharm-btn pharm-btn-sm ${selectedMedicine === med._id ? 'pharm-btn-teal' : 'pharm-btn-ghost'}`}
                          onClick={() => handleMedicineSelect(selectedMedicine === med._id ? '' : med._id)}>
                          {selectedMedicine === med._id ? '▲ Hide' : '▼ Daily'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Selected Medicine Daily Breakdown ── */}
        {selectedMedicineDetails && (
          <div className="pharm-section">
            <div className="pharm-section-header">
              <h2 className="pharm-section-title">
                🔬 Daily Breakdown: {selectedMedicineDetails.name}
                {selectedMedicineDetails.brandName && ` (${selectedMedicineDetails.brandName})`}
              </h2>
              <button className="pharm-btn pharm-btn-ghost pharm-btn-sm"
                onClick={() => { setSelectedMedicineDetails(null); setDailyBreakdown([]); setSelectedMedicine(''); }}>
                ✕ Close
              </button>
            </div>

            {/* Medicine quick stats */}
            <div className="pharm-stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: '1.5rem' }}>
              <div className="pharm-stat-card">
                <div className="pharm-stat-label">Current Stock</div>
                <div className="pharm-stat-value">{selectedMedicineDetails.currentStock}</div>
                <div className="pharm-stat-meta">{selectedMedicineDetails.unit}</div>
              </div>
              <div className="pharm-stat-card">
                <div className="pharm-stat-label">Reorder Level</div>
                <div className="pharm-stat-value">{selectedMedicineDetails.reorderLevel || 20}</div>
              </div>
              <div className="pharm-stat-card">
                <div className="pharm-stat-label">Total Issued</div>
                <div className="pharm-stat-value" style={{ color: 'var(--pharm-red)' }}>
                  {dailyBreakdown.reduce((s, d) => s + d.issued, 0)}
                </div>
              </div>
              <div className="pharm-stat-card">
                <div className="pharm-stat-label">Total Added</div>
                <div className="pharm-stat-value" style={{ color: 'var(--pharm-teal)' }}>
                  +{dailyBreakdown.reduce((s, d) => s + d.added, 0)}
                </div>
              </div>
              <div className="pharm-stat-card">
                <div className="pharm-stat-label">Net Change</div>
                {(() => {
                  const net = dailyBreakdown.reduce((s, d) => s + d.netChange, 0);
                  return (
                    <div className="pharm-stat-value" style={{ color: net >= 0 ? 'var(--pharm-teal)' : 'var(--pharm-red)' }}>
                      {net >= 0 ? '+' : ''}{net}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Low stock alert */}
            {selectedMedicineDetails.currentStock < (selectedMedicineDetails.reorderLevel || 20) && (
              <div className="pharm-alert pharm-alert-warning" style={{ marginBottom: '1rem' }}>
                ⚠️ <strong>Low Stock:</strong> Current ({selectedMedicineDetails.currentStock}) is below reorder level ({selectedMedicineDetails.reorderLevel || 20}). Please restock.
              </div>
            )}

            {detailLoading ? (
              <div className="pharm-loading" style={{ minHeight: 100 }}>⏳ Loading daily data...</div>
            ) : (
              <div className="pharm-table-container">
                <table className="pharm-table" style={{ fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Units Issued</th>
                      <th>Issue Count</th>
                      <th>Units Added</th>
                      <th>Add Count</th>
                      <th>Daily Net</th>
                      <th>Cumulative</th>
                      <th>Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyBreakdown.map((day) => (
                      <tr key={day.date}>
                        <td className="mono" style={{ fontWeight: 500 }}>{day.date}</td>
                        <td style={{ color: 'var(--pharm-red)', fontFamily: 'var(--pharm-mono)', fontWeight: 600 }}>
                          {day.issued > 0 ? `−${day.issued}` : '—'}
                        </td>
                        <td className="mono">{day.issuanceCount || '—'}</td>
                        <td style={{ color: 'var(--pharm-teal)', fontFamily: 'var(--pharm-mono)', fontWeight: 600 }}>
                          {day.added > 0 ? `+${day.added}` : '—'}
                        </td>
                        <td className="mono">{day.additionCount || '—'}</td>
                        <td style={{
                          color: day.netChange >= 0 ? 'var(--pharm-green)' : 'var(--pharm-red)',
                          fontFamily: 'var(--pharm-mono)', fontWeight: 700
                        }}>
                          {day.netChange >= 0 ? '+' : ''}{day.netChange}
                        </td>
                        <td style={{
                          color: (day.cumulativeChange || 0) >= 0 ? 'var(--pharm-teal)' : 'var(--pharm-red)',
                          fontFamily: 'var(--pharm-mono)',
                          background: (day.cumulativeChange || 0) < -20 ? 'rgba(220,38,38,0.08)' : 'transparent'
                        }}>
                          {(day.cumulativeChange || 0) >= 0 ? '+' : ''}{day.cumulativeChange || 0}
                        </td>
                        <td>
                          {day.issued === 0 && day.added === 0
                            ? <span className="pharm-badge" style={{ background: 'var(--pharm-gray-100)', color: 'var(--pharm-gray-400)' }}>No Activity</span>
                            : day.added > 0 && day.issued === 0
                            ? <span className="pharm-badge pharm-badge-green">Restocked</span>
                            : day.issued > 0 && day.added === 0
                            ? <span className="pharm-badge pharm-badge-red">Issued Only</span>
                            : <span className="pharm-badge pharm-badge-amber">Both</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}