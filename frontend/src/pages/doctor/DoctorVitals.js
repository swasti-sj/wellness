import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../../styles/doctor/DoctorVitals.css';
import DocumentUpload from './documentUpload';

const AccSection = ({ id, title, subtitle, children, openSection, toggleSection }) => {
  const isOpen = openSection === id;

  return (
    <div className="acc-section">
      <button
        type="button"
        className={`acc-toggle${isOpen ? ' open' : ''}`}
        onClick={() => toggleSection((prev) => (prev === id ? null : id))}
      >
        <div className="acc-toggle-left">
          <div>
            <div className="acc-title">{title}</div>
            {subtitle && <div className="acc-subtitle">{subtitle}</div>}
          </div>
        </div>
        <span className="acc-chevron">{isOpen ? '^' : 'v'}</span>
      </button>
      <div className={`acc-body${isOpen ? ' open' : ''}`}>{children}</div>
    </div>
  );
};

const initialFormData = {
  department: '',
  uhid: '',
  tokenNumber: '',
  bloodGroup: '',
  time: '',
  pastMedicalHistory: '',
  medicalAllergy: '',
  chiefComplaints: '',
  systemicExamination: '',
  generalPhysicalExamination: '',
  investigations: '',
  treatmentAdvice: '',
  followUpDate: '',
  bloodPressureSystolic: '',
  bloodPressureDiastolic: '',
  weight: '',
  height: '',
  temperature: '',
  pulse: '',
  respiratoryRate: '',
  spO2: '',
  notes: ''
};

const DoctorVitals = ({ appointmentId, patientId, dependantUhid, apiBaseUrl, readOnly = false }) => {
  const token = localStorage.getItem('token');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [existingVitalId, setExistingVitalId] = useState(null);
  const [openSection, setOpenSection] = useState('basic');
  const [caseSheetDocument, setCaseSheetDocument] = useState(null);
  const [caseSheetDocumentUrl, setCaseSheetDocumentUrl] = useState('');
  const [formData, setFormData] = useState(initialFormData);
  const [recordLoaded, setRecordLoaded] = useState(false);


  const mapVitalToFormData = (v) => ({
    department: v.department || '',
    uhid: dependantUhid || v.uhid || '',
    tokenNumber: v.tokenNumber || '',
    bloodGroup: v.bloodGroup || '',
    time: v.time || '',
    pastMedicalHistory: v.pastMedicalHistory || '',
    medicalAllergy: v.medicalAllergy || '',
    chiefComplaints: v.chiefComplaints || '',
    systemicExamination: v.systemicExamination || '',
    generalPhysicalExamination: v.generalPhysicalExamination || '',
    investigations: v.investigations || '',
    treatmentAdvice: v.treatmentAdvice || '',
    followUpDate: v.followUpDate ? v.followUpDate.split('T')[0] : '',
    bloodPressureSystolic: v.bloodPressureSystolic || '',
    bloodPressureDiastolic: v.bloodPressureDiastolic || '',
    weight: v.weight || '',
    height: v.height || '',
    temperature: v.temperature || '',
    pulse: v.pulse || '',
    respiratoryRate: v.respiratoryRate || '',
    spO2: v.spO2 || '',
    notes: v.notes || ''
  });

  const fetchVitals = async () => {
    if (!apiBaseUrl || !appointmentId) return;
    setRecordLoaded(false);
    try {
      const res = await axios.get(`${apiBaseUrl}/api/vitals/${appointmentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.vital) {
        const v = res.data.vital;
        setExistingVitalId(v._id);
        setRecordLoaded(true);
        const mapped = mapVitalToFormData(v);

        // If the saved vital has no UHID, fetch from patient profile
        if (!mapped.uhid && patientId && apiBaseUrl) {
          try {
            const uhidRes = await axios.get(`${apiBaseUrl}/api/users/patient-uhid/${patientId}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            mapped.uhid = dependantUhid || uhidRes.data?.uhid || '';
          } catch (uhidErr) {
            console.warn('Could not fetch patient UHID:', uhidErr.message);
          }
        }

        setFormData(mapped);
        setCaseSheetDocumentUrl(v.caseSheetDocumentUrl || '');
      } else {
        // No saved vital yet — still fetch UHID for the blank form
        if (patientId && apiBaseUrl) {
          try {
            const uhidRes = await axios.get(`${apiBaseUrl}/api/users/patient-uhid/${patientId}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            setFormData((prev) => ({ ...prev, uhid: dependantUhid || uhidRes.data?.uhid || '' }));
          } catch (uhidErr) {
            console.warn('Could not fetch patient UHID:', uhidErr.message);
          }
        }
      }
    } catch (err) {
      const status = err.response?.status;
      const errorMessage = err.response?.data?.error || err.message;
      console.log('Failed to load vitals:', status, errorMessage);
      if (status === 404) {
        setExistingVitalId(null);
        setRecordLoaded(true);
        // No saved vital — fetch UHID for the blank form
        if (patientId && apiBaseUrl) {
          try {
            const uhidRes = await axios.get(`${apiBaseUrl}/api/users/patient-uhid/${patientId}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            setFormData({ ...initialFormData, uhid: dependantUhid || uhidRes.data?.uhid || '' });
          } catch {
            setFormData(initialFormData);
          }
        } else {
          setFormData(initialFormData);
        }
        setCaseSheetDocumentUrl('');
      } else {
        setRecordLoaded(true);
      }
    }
  };

  useEffect(() => {
    fetchVitals();
  }, [appointmentId, apiBaseUrl, token, patientId, dependantUhid]);


  const handleInputChange = (e) => {
    if (readOnly) return;
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveVitals = async () => {
    try {
      setLoading(true);
      setMessage('');
      const payload = new FormData();
      payload.append('appointmentId', appointmentId);
      payload.append('patientId', patientId);
      Object.entries(formData).forEach(([key, value]) => payload.append(key, value ?? ''));

      if (caseSheetDocument) {
        payload.append('caseSheetDocument', caseSheetDocument);
      } else if (caseSheetDocumentUrl) {
        payload.append('existingCaseSheetDocumentUrl', caseSheetDocumentUrl);
      }

      const res = await axios.post(`${apiBaseUrl}/api/vitals/save`, payload, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.data.success) {
        setMessage('Case sheet saved successfully.');
        setExistingVitalId(res.data.vital?._id || existingVitalId);
        setCaseSheetDocument(null);
        setCaseSheetDocumentUrl(res.data.vital?.caseSheetDocumentUrl || caseSheetDocumentUrl);
        if (res.data.vital) {
          setFormData(mapVitalToFormData(res.data.vital));
        }
        await fetchVitals();
      }
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to save case sheet.');
    } finally {
      setLoading(false);
    }
  };

  const calculateBMI = () => {
    const weight = parseFloat(formData.weight);
    const height = parseFloat(formData.height);
    if (weight && height) {
      const h = height / 100;
      return (weight / (h * h)).toFixed(1);
    }
    return '-';
  };

  if (readOnly && recordLoaded && !existingVitalId) {
    return (
      <div className="doctor-vitals read-only no-case-sheet">
        <div className="case-sheet-title">Case Sheet</div>
        <div className="no-case-sheet-message">
          <strong>No case sheet recorded</strong>
          <span>The doctor or nurse has not added case-sheet details for this appointment yet.</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`doctor-vitals${readOnly ? ' read-only' : ''}`}>
      <div className="case-sheet-title">
        Case Sheet
        {existingVitalId && <span className="saved-badge">Saved</span>}
      </div>

      <AccSection id="basic" title="Basic Details" subtitle="Department, UHID, blood group, time" openSection={openSection} toggleSection={setOpenSection}>
        <div className="fg2">
          <div className="ff"><label>Department</label><input type="text" name="department" value={formData.department} onChange={handleInputChange} readOnly={readOnly} /></div>
          <div className="ff">
            <label>UHID </label>
            <input
              type="text"
              name="uhid"
              value={formData.uhid || 'Not assigned'}
              readOnly
              style={{ background: 'rgba(74,16,96,0.05)', cursor: 'not-allowed', color: '#4a1060', fontWeight: 600 }}
            />
          </div>
          <div className="ff"><label>Token Number</label><input type="text" name="tokenNumber" value={formData.tokenNumber} onChange={handleInputChange} readOnly={readOnly} /></div>
          <div className="ff">
            <label>Blood Group</label>
            <select name="bloodGroup" value={formData.bloodGroup} onChange={handleInputChange} disabled={readOnly}>
              <option value="">Select blood group</option>
              <option>A+</option><option>A-</option><option>B+</option><option>B-</option>
              <option>AB+</option><option>AB-</option><option>O+</option><option>O-</option>
            </select>
          </div>
          <div className="ff"><label>Time</label><input type="time" name="time" value={formData.time} onChange={handleInputChange} readOnly={readOnly} /></div>
        </div>
      </AccSection>

      <AccSection id="history" title="Medical History" subtitle="Past illnesses, allergies, chief complaints" openSection={openSection} toggleSection={setOpenSection}>
        <div className="fg1">
          <div className="ff"><label>Past Medical History</label><textarea name="pastMedicalHistory" value={formData.pastMedicalHistory} onChange={handleInputChange} rows={2} readOnly={readOnly} /></div>
          <div className="ff"><label>Medical Allergy</label><textarea name="medicalAllergy" value={formData.medicalAllergy} onChange={handleInputChange} rows={2} readOnly={readOnly} /></div>
          <div className="ff"><label>Chief Complaints with Duration</label><textarea name="chiefComplaints" value={formData.chiefComplaints} onChange={handleInputChange} rows={2} readOnly={readOnly} /></div>
          <div className="ff"><label>Systemic Examination</label><textarea name="systemicExamination" value={formData.systemicExamination} onChange={handleInputChange} rows={2} readOnly={readOnly} /></div>
          <div className="ff"><label>General Physical Examination</label><textarea name="generalPhysicalExamination" value={formData.generalPhysicalExamination} onChange={handleInputChange} rows={2} readOnly={readOnly} /></div>
        </div>
      </AccSection>

      <AccSection id="vitals" title="Vital Signs" subtitle="Blood pressure, pulse, temperature, oxygen, weight, height" openSection={openSection} toggleSection={setOpenSection}>
        <div className="fg3">
          <div className="ff"><label>BP Systolic</label><div className="input-addon"><input type="number" name="bloodPressureSystolic" value={formData.bloodPressureSystolic} onChange={handleInputChange} readOnly={readOnly} /><span>mmHg</span></div></div>
          <div className="ff"><label>BP Diastolic</label><div className="input-addon"><input type="number" name="bloodPressureDiastolic" value={formData.bloodPressureDiastolic} onChange={handleInputChange} readOnly={readOnly} /><span>mmHg</span></div></div>
          <div className="ff"><label>Pulse Rate</label><div className="input-addon"><input type="number" name="pulse" value={formData.pulse} onChange={handleInputChange} readOnly={readOnly} /><span>bpm</span></div></div>
          <div className="ff"><label>Temperature</label><div className="input-addon"><input type="number" step="0.1" name="temperature" value={formData.temperature} onChange={handleInputChange} readOnly={readOnly} /><span>F</span></div></div>
          <div className="ff"><label>Respiratory Rate</label><div className="input-addon"><input type="number" name="respiratoryRate" value={formData.respiratoryRate} onChange={handleInputChange} readOnly={readOnly} /><span>/min</span></div></div>
          <div className="ff"><label>SpO2</label><div className="input-addon"><input type="number" name="spO2" value={formData.spO2} onChange={handleInputChange} readOnly={readOnly} /><span>%</span></div></div>
          <div className="ff"><label>Weight</label><div className="input-addon"><input type="number" step="0.1" name="weight" value={formData.weight} onChange={handleInputChange} readOnly={readOnly} /><span>kg</span></div></div>
          <div className="ff"><label>Height</label><div className="input-addon"><input type="number" name="height" value={formData.height} onChange={handleInputChange} readOnly={readOnly} /><span>cm</span></div></div>
          <div className="ff"><label>BMI</label><div className="input-addon readonly"><input type="text" value={calculateBMI()} readOnly /><span>kg/m2</span></div></div>
        </div>
      </AccSection>

      <AccSection id="investigations" title="Investigations and Treatment" subtitle="Lab tests, treatment advice, follow-up date" openSection={openSection} toggleSection={setOpenSection}>
        <div className="fg1">
          <div className="ff"><label>Investigations</label><textarea name="investigations" value={formData.investigations} onChange={handleInputChange} rows={2} readOnly={readOnly} /></div>
          <div className="ff"><label>Treatment / Advice</label><textarea name="treatmentAdvice" value={formData.treatmentAdvice} onChange={handleInputChange} rows={2} readOnly={readOnly} /></div>
          <div className="ff follow-date"><label>Follow-up Date</label><input type="date" name="followUpDate" value={formData.followUpDate} onChange={handleInputChange} readOnly={readOnly} /></div>
        </div>
      </AccSection>

      <AccSection id="notes" title="Additional Notes" subtitle="Any extra observations or instructions" openSection={openSection} toggleSection={setOpenSection}>
        <div className="ff"><textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={3} readOnly={readOnly} /></div>
      </AccSection>

      <AccSection id="documents" title="Case Sheet Documents" subtitle={readOnly ? "Supporting case sheet files" : "Upload supporting case sheet files"} openSection={openSection} toggleSection={setOpenSection}>
        {readOnly ? (
          <DocumentUpload
            label="Case Sheet Document"
            previewUrl={caseSheetDocumentUrl}
            isEditing={false}
            emptyMessage="No case sheet document uploaded."
          />
        ) : (
          <DocumentUpload
            label="Upload Case Sheet Document"
            previewUrl={caseSheetDocumentUrl}
            selectedFile={caseSheetDocument}
            onFileChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setCaseSheetDocument(file);
              setCaseSheetDocumentUrl(URL.createObjectURL(file));
            }}
            onRemove={() => {
              setCaseSheetDocument(null);
              setCaseSheetDocumentUrl('');
            }}
            uploading={loading}
            isEditing
          />
        )}
      </AccSection>

      {!readOnly && (
        <div className="vitals-save-row">
          <button className="save-case-btn" onClick={handleSaveVitals} disabled={loading}>
            {loading ? 'Saving...' : existingVitalId ? 'Update Case Sheet' : 'Save Case Sheet'}
          </button>
          {message && <p className={message.toLowerCase().includes('successfully') ? 'msg-success' : 'msg-error'}>{message}</p>}
        </div>
      )}
    </div>
  );
};

export default DoctorVitals;
