import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../../styles/pharmacist/PharmacistDashboard.css';
import { useApi } from '../../context/ApiContext';
import { IssueMedicineModal, AddStockModal } from './PharmacistDashboard';

export default function PharmacistIssuanceRecords() {
  const [issuanceSummary, setIssuanceSummary] = useState(null);
  const [issuances, setIssuances] = useState([]);
  const [issuancePage, setIssuancePage] = useState(1);
  const [issuancePages, setIssuancePages] = useState(1);
  const [issuanceTotal, setIssuanceTotal] = useState(0);
  const [issuanceLimit] = useState(20);

  const [allDoctors, setAllDoctors] = useState([]);
  const [allMedicines, setAllMedicines] = useState([]);
  const [allPatients, setAllPatients] = useState([]);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueForm, setIssueForm] = useState({
    patient: '', medicine: '', doctor: '', quantityIssued: '', source: 'INHOUSE', notes: ''
  });
  const [selectedMedStock, setSelectedMedStock] = useState(null);
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueError, setIssueError] = useState('');
  const [issueSuccess, setIssueSuccess] = useState('');
  const [exportingAll, setExportingAll] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientSearchResults, setPatientSearchResults] = useState([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [medicineFilter, setMedicineFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [patientFilter, setPatientFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [quickSearch, setQuickSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');
  const [listError, setListError] = useState('');
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);

  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };
  const apiBaseUrl = useApi();
  const API_BASE = `${apiBaseUrl}/api`;

  // ── Load reference data (doctors, medicines, patients) using allSettled so partial failures don't break page
  const loadAll = useCallback(async () => {
    setLoading(true);
    setSummaryError('');
    try {
      const [summaryRes, medsRes, doctorsRes, patientsRes] = await Promise.allSettled([
        axios.get(`${API_BASE}/issuances/stats/summary`, authHeader),
        axios.get(`${API_BASE}/medicines`, authHeader),
        axios.get(`${API_BASE}/doctors/list`, authHeader),
        axios.get(`${API_BASE}/users/patients`, authHeader),
      ]);

      if (summaryRes.status === 'fulfilled') setIssuanceSummary(summaryRes.value.data);
      else setSummaryError('Could not load issuance summary.');

      if (medsRes.status === 'fulfilled') setAllMedicines(medsRes.value.data.medicines || []);
      if (doctorsRes.status === 'fulfilled') setAllDoctors(doctorsRes.value.data || []);
      if (patientsRes.status === 'fulfilled') setAllPatients(patientsRes.value.data || []);

      await loadIssuances(1);
    } catch (e) {
      setSummaryError('Failed to load page data. Check your connection.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadIssuances = useCallback(async (pageToLoad = issuancePage) => {
    setListError('');
    try {
      const params = {
        limit: issuanceLimit,
        page: pageToLoad,
        ...(medicineFilter && { medicine: medicineFilter }),
        ...(doctorFilter && { doctor: doctorFilter }),
        ...(patientFilter && { patient: patientFilter }),
        ...(sourceFilter && { source: sourceFilter }),
        ...(fromDate && { from: fromDate }),
        ...(toDate && { to: toDate })
      };
      const res = await axios.get(`${API_BASE}/issuances`, { ...authHeader, params });
      setIssuances(res.data.issuances || []);
      setIssuanceTotal(res.data.total || 0);
      setIssuancePages(res.data.pages || 1);
      setIssuancePage(res.data.page || pageToLoad);
    } catch (err) {
      setListError('Failed to load issuance records.');
    }
  }, [medicineFilter, doctorFilter, sourceFilter, patientFilter, fromDate, toDate, issuanceLimit, issuancePage, API_BASE]);

  // ── Export current page as CSV
  const exportPageCSV = () => {
    if (!issuances.length) return;
    const headers = ['Patient', 'Email', 'Medicine', 'Brand', 'Qty', 'Source', 'Doctor', 'Issued By', 'Date', 'Stock Before', 'Stock After', 'Notes'];
    const rows = issuances.map(iss => [
      iss.patient?.name || 'N/A',
      iss.patient?.email || '',
      iss.medicine?.name || 'N/A',
      iss.medicine?.brandName || '',
      iss.quantityIssued,
      iss.source || 'INHOUSE',
      iss.doctor?.name || 'N/A',
      iss.issuedBy?.name || 'N/A',
      new Date(iss.issuedDate).toLocaleString('en-IN'),
      iss.stockBefore ?? '',
      iss.stockAfter ?? '',
      (iss.notes || '').replace(/"/g, '""')
    ].map(v => `"${v}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    downloadCSV(csv, `issuances_page${issuancePage}_${today()}.csv`);
  };

  // ── Export ALL filtered records
  const exportAllCSV = async () => {
    setExportingAll(true);
    try {
      const params = {
        ...(medicineFilter && { medicine: medicineFilter }),
        ...(doctorFilter && { doctor: doctorFilter }),
        ...(patientFilter && { patient: patientFilter }),
        ...(sourceFilter && { source: sourceFilter }),
        ...(fromDate && { from: fromDate }),
        ...(toDate && { to: toDate })
      };
      const res = await axios.get(`${API_BASE}/issuances/export`, { ...authHeader, params });
      const allRows = res.data.issuances || [];
      if (!allRows.length) { alert('No records to export.'); return; }
      const headers = ['Patient', 'Email', 'UHID', 'Medicine', 'Brand', 'Category', 'Qty', 'Source', 'Doctor', 'Issued By', 'Date', 'Stock Before', 'Stock After', 'Notes'];
      const rows = allRows.map(iss => [
        iss.patient?.name || 'N/A',
        iss.patient?.email || '',
        iss.patient?.uhid || '',
        iss.medicine?.name || 'N/A',
        iss.medicine?.brandName || '',
        iss.medicine?.category || '',
        iss.quantityIssued,
        iss.source || 'INHOUSE',
        iss.doctor?.name || 'N/A',
        iss.issuedBy?.name || 'N/A',
        new Date(iss.issuedDate).toLocaleString('en-IN'),
        iss.stockBefore ?? '',
        iss.stockAfter ?? '',
        (iss.notes || '').replace(/"/g, '""')
      ].map(v => `"${v}"`).join(','));
      const csv = [headers.join(','), ...rows].join('\n');
      downloadCSV(csv, `all_issuances_${today()}.csv`);
    } catch (err) {
      alert('Export failed. Please try again.');
    } finally {
      setExportingAll(false);
    }
  };

  const today = () => new Date().toISOString().split('T')[0];
  const downloadCSV = (csv, filename) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    setIssueError('');
    setIssueSuccess('');
    if (!issueForm.patient || !issueForm.medicine || !issueForm.doctor || !issueForm.quantityIssued) {
      setIssueError('Please fill patient, medicine, doctor, and quantity.');
      return;
    }
    setIssueLoading(true);
    try {
      await axios.post(`${API_BASE}/issuances`, {
        ...issueForm,
        quantityIssued: parseInt(issueForm.quantityIssued, 10)
      }, authHeader);
      setIssueSuccess(`Medicine issued successfully${issueForm.source === 'EXTERNAL' ? ' (logged only — no in-house stock deducted)' : ''}.`);
      setIssueForm({ patient: '', medicine: '', doctor: '', quantityIssued: '', source: 'INHOUSE', notes: '' });
      setSelectedMedStock(null);
      setSelectedPatient(null);
      setPatientSearch('');
      setPatientSearchResults([]);
      await loadAll();
      setShowIssueForm(false);
    } catch (err) {
      setIssueError(err.response?.data?.error || 'Failed to issue medicine.');
    } finally {
      setIssueLoading(false);
    }
  };

  // When medicine selection changes in the form, update the visible stock info
  const handleMedicineChange = (medId) => {
    const med = allMedicines.find(m => m._id === medId);
    setSelectedMedStock(med || null);
    setIssueForm(f => ({ ...f, medicine: medId }));
  };

  useEffect(() => { loadAll(); }, [loadAll]);

  const searchPatients = useCallback(async (term) => {
    if (!term || term.trim().length < 1) { setPatientSearchResults([]); return; }
    setPatientSearching(true);
    try {
      const res = await axios.get(`${API_BASE}/users/patients`, { ...authHeader, params: { search: term.trim(), limit: 20 } });
      setPatientSearchResults(res.data || []);
    } catch {
      setPatientSearchResults([]);
    } finally {
      setPatientSearching(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE]);

  // Debounced patient search
  useEffect(() => {
    const t = setTimeout(() => searchPatients(patientSearch), 300);
    return () => clearTimeout(t);
  }, [patientSearch, searchPatients]);

  // Reload issuances when any filter changes
  useEffect(() => {
    loadIssuances(issuancePage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicineFilter, doctorFilter, sourceFilter, patientFilter, fromDate, toDate, issuancePage]);

  const isLow = (iss) => {
    const stockAfter = Number(iss.stockAfter || 0);
    const reorder = Number(iss.medicine?.reorderLevel || 20);
    if (stockAfter === 0) return 'row-out-of-stock';
    if (stockAfter <= reorder) return 'row-low-stock';
    return '';
  };

  const lowerSearch = quickSearch.trim().toLowerCase();
  const filteredIssuances = issuances.filter(iss => {
    if (!lowerSearch) return true;
    return [iss.patient?.name, iss.patient?.email, iss.doctor?.name, iss.medicine?.name, iss.medicine?.brandName, iss.source, iss.notes]
      .filter(Boolean).join(' ').toLowerCase().includes(lowerSearch);
  });

  if (loading) return <div className="pharm-loading">Loading pharmacy records...</div>;

  return (
    <div className="pharm-layout">
      <div className="pharm-root">
        <IssueMedicineModal
          open={showIssueModal}
          onClose={() => setShowIssueModal(false)}
          onSuccess={loadAll}
          apiBase={API_BASE}
          authHeader={authHeader}
          allMedicines={allMedicines}
          allDoctors={allDoctors}
        />
        <AddStockModal
          open={showStockModal}
          onClose={() => setShowStockModal(false)}
          onSuccess={loadAll}
          apiBase={API_BASE}
          authHeader={authHeader}
          allMedicines={allMedicines}
        />

        {/* ── Header ── */}
        <div className="pharm-header">
          <div>
            <h1 className="pharm-title">Issuance Records</h1>
            <p className="pharm-subtitle">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="pharm-header-actions">
            <button className="pharm-btn pharm-btn-ghost" onClick={exportPageCSV} disabled={!issuances.length}>Export Page</button>
            <button className="pharm-btn pharm-btn-ghost" onClick={exportAllCSV} disabled={exportingAll}>{exportingAll ? 'Exporting...' : 'Export All'}</button>
            <button className="pharm-btn pharm-btn-ghost" onClick={loadAll}>Refresh</button>
            <button className="pharm-btn pharm-btn-ghost" onClick={() => setShowStockModal(true)}>+ Add Stock</button>
            <button className="pharm-btn pharm-btn-teal" onClick={() => setShowIssueModal(true)}>+ Issue Medicine</button>
          </div>
        </div>

        {summaryError && <div className="pharm-alert pharm-alert-danger">{summaryError}</div>}

        {/* ── Issue Medicine Form ── */}
        {showIssueForm && (
          <div className="pharm-section" style={{ marginTop: '1rem' }}>
            <div className="pharm-section-header" style={{ marginBottom: '1rem' }}>
              <h2 className="pharm-section-title">Issue Medicine</h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--pharm-gray-500)' }}>
                Select INHOUSE to deduct from college stock · EXTERNAL = dispensed from external pharmacy (no stock change)
              </div>
            </div>
            {issueError && <div className="pharm-alert pharm-alert-danger" style={{ marginBottom: '1rem' }}>{issueError}</div>}
            {issueSuccess && <div className="pharm-alert pharm-alert-success" style={{ marginBottom: '1rem' }}>{issueSuccess}</div>}
            <form onSubmit={handleIssueSubmit} style={{ display: 'grid', gap: '0.9rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--pharm-gray-500)', display: 'block', marginBottom: '4px' }}>Patient *</label>
                {selectedPatient ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.875rem', border: '1.5px solid var(--pharm-gray-200)', borderRadius: 8, background: 'var(--pharm-gray-50)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{selectedPatient.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--pharm-gray-400)' }}>
                        {selectedPatient.email}{selectedPatient.roll ? ` · Roll: ${selectedPatient.roll}` : ''}{selectedPatient.uhid ? ` · UHID: ${selectedPatient.uhid}` : ''}
                      </div>
                    </div>
                    <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pharm-red)', fontWeight: 600, fontSize: '0.8rem' }}
                      onClick={() => { setSelectedPatient(null); setIssueForm(f => ({ ...f, patient: '' })); setPatientSearch(''); }}>
                      Change
                    </button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <input
                      className="pharm-input"
                      placeholder="Type name, roll no, email or UHID..."
                      value={patientSearch}
                      onChange={e => setPatientSearch(e.target.value)}
                      autoComplete="off"
                    />
                    {patientSearching && <div style={{ fontSize: '0.75rem', color: 'var(--pharm-gray-400)', padding: '4px 0' }}>Searching...</div>}
                    {patientSearchResults.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                        background: '#fff', border: '1.5px solid var(--pharm-gray-200)',
                        borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                        maxHeight: 220, overflowY: 'auto'
                      }}>
                        {patientSearchResults.map(p => (
                          <div key={p._id}
                            style={{ padding: '0.6rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--pharm-gray-100)' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8f4ff'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                            onClick={() => {
                              setSelectedPatient(p);
                              setIssueForm(f => ({ ...f, patient: p._id }));
                              setPatientSearch('');
                              setPatientSearchResults([]);
                            }}>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.name || 'Unnamed'}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--pharm-gray-400)' }}>
                              {p.email}{p.roll ? ` · ${p.roll}` : ''}{p.uhid ? ` · UHID: ${p.uhid}` : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {patientSearch.length > 1 && !patientSearching && patientSearchResults.length === 0 && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--pharm-amber)', padding: '4px 0' }}>No patients found. Try a different search term.</div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--pharm-gray-500)', display: 'block', marginBottom: '4px' }}>Medicine *</label>
                <select className="pharm-select" value={issueForm.medicine} onChange={e => handleMedicineChange(e.target.value)}>
                  <option value="">Select medicine</option>
                  {allMedicines.map(m => (
                    <option key={m._id} value={m._id}>
                      {m.name}{m.brandName ? ` (${m.brandName})` : ''} — Stock: {m.stockCount}
                    </option>
                  ))}
                </select>
                {selectedMedStock && (
                  <div style={{ marginTop: '4px', fontSize: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className={`pharm-badge ${selectedMedStock.stockCount === 0 ? 'pharm-badge-red' : selectedMedStock.stockCount < (selectedMedStock.reorderLevel || 20) ? 'pharm-badge-amber' : 'pharm-badge-green'}`}>
                      Stock: {selectedMedStock.stockCount} {selectedMedStock.unit || 'units'}
                    </span>
                    {selectedMedStock.expiryDate && (
                      <span className={`pharm-badge ${new Date(selectedMedStock.expiryDate) <= new Date() ? 'pharm-badge-red' : 'pharm-badge-navy'}`}>
                        Exp: {new Date(selectedMedStock.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--pharm-gray-500)', display: 'block', marginBottom: '4px' }}>Doctor *</label>
                <select className="pharm-select" value={issueForm.doctor} onChange={e => setIssueForm({ ...issueForm, doctor: e.target.value })}>
                  <option value="">Select doctor</option>
                  {allDoctors.map(d => (
                    <option key={d._id} value={d._id}>{d.name}{d.specialization ? ` (${d.specialization})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--pharm-gray-500)', display: 'block', marginBottom: '4px' }}>Source *</label>
                <select className="pharm-select" value={issueForm.source} onChange={e => setIssueForm({ ...issueForm, source: e.target.value })}>
                  <option value="INHOUSE">INHOUSE - deducts from college stock</option>
                  <option value="EXTERNAL">EXTERNAL - external pharmacy (no stock change)</option>
                </select>
                {issueForm.source === 'EXTERNAL' && (
                  <div style={{ marginTop: '4px', fontSize: '0.73rem', color: 'var(--pharm-amber)', background: '#fffbeb', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--pharm-gold-mid)' }}>
                    Note: External source — issuance will be logged but in-house stock will NOT be reduced.
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--pharm-gray-500)', display: 'block', marginBottom: '4px' }}>Quantity *</label>
                <input className="pharm-input" type="number" min="1"
                  placeholder={issueForm.source === 'INHOUSE' && selectedMedStock ? `Max: ${selectedMedStock.stockCount}` : 'Quantity'}
                  value={issueForm.quantityIssued}
                  onChange={e => setIssueForm({ ...issueForm, quantityIssued: e.target.value })} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--pharm-gray-500)', display: 'block', marginBottom: '4px' }}>Notes (optional)</label>
                <textarea className="pharm-input" placeholder="Notes..." rows="2" value={issueForm.notes}
                  onChange={e => setIssueForm({ ...issueForm, notes: e.target.value })} style={{ minHeight: 60 }} />
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem' }}>
                <button className="pharm-btn pharm-btn-teal" type="submit" disabled={issueLoading}>
                  {issueLoading ? 'Issuing...' : 'Submit Issuance'}
                </button>
                <button className="pharm-btn pharm-btn-ghost" type="button" onClick={() => setShowIssueForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* ── Issuance Summary Cards ── */}
        {issuanceSummary?.today && (
          <div className="pharm-issuance-summary">
            <div className="pharm-issuance-card">
              <div className="label">TODAY</div>
              <div className="value">{issuanceSummary.today?.qty || 0}</div>
              <div className="sub">{issuanceSummary.today?.transactions || 0} transactions</div>
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

        {/* ── Filters ── */}
        <div className="pharm-section" style={{ marginTop: '1.25rem' }}>
          <div className="pharm-section-header">
            <h2 className="pharm-section-title">Filter Records</h2>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button className="pharm-btn pharm-btn-ghost pharm-btn-sm" onClick={() => {
                setMedicineFilter(''); setDoctorFilter(''); setPatientFilter('');
                setSourceFilter(''); setFromDate(''); setToDate(''); setQuickSearch(''); setIssuancePage(1);
              }}>Reset Filters</button>
              <button className="pharm-btn pharm-btn-teal pharm-btn-sm" onClick={() => loadIssuances(1)}>Apply</button>
            </div>
          </div>
          <div className="pharm-filter-bar" style={{ gap: '0.6rem', padding: '1rem', flexWrap: 'wrap' }}>
            <select className="pharm-select" style={{ minWidth: 180, flex: '1 1 180px' }} value={medicineFilter}
              onChange={e => { setMedicineFilter(e.target.value); setIssuancePage(1); }}>
              <option value="">All Medicines</option>
              {allMedicines.map(m => <option key={m._id} value={m._id}>{m.name}{m.brandName ? ` (${m.brandName})` : ''}</option>)}
            </select>
            <select className="pharm-select" style={{ minWidth: 180, flex: '1 1 180px' }} value={doctorFilter}
              onChange={e => { setDoctorFilter(e.target.value); setIssuancePage(1); }}>
              <option value="">All Doctors</option>
              {allDoctors.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
            <select className="pharm-select" style={{ minWidth: 150, flex: '1 1 150px' }} value={sourceFilter}
              onChange={e => { setSourceFilter(e.target.value); setIssuancePage(1); }}>
              <option value="">All Sources</option>
              <option value="INHOUSE">INHOUSE</option>
              <option value="EXTERNAL">EXTERNAL</option>
            </select>
            <input className="pharm-input" style={{ minWidth: 180, flex: '1 1 180px' }} placeholder="Patient name / UHID"
              value={patientFilter} onChange={e => { setPatientFilter(e.target.value); setIssuancePage(1); }} />
            <input className="pharm-input" type="date" style={{ flex: '0 0 auto' }} value={fromDate}
              onChange={e => { setFromDate(e.target.value); setIssuancePage(1); }} />
            <span style={{ alignSelf: 'center', color: 'var(--pharm-gray-400)', fontSize: '0.8rem' }}>to</span>
            <input className="pharm-input" type="date" style={{ flex: '0 0 auto' }} value={toDate}
              onChange={e => { setToDate(e.target.value); setIssuancePage(1); }} />
            <input className="pharm-input" style={{ minWidth: 200, flex: '1 1 200px' }} placeholder="Quick search…"
              value={quickSearch} onChange={e => setQuickSearch(e.target.value)} />
          </div>
          <div style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', color: 'var(--pharm-gray-500)' }}>
            Showing {filteredIssuances.length} / {issuanceTotal} records &nbsp;·&nbsp; Page {issuancePage} of {issuancePages}
          </div>
        </div>

        {/* ── Records Table ── */}
        <div className="pharm-section" style={{ marginTop: '1.5rem' }}>
          <div className="pharm-section-header">
            <h2 className="pharm-section-title">
              Issuance Records
              <span className="count-badge">{issuanceTotal}</span>
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="pharm-btn pharm-btn-ghost pharm-btn-sm" onClick={exportPageCSV} disabled={!filteredIssuances.length}>
                Export Page CSV
              </button>
              <button className="pharm-btn pharm-btn-teal pharm-btn-sm" onClick={exportAllCSV} disabled={exportingAll}>
                {exportingAll ? 'Exporting…' : 'Export All CSV'}
              </button>
            </div>
          </div>

          {listError && <div className="pharm-alert pharm-alert-danger" style={{ margin: '0.75rem 1rem' }}>{listError}</div>}

          <div className="pharm-table-container">
            {filteredIssuances.length === 0 ? (
              <div className="pharm-empty">
                <div className="pharm-empty-text">No issuance records found</div>
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table className="pharm-table">
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Medicine</th>
                        <th>Qty</th>
                        <th>Source</th>
                        <th>Stock After</th>
                        <th>Doctor</th>
                        <th>Issued By</th>
                        <th>Date &amp; Time</th>
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
                          <td>
                            <span className={`pharm-badge ${iss.source === 'EXTERNAL' ? 'pharm-badge-amber' : 'pharm-badge-green'}`}>
                              {iss.source === 'EXTERNAL' ? 'EXTERNAL' : 'INHOUSE'}
                            </span>
                          </td>
                          <td className="mono" style={{ fontSize: '0.82rem', color: (iss.stockAfter ?? 999) < 20 ? 'var(--pharm-amber)' : 'inherit' }}>
                            {iss.source === 'EXTERNAL' ? <span style={{ color: 'var(--pharm-gray-400)' }}>—</span> : (iss.stockAfter ?? '—')}
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
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderTop: '1px solid var(--pharm-gray-100)' }}>
                  <div style={{ fontSize: '0.83rem', color: 'var(--pharm-gray-500)' }}>
                    Page {issuancePage} of {issuancePages} &nbsp;·&nbsp; {issuanceTotal} total records
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button className="pharm-btn pharm-btn-sm pharm-btn-ghost"
                      onClick={() => setIssuancePage(p => Math.max(1, p - 1))} disabled={issuancePage <= 1}>← Prev</button>
                    {Array.from({ length: Math.min(5, issuancePages) }, (_, i) => {
                      const pg = Math.max(1, Math.min(issuancePage - 2, issuancePages - 4)) + i;
                      return pg <= issuancePages ? (
                        <button key={pg} className={`pharm-btn pharm-btn-sm ${issuancePage === pg ? 'pharm-btn-teal' : 'pharm-btn-ghost'}`}
                          onClick={() => setIssuancePage(pg)}>{pg}</button>
                      ) : null;
                    })}
                    <button className="pharm-btn pharm-btn-sm pharm-btn-ghost"
                      onClick={() => setIssuancePage(p => Math.min(issuancePages, p + 1))} disabled={issuancePage >= issuancePages}>Next →</button>
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