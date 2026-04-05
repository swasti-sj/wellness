import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../../styles/pharmacist/PharmacistDashboard.css';

const API = 'http://localhost:5000/api';

const getDaysToExpiry = (date) =>
  Math.max(0, Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24)));

const getMedStatus = (med) => {
  if (med.stockCount === 0) return { label: 'Out of Stock', cls: 'pharm-badge-red' };
  if (med.stockCount < (med.reorderLevel || 20)) return { label: 'Low Stock', cls: 'pharm-badge-amber' };
  const days = getDaysToExpiry(med.expiryDate);
  if (days === 0) return { label: 'Expired', cls: 'pharm-badge-red' };
  if (days <= 30) return { label: `Exp ${days}d`, cls: 'pharm-badge-red' };
  if (days <= 90) return { label: `Exp ${days}d`, cls: 'pharm-badge-amber' };
  return { label: 'Good', cls: 'pharm-badge-green' };
};

export default function PharmacistIssuanceRecords() {
  const [stats, setStats] = useState(null);
  const [issuanceSummary, setIssuanceSummary] = useState(null);
  const [criticalMeds, setCriticalMeds] = useState([]);
  const [recentIssuances, setRecentIssuances] = useState([]);
  const [topUsed, setTopUsed] = useState([]);
  const [usagePeriod, setUsagePeriod] = useState('month');

  // Issuance filter states (medicine/module, doctor, patient, dates)
  const [issuances, setIssuances] = useState([]);
  const [issuancePage, setIssuancePage] = useState(1);
  const [issuancePages, setIssuancePages] = useState(1);
  const [issuanceTotal, setIssuanceTotal] = useState(0);
  const [issuanceLimit, setIssuanceLimit] = useState(20);

  const [allDoctors, setAllDoctors] = useState([]);
  const [allMedicines, setAllMedicines] = useState([]);

  const [medicineFilter, setMedicineFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [patientFilter, setPatientFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [quickSearch, setQuickSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, summaryRes, medsRes, doctorsRes, usageRes] = await Promise.all([
        axios.get(`${API}/medicines/stats`, authHeader),
        axios.get(`${API}/issuances/stats/summary`, authHeader),
        axios.get(`${API}/medicines`, authHeader),
        axios.get(`${API}/doctors/list`, authHeader),
        axios.get(`${API}/medicines/analytics/usage?period=${usagePeriod}`, authHeader),
      ]);

      setStats(statsRes.data);
      setIssuanceSummary(summaryRes.data);
      setTopUsed(usageRes.data.usage || []);
      setAllMedicines(medsRes.data.medicines || []);
      setAllDoctors(doctorsRes.data || []);

      const today = new Date();
      const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      const allMeds = medsRes.data.medicines || [];

      // Sort by severity: out-of-stock > expired > expiring30 > low stock
      const critical = allMeds
        .filter(m =>
          m.stockCount === 0 ||
          m.stockCount < (m.reorderLevel || 20) ||
          new Date(m.expiryDate) <= in30
        )
        .sort((a, b) => getMedStatus(b).label.localeCompare(getMedStatus(a).label))
        .slice(0, 12);
      setCriticalMeds(critical);

      await loadIssuances(1);
    } catch (e) {
      setError('Failed to load dashboard. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [usagePeriod]);

  const loadIssuances = useCallback(async (pageToLoad = issuancePage) => {
    setLoading(true);
    setError('');
    try {
      const params = {
        limit: issuanceLimit,
        page: pageToLoad,
        ...(medicineFilter && { medicine: medicineFilter }),
        ...(doctorFilter && { doctor: doctorFilter }),
        ...(fromDate && { from: fromDate }),
        ...(toDate && { to: toDate })
      };
      const res = await axios.get(`${API}/issuances`, { ...authHeader, params });
      setIssuances(res.data.issuances || []);
      setRecentIssuances(res.data.issuances || []);
      setIssuanceTotal(res.data.total || 0);
      setIssuancePages(res.data.pages || 1);
      setIssuancePage(res.data.page || pageToLoad);

      // if no summary existing yet, just keep it null until loadAll provides it.
      // previous fallback object was inconsistent with the expected structure (today, week, month)
      // and caused crashes.
    } catch (err) {
      setError('Failed to load issuance records.');
    } finally {
      setLoading(false);
    }
  }, [medicineFilter, doctorFilter, patientFilter, fromDate, toDate, issuanceLimit, issuancePage]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    // refresh list whenever filter parameters change
    if (medicineFilter || doctorFilter || patientFilter || fromDate || toDate || issuancePage) {
      loadIssuances(issuancePage);
    }
  }, [medicineFilter, doctorFilter, patientFilter, fromDate, toDate, issuancePage, loadIssuances]);

  if (loading) return (
    <div className="pharm-loading">
      Loading pharmacy records...
    </div>
  );

  if (error) return (
    <div className="pharm-error">
      <span>{error}</span>
      <button className="pharm-btn pharm-btn-primary" onClick={loadAll}>Retry</button>
    </div>
  );

  const maxUsage = topUsed[0]?.totalIssued || 1;
  const totalInventoryValue = 0; // would need pricePerUnit sum from backend

  const lowerSearch = quickSearch.trim().toLowerCase();
  const filteredIssuances = issuances.filter(iss => {
    if (!lowerSearch) return true;
    const combined = [iss.patient?.name, iss.patient?.email, iss.doctor?.name, iss.medicine?.name, iss.medicine?.brandName, iss.notes]
      .filter(Boolean).join(' ').toLowerCase();
    return combined.includes(lowerSearch);
  });

  const isLow = (iss) => {
    const stockAfter = Number(iss.stockAfter || 0);
    const reorder = Number(iss.medicine?.reorderLevel || 20);
    if (stockAfter === 0) return 'row-out-of-stock';
    if (stockAfter <= reorder) return 'row-low-stock';
    return '';
  };

  return (
    <div className="pharm-layout">
      <div className="pharm-root">

        {/* ── Header ── */}
        <div className="pharm-header">
          <div>
            <h1 className="pharm-title">Pharmacy Issuance Records</h1>
            <p className="pharm-subtitle">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="pharm-header-actions">
            <button className="pharm-btn pharm-btn-ghost" onClick={loadAll}>Refresh</button>
            <button className="pharm-btn pharm-btn-ghost" onClick={() => navigate('/pharmacist-dashboard/records')}>
              Issue Medicine
            </button>
            <button className="pharm-btn pharm-btn-teal" onClick={() => navigate('/pharmacist-dashboard/stock')}>
              Add Stock
            </button>
          </div>
        </div>

        {/* ── Key Stats ── */}
        {stats && (
          <div className="pharm-stats-grid">
            <div className="pharm-stat-card">
              <div className="pharm-stat-label">Total Medicines</div>
              <div className="pharm-stat-value">{stats.totalMedicines}</div>
              <div className="pharm-stat-meta">{stats.totalUnitsInStock.toLocaleString()} units in stock</div>
            </div>
            <div className="pharm-stat-card danger">
              <div className="pharm-stat-label">Out of Stock</div>
              <div className="pharm-stat-value" style={{ color: 'var(--pharm-red)' }}>{stats.outOfStock}</div>
              <div className="pharm-stat-meta">Needs immediate restocking</div>
            </div>
            <div className="pharm-stat-card warning">
              <div className="pharm-stat-label">Low Stock</div>
              <div className="pharm-stat-value" style={{ color: 'var(--pharm-amber)' }}>{stats.lowStock}</div>
              <div className="pharm-stat-meta">Below reorder level</div>
            </div>
            <div className="pharm-stat-card warning">
              <div className="pharm-stat-label">Expiring ≤30d</div>
              <div className="pharm-stat-value" style={{ color: stats.expiring30Days > 0 ? 'var(--pharm-red)' : 'inherit' }}>
                {stats.expiring30Days}
              </div>
              <div className="pharm-stat-meta">{stats.expiring90Days} within 90 days</div>
            </div>
          </div>
        )}

        {/* ── Stock Movement Summary ── */}
        {stats?.stockMovement && (
          <div className="pharm-analytics-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="pharm-section" style={{ margin: 0, borderTop: '5px solid var(--pharm-gold)', boxShadow: '0 8px 24px rgba(200, 134, 10, 0.12)' }}>
              <div className="pharm-section-header" style={{ background: 'linear-gradient(to right, var(--pharm-gold-soft), #fff)', borderBottom: '1px solid var(--pharm-gold-mid)' }}>
                <h2 className="pharm-section-title" style={{ color: 'var(--pharm-gold-dark)' }}>Stock Added</h2>
              </div>
              <div className="pharm-stats-grid" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #fffbeb 0%, var(--pharm-gold-soft) 100%)' }}>
                {[
                  { label: 'Today', val: stats.stockMovement.added.today },
                  { label: 'This Week', val: stats.stockMovement.added.week },
                  { label: 'This Month', val: stats.stockMovement.added.month },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--pharm-gray-400)', textTransform: 'uppercase' }}>{s.label}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--pharm-teal)' }}>+{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pharm-section" style={{ margin: 0, borderTop: '5px solid var(--pharm-red)', boxShadow: '0 8px 24px rgba(220, 38, 38, 0.12)' }}>
              <div className="pharm-section-header" style={{ background: 'linear-gradient(to right, var(--pharm-red-pale), #fff)', borderBottom: '1px solid #fecaca' }}>
                <h2 className="pharm-section-title" style={{ color: '#991b1b' }}>Units Dispensed</h2>
              </div>
              <div className="pharm-stats-grid" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #fff5f5 0%, var(--pharm-red-pale) 100%)' }}>
                {[
                  { label: 'Today', val: stats.stockMovement.issued.today },
                  { label: 'This Week', val: stats.stockMovement.issued.week },
                  { label: 'This Month', val: stats.stockMovement.issued.month },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--pharm-gray-400)', textTransform: 'uppercase' }}>{s.label}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--pharm-red)' }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Issuance Summary ── */}
        {issuanceSummary && issuanceSummary.today && (
          <div className="pharm-issuance-summary">
            <div className="pharm-issuance-card">
              <div className="label">TODAY</div>
              <div className="value">{issuanceSummary.today?.qty || 0}</div>
              <div className="sub">{issuanceSummary.today?.transactions || 0} dispensing transactions</div>
            </div>
            <div className="pharm-issuance-card week">
              <div className="label">THIS WEEK</div>
              <div className="value">{issuanceSummary.week?.qty || 0}</div>
              <div className="sub">{issuanceSummary.week?.transactions || 0} transactions</div>
            </div>
            <div className="pharm-issuance-card month">
              <div className="label">THIS MONTH</div>
              <div className="value">{issuanceSummary.month?.qty || 0}</div>
              <div className="sub">{issuanceSummary.month?.transactions || 0} transactions</div>
            </div>
            <div className="pharm-issuance-card year">
              <div className="label">THIS YEAR</div>
              <div className="value">{issuanceSummary.year?.qty || 0}</div>
              <div className="sub">{issuanceSummary.year?.transactions || 0} transactions</div>
            </div>
          </div>
        )}

        <div className="pharm-analytics-grid">
          {/* ── Critical Alerts ── */}
          <div className="pharm-section">
            <div className="pharm-section-header">
              <h2 className="pharm-section-title">
                Critical Alerts
                {criticalMeds.length > 0 && <span className="count-badge" style={{ background: 'var(--pharm-red)', color: '#fff' }}>{criticalMeds.length}</span>}
              </h2>
              <button className="pharm-btn pharm-btn-ghost pharm-btn-sm"
                onClick={() => navigate('/pharmacist-dashboard/stock')}>
                View All →
              </button>
            </div>
            {criticalMeds.length === 0 ? (
              <div className="pharm-empty">
                <div className="pharm-empty-text">All medicines are well-stocked and within expiry!</div>
              </div>
            ) : (
              <div className="pharm-table-container">
                <table className="pharm-table">
                  <thead>
                    <tr>
                      <th>Medicine</th>
                      <th>Stock</th>
                      <th>Expiry</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criticalMeds.map(med => {
                      const status = getMedStatus(med);
                      const days = getDaysToExpiry(med.expiryDate);
                      return (
                        <tr key={med._id} className={med.stockCount === 0 ? 'row-out-of-stock' : 'row-low-stock'}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{med.name}</div>
                            {med.brandName && <div style={{ fontSize: '0.72rem', color: 'var(--pharm-gray-400)' }}>{med.brandName}</div>}
                          </td>
                          <td>
                            <span className={`pharm-stock-num ${med.stockCount === 0 ? 'out' : 'low'}`}>
                              {med.stockCount}
                            </span>
                          </td>
                          <td className="mono" style={{ fontSize: '0.8rem', color: days <= 30 ? 'var(--pharm-red)' : 'inherit' }}>
                            {new Date(med.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}
                          </td>
                          <td>
                            <span className={`pharm-badge ${status.cls}`}>{status.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Top Used Medicines ── */}
          <div className="pharm-section">
            <div className="pharm-section-header">
              <h2 className="pharm-section-title">Most Dispensed</h2>
              <div className="pharm-period-selector">
                {['day', 'week', 'month'].map(p => (
                  <button key={p}
                    className={`pharm-period-btn ${usagePeriod === p ? 'active' : ''}`}
                    onClick={() => setUsagePeriod(p)}>
                    {p === 'day' ? 'Today' : p === 'week' ? 'Week' : 'Month'}
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
                        Stock: {item.currentStock} {item.unit || 'units'}
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
        </div>

        {/* ── Issuance Filter & Controls ── */}
        <div className="pharm-section" style={{ marginTop: '1.25rem' }}>
          <div className="pharm-section-header">
            <h2 className="pharm-section-title">Filter Issuance Records</h2>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="pharm-btn pharm-btn-ghost pharm-btn-sm" onClick={() => { setMedicineFilter(''); setDoctorFilter(''); setPatientFilter(''); setFromDate(''); setToDate(''); setQuickSearch(''); setIssuancePage(1); }}>
                Reset Filters
              </button>
              <button className="pharm-btn pharm-btn-teal pharm-btn-sm" onClick={() => loadIssuances(1)}>
                Apply Filters
              </button>
            </div>
          </div>
          <div className="pharm-filter-bar" style={{ gap: '0.6rem', padding: '1rem' }}>
            <select className="pharm-select" style={{ minWidth: 180, flex: '1 1 180px' }} value={medicineFilter} onChange={e => { setMedicineFilter(e.target.value); setIssuancePage(1); }}>
              <option value="">All Medicines</option>
              {allMedicines.map(m => (
                <option key={m._id} value={m._id}>{m.name}{m.brandName ? ` (${m.brandName})` : ''}</option>
              ))}
            </select>
            <select className="pharm-select" style={{ minWidth: 180, flex: '1 1 180px' }} value={doctorFilter} onChange={e => { setDoctorFilter(e.target.value); setIssuancePage(1); }}>
              <option value="">All Doctors</option>
              {allDoctors.map(d => (
                <option key={d._id} value={d._id}>{d.name}{d.specialization ? ` (${d.specialization})` : ''}</option>
              ))}
            </select>
            <input className="pharm-input" style={{ minWidth: 180, flex: '1 1 180px' }} placeholder="Patient name/ID" value={patientFilter} onChange={e => { setPatientFilter(e.target.value); setIssuancePage(1); }} />
            <input className="pharm-input" type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setIssuancePage(1); }} />
            <input className="pharm-input" type="date" value={toDate} onChange={e => { setToDate(e.target.value); setIssuancePage(1); }} />
            <input className="pharm-input" style={{ minWidth: 220, flex: '1 1 220px' }} placeholder="Quick search patient/med/doctor" value={quickSearch} onChange={e => setQuickSearch(e.target.value)} />
          </div>
          <div style={{ padding: '0.7rem 1rem', fontSize: '0.8rem', color: 'var(--pharm-gray-500)' }}>
            Showing {filteredIssuances.length} / {issuanceTotal} records (Page {issuancePage} of {issuancePages})
          </div>
        </div>

        {/* ── Recent Issuances ── */}
        <div className="pharm-section" style={{ marginTop: '1.5rem' }}>
          <div className="pharm-section-header">
            <h2 className="pharm-section-title">
              📋 Recent Issuances
              <span className="count-badge">{recentIssuances.length}</span>
            </h2>
            <button className="pharm-btn pharm-btn-ghost pharm-btn-sm"
              onClick={() => navigate('/pharmacist-dashboard/records')}>
              View All →
            </button>
          </div>
          <div className="pharm-table-container">
            {filteredIssuances.length === 0 ? (
              <div className="pharm-empty">
                <div className="pharm-empty-text">No issuances recorded yet</div>
              </div>
            ) : (
              <>
                <table className="pharm-table">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Medicine</th>
                      <th>Qty</th>
                      <th>Stock After</th>
                      <th>Doctor</th>
                      <th>Issued By</th>
                      <th>Date & Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIssuances.map(iss => (
                      <tr key={iss._id} className={isLow(iss)}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{iss.patient?.name || 'N/A'}</div>
                          <div style={{ fontSize: '0.73rem', color: 'var(--pharm-gray-400)' }}>{iss.patient?.email || ''}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{iss.medicine?.name || 'N/A'}</div>
                          {iss.medicine?.brandName && <div style={{ fontSize: '0.73rem', color: 'var(--pharm-gray-400)' }}>{iss.medicine.brandName}</div>}
                        </td>
                        <td>
                          <span className="pharm-badge pharm-badge-navy" style={{ fontFamily: 'var(--pharm-mono)' }}>
                            {iss.quantityIssued} {iss.medicine?.unit || 'units'}
                          </span>
                        </td>
                        <td className="mono" style={{ fontSize: '0.82rem', color: iss.stockAfter < 20 ? 'var(--pharm-amber)' : 'inherit' }}>
                          {iss.stockAfter ?? '—'}
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{iss.doctor?.name || 'N/A'}</td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--pharm-gray-500)' }}>{iss.issuedBy?.name || '—'}</td>
                        <td className="mono" style={{ fontSize: '0.78rem' }}>
                          <div>{new Date(iss.issuedDate).toLocaleDateString('en-IN')}</div>
                          <div style={{ color: 'var(--pharm-gray-400)', fontSize: '0.7rem' }}>
                            {new Date(iss.issuedDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.8rem', padding: '0 0.6rem' }}>
                  <div style={{ fontSize: '0.83rem', color: 'var(--pharm-gray-500)' }}>
                    Showing {filteredIssuances.length} on this page • {issuanceTotal} total
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button className="pharm-btn pharm-btn-sm pharm-btn-ghost" onClick={() => setIssuancePage(p => Math.max(1, p - 1))} disabled={issuancePage <= 1}>← Prev</button>
                    <button className="pharm-btn pharm-btn-sm pharm-btn-ghost" onClick={() => setIssuancePage(p => Math.min(issuancePages, p + 1))} disabled={issuancePage >= issuancePages}>Next →</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}