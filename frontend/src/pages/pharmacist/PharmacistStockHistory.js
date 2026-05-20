import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import '../../styles/pharmacist/PharmacistDashboard.css';
import { useApi } from '../../context/ApiContext';


const TX_TYPES = [
  { value: '',                label: 'All Types' },
  { value: 'ADDITION',       label: 'Stock Addition' },
  { value: 'OPENING_BALANCE',label: 'Opening Balance' },
  { value: 'ISSUANCE',       label: 'Issuance (Dispensed)' },
  { value: 'ADJUSTMENT',     label: 'Adjustment' },
  { value: 'EXPIRY_REMOVAL', label: 'Expiry / Removal' },
  { value: 'RETURN',         label: 'Return' },
];

const txIcon = (type) => null; // Icons removed for clinical theme

const txColor = (type) => {
  if (['ADDITION', 'OPENING_BALANCE', 'RETURN'].includes(type)) return 'var(--pharm-green)';
  if (['EXPIRY_REMOVAL', 'ISSUANCE'].includes(type)) return 'var(--pharm-red)';
  return 'var(--pharm-amber)';
};

function exportCSV(transactions, medicineName) {
  const headers = ['Date', 'Time', 'Type', 'Change', 'Stock Before', 'Stock After', 'Batch #', 'Expiry Date', 'Supplier', 'Invoice #', 'Performed By', 'Notes'];
  const rows = transactions.map(tx => [
    new Date(tx.createdAt).toLocaleDateString('en-IN'),
    new Date(tx.createdAt).toLocaleTimeString('en-IN'),
    tx.transactionType,
    tx.quantityChanged >= 0 ? `+${tx.quantityChanged}` : tx.quantityChanged,
    tx.stockBefore,
    tx.stockAfter,
    tx.batchNumber || '',
    tx.newExpiryDate ? new Date(tx.newExpiryDate).toLocaleDateString('en-IN') : '',
    tx.supplier || '',
    tx.invoiceNumber || '',
    tx.performedBy?.name || '',
    tx.notes || ''
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stock_history_${medicineName}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PharmacistStockHistory() {
  const [transactions, setTransactions] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedMed, setSelectedMed] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [txType, setTxType] = useState('');
  const [quickFilter, setQuickFilter] = useState('month');
  const [medSearch, setMedSearch] = useState('');
  const apiBaseUrl = useApi();
const API_BASE = `${apiBaseUrl}/api`;
  const token = localStorage.getItem('token');
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const getDateRange = (filter) => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    if (filter === 'today')  return { from: today, to: today };
    if (filter === 'week')   return { from: new Date(now - 7 * 86400000).toISOString().split('T')[0], to: today };
    if (filter === 'month')  return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], to: today };
    if (filter === 'year')   return { from: new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0], to: today };
    if (filter === 'custom') return { from: fromDate, to: toDate };
    return {};
  };

  useEffect(() => {
    axios.get(`${API_BASE}/medicines`, authHeader)
      .then(r => setMedicines(r.data.medicines || []))
      .catch(() => {});
  }, []);

  const loadTransactions = useCallback(async () => {
    if (!selectedMed) { setTransactions([]); return; }
    setLoading(true);
    setError('');
    try {
      const dateRange = getDateRange(quickFilter);
      const params = {
        ...(dateRange.from && { from: dateRange.from }),
        ...(dateRange.to   && { to:   dateRange.to   }),
        ...(txType         && { type: txType          }),
        limit: 200,
      };
      const res = await axios.get(`${API_BASE}/medicines/${selectedMed}/transactions`, { ...authHeader, params });
      setTransactions(res.data.transactions || []);
    } catch (e) {
      setError('Failed to load stock history');
    } finally {
      setLoading(false);
    }
  }, [selectedMed, quickFilter, fromDate, toDate, txType]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const selectedMedObj = medicines.find(m => m._id === selectedMed);
  const totalAdded   = transactions.filter(t => t.quantityChanged > 0).reduce((s, t) => s + t.quantityChanged, 0);
  const totalRemoved = transactions.filter(t => t.quantityChanged < 0).reduce((s, t) => s + Math.abs(t.quantityChanged), 0);

  // Medicine dropdown filtered by search
  const filteredMeds = medSearch
    ? medicines.filter(m =>
        m.name.toLowerCase().includes(medSearch.toLowerCase()) ||
        (m.brandName || '').toLowerCase().includes(medSearch.toLowerCase())
      )
    : medicines;

  return (
    <div className="pharm-layout">
      <div className="pharm-root">
        <div className="pharm-header">
          <div>
            <h1 className="pharm-title">Stock History</h1>
            <p className="pharm-subtitle">Complete audit trail — every stock change recorded with full traceability</p>
          </div>
          <div className="pharm-header-actions">
            {transactions.length > 0 && selectedMedObj && (
              <button className="pharm-btn pharm-btn-ghost" onClick={() => exportCSV(transactions, selectedMedObj.name)}>
                Export CSV
              </button>
            )}
            <button className="pharm-btn pharm-btn-ghost" onClick={loadTransactions}>Refresh</button>
          </div>
        </div>

        {error && <div className="pharm-alert pharm-alert-danger">{error}</div>}

        {/* ── Medicine Selector ── */}
        <div className="pharm-section">
          <div className="pharm-section-header">
            <h2 className="pharm-section-title">Select Medicine</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0 1.5rem 1rem' }}>

            {/* Medicine search + select */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input className="pharm-input" placeholder="Type to search medicines..."
                style={{ minWidth: 220, maxWidth: 320 }}
                value={medSearch} onChange={e => setMedSearch(e.target.value)} />
              <select className="pharm-select" style={{ flex: '1 1 320px' }}
                value={selectedMed} onChange={e => setSelectedMed(e.target.value)}>
                <option value="">— Select a medicine —</option>
                {filteredMeds.map(m => (
                  <option key={m._id} value={m._id}>
                    {m.name}{m.brandName ? ` (${m.brandName})` : ''} — Stock: {m.stockCount} {m.unit || 'units'}
                  </option>
                ))}
              </select>
              <select className="pharm-select" value={txType} onChange={e => setTxType(e.target.value)} style={{ flex: '0 1 200px' }}>
                {TX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {/* Period filters */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="pharm-filter-label">Period:</span>
              <div className="pharm-filter-chips">
                {[
                  { key: 'today',  label: 'Today' },
                  { key: 'week',   label: 'This Week' },
                  { key: 'month',  label: 'This Month' },
                  { key: 'year',   label: 'This Year' },
                  { key: 'custom', label: 'Custom' },
                ].map(f => (
                  <button key={f.key}
                    className={`pharm-chip ${quickFilter === f.key ? 'active' : ''}`}
                    onClick={() => setQuickFilter(f.key)}>
                    {f.label}
                  </button>
                ))}
              </div>
              {quickFilter === 'custom' && (
                <>
                  <input className="pharm-input" type="date" style={{ width: 'auto' }}
                    value={fromDate} onChange={e => setFromDate(e.target.value)} />
                  <span style={{ color: 'var(--pharm-gray-400)' }}>to</span>
                  <input className="pharm-input" type="date" style={{ width: 'auto' }}
                    value={toDate} onChange={e => setToDate(e.target.value)} />
                  <button className="pharm-btn pharm-btn-teal pharm-btn-sm" onClick={loadTransactions}>Apply</button>
                </>
              )}
            </div>
          </div>
        </div>

        {!selectedMed ? (
          <div className="pharm-empty" style={{ padding: '4rem' }}>
            <div className="pharm-empty-text">Select a medicine above to view its complete stock history</div>
          </div>
        ) : (
          <>
            {/* ── Medicine Overview ── */}
            {selectedMedObj && (
              <div className="pharm-stats-grid" style={{ marginBottom: '1rem' }}>
                <div className="pharm-stat-card">
                  <div className="pharm-stat-label">Current Stock</div>
                  <div className="pharm-stat-value">{selectedMedObj.stockCount}</div>
                  <div className="pharm-stat-meta">{selectedMedObj.unit || 'units'}</div>
                </div>
                <div className="pharm-stat-card">
                  <div className="pharm-stat-label">Expiry Date</div>
                  <div className="pharm-stat-value" style={{ fontSize: '1rem' }}>
                    {selectedMedObj.expiryDate
                      ? new Date(selectedMedObj.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                      : '—'}
                  </div>
                </div>
                <div className="pharm-stat-card">
                  <div className="pharm-stat-label">Added (period)</div>
                  <div className="pharm-stat-value" style={{ color: 'var(--pharm-green)' }}>+{totalAdded}</div>
                </div>
                <div className="pharm-stat-card">
                  <div className="pharm-stat-label">Removed (period)</div>
                  <div className="pharm-stat-value" style={{ color: 'var(--pharm-red)' }}>−{totalRemoved}</div>
                </div>
                <div className="pharm-stat-card">
                  <div className="pharm-stat-label">Transactions</div>
                  <div className="pharm-stat-value">{transactions.length}</div>
                  <div className="pharm-stat-meta">Net: {totalAdded - totalRemoved >= 0 ? '+' : ''}{totalAdded - totalRemoved}</div>
                </div>
              </div>
            )}

            {/* ── Transaction Timeline ── */}
            <div className="pharm-section">
              <div className="pharm-section-header">
                <h2 className="pharm-section-title">
                  📋 Transaction History
                  <span className="count-badge">{transactions.length}</span>
                </h2>
              </div>
              <div className="pharm-table-container">
                {loading ? (
                  <div className="pharm-loading" style={{ minHeight: '150px' }}>Loading history...</div>
                ) : transactions.length === 0 ? (
                  <div className="pharm-empty">
                    <div className="pharm-empty-text">No transactions in this period</div>
                  </div>
                ) : (
                  <table className="pharm-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Type</th>
                        <th>Change</th>
                        <th>Before → After</th>
                        <th>Batch #</th>
                        <th>Expiry</th>
                        <th>Supplier</th>
                        <th>Invoice #</th>
                        <th>Performed By</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(tx => (
                        <tr key={tx._id}>
                          <td className="mono" style={{ fontSize: '0.78rem' }}>
                            <div>{new Date(tx.createdAt).toLocaleDateString('en-IN')}</div>
                            <div style={{ color: 'var(--pharm-gray-400)', fontSize: '0.7rem' }}>
                              {new Date(tx.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                              {txIcon(tx.transactionType)}
                              <span style={{ color: txColor(tx.transactionType), fontWeight: 600 }}>
                                {tx.transactionType.replace(/_/g, ' ')}
                              </span>
                            </span>
                          </td>
                          <td>
                            <span className="mono" style={{
                              fontWeight: 700,
                              color: tx.quantityChanged >= 0 ? 'var(--pharm-green)' : 'var(--pharm-red)',
                              fontSize: '1rem'
                            }}>
                              {tx.quantityChanged >= 0 ? '+' : ''}{tx.quantityChanged}
                            </span>
                          </td>
                          <td className="mono" style={{ fontSize: '0.82rem' }}>
                            {tx.stockBefore}
                            <span style={{ color: 'var(--pharm-gray-400)' }}> → </span>
                            <strong>{tx.stockAfter}</strong>
                          </td>
                          <td style={{ fontSize: '0.78rem' }}>{tx.batchNumber || '—'}</td>
                          <td className="mono" style={{ fontSize: '0.78rem' }}>
                            {tx.newExpiryDate
                              ? new Date(tx.newExpiryDate).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
                              : '—'}
                          </td>
                          <td style={{ fontSize: '0.78rem' }}>{tx.supplier || '—'}</td>
                          <td style={{ fontSize: '0.78rem' }}>{tx.invoiceNumber || '—'}</td>
                          <td style={{ fontSize: '0.8rem' }}>{tx.performedBy?.name || '—'}</td>
                          <td style={{ fontSize: '0.76rem', color: 'var(--pharm-gray-400)', maxWidth: 160 }}>
                            {tx.notes || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}