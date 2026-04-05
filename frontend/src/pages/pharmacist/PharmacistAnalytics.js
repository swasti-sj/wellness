import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import '../../styles/pharmacist/PharmacistDashboard.css';

const API = 'http://localhost:5000/api';

export default function PharmacistAnalytics() {
  const [usagePeriod, setUsagePeriod] = useState('month');
  const [topUsed, setTopUsed] = useState([]);
  const [dailyMovement, setDailyMovement] = useState({ dailyIssuances: [], dailyAdditions: [] });
  const [movementDays, setMovementDays] = useState(30);
  const [issuanceSummary, setIssuanceSummary] = useState(null);
  const [expirySummary, setExpirySummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('token');
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const [usageRes, movementRes, summaryRes, expiryRes] = await Promise.all([
        axios.get(`${API}/medicines/analytics/usage?period=${usagePeriod}`, authHeader),
        axios.get(`${API}/medicines/analytics/stock-movement?days=${movementDays}`, authHeader),
        axios.get(`${API}/issuances/stats/summary`, authHeader),
        axios.get(`${API}/medicines/analytics/expiry-summary`, authHeader),
      ]);
      setTopUsed(usageRes.data.usage || []);
      setDailyMovement(movementRes.data);
      setIssuanceSummary(summaryRes.data);
      setExpirySummary(expiryRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [usagePeriod, movementDays]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  // Build movement map
  const movementMap = {};
  (dailyMovement.dailyIssuances || []).forEach(d => {
    movementMap[d._id] = { ...movementMap[d._id], issued: d.totalIssued, issuedTx: d.transactionCount };
  });
  (dailyMovement.dailyAdditions || []).forEach(d => {
    movementMap[d._id] = { ...movementMap[d._id], added: d.totalAdded };
  });
  const movementDates = Object.keys(movementMap).sort();
  const maxMov = Math.max(
    ...movementDates.map(d => Math.max(movementMap[d].issued || 0, movementMap[d].added || 0)),
    1
  );
  const maxUsage = topUsed[0]?.totalIssued || 1;

  // Totals for movement period
  const totalIssued = movementDates.reduce((s, d) => s + (movementMap[d].issued || 0), 0);
  const totalAdded  = movementDates.reduce((s, d) => s + (movementMap[d].added  || 0), 0);
  const netChange   = totalAdded - totalIssued;

  if (loading) return <div className="pharm-loading">Loading analytics...</div>;

  return (
    <div className="pharm-layout">
      <div className="pharm-root">
        <div className="pharm-header">
          <div>
            <h1 className="pharm-title">Analytics & Reports</h1>
            <p className="pharm-subtitle">Usage statistics, stock movement, and consumption trends</p>
          </div>
          <button className="pharm-btn pharm-btn-ghost" onClick={loadAnalytics}>Refresh</button>
        </div>

        {/* ── Issuance Summary ── */}
        {issuanceSummary && (
          <div className="pharm-issuance-summary">
            {[
              { label: 'TODAY',      data: issuanceSummary.today },
              { label: 'THIS WEEK',  data: issuanceSummary.week,  cls: 'week' },
              { label: 'THIS MONTH', data: issuanceSummary.month, cls: 'month' },
              { label: 'THIS YEAR',  data: issuanceSummary.year, cls: 'year' },
              { label: 'ALL TIME',   data: issuanceSummary.allTime },
            ].map(s => (
              <div key={s.label} className={`pharm-issuance-card ${s.cls || ''}`}>
                <div className="label">{s.label}</div>
                <div className="value">{s.data?.qty || 0}</div>
                <div className="sub">{s.data?.transactions || 0} transactions</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Movement Period Totals ── */}
        <div className="pharm-stats-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="pharm-stat-card warning">
            <div className="pharm-stat-label">Stock Added ({movementDays}d)</div>
            <div className="pharm-stat-value" style={{ color: 'var(--pharm-gold)' }}>+{totalAdded}</div>
          </div>
          <div className="pharm-stat-card danger">
            <div className="pharm-stat-label">Stock Issued ({movementDays}d)</div>
            <div className="pharm-stat-value" style={{ color: 'var(--pharm-red)' }}>−{totalIssued}</div>
          </div>
          <div className="pharm-stat-card info">
            <div className="pharm-stat-label">Net Change ({movementDays}d)</div>
            <div className="pharm-stat-value" style={{ color: netChange >= 0 ? 'var(--pharm-plum)' : 'var(--pharm-red)' }}>
              {netChange >= 0 ? '+' : ''}{netChange}
            </div>
          </div>
        </div>

        <div className="pharm-analytics-grid">
          {/* ── Most Used Medicines ── */}
          <div className="pharm-section">
            <div className="pharm-section-header">
              <h2 className="pharm-section-title">Most Dispensed Medicines</h2>
              <div className="pharm-period-selector">
                {[
                  { k: 'day', l: 'Today' },
                  { k: 'week', l: 'Week' },
                  { k: 'month', l: 'Month' },
                  { k: 'year', l: 'Year' },
                ].map(p => (
                  <button key={p.k} className={`pharm-period-btn ${usagePeriod === p.k ? 'active' : ''}`}
                    onClick={() => setUsagePeriod(p.k)}>
                    {p.l}
                  </button>
                ))}
              </div>
            </div>
            {topUsed.length === 0 ? (
              <div className="pharm-empty">
                <div className="pharm-empty-text">No issuance data for this period</div>
              </div>
            ) : (
              <div className="pharm-usage-list">
                {topUsed.map((item, idx) => (
                  <div key={item._id} className="pharm-usage-item">
                    <div className={`pharm-usage-rank ${idx < 3 ? 'top' : ''}`}>{idx + 1}</div>
                    <div className="pharm-usage-info">
                      <div className="pharm-usage-name">{item.name}</div>
                      <div className="pharm-usage-brand">
                        {item.brandName && `${item.brandName} · `}
                        {item.count} prescriptions · Stock: {item.currentStock} {item.unit || 'units'}
                      </div>
                    </div>
                    <div className="pharm-usage-bar-wrap">
                      <div className="pharm-usage-bar">
                        <div className="pharm-usage-bar-fill"
                          style={{ width: `${(item.totalIssued / maxUsage) * 100}%` }} />
                      </div>
                    </div>
                    <div className="pharm-usage-qty">{item.totalIssued}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Daily Stock Movement ── */}
          <div className="pharm-section">
            <div className="pharm-section-header">
              <h2 className="pharm-section-title">Daily Stock Movement</h2>
              <div className="pharm-period-selector">
                {[7, 14, 30, 60].map(d => (
                  <button key={d} className={`pharm-period-btn ${movementDays === d ? 'active' : ''}`}
                    onClick={() => setMovementDays(d)}>
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            {movementDates.length === 0 ? (
              <div className="pharm-empty">
                <div className="pharm-empty-text">No movement data in this period</div>
              </div>
            ) : (
              <div style={{ padding: '1rem 1.5rem' }}>
                {/* Bar chart — CSS only */}
                <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '160px', marginBottom: '0.5rem', overflowX: 'auto' }}>
                  {movementDates.slice(-28).map(date => {
                    const d = movementMap[date];
                    const issued = d?.issued || 0;
                    const added  = d?.added  || 0;
                    return (
                      <div key={date} style={{ flex: '0 0 auto', minWidth: 12, maxWidth: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <div style={{ width: '100%', display: 'flex', gap: '1px', alignItems: 'flex-end', height: '140px' }}>
                          <div style={{
                            flex: 1,
                            height: `${(issued / maxMov) * 100}%`,
                            background: 'var(--pharm-red)',
                            borderRadius: '2px 2px 0 0',
                            opacity: 0.8,
                            minHeight: issued > 0 ? '3px' : '0',
                          }} title={`${date}: Issued ${issued}`} />
                          <div style={{
                            flex: 1,
                            height: `${(added / maxMov) * 100}%`,
                            background: 'var(--pharm-teal)',
                            borderRadius: '2px 2px 0 0',
                            opacity: 0.8,
                            minHeight: added > 0 ? '3px' : '0',
                          }} title={`${date}: Added ${added}`} />
                        </div>
                        <div style={{ fontSize: '0.55rem', color: 'var(--pharm-gray-400)', transform: 'rotate(-45deg)', whiteSpace: 'nowrap', transformOrigin: 'top left', marginTop: '2px' }}>
                          {date.slice(5)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--pharm-gray-500)', marginBottom: '1rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ width: 12, height: 12, background: 'var(--pharm-red)', borderRadius: 2, opacity: 0.8, display: 'inline-block' }} />
                    Issued (dispensed)
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ width: 12, height: 12, background: 'var(--pharm-teal)', borderRadius: 2, opacity: 0.8, display: 'inline-block' }} />
                    Added (restocked)
                  </span>
                </div>

                {/* Table */}
                <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  <table className="pharm-table" style={{ fontSize: '0.78rem' }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Issued</th>
                        <th>Added</th>
                        <th>Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movementDates.slice().reverse().map(date => {
                        const d = movementMap[date];
                        const issued = d?.issued || 0;
                        const added  = d?.added  || 0;
                        const net    = added - issued;
                        return (
                          <tr key={date}>
                            <td className="mono">{date}</td>
                            <td style={{ color: 'var(--pharm-red)', fontFamily: 'var(--pharm-mono)' }}>−{issued}</td>
                            <td style={{ color: 'var(--pharm-teal)', fontFamily: 'var(--pharm-mono)' }}>+{added}</td>
                            <td style={{ color: net >= 0 ? 'var(--pharm-green)' : 'var(--pharm-red)', fontFamily: 'var(--pharm-mono)', fontWeight: 600 }}>
                              {net >= 0 ? '+' : ''}{net}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Expiry Distribution ── */}
        {expirySummary && (
          <div className="pharm-section" style={{ marginTop: '1.5rem' }}>
            <div className="pharm-section-header">
              <h2 className="pharm-section-title">Medicine Expiry Distribution</h2>
            </div>
            <div className="pharm-stats-grid">
              {[
                { label: 'Expired',      val: expirySummary.expired,    color: 'var(--pharm-red)' },
                { label: '≤30 days',     val: expirySummary.expiring30,  color: 'var(--pharm-red)' },
                { label: '31–60 days',   val: expirySummary.expiring60,  color: 'var(--pharm-red)' },
                { label: '61–90 days',   val: expirySummary.expiring90,  color: 'var(--pharm-red)' },
                { label: '91–180 days',  val: expirySummary.expiring180, color: 'inherit' },
                { label: '181–365 days', val: expirySummary.expiring365, color: 'var(--pharm-green)' },
                { label: '>1 year',      val: expirySummary.beyond365,   color: 'var(--pharm-green)' },
              ].map(s => (
                <div key={s.label} className="pharm-stat-card" style={{ textAlign: 'center', padding: '0.75rem' }}>
                  <div className="pharm-stat-label" style={{ fontSize: '0.7rem' }}>{s.label}</div>
                  <div className="pharm-stat-value" style={{ color: s.color, fontSize: '1.4rem' }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}