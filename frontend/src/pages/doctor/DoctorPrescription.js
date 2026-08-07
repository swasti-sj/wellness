import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Fuse from 'fuse.js';
import '../../styles/doctor/DoctorPrescription.css';
import DocumentUpload from './documentUpload';
import { useApi } from '../../context/ApiContext';
function DoctorPrescription({ appointmentId, patientId }) {
  const [current, setCurrent] = useState([]);
  const [previous, setPrevious] = useState([]);
  const [fuse, setFuse] = useState(null);
  const [dropdownIndex, setDropdownIndex] = useState(-1);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [documentUrl, setDocumentUrl] = useState('');
  const [prescriptionDocument, setPrescriptionDocument] = useState(null);
  const [bookNo, setBookNo] = useState('');
  const [prescriptionNo, setPrescriptionNo] = useState('');
  const token = localStorage.getItem('token');
  const apiBaseUrl = useApi();
  useEffect(() => {
    const load = async () => {
      if (!appointmentId || !patientId) return;
      setLoading(true);
      setError('');
      try {
        const [cur, prev, meds] = await Promise.all([
          axios.get(`${apiBaseUrl}/api/prescriptions/${appointmentId}`, { params: { token } }),
          axios.get(`${apiBaseUrl}/api/prescriptions/latest/${patientId}`, { params: { token } }),
          axios.get(`${apiBaseUrl}/api/medicines?inStock=true`, { params: { token } })
        ]);

        const medsList = meds.data.medicines || [];
        setCurrent(cur.data.prescriptions || []);
        setPrevious(prev.data.prescriptions || []);
        setDocumentUrl(cur.data.documentUrl || '');
        setBookNo(cur.data.bookNo || '');
        setPrescriptionNo(cur.data.prescriptionNo || '');
        setFuse(new Fuse(medsList, { keys: ['name'], threshold: 0.4, includeScore: true }));
      } catch (e) {
        const errorMsg = e.response?.data?.error || e.message || 'Unknown error';
        setError('Could not load data: ' + errorMsg);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [appointmentId, patientId, token]);

  const updateRow = (index, field, value) => {
    setCurrent((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setSaved(false);
  };

  const handleMedInput = (i, value) => {
    updateRow(i, 'medication', value);
    updateRow(i, 'medicine', '');
    updateRow(i, 'stockInfo', '');
    setDropdownSearch(value);
    setDropdownIndex(i);
  };

  const selectMedicine = (i, med) => {
    setCurrent((prev) => {
      const next = [...prev];
      next[i] = {
        ...next[i],
        medication: med.name,
        medicine: med._id,
        stockInfo: `Stock: ${med.stockCount}, expires in ${med.daysToExpiry} days`
      };
      return next;
    });
    setDropdownIndex(-1);
    setDropdownSearch('');
  };

  const addRow = () => {
    setCurrent((prev) => [...prev, { medication: '', dosage: '', frequency: '', notes: '', quantity: 1, status: 'new', source: 'INHOUSE' }]);
    setSaved(false);
  };

  const removeRow = (i) => {
    setCurrent((prev) => prev.filter((_, index) => index !== i));
    setSaved(false);
  };

  const togglePrev = (rx, checked) => {
    if (checked) {
      if (!current.some((p) => p.medication === rx.medication)) {
        setCurrent((prev) => [...prev, { ...rx, status: 'continued' }]);
      }
    } else {
      setCurrent((prev) => prev.filter((p) => p.medication !== rx.medication));
    }
    setSaved(false);
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('token', token);
      formData.append('appointmentId', appointmentId);
      formData.append('prescriptions', JSON.stringify(current));
      formData.append('bookNo', bookNo);
      formData.append('prescriptionNo', prescriptionNo);
      if (prescriptionDocument) {
        formData.append('prescriptionDocument', prescriptionDocument);
      } else if (documentUrl) {
        formData.append('existingDocumentUrl', documentUrl);
      }

      const r = await axios.post(`${apiBaseUrl}/api/prescriptions/save`, formData);

      if (r.data.success) {
        setCurrent(r.data.prescription.prescriptions);
        setDocumentUrl(r.data.prescription.documentUrl || '');
        setBookNo(r.data.prescription.bookNo || '');
        setPrescriptionNo(r.data.prescription.prescriptionNo || '');
        setPrescriptionDocument(null);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      setError('Failed to save. ' + (e.response?.data?.error || ''));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="rx-loading">Loading prescriptions...</div>;

  return (
    <div className="rx-root">
      {error && <div className="rx-error">{error}</div>}

      {previous.length > 0 && (
        <div className="rx-prev">
          <div className="rx-prev-header">
            <span className="rx-prev-title">Continue previous medications?</span>
          </div>
          <div className="rx-prev-list">
            {previous.map((rx, i) => {
              const isActive = current.some((p) => p.medication === rx.medication);
              return (
                <label key={i} className={`rx-prev-item${isActive ? ' active' : ''}`}>
                  <input type="checkbox" checked={isActive} onChange={(e) => togglePrev(rx, e.target.checked)} />
                  <div className="rx-prev-drug">
                    <span className="rx-prev-name">{rx.medication}</span>
                    <span className="rx-prev-detail">{rx.dosage} | {rx.frequency}</span>
                  </div>
                  {isActive && <span className="rx-continued-badge">Added</span>}
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="rx-section-label">
        <span>Current Prescription</span>
        {current.length > 0 && <span className="rx-count">{current.length} medication{current.length > 1 ? 's' : ''}</span>}
      </div>

      <div className="rx-table" style={{ marginBottom: '1rem' }}>
        <div className="rx-row" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'end' }}>
          <div className="rx-med-container">
            <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>Book No.</label>
            <input value={bookNo} onChange={(e) => { setBookNo(e.target.value); setSaved(false); }} placeholder="Enter book number" />
          </div>
          <div className="rx-med-container">
            <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>Prescription No.</label>
            <input value={prescriptionNo} onChange={(e) => { setPrescriptionNo(e.target.value); setSaved(false); }} placeholder="Enter prescription number" />
          </div>
        </div>
      </div>

      <DocumentUpload
        label="Upload Prescription Document"
        previewUrl={documentUrl}
        selectedFile={prescriptionDocument}
        onFileChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setPrescriptionDocument(file);
          setDocumentUrl(URL.createObjectURL(file));
          setSaved(false);
        }}
        onRemove={() => {
          setPrescriptionDocument(null);
          setDocumentUrl('');
          setSaved(false);
        }}
        uploading={isSaving}
        isEditing
      />

      {current.length === 0 ? (
        <div className="rx-empty">No medications added yet. Click "Add Medication" to begin.</div>
      ) : (
        <div className="rx-table">
          <div className="rx-table-head">
            <span>#</span>
            <span>Medication</span>
            <span>Qty</span>
            <span>Dosage</span>
            <span>Frequency</span>
            <span>Instructions</span>
            <span>Source</span>
            <span></span>
          </div>
          {current.map((rx, i) => (
            <div key={i} className={`rx-row${rx.status === 'continued' ? ' continued' : ''}`}>
              <span className="rx-num">{i + 1}</span>
              <div className="rx-med-container">
                <input value={rx.medication} onChange={(e) => handleMedInput(i, e.target.value)} placeholder="Type to search medicines" />
                {rx.medicine && rx.source !== 'EXTERNAL' && rx.stockInfo && (
                  <small style={{ color: '#1e8a55' }}>{rx.stockInfo}</small>
                )}
                {rx.medicine && rx.source === 'EXTERNAL' && (
                  <small style={{ color: '#b45309' }}>External — stock not deducted</small>
                )}
                {dropdownIndex === i && dropdownSearch && fuse && (
                  <div className="rx-dropdown">
                    {fuse.search(dropdownSearch).slice(0, 8).map((result, idx) => (
                      <div key={result.item._id || idx} className="rx-dropdown-item" onClick={() => selectMedicine(i, result.item)}>
                        {result.item.name} (Stock: {result.item.stockCount})
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input name="quantity" type="number" min="1" value={rx.quantity || 1} onChange={(e) => updateRow(i, 'quantity', e.target.value)} placeholder="Qty" />
              <input name="dosage" value={rx.dosage} onChange={(e) => updateRow(i, 'dosage', e.target.value)} placeholder="e.g. 500mg" />
              <input name="frequency" value={rx.frequency} onChange={(e) => updateRow(i, 'frequency', e.target.value)} placeholder="e.g. Twice daily" />
              <input name="notes" value={rx.notes} onChange={(e) => updateRow(i, 'notes', e.target.value)} placeholder="e.g. After food" />
              {/* Source dropdown — always visible */}
              <select
                value={rx.source || 'INHOUSE'}
                onChange={(e) => updateRow(i, 'source', e.target.value)}
                title="Select stock source"
                style={{
                  fontSize: '0.78rem',
                  padding: '4px 6px',
                  borderRadius: 6,
                  border: (rx.source || 'INHOUSE') === 'EXTERNAL'
                    ? '1.5px solid #b45309'
                    : '1.5px solid #1e8a55',
                  background: (rx.source || 'INHOUSE') === 'EXTERNAL' ? '#fffbeb' : '#f0fdf4',
                  color: (rx.source || 'INHOUSE') === 'EXTERNAL' ? '#b45309' : '#166534',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minWidth: 100,
                  width: '100%'
                }}
              >
                <option value="INHOUSE">In-House</option>
                <option value="EXTERNAL">External</option>
              </select>
              <button className="rx-del" onClick={() => removeRow(i)} title="Remove">x</button>
              {rx.status === 'continued' && <span className="rx-badge-cont">Continued</span>}
            </div>
          ))}
        </div>
      )}

      <div className="rx-footer">
        <button className="rx-add-btn" onClick={addRow}>Add Medication</button>
        <div className="rx-save-group">
          {saved && <span className="rx-saved">Saved</span>}
          <button className="rx-save-btn" onClick={handleSave} disabled={isSaving || current.length === 0}>
            {isSaving ? 'Saving...' : 'Save Prescription'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DoctorPrescription;
