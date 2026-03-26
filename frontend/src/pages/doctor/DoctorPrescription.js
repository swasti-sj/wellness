import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Fuse from 'fuse.js';
import '../../styles/doctor/DoctorPrescription.css';

function DoctorPrescription({ appointmentId, patientId }) {
  const [current, setCurrent] = useState([]);
  const [previous, setPrevious] = useState([]);
  const [medicinesList, setMedicinesList] = useState([]);
  const [fuse, setFuse] = useState(null);
  const [dropdownIndex, setDropdownIndex] = useState(-1);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
        const [error, setError] = useState('');
        const [saved, setSaved] = useState(false);
        const token = localStorage.getItem('token');
        const dropdownRef = useRef(null);
        const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!appointmentId || !patientId) return;
      setLoading(true); setError('');
      try {
        const [cur, prev, meds] = await Promise.all([
          axios.get(`http://localhost:5000/api/prescriptions/${appointmentId}`, { params: { token } }),
          axios.get(`http://localhost:5000/api/prescriptions/latest/${patientId}`, { params: { token } }),
          axios.get(`http://localhost:5000/api/medicines?inStock=true`, { params: { token } })
        ]);
        setCurrent(cur.data.prescriptions || []);
        setPrevious(prev.data.prescriptions || []);
        const medsList = meds.data.medicines || [];
        setMedicinesList(medsList);
        setFuse(new Fuse(medsList, { 
          keys: ['name'], 
          threshold: 0.4,
          includeScore: true 
        }));
      } catch (e) {
        const errorMsg = e.response?.data?.error || e.message || 'Unknown error';
        setError('Could not load data: ' + errorMsg);
        console.error('Error loading prescription data:', e);
      } finally { setLoading(false); }
    };
    load();
  }, [appointmentId, patientId, token]);

  const change = (i, e) => {
    const v = [...current];
    v[i][e.target.name] = e.target.value;
    setCurrent(v); setSaved(false);
  };

  const selectMedicine = (i, med) => {
    const v = [...current];
    v[i].medication = med.name;
    v[i].medicine = med._id;
    v[i].stockInfo = `Stock: ${med.stockCount}, Expires: ${med.daysToExpiry} days`;
    setCurrent(v);
    setDropdownIndex(-1);
    setDropdownSearch('');
  };

  const handleMedInput = (i, value) => {
    const v = [...current];
    v[i].medication = value;
    v[i].medicine = '';
    v[i].stockInfo = '';
    setCurrent(v);
    setDropdownSearch(value);
    setDropdownIndex(i);
  };

  const addRow = () => {
    setCurrent([...current, { medication: '', dosage: '', frequency: '', notes: '', quantity: 1, status: 'new' }]);
    setSaved(false);
  };

  const removeRow = (i) => { const v = [...current]; v.splice(i, 1); setCurrent(v); setSaved(false); };

  const togglePrev = (rx, checked) => {
    if (checked) {
      if (!current.some(p => p.medication === rx.medication))
        setCurrent([...current, { ...rx, status: 'continued' }]);
    } else {
      setCurrent(current.filter(p => p.medication !== rx.medication));
    }
    setSaved(false);
  };

  const handleSave = async () => {
    setError(''); setSaving(true);
    try {
      const r = await axios.post('http://localhost:5000/api/prescriptions/save', {
        token, appointmentId, prescriptions: current,
      });
      if (r.data.success) {
        setCurrent(r.data.prescription.prescriptions);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      setError('Failed to save. ' + (e.response?.data?.error || ''));
    } finally { setSaving(false); }
  };

  if (isLoading) return <div className="rx-loading">⏳ Loading prescriptions…</div>;

  return (
    <div className="rx-root">
      {error && <div className="rx-error"><span>⚠</span> {error}</div>}

      {/* Previous medications */}
      {previous.length > 0 && (
        <div className="rx-prev">
          <div className="rx-prev-header">
            <span className="rx-prev-icon">🔁</span>
            <span className="rx-prev-title">Continue Previous Medications?</span>
          </div>
          <div className="rx-prev-list">
            {previous.map((rx, i) => {
              const isActive = current.some(p => p.medication === rx.medication);
              return (
                <label key={i} className={`rx-prev-item${isActive ? ' active' : ''}`}>
                  <input type="checkbox" checked={isActive} onChange={e => togglePrev(rx, e.target.checked)} />
                  <div className="rx-prev-drug">
                    <span className="rx-prev-name">{rx.medication}</span>
                    <span className="rx-prev-detail">{rx.dosage} · {rx.frequency}</span>
                  </div>
                  {isActive && <span className="rx-continued-badge">✓ Added</span>}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Current prescription rows */}
      <div className="rx-section-label">
        <span>💊</span>
        <span>Current Prescription</span>
        {current.length > 0 && <span className="rx-count">{current.length} medication{current.length > 1 ? 's' : ''}</span>}
      </div>

      {current.length === 0 ? (
        <div className="rx-empty">No medications added yet. Click "+ Add Medication" to begin.</div>
      ) : (
        <div className="rx-table">
          {/* Header */}
          <div className="rx-table-head">
            <span>#</span>
            <span>Medication</span>
            <span>Qty</span>
            <span>Dosage</span>
            <span>Frequency</span>
            <span>Instructions</span>
            <span></span>
          </div>
          {current.map((rx, i) => (
            <div key={i} className={`rx-row${rx.status === 'continued' ? ' continued' : ''}`}>
              <span className="rx-num">{i + 1}</span>
              <div className="rx-med-container">
                <input 
                  value={rx.medication}
                  onChange={(e) => handleMedInput(i, e.target.value)}
                  placeholder="Type to search medicines..."
                />
                {rx.stockInfo && <small>{rx.stockInfo}</small>}
                {dropdownIndex === i && dropdownSearch && fuse && (
                  <div className="rx-dropdown">
                    {fuse.search(dropdownSearch).slice(0, 8).map((result, idx) => (
                      <div 
                        key={result.item._id || idx}
                        className="rx-dropdown-item"
                        onClick={() => selectMedicine(i, result.item)}
                      >
                        {result.item.name} (Stock: {result.item.stockCount})
                        {result.item.daysToExpiry <= 28 && (
                          <span className="rx-expiry-alert"> ⚠️ {result.item.daysToExpiry}d</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input name="quantity" type="number" min="1" value={rx.quantity || 1}
                onChange={e => change(i, e)} placeholder="Qty" />
              <input name="dosage" value={rx.dosage}
                onChange={e => change(i, e)} placeholder="e.g. 500mg" />
              <input name="frequency" value={rx.frequency}
                onChange={e => change(i, e)} placeholder="e.g. Twice daily" />
              <input name="notes" value={rx.notes}
                onChange={e => change(i, e)} placeholder="e.g. After food" />
              <button className="rx-del" onClick={() => removeRow(i)} title="Remove">✕</button>
              {rx.status === 'continued' && <span className="rx-badge-cont">Continued</span>}
            </div>
          ))}
        </div>
      )}

      <div className="rx-footer">
        <button className="rx-add-btn" onClick={addRow}>+ Add Medication</button>
        <div className="rx-save-group">
          {saved && <span className="rx-saved">✓ Saved</span>}
          <button className="rx-save-btn" onClick={handleSave} disabled={isSaving || current.length === 0}>
            {isSaving ? '⏳ Saving…' : '💾 Save Prescription'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DoctorPrescription;