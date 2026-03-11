import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../../styles/doctor/DoctorPrescription.css';

function DoctorPrescription({ appointmentId, patientId }) {
  const [current, setCurrent] = useState([]);
  const [previous, setPrevious] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    const load = async () => {
      if (!appointmentId || !patientId) return;
      setLoading(true); setError('');
      try {
        const [cur, prev] = await Promise.all([
          axios.get(`http://localhost:5000/api/prescriptions/${appointmentId}`, { params: { token } }),
          axios.get(`http://localhost:5000/api/prescriptions/latest/${patientId}`, { params: { token } }),
        ]);
        setCurrent(cur.data.prescriptions || []);
        setPrevious(prev.data.prescriptions || []);
      } catch (e) {
        setError('Could not load prescription data.');
      } finally { setLoading(false); }
    };
    load();
  }, [appointmentId, patientId, token]);

  const change = (i, e) => {
    const v = [...current];
    v[i][e.target.name] = e.target.value;
    setCurrent(v); setSaved(false);
  };

  const addRow = () => {
    setCurrent([...current, { medication: '', dosage: '', frequency: '', notes: '', status: 'new' }]);
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
            <span>Dosage</span>
            <span>Frequency</span>
            <span>Instructions</span>
            <span></span>
          </div>
          {current.map((rx, i) => (
            <div key={i} className={`rx-row${rx.status === 'continued' ? ' continued' : ''}`}>
              <span className="rx-num">{i + 1}</span>
              <input name="medication" value={rx.medication}
                onChange={e => change(i, e)} placeholder="e.g. Paracetamol" />
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