import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import '../../styles/pharmacist/PharmacistDashboard.css';
import { useApi } from '../../context/ApiContext';

// ── CSV helper
function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportMovementCSV(movementData) {
  const headers = ['Date', 'Units Issued', 'Issuance Txns', 'Units Added', 'Addition Txns', 'Net Change'];
  const rows = movementData.map(d => [d.date, d.issued || 0, d.issuedTx || 0, d.added || 0, d.addedTx || 0, d.net || 0]);
  downloadCSV([headers, ...rows].map(r => r.join(',')).join('\n'), `stock_movement_${new Date().toISOString().split('T')[0]}.csv`);
}

function exportUsageCSV(usageData) {
  const headers = ['Rank', 'Medicine', 'Brand', 'Category', 'Units Dispensed', 'Prescriptions', 'Current Stock'];
  const rows = usageData.map((item, idx) => [idx + 1, item.name, item.brandName || '', item.category || '', item.totalIssued, item.count, item.currentStock]);
  downloadCSV([headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n'), `top_medicines_${new Date().toISOString().split('T')[0]}.csv`);
}

export default function PharmacistAnalytics() {
  const [activeTab, setActiveTab] = useState('overview');

  // Overview & Usage
  const [usagePeriod, setUsagePeriod] = useState('month');
  const [topUsed, setTopUsed] = useState([]);
  const [issuanceSummary, setIssuanceSummary] = useState(null);

  // Stock Movement
  const [movementDays, setMovementDays] = useState(30);
  const [movementData, setMovementData] = useState({ dailyIssuances: [], dailyAdditions: [], movementData: [] });

  // Expiry
  const [expirySummary, setExpirySummary] = useState(null);

  // Advanced: custom date
  const [dateMode, setDateMode] = useState('preset');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [advPeriod, setAdvPeriod] = useState('month');

  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  const apiBaseUrl = useApi();
  const API_BASE = `${apiBaseUrl}/api`;
  const token = localStorage.getItem('token');
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErrors({});
    const [usageRes, movRes, summaryRes, expiryRes] = await Promise.allSettled([
      axios.get(`${API_BASE}/medicines/analytics/usage?period=${usagePeriod}`, authHeader),
      axios.get(`${API_BASE}/medicines/analytics/stock-movement?days=${movementDays}`, authHeader),
      axios.get(`${API_BASE}/issuances/stats/summary`, authHeader),
      axios.get(`${API_BASE}/medicines/analytics/expiry-summary`, authHeader),
    ]);

    if (usageRes.status === 'fulfilled') setTopUsed(usageRes.value.data.usage || []);
    else setErrors(e => ({ ...e, usage: 'Could not load usage data.' }));

    if (movRes.status === 'fulfilled') setMovementData(movRes.value.data);
    else setErrors(e => ({ ...e, movement: 'Could not load stock movement.' }));

    if (summaryRes.status === 'fulfilled') setIssuanceSummary(summaryRes.value.data);
    else setErrors(e => ({ ...e, summary: 'Could not load issuance summary.' }));

    if (expiryRes.status === 'fulfilled') setExpirySummary(expiryRes.value.data);
    else setErrors(e => ({ ...e, expiry: 'Could not load expiry data.' }));

    setLoading(false);
  }, [usagePeriod, movementDays]);

  // Advanced load with custom date range
  const loadAdvanced = useCallback(async () => {
    setLoading(true);
    const params = dateMode === 'custom' && customFrom && customTo
      ? { usageP: { from: customFrom, to: customTo }, movP: { from: customFrom, to: customTo } }
      : { usageP: { period: advPeriod }, movP: { days: advPeriod === 'day' ? 1 : advPeriod === 'week' ? 7 : advPeriod === 'year' ? 365 : 30 } };

    const [usageRes, movRes] = await Promise.allSettled([
      axios.get(`${API_BASE}/medicines/analytics/usage`, { ...authHeader, params: params.usageP }),
      axios.get(`${API_BASE}/medicines/analytics/stock-movement`, { ...authHeader, params: params.movP }),
    ]);

    if (usageRes.status === 'fulfilled') setTopUsed(usageRes.value.data.usage || []);
    if (movRes.status === 'fulfilled') setMovementData(movRes.value.data);
    setLoading(false);
  }, [dateMode, customFrom, customTo, advPeriod]);

  useEffect(() => {
    if (activeTab === 'advanced') loadAdvanced();
    else loadAll();
  }, [activeTab, loadAll, loadAdvanced]);

  // ── Build movement map for Overview bar chart
  const movMap = {};
  (movementData.dailyIssuances || []).forEach(d => { movMap[d._id] = { ...movMap[d._id], issued: d.totalIssued, issuedTx: d.transactionCount }; });
  (movementData.dailyAdditions || []).forEach(d => { movMap[d._id] = { ...movMap[d._id], added: d.totalAdded }; });
  const movDates = Object.keys(movMap).sort();
  const maxMov = Math.max(...movDates.map(d => Math.max(movMap[d].issued || 0, movMap[d].added || 0)), 1);

  const mergedMovement = movementData.movementData || [];
  const maxMovAdv = Math.max(...mergedMovement.map(d => Math.max(d.issued || 0, d.added || 0)), 1);
  const totalIssued = mergedMovement.reduce((s, d) => s + (d.issued || 0), 0);
  const totalAdded = mergedMovement.reduce((s, d) => s + (d.added || 0), 0);
  const netChange = totalAdded - totalIssued;

  const maxUsage = topUsed[0]?.totalIssued || 1;

  const TABS = [
    { k: 'overview', l: 'Overview' },
    { k: 'usage', l: 'Top Usage' },
    { k: 'movement', l: 'Stock Movement' },
    { k: 'expiry', l: 'Expiry Status' },
    { k: 'advanced', l: 'Advanced' },
  ];

  if (loading) return <div className="pharm-loading">Loading analytics...</div>;

  return (
    <div className="pharm-layout">
      <div className="pharm-root">

        {/* ── Header ── */}
        <div className="pharm-header">
          <div>
            <h1 className="pharm-title">Analytics &amp; Reports</h1>
            <p className="pharm-subtitle">Usage statistics, stock movement, expiry tracking, and consumption trends</p>
          </div>
          <div className="pharm-header-actions">
            {activeTab === 'movement' && mergedMovement.length > 0 && (
              <button className="pharm-btn pharm-btn-ghost" onClick={() => exportMovementCSV(mergedMovement)}>Export CSV</button>
            )}
            {(activeTab === 'usage' || activeTab === 'overview') && topUsed.length > 0 && (
              <button className="pharm-btn pharm-btn-ghost" onClick={() => exportUsageCSV(topUsed)}>Export CSV</button>
            )}
            <button className="pharm-btn pharm-btn-ghost" onClick={() => activeTab === 'advanced' ? loadAdvanced() : loadAll()}>Refresh</button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1.25rem', borderBottom: '2px solid var(--pharm-gray-100)', paddingBottom: '0', overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.k}
              className={`pharm-btn pharm-btn-sm ${activeTab === t.k ? 'pharm-btn-teal' : 'pharm-btn-ghost'}`}
              style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none', whiteSpace: 'nowrap' }}
              onClick={() => setActiveTab(t.k)}>
              {t.l}
            </button>
          ))}
        </div>

        {/* ══════════ OVERVIEW TAB ══════════ */}
        {activeTab === 'overview' && (
          <>
            {/* Issuance Summary */}
            {issuanceSummary && (
              <div className="pharm-issuance-summary" style={{ marginBottom: '1.5rem' }}>
                {[
                  { label: 'TODAY', data: issuanceSummary.today },
                  { label: 'THIS WEEK', data: issuanceSummary.week, cls: 'week' },
                  { label: 'THIS MONTH', data: issuanceSummary.month, cls: 'month' },
                  { label: 'THIS YEAR', data: issuanceSummary.year, cls: 'year' },
                  { label: 'ALL TIME', data: issuanceSummary.allTime },
                ].map(s => (
                  <div key={s.label} className={`pharm-issuance-card ${s.cls || ''}`}>
                    <div className="label">{s.label}</div>
                    <div className="value">{s.data?.qty || 0}</div>
                    <div className="sub">{s.data?.transactions || 0} transactions</div>
                  </div>
                ))}
              </div>
            )}

            {/* Movement Totals */}
            <div className="pharm-stats-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="pharm-stat-card warning">
                <div className="pharm-stat-label">Stock Added ({movementDays}d)</div>
                <div className="pharm-stat-value" style={{ color: 'var(--pharm-gold)' }}>+{movDates.reduce((s, d) => s + (movMap[d].added || 0), 0)}</div>
              </div>
              <div className="pharm-stat-card danger">
                <div className="pharm-stat-label">Stock Issued ({movementDays}d)</div>
                <div className="pharm-stat-value" style={{ color: 'var(--pharm-red)' }}>−{movDates.reduce((s, d) => s + (movMap[d].issued || 0), 0)}</div>
              </div>
              {expirySummary && (
                <>
                  <div className="pharm-stat-card danger">
                    <div className="pharm-stat-label">Expired / ≤30d</div>
                    <div className="pharm-stat-value" style={{ color: 'var(--pharm-red)' }}>{expirySummary.expired + expirySummary.expiring30}</div>
                    <div className="pharm-stat-meta">Need immediate action</div>
                  </div>
                  <div className="pharm-stat-card warning">
                    <div className="pharm-stat-label">Expiring 31–90d</div>
                    <div className="pharm-stat-value" style={{ color: 'var(--pharm-amber)' }}>{(expirySummary.expiring60 || 0) + (expirySummary.expiring90 || 0)}</div>
                    <div className="pharm-stat-meta">Plan restocking</div>
                  </div>
                </>
              )}
            </div>

            {/* Bar chart — daily movement */}
            <div className="pharm-section">
              <div className="pharm-section-header">
                <h2 className="pharm-section-title">Daily Stock Movement</h2>
                <div className="pharm-period-selector">
                  {[7, 14, 30, 60].map(d => (
                    <button key={d} className={`pharm-period-btn ${movementDays === d ? 'active' : ''}`} onClick={() => setMovementDays(d)}>{d}d</button>
                  ))}
                </div>
              </div>
              {movDates.length === 0 ? (
                <div className="pharm-empty"><div className="pharm-empty-text">No movement data in this period</div></div>
              ) : (
                <div style={{ padding: '1rem 1.5rem' }}>
                  <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '160px', marginBottom: '2rem', overflowX: 'auto' }}>
                    {movDates.slice(-28).map(date => {
                      const d = movMap[date];
                      return (
                        <div key={date} style={{ flex: '0 0 auto', minWidth: 12, maxWidth: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <div style={{ width: '100%', display: 'flex', gap: '1px', alignItems: 'flex-end', height: '140px' }}>
                            <div style={{ flex: 1, height: `${((d?.issued || 0) / maxMov) * 100}%`, background: 'var(--pharm-red)', borderRadius: '2px 2px 0 0', opacity: 0.8, minHeight: (d?.issued || 0) > 0 ? '3px' : '0' }} title={`${date}: Issued ${d?.issued || 0}`} />
                            <div style={{ flex: 1, height: `${((d?.added || 0) / maxMov) * 100}%`, background: 'var(--pharm-teal)', borderRadius: '2px 2px 0 0', opacity: 0.8, minHeight: (d?.added || 0) > 0 ? '3px' : '0' }} title={`${date}: Added ${d?.added || 0}`} />
                          </div>
                          <div style={{ fontSize: '0.55rem', color: 'var(--pharm-gray-400)', transform: 'rotate(-45deg)', whiteSpace: 'nowrap', transformOrigin: 'top left', marginTop: '2px' }}>{date.slice(5)}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--pharm-gray-500)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><span style={{ width: 12, height: 12, background: 'var(--pharm-red)', borderRadius: 2, opacity: 0.8, display: 'inline-block' }} /> Issued</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><span style={{ width: 12, height: 12, background: 'var(--pharm-teal)', borderRadius: 2, opacity: 0.8, display: 'inline-block' }} /> Added</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════ USAGE TAB ══════════ */}
        {activeTab === 'usage' && (
          <div className="pharm-section">
            <div className="pharm-section-header">
              <h2 className="pharm-section-title">Most Dispensed Medicines</h2>
              <div className="pharm-period-selector">
                {[{ k: 'day', l: 'Today' }, { k: 'week', l: 'Week' }, { k: 'month', l: 'Month' }, { k: 'year', l: 'Year' }].map(p => (
                  <button key={p.k} className={`pharm-period-btn ${usagePeriod === p.k ? 'active' : ''}`} onClick={() => setUsagePeriod(p.k)}>{p.l}</button>
                ))}
              </div>
            </div>
            {errors.usage && <div className="pharm-alert pharm-alert-danger">{errors.usage}</div>}
            {topUsed.length === 0 ? (
              <div className="pharm-empty"><div className="pharm-empty-text">No issuance data for this period</div></div>
            ) : (
              <>
                <div className="pharm-usage-list">
                  {topUsed.map((item, idx) => (
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
                          <div className="pharm-usage-bar-fill" style={{ width: `${(item.totalIssued / maxUsage) * 100}%` }} />
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--pharm-gray-400)' }}>{((item.totalIssued / maxUsage) * 100).toFixed(0)}%</div>
                      </div>
                      <div className="pharm-usage-qty">{item.totalIssued}</div>
                    </div>
                  ))}
                </div>
                <div className="pharm-table-container" style={{ marginTop: '1rem' }}>
                  <table className="pharm-table" style={{ fontSize: '0.8rem' }}>
                    <thead><tr><th>Rank</th><th>Medicine</th><th>Brand</th><th>Category</th><th>Prescriptions</th><th>Units Dispensed</th><th>Current Stock</th></tr></thead>
                    <tbody>
                      {topUsed.map((item, idx) => (
                        <tr key={item._id}>
                          <td className="mono">{idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>{item.name}</td>
                          <td style={{ color: 'var(--pharm-gray-400)' }}>{item.brandName || '—'}</td>
                          <td><span className="pharm-badge pharm-badge-navy" style={{ fontSize: '0.68rem' }}>{item.category}</span></td>
                          <td className="mono">{item.count}</td>
                          <td style={{ color: 'var(--pharm-red)', fontFamily: 'var(--pharm-mono)', fontWeight: 600 }}>{item.totalIssued}</td>
                          <td><span className={`pharm-stock-num ${item.currentStock === 0 ? 'out' : item.currentStock < 20 ? 'low' : 'ok'}`}>{item.currentStock}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════ STOCK MOVEMENT TAB ══════════ */}
        {activeTab === 'movement' && (
          <div className="pharm-section">
            <div className="pharm-section-header">
              <h2 className="pharm-section-title">Daily Stock Movement</h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="pharm-badge" style={{ background: 'var(--pharm-red-pale)', color: 'var(--pharm-red)', border: '1px solid #fecaca' }}>Issued: {totalIssued}</span>
                <span className="pharm-badge" style={{ background: 'var(--pharm-gold-soft)', color: 'var(--pharm-gold-dark)', border: '1px solid var(--pharm-gold-mid)' }}>Added: {totalAdded}</span>
                <span className={`pharm-badge ${netChange >= 0 ? 'pharm-badge-green' : 'pharm-badge-red'}`} style={{ fontWeight: 700 }}>Net: {netChange >= 0 ? '+' : ''}{netChange}</span>
                <div className="pharm-period-selector">
                  {[7, 14, 30, 60].map(d => (
                    <button key={d} className={`pharm-period-btn ${movementDays === d ? 'active' : ''}`} onClick={() => setMovementDays(d)}>{d}d</button>
                  ))}
                </div>
              </div>
            </div>
            {mergedMovement.length === 0 ? (
              <div className="pharm-empty"><div className="pharm-empty-text">No movement data for this period</div></div>
            ) : (
              <>
                <div style={{ padding: '1rem 1.5rem' }}>
                  <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '180px', overflowX: 'auto', paddingBottom: '2rem' }}>
                    {mergedMovement.map(day => (
                      <div key={day.date} style={{ flex: '0 0 auto', minWidth: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <div style={{ width: '100%', display: 'flex', gap: '1px', alignItems: 'flex-end', height: '160px', minWidth: 14 }}>
                          <div style={{ flex: 1, height: `${((day.issued || 0) / maxMovAdv) * 100}%`, background: '#dc2626', borderRadius: '3px 3px 0 0', minHeight: (day.issued || 0) > 0 ? '3px' : '0' }} title={`${day.date}\nIssued: ${day.issued}`} />
                          <div style={{ flex: 1, height: `${((day.added || 0) / maxMovAdv) * 100}%`, background: '#14b8a6', borderRadius: '3px 3px 0 0', minHeight: (day.added || 0) > 0 ? '3px' : '0' }} title={`${day.date}\nAdded: ${day.added}`} />
                        </div>
                        <div style={{ fontSize: '0.55rem', color: 'var(--pharm-gray-400)', transform: 'rotate(-45deg)', whiteSpace: 'nowrap', transformOrigin: 'top left', marginTop: '4px' }}>{day.date.slice(5)}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', fontSize: '0.78rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><span style={{ width: 14, height: 14, background: '#dc2626', borderRadius: 2, display: 'inline-block' }} /> Issued</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><span style={{ width: 14, height: 14, background: '#14b8a6', borderRadius: 2, display: 'inline-block' }} /> Added</span>
                  </div>
                </div>
                <div className="pharm-table-container">
                  <table className="pharm-table" style={{ fontSize: '0.8rem' }}>
                    <thead><tr><th>Date</th><th>Units Issued</th><th>Issuance Txns</th><th>Units Added</th><th>Addition Txns</th><th>Net Change</th></tr></thead>
                    <tbody>
                      {mergedMovement.slice().reverse().map(day => (
                        <tr key={day.date}>
                          <td className="mono">{day.date}</td>
                          <td style={{ color: '#dc2626', fontFamily: 'monospace', fontWeight: 600 }}>−{day.issued || 0}</td>
                          <td className="mono">{day.issuedTx || 0}</td>
                          <td style={{ color: '#14b8a6', fontFamily: 'monospace', fontWeight: 600 }}>+{day.added || 0}</td>
                          <td className="mono">{day.addedTx || 0}</td>
                          <td style={{ color: (day.net || 0) >= 0 ? '#14b8a6' : '#dc2626', fontFamily: 'monospace', fontWeight: 700 }}>
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

        {/* ══════════ EXPIRY STATUS TAB ══════════ */}
        {activeTab === 'expiry' && (
          <div className="pharm-section">
            <div className="pharm-section-header">
              <h2 className="pharm-section-title">Expiry Date Distribution</h2>
              {expirySummary && <span style={{ fontSize: '0.82rem', color: 'var(--pharm-gray-400)' }}>{expirySummary.totalAnalyzed} medicines analysed</span>}
            </div>
            {errors.expiry && <div className="pharm-alert pharm-alert-danger">{errors.expiry}</div>}
            {expirySummary ? (
              <>
                <div className="pharm-stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '1.5rem' }}>
                  {[
                    { label: 'Already Expired', val: expirySummary.expired, cls: 'danger', color: 'var(--pharm-red)', meta: 'Remove from inventory' },
                    { label: 'Expiring ≤30 days', val: expirySummary.expiring30, cls: 'danger', color: 'var(--pharm-red)', meta: 'Immediate action needed' },
                    { label: 'Expiring 31–90 days', val: (expirySummary.expiring60 || 0) + (expirySummary.expiring90 || 0), cls: 'warning', color: 'var(--pharm-amber)', meta: 'Plan restocking' },
                    { label: 'Safe (>90 days)', val: (expirySummary.expiring180 || 0) + (expirySummary.expiring365 || 0) + (expirySummary.beyond365 || 0), cls: 'success', color: 'var(--pharm-green)', meta: 'No action needed' },
                  ].map(s => (
                    <div key={s.label} className={`pharm-stat-card ${s.cls}`}>
                      <div className="pharm-stat-label">{s.label}</div>
                      <div className="pharm-stat-value" style={{ color: s.color }}>{s.val}</div>
                      <div className="pharm-stat-meta">{s.meta}</div>
                    </div>
                  ))}
                </div>
                {/* Horizontal bar chart */}
                <div style={{ padding: '0 1.5rem 1.5rem' }}>
                  {[
                    { label: 'Already Expired', val: expirySummary.expired, color: 'var(--pharm-red)' },
                    { label: 'Expiring ≤30d', val: expirySummary.expiring30, color: '#dc2626' },
                    { label: 'Expiring 31–60d', val: expirySummary.expiring60, color: '#ef4444' },
                    { label: 'Expiring 61–90d', val: expirySummary.expiring90, color: '#f87171' },
                    { label: 'Expiring 91–180d', val: expirySummary.expiring180, color: '#ca8a04' },
                    { label: 'Expiring 181–365d', val: expirySummary.expiring365, color: '#16a34a' },
                    { label: 'Beyond 1 year', val: expirySummary.beyond365, color: '#15803d' },
                  ].map(cat => {
                    const maxVal = Math.max(expirySummary.expired, expirySummary.expiring30, expirySummary.expiring60,
                      expirySummary.expiring90, expirySummary.expiring180, expirySummary.expiring365, expirySummary.beyond365, 1);
                    return (
                      <div key={cat.label} style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                        <div style={{ width: 140, fontSize: '0.8rem', color: 'var(--pharm-gray-600)', flexShrink: 0 }}>{cat.label}</div>
                        <div style={{ flex: 1, background: 'var(--pharm-gray-100)', borderRadius: 4, height: 22, position: 'relative', overflow: 'hidden' }}>
                          <div style={{ width: `${(cat.val / maxVal) * 100}%`, background: cat.color, height: '100%', borderRadius: 4, transition: 'width 0.4s ease', opacity: 0.85 }} />
                        </div>
                        <div style={{ width: 36, textAlign: 'right', fontFamily: 'var(--pharm-mono)', fontWeight: 700, color: cat.color, fontSize: '0.9rem' }}>{cat.val}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="pharm-empty"><div className="pharm-empty-text">Expiry data not available</div></div>
            )}
          </div>
        )}

        {/* ══════════ ADVANCED TAB ══════════ */}
        {activeTab === 'advanced' && (
          <>
            {/* Date Range Selector */}
            <div className="pharm-section" style={{ marginBottom: '1rem' }}>
              <div className="pharm-section-header">
                <h2 className="pharm-section-title">Custom Date Range</h2>
              </div>
              <div className="pharm-filter-bar" style={{ flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', padding: '1rem' }}>
                <div className="pharm-filter-chips">
                  <button className={`pharm-chip ${dateMode === 'preset' ? 'active' : ''}`} onClick={() => setDateMode('preset')}>Preset</button>
                  <button className={`pharm-chip ${dateMode === 'custom' ? 'active' : ''}`} onClick={() => setDateMode('custom')}>Custom Range</button>
                </div>
                {dateMode === 'preset' && (
                  <div className="pharm-filter-chips">
                    {[{ k: 'day', l: 'Today' }, { k: 'week', l: 'This Week' }, { k: 'month', l: 'This Month' }, { k: 'year', l: 'This Year' }].map(p => (
                      <button key={p.k} className={`pharm-period-btn ${advPeriod === p.k ? 'active' : ''}`} onClick={() => setAdvPeriod(p.k)}>{p.l}</button>
                    ))}
                  </div>
                )}
                {dateMode === 'custom' && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="date" className="pharm-input" style={{ width: 'auto' }} value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
                    <span style={{ color: 'var(--pharm-gray-400)' }}>to</span>
                    <input type="date" className="pharm-input" style={{ width: 'auto' }} value={customTo} onChange={e => setCustomTo(e.target.value)} />
                    <button className="pharm-btn pharm-btn-teal pharm-btn-sm" onClick={loadAdvanced}>Apply</button>
                  </div>
                )}
              </div>
            </div>

            {/* Usage + Movement side by side */}
            <div className="pharm-analytics-grid">
              <div className="pharm-section">
                <div className="pharm-section-header">
                  <h2 className="pharm-section-title">Top Dispensed</h2>
                  <span style={{ fontSize: '0.82rem', color: 'var(--pharm-gray-400)' }}>{topUsed.length} medicines · {topUsed.reduce((s, i) => s + i.totalIssued, 0)} units</span>
                </div>
                {topUsed.length === 0 ? <div className="pharm-empty"><div className="pharm-empty-text">No data</div></div> : (
                  <div className="pharm-usage-list">
                    {topUsed.slice(0, 10).map((item, idx) => (
                      <div key={item._id} className="pharm-usage-item">
                        <div className={`pharm-usage-rank ${idx < 3 ? 'top' : ''}`}>{idx + 1}</div>
                        <div className="pharm-usage-info">
                          <div className="pharm-usage-name">{item.name}</div>
                          <div className="pharm-usage-brand">{item.brandName && `${item.brandName} · `}Stock: {item.currentStock}</div>
                        </div>
                        <div className="pharm-usage-bar-wrap">
                          <div className="pharm-usage-bar"><div className="pharm-usage-bar-fill" style={{ width: `${(item.totalIssued / maxUsage) * 100}%` }} /></div>
                        </div>
                        <div className="pharm-usage-qty">{item.totalIssued}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pharm-section">
                <div className="pharm-section-header">
                  <h2 className="pharm-section-title">Stock Movement</h2>
                  <div style={{ display: 'flex', gap: '0.4rem', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--pharm-red)' }}>−{totalIssued}</span>
                    <span style={{ color: 'var(--pharm-teal)' }}>+{totalAdded}</span>
                    <span style={{ fontWeight: 700, color: netChange >= 0 ? 'var(--pharm-green)' : 'var(--pharm-red)' }}>{netChange >= 0 ? '+' : ''}{netChange}</span>
                  </div>
                </div>
                {mergedMovement.length === 0 ? <div className="pharm-empty"><div className="pharm-empty-text">No movement data</div></div> : (
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    <table className="pharm-table" style={{ fontSize: '0.78rem' }}>
                      <thead><tr><th>Date</th><th>Issued</th><th>Added</th><th>Net</th></tr></thead>
                      <tbody>
                        {mergedMovement.slice().reverse().map(day => (
                          <tr key={day.date}>
                            <td className="mono">{day.date}</td>
                            <td style={{ color: '#dc2626', fontFamily: 'monospace' }}>−{day.issued || 0}</td>
                            <td style={{ color: '#14b8a6', fontFamily: 'monospace' }}>+{day.added || 0}</td>
                            <td style={{ color: (day.net || 0) >= 0 ? '#14b8a6' : '#dc2626', fontFamily: 'monospace', fontWeight: 700 }}>
                              {(day.net || 0) >= 0 ? '+' : ''}{day.net || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}