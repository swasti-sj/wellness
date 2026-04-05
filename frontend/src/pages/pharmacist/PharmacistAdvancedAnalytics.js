import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import '../../styles/pharmacist/PharmacistDashboard.css';

const API = 'http://localhost:5000/api';

// ─── CSV export ────────────────────────────────────────────────────────────
function exportMovementCSV(movementData) {
  const headers = ['Date', 'Units Issued', 'Issuance Count', 'Units Added', 'Addition Count', 'Net Change'];
  const rows = movementData.map(d => [d.date, d.issued, d.issuedTx || 0, d.added, d.addedTx || 0, d.net]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stock_movement_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PharmacistAdvancedAnalytics() {
  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [dateMode, setDateMode] = useState('preset');
  const [selectedChart, setSelectedChart] = useState('usage');

  const [usageData, setUsageData] = useState([]);
  const [movementData, setMovementData] = useState([]);
  const [expirySummary, setExpirySummary] = useState(null);
  const [issuanceSummary, setIssuanceSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const buildParams = useCallback(() => {
    if (dateMode === 'custom' && customFrom && customTo) {
      return {
        usageParams:    { from: customFrom, to: customTo },
        movementParams: { from: customFrom, to: customTo },
      };
    }
    const days = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 365;
    return {
      usageParams:    { period },
      movementParams: { days },
    };
  }, [period, dateMode, customFrom, customTo]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { usageParams, movementParams } = buildParams();
      const [usageRes, movementRes, expiryRes, summaryRes] = await Promise.all([
        axios.get(`${API}/medicines/analytics/usage`,         { ...authHeader, params: usageParams }),
        axios.get(`${API}/medicines/analytics/stock-movement`, { ...authHeader, params: movementParams }),
        axios.get(`${API}/medicines/analytics/expiry-summary`, authHeader),
        axios.get(`${API}/issuances/stats/summary`,            authHeader),
      ]);
      setUsageData(usageRes.data.usage || []);
      setMovementData(movementRes.data.movementData || []);
      setExpirySummary(expiryRes.data);
      setIssuanceSummary(summaryRes.data);
    } catch (e) {
      setError('Failed to load analytics data.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => { loadAllData(); }, [loadAllData]);

  const maxUsage = usageData[0]?.totalIssued || 1;
  const maxMovement = Math.max(...movementData.map(d => Math.max(d.issued || 0, d.added || 0)), 1);

  const totalIssued = movementData.reduce((s, d) => s + (d.issued || 0), 0);
  const totalAdded  = movementData.reduce((s, d) => s + (d.added  || 0), 0);
  const netChange   = totalAdded - totalIssued;

  const getPeriodLabel = () => {
    if (dateMode === 'custom' && customFrom && customTo) return `${customFrom} → ${customTo}`;
    return { day: 'Today', week: 'This Week', month: 'This Month', year: 'This Year' }[period] || '';
  };

  if (loading) return <div className="pharm-loading">Loading advanced analytics...</div>;

  return (
    <div className="pharm-layout">
      <div className="pharm-root">
        <div className="pharm-header">
          <div>
            <h1 className="pharm-title">Advanced Analytics</h1>
            <p className="pharm-subtitle">Comprehensive pharmacy operations insights — {getPeriodLabel()}</p>
          </div>
          <div className="pharm-header-actions">
            {selectedChart === 'movement' && movementData.length > 0 && (
              <button className="pharm-btn pharm-btn-ghost" onClick={() => exportMovementCSV(movementData)}>
                Export CSV
              </button>
            )}
            <button className="pharm-btn pharm-btn-ghost" onClick={loadAllData}>Refresh</button>
          </div>
        </div>

        {error && <div className="pharm-alert pharm-alert-danger">{error}</div>}

        {/* ── Dispensing Summary Cards ── */}
        {issuanceSummary && (
          <div className="pharm-stats-grid">
            {[
              { label: 'Today',     data: issuanceSummary.today,  cls: 'info' },
              { label: 'This Week', data: issuanceSummary.week,   cls: 'info' },
              { label: 'This Month',data: issuanceSummary.month,  cls: 'warning' },
              { label: 'This Year', data: issuanceSummary.year,   cls: 'warning' },
              { label: 'All Time',  data: issuanceSummary.allTime,cls: 'info' },
            ].map(s => (
              <div key={s.label} className={`pharm-stat-card ${s.cls}`}>
                <div className="pharm-stat-label">{s.label}</div>
                <div className="pharm-stat-value">{s.data?.qty?.toLocaleString() || 0}</div>
                <div className="pharm-stat-meta">{s.data?.transactions || 0} transactions</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Period Selector ── */}
        <div className="pharm-section">
          <div className="pharm-section-header">
            <h2 className="pharm-section-title">Date Range</h2>
          </div>
          <div className="pharm-filter-bar" style={{ flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <div className="pharm-filter-chips">
              <button className={`pharm-chip ${dateMode === 'preset' ? 'active' : ''}`} onClick={() => setDateMode('preset')}>
                Preset
              </button>
              <button className={`pharm-chip ${dateMode === 'custom' ? 'active' : ''}`} onClick={() => setDateMode('custom')}>
                Custom Range
              </button>
            </div>

            {dateMode === 'preset' && (
              <div className="pharm-filter-chips">
                {[
                  { k: 'day',   l: 'Today' },
                  { k: 'week',  l: 'This Week' },
                  { k: 'month', l: 'This Month' },
                  { k: 'year',  l: 'This Year' },
                ].map(p => (
                  <button key={p.k}
                    className={`pharm-period-btn ${period === p.k ? 'active' : ''}`}
                    onClick={() => setPeriod(p.k)}>
                    {p.l}
                  </button>
                ))}
              </div>
            )}

            {dateMode === 'custom' && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="date" className="pharm-input" style={{ width: 'auto' }}
                  value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
                <span style={{ color: 'var(--pharm-gray-400)' }}>to</span>
                <input type="date" className="pharm-input" style={{ width: 'auto' }}
                  value={customTo} onChange={e => setCustomTo(e.target.value)} />
                <button className="pharm-btn pharm-btn-teal pharm-btn-sm" onClick={loadAllData}>
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Chart Tabs ── */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '2px solid var(--pharm-gray-100)', paddingBottom: '0' }}>
          {[
            { k: 'usage',    l: 'Top Usage' },
            { k: 'movement', l: 'Daily Movement' },
            { k: 'expiry',   l: 'Expiry Status' },
          ].map(t => (
            <button key={t.k}
              className={`pharm-btn pharm-btn-sm ${selectedChart === t.k ? 'pharm-btn-teal' : 'pharm-btn-ghost'}`}
              style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
              onClick={() => setSelectedChart(t.k)}>
              {t.l}
            </button>
          ))}
        </div>

        {/* ── Top Usage Chart ── */}
        {selectedChart === 'usage' && (
          <div className="pharm-section">
            <div className="pharm-section-header">
              <h2 className="pharm-section-title">Most Dispensed Medicines — {getPeriodLabel()}</h2>
              <span style={{ fontSize: '0.82rem', color: 'var(--pharm-gray-400)' }}>
                {usageData.length} medicines · {usageData.reduce((s, i) => s + i.totalIssued, 0)} total units
              </span>
            </div>
            {usageData.length === 0 ? (
              <div className="pharm-empty">
                <div className="pharm-empty-text">No dispensing data for this period</div>
              </div>
            ) : (
              <>
                <div className="pharm-usage-list">
                  {usageData.map((item, idx) => (
                    <div key={item._id} className="pharm-usage-item">
                      <div className={`pharm-usage-rank ${idx < 3 ? 'top' : ''}`}>{idx + 1}</div>
                      <div className="pharm-usage-info">
                        <div className="pharm-usage-name">{item.name}</div>
                        <div className="pharm-usage-brand">
                          {item.brandName && `${item.brandName} · `}
                          {item.category && `${item.category} · `}
                          {item.count} prescriptions · Stock: {item.currentStock} {item.unit || 'units'}
                        </div>
                      </div>
                      <div className="pharm-usage-bar-wrap">
                        <div className="pharm-usage-bar">
                          <div className="pharm-usage-bar-fill"
                            style={{ width: `${(item.totalIssued / maxUsage) * 100}%` }} />
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--pharm-gray-400)' }}>
                          {((item.totalIssued / maxUsage) * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div className="pharm-usage-qty">{item.totalIssued}</div>
                    </div>
                  ))}
                </div>

                {/* Usage table below bars */}
                <div className="pharm-table-container" style={{ marginTop: '1rem' }}>
                  <table className="pharm-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th>Rank</th><th>Medicine</th><th>Brand</th><th>Category</th>
                        <th>Prescriptions</th><th>Units Dispensed</th><th>Current Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageData.map((item, idx) => (
                        <tr key={item._id}>
                          <td className="mono">{idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>{item.name}</td>
                          <td style={{ color: 'var(--pharm-gray-400)' }}>{item.brandName || '—'}</td>
                          <td><span className="pharm-badge pharm-badge-navy" style={{ fontSize: '0.68rem' }}>{item.category}</span></td>
                          <td className="mono">{item.count}</td>
                          <td style={{ color: 'var(--pharm-red)', fontFamily: 'var(--pharm-mono)', fontWeight: 600 }}>{item.totalIssued}</td>
                          <td>
                            <span className={`pharm-stock-num ${item.currentStock === 0 ? 'out' : item.currentStock < 20 ? 'low' : 'ok'}`}>
                              {item.currentStock}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Daily Movement ── */}
        {selectedChart === 'movement' && (
          <div className="pharm-section">
            <div className="pharm-section-header">
              <h2 className="pharm-section-title">Daily Stock Movement</h2>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.85rem', color: 'var(--pharm-gray-500)' }}>
                <span className="pharm-badge pharm-badge-red" style={{ background: 'var(--pharm-red-pale)', color: 'var(--pharm-red)', border: '1px solid #fecaca' }}>
                  Total Issued: {totalIssued}
                </span>
                <span className="pharm-badge" style={{ background: 'var(--pharm-gold-soft)', color: 'var(--pharm-gold-dark)', border: '1px solid var(--pharm-gold-mid)' }}>
                  Total Added: {totalAdded}
                </span>
                <span className={`pharm-badge ${netChange >= 0 ? 'pharm-badge-green' : 'pharm-badge-red'}`} style={{ fontWeight: 700 }}>
                  Net: {netChange >= 0 ? '+' : ''}{netChange}
                </span>
              </div>
            </div>
            {movementData.length === 0 ? (
              <div className="pharm-empty">
                <div className="pharm-empty-text">No movement data for this period</div>
              </div>
            ) : (
              <>
                {/* Bar chart */}
                <div style={{ padding: '1rem 1.5rem' }}>
                  <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '180px', overflowX: 'auto', paddingBottom: '2rem' }}>
                    {movementData.map(day => (
                      <div key={day.date} style={{ flex: '0 0 auto', minWidth: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <div style={{ width: '100%', display: 'flex', gap: '1px', alignItems: 'flex-end', height: '160px', minWidth: 14 }}>
                          <div style={{
                            flex: 1,
                            height: `${((day.issued || 0) / maxMovement) * 100}%`,
                            background: '#dc2626',
                            borderRadius: '3px 3px 0 0',
                            minHeight: (day.issued || 0) > 0 ? '3px' : '0',
                          }} title={`${day.date}\nIssued: ${day.issued}`} />
                          <div style={{
                            flex: 1,
                            height: `${((day.added || 0) / maxMovement) * 100}%`,
                            background: '#14b8a6',
                            borderRadius: '3px 3px 0 0',
                            minHeight: (day.added || 0) > 0 ? '3px' : '0',
                          }} title={`${day.date}\nAdded: ${day.added}`} />
                        </div>
                        <div style={{ fontSize: '0.55rem', color: 'var(--pharm-gray-400)', transform: 'rotate(-45deg)', whiteSpace: 'nowrap', transformOrigin: 'top left', marginTop: '4px' }}>
                          {day.date.slice(5)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.75rem', fontSize: '0.78rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ width: 14, height: 14, background: '#dc2626', borderRadius: 2, display: 'inline-block' }} />
                      Issued (dispensed)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ width: 14, height: 14, background: '#14b8a6', borderRadius: 2, display: 'inline-block' }} />
                      Added (restocked)
                    </span>
                  </div>
                </div>

                {/* Movement Table */}
                <div className="pharm-table-container">
                  <table className="pharm-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Units Issued</th>
                        <th>Issuance Txns</th>
                        <th>Units Added</th>
                        <th>Addition Txns</th>
                        <th>Net Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movementData.slice().reverse().map(day => (
                        <tr key={day.date}>
                          <td className="mono">{day.date}</td>
                          <td style={{ color: '#dc2626', fontFamily: 'monospace', fontWeight: 600 }}>−{day.issued || 0}</td>
                          <td className="mono">{day.issuedTx || 0}</td>
                          <td style={{ color: '#14b8a6', fontFamily: 'monospace', fontWeight: 600 }}>+{day.added || 0}</td>
                          <td className="mono">{day.addedTx || 0}</td>
                          <td style={{
                            color: (day.net || 0) >= 0 ? '#14b8a6' : '#dc2626',
                            fontFamily: 'monospace', fontWeight: 700
                          }}>
                            {(day.net || 0) >= 0 ? '+' : ''}{day.net || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Expiry Distribution ── */}
        {selectedChart === 'expiry' && expirySummary && (
          <div className="pharm-section">
            <div className="pharm-section-header">
              <h2 className="pharm-section-title">Expiry Date Distribution</h2>
              <span style={{ fontSize: '0.82rem', color: 'var(--pharm-gray-400)' }}>
                {expirySummary.totalAnalyzed} medicines analysed
              </span>
            </div>

            {/* Visual bar per category */}
            {(() => {
              const cats = [
                { label: 'Already Expired',  val: expirySummary.expired,    color: 'var(--pharm-red)' },
                { label: 'Expiring ≤30d',    val: expirySummary.expiring30,  color: '#dc2626' },
                { label: 'Expiring 31–60d',  val: expirySummary.expiring60,  color: '#ef4444' },
                { label: 'Expiring 61–90d',  val: expirySummary.expiring90,  color: '#f87171' },
                { label: 'Expiring 91–180d', val: expirySummary.expiring180, color: '#ca8a04' },
                { label: 'Expiring 181–365d',val: expirySummary.expiring365, color: '#16a34a' },
                { label: 'Beyond 1 year',    val: expirySummary.beyond365,   color: '#15803d' },
              ];
              const maxVal = Math.max(...cats.map(c => c.val), 1);
              return (
                <>
                  <div className="pharm-stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.5rem' }}>
                    <div className="pharm-stat-card danger">
                      <div className="pharm-stat-label">Expired</div>
                      <div className="pharm-stat-value" style={{ color: 'var(--pharm-red)' }}>{expirySummary.expired}</div>
                      <div className="pharm-stat-meta">Past expiry date</div>
                    </div>
                    <div className="pharm-stat-card danger">
                      <div className="pharm-stat-label">Expiring ≤30 days</div>
                      <div className="pharm-stat-value" style={{ color: 'var(--pharm-red)' }}>{expirySummary.expiring30}</div>
                      <div className="pharm-stat-meta">Immediate action</div>
                    </div>
                    <div className="pharm-stat-card danger">
                      <div className="pharm-stat-label">Expiring ≤90 days</div>
                      <div className="pharm-stat-value" style={{ color: 'var(--pharm-red)' }}>{expirySummary.expiring60 + expirySummary.expiring90}</div>
                      <div className="pharm-stat-meta">Plan restocking</div>
                    </div>
                    <div className="pharm-stat-card success">
                      <div className="pharm-stat-label">Safe (Over 90 days)</div>
                      <div className="pharm-stat-value" style={{ color: 'var(--pharm-green)' }}>
                        {expirySummary.expiring180 + expirySummary.expiring365 + expirySummary.beyond365}
                      </div>
                      <div className="pharm-stat-meta">No action needed</div>
                    </div>
                  </div>

                  <div style={{ padding: '0 1.5rem 1rem' }}>
                    {cats.map(cat => (
                      <div key={cat.label} style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                        <div style={{ width: 140, fontSize: '0.8rem', color: 'var(--pharm-gray-600)', flexShrink: 0 }}>{cat.label}</div>
                        <div style={{ flex: 1, background: 'var(--pharm-gray-100)', borderRadius: 4, height: 22, position: 'relative', overflow: 'hidden' }}>
                          <div style={{
                            width: `${(cat.val / maxVal) * 100}%`,
                            background: cat.color,
                            height: '100%',
                            borderRadius: 4,
                            transition: 'width 0.4s ease',
                            opacity: 0.85
                          }} />
                        </div>
                        <div style={{ width: 36, textAlign: 'right', fontFamily: 'var(--pharm-mono)', fontWeight: 700, color: cat.color, fontSize: '0.9rem' }}>
                          {cat.val}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}