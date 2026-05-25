import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../../styles/pharmacist/PharmacistDashboard.css';
import { useApi } from '../../context/ApiContext';

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

// ── Reusable Patient Search Input ──────────────────────────────────────────
export function PatientSearchInput({ apiBase, authHeader, value, onSelect, onClear }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const url = `${apiBase}/users/patients`;
      console.log('[PatientSearch] Searching for:', query.trim());
      console.log('[PatientSearch] API URL:', url);
      console.log('[PatientSearch] Auth header present:', !!authHeader?.headers?.Authorization);
      try {
        const res = await axios.get(url, {
          ...authHeader, params: { search: query.trim(), limit: 15 }
        });
        console.log('[PatientSearch] Response status:', res.status);
        console.log('[PatientSearch] Results count:', res.data?.length);
        console.log('[PatientSearch] Results:', res.data);
        setResults(res.data || []);
        setOpen(true);
      } catch (err) {
        console.error('[PatientSearch] ERROR:', err.message);
        console.error('[PatientSearch] Response data:', err.response?.data);
        console.error('[PatientSearch] Status code:', err.response?.status);
        console.error('[PatientSearch] Full error:', err);
        setResults([]);
      }
      finally { setSearching(false); }
    }, 280);
    return () => clearTimeout(t);
  }, [query, apiBase, authHeader]);

  if (value) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 0.875rem', border: '1.5px solid var(--pharm-plum-light)', borderRadius: 8, background: 'var(--pharm-plum-soft)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--pharm-plum)' }}>{value.name || 'Unknown'}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--pharm-gray-500)' }}>
            {value.email}{value.roll ? ` · Roll: ${value.roll}` : ''}{value.uhid ? ` · UHID: ${value.uhid}` : ''}
          </div>
        </div>
        <button type="button" onClick={onClear}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pharm-red)', fontWeight: 700, fontSize: '0.78rem', padding: '2px 6px', borderRadius: 4 }}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          className="pharm-input"
          placeholder="Type name, roll no, email or UHID..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoComplete="off"
          style={{ paddingRight: '2rem' }}
        />
        {searching && (
          <span style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: 'var(--pharm-gray-400)' }}>
            ...
          </span>
        )}
        {query && !searching && (
          <button type="button"
            onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
            style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pharm-gray-400)', fontSize: '0.9rem', lineHeight: 1 }}>
            ×
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 999,
          background: '#fff', border: '1.5px solid var(--pharm-border)',
          borderRadius: 10, boxShadow: '0 8px 32px rgba(74,16,96,0.15)',
          maxHeight: 240, overflowY: 'auto'
        }}>
          {results.map((p, i) => (
            <div key={p._id}
              style={{ padding: '0.65rem 1rem', cursor: 'pointer', borderBottom: i < results.length - 1 ? '1px solid var(--pharm-gray-100)' : 'none', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--pharm-plum-soft)'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              onMouseDown={() => { onSelect(p); setQuery(''); setResults([]); setOpen(false); }}>
              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--pharm-plum)' }}>{p.name || 'Unnamed'}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--pharm-gray-500)', marginTop: 2 }}>
                {p.email}
                {p.roll ? <span style={{ marginLeft: 8 }}>Roll: {p.roll}</span> : null}
                {p.uhid ? <span style={{ marginLeft: 8 }}>UHID: {p.uhid}</span> : null}
                {p.phone ? <span style={{ marginLeft: 8 }}>Ph: {p.phone}</span> : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && !searching && results.length === 0 && query.length > 1 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 999, background: '#fff', border: '1.5px solid var(--pharm-border)', borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--pharm-gray-500)' }}>
          No patients found for "{query}"
        </div>
      )}
    </div>
  );
}

// ── Add Stock Modal ────────────────────────────────────────────────────────
export function AddStockModal({ open, onClose, onSuccess, apiBase, authHeader, allMedicines }) {
  const [medSearch, setMedSearch] = useState('');
  const [selectedMed, setSelectedMed] = useState(null);
  const [showMedDrop, setShowMedDrop] = useState(false);
  const [form, setForm] = useState({ addStock: '', expiryDate: '', batchNumber: '', supplier: '', invoiceNumber: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const medRef = useRef(null);

  const filteredMeds = medSearch.trim()
    ? allMedicines.filter(m =>
        m.name.toLowerCase().includes(medSearch.toLowerCase()) ||
        (m.brandName || '').toLowerCase().includes(medSearch.toLowerCase())
      ).slice(0, 15)
    : allMedicines.slice(0, 15);

  useEffect(() => {
    const h = (e) => { if (medRef.current && !medRef.current.contains(e.target)) setShowMedDrop(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const reset = () => {
    setMedSearch(''); setSelectedMed(null); setShowMedDrop(false);
    setForm({ addStock: '', expiryDate: '', batchNumber: '', supplier: '', invoiceNumber: '', notes: '' });
    setError(''); setSuccess('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!selectedMed) { setError('Please select a medicine.'); return; }
    if (!form.addStock || parseInt(form.addStock) < 1) { setError('Enter a valid quantity to add.'); return; }
    if (!form.expiryDate) { setError('Expiry date is required.'); return; }
    setLoading(true);
    try {
      await axios.put(`${apiBase}/medicines/${selectedMed._id}`, {
        addStock: parseInt(form.addStock),
        expiryDate: form.expiryDate,
        batchNumber: form.batchNumber,
        supplier: form.supplier,
        invoiceNumber: form.invoiceNumber,
        notes: form.notes,
        receivedDate: new Date().toISOString().split('T')[0]
      }, authHeader);
      setSuccess(`Added ${form.addStock} ${selectedMed.unit || 'units'} of "${selectedMed.name}" to stock.`);
      setTimeout(() => { reset(); onClose(); onSuccess(); }, 1400);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update stock.');
    } finally { setLoading(false); }
  };

  if (!open) return null;

  return (
    <div className="pharm-modal-overlay" onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="pharm-modal" style={{ maxWidth: 540 }}>
        <div className="pharm-modal-header">
          <h2 className="pharm-modal-title">Add Stock</h2>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--pharm-gray-500)', lineHeight: 1 }}>×</button>
        </div>
        <div className="pharm-modal-body">
          {error && <div className="pharm-alert pharm-alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}
          {success && <div className="pharm-alert pharm-alert-success" style={{ marginBottom: '1rem' }}>{success}</div>}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Medicine search */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--pharm-gray-600)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Medicine <span style={{ color: 'var(--pharm-red)' }}>*</span></label>
              {selectedMed ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 0.875rem', border: '1.5px solid var(--pharm-plum-light)', borderRadius: 8, background: 'var(--pharm-plum-soft)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--pharm-plum)' }}>{selectedMed.name}{selectedMed.brandName ? ` (${selectedMed.brandName})` : ''}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--pharm-gray-500)' }}>Current stock: {selectedMed.stockCount} {selectedMed.unit || 'units'}</div>
                  </div>
                  <button type="button" onClick={() => { setSelectedMed(null); setMedSearch(''); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pharm-red)', fontWeight: 700, fontSize: '0.78rem', padding: '2px 6px', borderRadius: 4 }}>Change</button>
                </div>
              ) : (
                <div ref={medRef} style={{ position: 'relative' }}>
                  <input className="pharm-input" placeholder="Type medicine name..." value={medSearch}
                    onChange={e => { setMedSearch(e.target.value); setShowMedDrop(true); }}
                    onFocus={() => setShowMedDrop(true)} autoComplete="off" />
                  {showMedDrop && filteredMeds.length > 0 && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 999, background: '#fff', border: '1.5px solid var(--pharm-border)', borderRadius: 10, boxShadow: '0 8px 32px rgba(74,16,96,0.15)', maxHeight: 200, overflowY: 'auto' }}>
                      {filteredMeds.map((m, i) => (
                        <div key={m._id}
                          style={{ padding: '0.6rem 1rem', cursor: 'pointer', borderBottom: i < filteredMeds.length - 1 ? '1px solid var(--pharm-gray-100)' : 'none' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--pharm-plum-soft)'}
                          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                          onMouseDown={() => { setSelectedMed(m); setMedSearch(''); setShowMedDrop(false); setForm(f => ({ ...f, expiryDate: m.expiryDate ? new Date(m.expiryDate).toISOString().split('T')[0] : '' })); }}>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--pharm-plum)' }}>{m.name}{m.brandName ? ` (${m.brandName})` : ''}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--pharm-gray-500)' }}>Stock: {m.stockCount} {m.unit || 'units'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--pharm-gray-600)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Qty to Add <span style={{ color: 'var(--pharm-red)' }}>*</span></label>
                <input className="pharm-input" type="number" min="1" placeholder="e.g. 100"
                  value={form.addStock} onChange={e => setForm(f => ({ ...f, addStock: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--pharm-gray-600)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Expiry Date <span style={{ color: 'var(--pharm-red)' }}>*</span></label>
                <input className="pharm-input" type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--pharm-gray-600)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Batch Number</label>
                <input className="pharm-input" placeholder="Batch #" value={form.batchNumber} onChange={e => setForm(f => ({ ...f, batchNumber: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--pharm-gray-600)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Supplier</label>
                <input className="pharm-input" placeholder="Supplier name" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--pharm-gray-600)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Invoice Number</label>
              <input className="pharm-input" placeholder="Invoice #" value={form.invoiceNumber} onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} />
            </div>
          </form>
        </div>
        <div className="pharm-modal-footer">
          <button className="pharm-btn pharm-btn-ghost" onClick={handleClose} disabled={loading}>Cancel</button>
          <button className="pharm-btn pharm-btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Adding...' : 'Add Stock'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Issue Medicine Modal ───────────────────────────────────────────────────
export function IssueMedicineModal({ open, onClose, onSuccess, apiBase, authHeader, allMedicines, allDoctors }) {
  const [form, setForm] = useState({ medicine: '', doctor: '', quantityIssued: '', source: 'INHOUSE', notes: '' });
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedMed, setSelectedMed] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const reset = () => {
    setForm({ medicine: '', doctor: '', quantityIssued: '', source: 'INHOUSE', notes: '' });
    setSelectedPatient(null);
    setSelectedMed(null);
    setError('');
    setSuccess('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleMedChange = (medId) => {
    const med = allMedicines.find(m => m._id === medId);
    setSelectedMed(med || null);
    setForm(f => ({ ...f, medicine: medId }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!selectedPatient) { setError('Please select a patient.'); return; }
    if (!form.medicine) { setError('Please select a medicine.'); return; }
    if (!form.doctor) { setError('Please select a doctor.'); return; }
    if (!form.quantityIssued || parseInt(form.quantityIssued) < 1) { setError('Please enter a valid quantity.'); return; }
    if (form.source === 'INHOUSE' && selectedMed && parseInt(form.quantityIssued) > selectedMed.stockCount) {
      setError(`Insufficient in-house stock. Available: ${selectedMed.stockCount} ${selectedMed.unit || 'units'}`);
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${apiBase}/issuances`, {
        patient: selectedPatient._id,
        medicine: form.medicine,
        doctor: form.doctor,
        quantityIssued: parseInt(form.quantityIssued),
        source: form.source,
        notes: form.notes
      }, authHeader);
      setSuccess(`Medicine issued successfully${form.source === 'EXTERNAL' ? ' — no in-house stock deducted' : ''}.`);
      setTimeout(() => { reset(); onClose(); onSuccess(); }, 1400);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to issue medicine. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="pharm-modal-overlay" onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="pharm-modal" style={{ maxWidth: 640 }}>
        {/* Header */}
        <div className="pharm-modal-header">
          <h2 className="pharm-modal-title">Issue Medicine</h2>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--pharm-gray-500)', lineHeight: 1 }}>×</button>
        </div>

        <div className="pharm-modal-body">
          {error && <div className="pharm-alert pharm-alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}
          {success && <div className="pharm-alert pharm-alert-success" style={{ marginBottom: '1rem' }}>{success}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Patient Search */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--pharm-gray-600)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                Patient <span style={{ color: 'var(--pharm-red)' }}>*</span>
              </label>
              <PatientSearchInput
                apiBase={apiBase}
                authHeader={authHeader}
                value={selectedPatient}
                onSelect={setSelectedPatient}
                onClear={() => setSelectedPatient(null)}
              />
            </div>

            {/* Medicine + Doctor in a row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--pharm-gray-600)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                  Medicine <span style={{ color: 'var(--pharm-red)' }}>*</span>
                </label>
                <select className="pharm-select" style={{ width: '100%' }} value={form.medicine} onChange={e => handleMedChange(e.target.value)}>
                  <option value="">Select medicine</option>
                  {allMedicines.map(m => (
                    <option key={m._id} value={m._id}>
                      {m.name}{m.brandName ? ` (${m.brandName})` : ''} — {m.stockCount} {m.unit || 'units'}
                    </option>
                  ))}
                </select>
                {selectedMed && (
                  <div style={{ marginTop: 6, display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span className={`pharm-badge ${selectedMed.stockCount === 0 ? 'pharm-badge-red' : selectedMed.stockCount < (selectedMed.reorderLevel || 20) ? 'pharm-badge-amber' : 'pharm-badge-green'}`}>
                      Stock: {selectedMed.stockCount} {selectedMed.unit || 'units'}
                    </span>
                    {selectedMed.expiryDate && (
                      <span className={`pharm-badge ${new Date(selectedMed.expiryDate) <= new Date() ? 'pharm-badge-red' : 'pharm-badge-navy'}`}>
                        Exp: {new Date(selectedMed.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--pharm-gray-600)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                  Doctor <span style={{ color: 'var(--pharm-red)' }}>*</span>
                </label>
                <select className="pharm-select" style={{ width: '100%' }} value={form.doctor} onChange={e => setForm(f => ({ ...f, doctor: e.target.value }))}>
                  <option value="">Select doctor</option>
                  {allDoctors.map(d => (
                    <option key={d._id} value={d._id}>{d.name}{d.specialization ? ` (${d.specialization})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quantity + Source in a row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--pharm-gray-600)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                  Quantity <span style={{ color: 'var(--pharm-red)' }}>*</span>
                </label>
                <input
                  className="pharm-input"
                  type="number"
                  min="1"
                  placeholder={form.source === 'INHOUSE' && selectedMed ? `Max: ${selectedMed.stockCount}` : 'Quantity'}
                  value={form.quantityIssued}
                  onChange={e => setForm(f => ({ ...f, quantityIssued: e.target.value }))}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--pharm-gray-600)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                  Source <span style={{ color: 'var(--pharm-red)' }}>*</span>
                </label>
                <select className="pharm-select" style={{ width: '100%' }} value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                  <option value="INHOUSE">INHOUSE - deducts college stock</option>
                  <option value="EXTERNAL">EXTERNAL - external pharmacy</option>
                </select>
                {form.source === 'EXTERNAL' && (
                  <div style={{ marginTop: 5, fontSize: '0.72rem', color: '#92400e', background: '#fffbeb', padding: '3px 8px', borderRadius: 4, border: '1px solid #fcd34d' }}>
                    Note: In-house stock will NOT be deducted
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--pharm-gray-600)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                Notes (optional)
              </label>
              <textarea className="pharm-input" rows="2" placeholder="Clinical notes, instructions..." value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical', minHeight: 56 }} />
            </div>
          </form>
        </div>

        <div className="pharm-modal-footer">
          <button className="pharm-btn pharm-btn-ghost" onClick={handleClose} disabled={loading}>Cancel</button>
          <button className="pharm-btn pharm-btn-teal" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Issuing...' : 'Confirm Issuance'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function PharmacistDashboard() {
  const [stats, setStats] = useState(null);
  const [issuanceSummary, setIssuanceSummary] = useState(null);
  const [criticalMeds, setCriticalMeds] = useState([]);
  const [recentIssuances, setRecentIssuances] = useState([]);
  const [topUsed, setTopUsed] = useState([]);
  const [usagePeriod, setUsagePeriod] = useState('month');
  const [allMedicines, setAllMedicines] = useState([]);
  const [allDoctors, setAllDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);

  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };
  const apiBaseUrl = useApi();
  const API_BASE = `${apiBaseUrl}/api`;

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, summaryRes, medsRes, issRes, usageRes, doctorsRes] = await Promise.all([
        axios.get(`${API_BASE}/medicines/stats`, authHeader),
        axios.get(`${API_BASE}/issuances/stats/summary`, authHeader),
        axios.get(`${API_BASE}/medicines`, authHeader),
        axios.get(`${API_BASE}/issuances?limit=8`, authHeader),
        axios.get(`${API_BASE}/medicines/analytics/usage?period=${usagePeriod}`, authHeader),
        axios.get(`${API_BASE}/doctors/list`, authHeader),
      ]);

      setStats(statsRes.data);
      setIssuanceSummary(summaryRes.data);
      setRecentIssuances(issRes.data.issuances || []);
      setTopUsed(usageRes.data.usage || []);
      setAllDoctors(doctorsRes.data || []);

      const allMeds = medsRes.data.medicines || [];
      setAllMedicines(allMeds);

      const today = new Date();
      const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      const critical = allMeds
        .filter(m => m.stockCount === 0 || m.stockCount < (m.reorderLevel || 20) || new Date(m.expiryDate) <= in30)
        .sort((a, b) => getMedStatus(b).label.localeCompare(getMedStatus(a).label))
        .slice(0, 12);
      setCriticalMeds(critical);
    } catch (e) {
      setError('Failed to load dashboard. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [usagePeriod]);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (loading) return <div className="pharm-loading">Loading pharmacy dashboard...</div>;

  if (error) return (
    <div className="pharm-error">
      <span>{error}</span>
      <button className="pharm-btn pharm-btn-primary" onClick={loadAll}>Retry</button>
    </div>
  );

  const maxUsage = topUsed[0]?.totalIssued || 1;

  // Urgent expiry banner
  const in7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const urgentMeds = criticalMeds.filter(m => new Date(m.expiryDate) <= in7);

  return (
    <div className="pharm-layout">
      <div className="pharm-root">

        {/* Issue Medicine Modal */}
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

        {/* Urgent Expiry Banner */}
        {urgentMeds.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
            color: '#fff', borderRadius: '12px', padding: '0.9rem 1.25rem',
            marginBottom: '1rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
            boxShadow: '0 4px 16px rgba(220,38,38,0.3)'
          }}>
            <span style={{ fontSize: '1rem', flexShrink: 0, fontWeight: 700, color: '#fca5a5' }}>ALERT</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.4rem' }}>
                Urgent Expiry Alert — {urgentMeds.length} medicine{urgentMeds.length > 1 ? 's' : ''} need immediate attention
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {urgentMeds.map(m => {
                  const days = getDaysToExpiry(m.expiryDate);
                  return (
                    <span key={m._id} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 6, padding: '2px 10px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid rgba(255,255,255,0.2)' }}>
                      {m.name} — {days === 0 ? 'EXPIRED' : `Exp in ${days}d`}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="pharm-header">
          <div>
            <h1 className="pharm-title">Pharmacy Dashboard</h1>
            <p className="pharm-subtitle">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="pharm-header-actions">
            <button className="pharm-btn pharm-btn-ghost" onClick={loadAll}>Refresh</button>
            <button className="pharm-btn pharm-btn-ghost" onClick={() => navigate('/pharmacist-dashboard/records')}>View Records</button>
            <button className="pharm-btn pharm-btn-ghost" onClick={() => setShowStockModal(true)}>+ Add Stock</button>
            <button className="pharm-btn pharm-btn-teal" onClick={() => setShowIssueModal(true)}>+ Issue Medicine</button>
          </div>
        </div>

        {/* Key Stats */}
        {stats && (
          <div className="pharm-stats-grid">
            <div className="pharm-stat-card">
              <div className="pharm-stat-label">Total Medicines</div>
              <div className="pharm-stat-value">{stats.totalMedicines}</div>
              <div className="pharm-stat-meta">{stats.totalUnitsInStock?.toLocaleString()} units in stock</div>
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
            <div className="pharm-stat-card danger">
              <div className="pharm-stat-label">Expiring ≤30d</div>
              <div className="pharm-stat-value" style={{ color: stats.expiring30Days > 0 ? 'var(--pharm-red)' : 'inherit' }}>
                {stats.expiring30Days}
              </div>
              <div className="pharm-stat-meta">{stats.expiring90Days} within 90 days</div>
            </div>
          </div>
        )}

        {/* Stock Movement Summary */}
        {stats?.stockMovement && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="pharm-section" style={{ margin: 0, borderTop: '5px solid var(--pharm-gold)', boxShadow: '0 8px 24px rgba(200,134,10,0.12)' }}>
              <div className="pharm-section-header" style={{ background: 'linear-gradient(to right,var(--pharm-gold-soft),#fff)', borderBottom: '1px solid var(--pharm-gold-mid)' }}>
                <h2 className="pharm-section-title" style={{ color: 'var(--pharm-gold-dark)' }}>Stock Added</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem', padding: '1.5rem', background: 'linear-gradient(135deg,#fffbeb 0%,var(--pharm-gold-soft) 100%)' }}>
                {[{ label: 'Today', val: stats.stockMovement.added.today }, { label: 'This Week', val: stats.stockMovement.added.week }, { label: 'This Month', val: stats.stockMovement.added.month }].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--pharm-gray-400)', textTransform: 'uppercase' }}>{s.label}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--pharm-teal)' }}>+{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pharm-section" style={{ margin: 0, borderTop: '5px solid var(--pharm-red)', boxShadow: '0 8px 24px rgba(220,38,38,0.12)' }}>
              <div className="pharm-section-header" style={{ background: 'linear-gradient(to right,var(--pharm-red-pale),#fff)', borderBottom: '1px solid #fecaca' }}>
                <h2 className="pharm-section-title" style={{ color: '#991b1b' }}>Units Dispensed</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem', padding: '1.5rem', background: 'linear-gradient(135deg,#fff5f5 0%,var(--pharm-red-pale) 100%)' }}>
                {[{ label: 'Today', val: stats.stockMovement.issued.today }, { label: 'This Week', val: stats.stockMovement.issued.week }, { label: 'This Month', val: stats.stockMovement.issued.month }].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--pharm-gray-400)', textTransform: 'uppercase' }}>{s.label}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--pharm-red)' }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Issuance Summary Cards */}
        {issuanceSummary?.today && (
          <div className="pharm-issuance-summary">
            <div className="pharm-issuance-card"><div className="label">TODAY</div><div className="value">{issuanceSummary.today?.qty || 0}</div><div className="sub">{issuanceSummary.today?.transactions || 0} dispensing transactions</div></div>
            <div className="pharm-issuance-card week"><div className="label">THIS WEEK</div><div className="value">{issuanceSummary.week?.qty || 0}</div><div className="sub">{issuanceSummary.week?.transactions || 0} transactions</div></div>
            <div className="pharm-issuance-card month"><div className="label">THIS MONTH</div><div className="value">{issuanceSummary.month?.qty || 0}</div><div className="sub">{issuanceSummary.month?.transactions || 0} transactions</div></div>
            <div className="pharm-issuance-card year"><div className="label">THIS YEAR</div><div className="value">{issuanceSummary.year?.qty || 0}</div><div className="sub">{issuanceSummary.year?.transactions || 0} transactions</div></div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Critical Alerts */}
          <div className="pharm-section">
            <div className="pharm-section-header">
              <h2 className="pharm-section-title">
                Critical Alerts
                {criticalMeds.length > 0 && <span className="count-badge" style={{ background: 'var(--pharm-red)', color: '#fff' }}>{criticalMeds.length}</span>}
              </h2>
              <button className="pharm-btn pharm-btn-ghost pharm-btn-sm" onClick={() => navigate('/pharmacist-dashboard/stock')}>View All</button>
            </div>
            {criticalMeds.length === 0 ? (
              <div className="pharm-empty"><div className="pharm-empty-text">All medicines are well-stocked and within expiry!</div></div>
            ) : (
              <div className="pharm-table-container">
                <table className="pharm-table">
                  <thead><tr><th>Medicine</th><th>Stock</th><th>Expiry</th><th>Status</th></tr></thead>
                  <tbody>
                    {criticalMeds.map(med => {
                      const status = getMedStatus(med);
                      const days = getDaysToExpiry(med.expiryDate);
                      return (
                        <tr key={med._id} className={med.stockCount === 0 ? 'row-out-of-stock' : 'row-low-stock'}>
                          <td><div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{med.name}</div>{med.brandName && <div style={{ fontSize: '0.72rem', color: 'var(--pharm-gray-400)' }}>{med.brandName}</div>}</td>
                          <td><span className={`pharm-stock-num ${med.stockCount === 0 ? 'out' : 'low'}`}>{med.stockCount}</span></td>
                          <td className="mono" style={{ fontSize: '0.8rem', color: days <= 30 ? 'var(--pharm-red)' : 'inherit' }}>
                            {new Date(med.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}
                          </td>
                          <td><span className={`pharm-badge ${status.cls}`}>{status.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Top Used Medicines */}
          <div className="pharm-section">
            <div className="pharm-section-header">
              <h2 className="pharm-section-title">Most Dispensed</h2>
              <div className="pharm-period-selector">
                {['day', 'week', 'month'].map(p => (
                  <button key={p} className={`pharm-period-btn ${usagePeriod === p ? 'active' : ''}`} onClick={() => setUsagePeriod(p)}>
                    {p === 'day' ? 'Today' : p === 'week' ? 'Week' : 'Month'}
                  </button>
                ))}
              </div>
            </div>
            {topUsed.length === 0 ? (
              <div className="pharm-empty"><div className="pharm-empty-text">No issuance data for this period</div></div>
            ) : (
              <div className="pharm-usage-list">
                {topUsed.map((item, idx) => (
                  <div key={item._id} className="pharm-usage-item">
                    <div className={`pharm-usage-rank ${idx < 3 ? 'top' : ''}`}>{idx + 1}</div>
                    <div className="pharm-usage-info">
                      <div className="pharm-usage-name">{item.name}</div>
                      <div className="pharm-usage-brand">{item.brandName && `${item.brandName} · `}Stock: {item.currentStock} {item.unit || 'units'}</div>
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
        </div>

        {/* Recent Issuances */}
        <div className="pharm-section" style={{ marginTop: '1.5rem' }}>
          <div className="pharm-section-header">
            <h2 className="pharm-section-title">Recent Issuances<span className="count-badge">{recentIssuances.length}</span></h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="pharm-btn pharm-btn-ghost pharm-btn-sm" onClick={() => setShowStockModal(true)}>+ Add Stock</button>
              <button className="pharm-btn pharm-btn-teal pharm-btn-sm" onClick={() => setShowIssueModal(true)}>+ Issue Medicine</button>
              <button className="pharm-btn pharm-btn-ghost pharm-btn-sm" onClick={() => navigate('/pharmacist-dashboard/records')}>View All</button>
            </div>
          </div>
          <div className="pharm-table-container">
            {recentIssuances.length === 0 ? (
              <div className="pharm-empty"><div className="pharm-empty-text">No issuances recorded yet</div></div>
            ) : (
              <table className="pharm-table">
                <thead>
                  <tr><th>Patient</th><th>Medicine</th><th>Qty</th><th>Source</th><th>Doctor</th><th>Issued By</th><th>Date &amp; Time</th></tr>
                </thead>
                <tbody>
                  {recentIssuances.map(iss => (
                    <tr key={iss._id}>
                      <td><div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{iss.patient?.name || 'N/A'}</div><div style={{ fontSize: '0.73rem', color: 'var(--pharm-gray-400)' }}>{iss.patient?.email || ''}</div></td>
                      <td><div style={{ fontWeight: 500 }}>{iss.medicine?.name || 'N/A'}</div>{iss.medicine?.brandName && <div style={{ fontSize: '0.73rem', color: 'var(--pharm-gray-400)' }}>{iss.medicine.brandName}</div>}</td>
                      <td><span className="pharm-badge pharm-badge-navy" style={{ fontFamily: 'var(--pharm-mono)' }}>{iss.quantityIssued} {iss.medicine?.unit || 'units'}</span></td>
                      <td><span className={`pharm-badge ${iss.source === 'EXTERNAL' ? 'pharm-badge-amber' : 'pharm-badge-green'}`}>{iss.source === 'EXTERNAL' ? 'EXTERNAL' : 'INHOUSE'}</span></td>
                      <td style={{ fontSize: '0.85rem' }}>{iss.doctor?.name || 'N/A'}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--pharm-gray-500)' }}>{iss.issuedBy?.name || '—'}</td>
                      <td className="mono" style={{ fontSize: '0.78rem' }}>
                        <div>{new Date(iss.issuedDate).toLocaleDateString('en-IN')}</div>
                        <div style={{ color: 'var(--pharm-gray-400)', fontSize: '0.7rem' }}>{new Date(iss.issuedDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}