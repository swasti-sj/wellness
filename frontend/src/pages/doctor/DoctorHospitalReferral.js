import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../../styles/doctor/DoctorHospitalReferral.css';
import DocumentUpload from './documentUpload';
import { buildDocumentUrl, getDocumentName } from './documentHelpers';
import { useApi } from '../../context/ApiContext';

const CashlessDocumentPreview = ({ url }) => {
  const documentUrl = buildDocumentUrl(url);
  const isImage = /^data:image\//i.test(documentUrl) || /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(documentUrl);
  const isPdf = /^data:application\/pdf/i.test(documentUrl) || /\.pdf(\?|#|$)/i.test(documentUrl);

  if (!documentUrl) return null;

  return (
    <div className="cashless-document-preview">
      {isImage ? (
        <img src={documentUrl} alt="Cashless form" />
      ) : isPdf ? (
        <iframe src={documentUrl} title="Cashless form" />
      ) : (
        <object data={documentUrl} type="application/octet-stream" aria-label="Cashless form">
          <p>Document preview is not supported in this browser.</p>
        </object>
      )}
      <a href={documentUrl} target="_blank" rel="noreferrer">Open full document</a>
    </div>
  );
};

function DoctorHospitalReferral({ appointmentId }) {
  const [refer, setRefer] = useState(false);
  const [hospitalName, setHospitalName] = useState('');
  const [ambulanceUsed, setAmbulanceUsed] = useState(false);
  const [cashlessFormUsed, setCashlessFormUsed] = useState(false);
  const [cashlessFormDocument, setCashlessFormDocument] = useState(null);
  const [cashlessFormDocumentUrl, setCashlessFormDocumentUrl] = useState('');
  const [referralFormUsed, setReferralFormUsed] = useState(false);
  const [referralFormDocument, setReferralFormDocument] = useState(null);
  const [referralFormDocumentUrl, setReferralFormDocumentUrl] = useState('');
  const [staffWent, setStaffWent] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [isEditing, setIsEditing] = useState(true);
  const token = localStorage.getItem('token');
  const apiBaseUrl = useApi();
  useEffect(() => {
    const fetchReferralData = async () => {
      if (!appointmentId) return;

      setIsLoading(true);
      setError('');
      try {
        const res = await axios.get(`${apiBaseUrl}/api/tests/${appointmentId}`, {
          params: { token }
        });

        if (res.data.hospitalReferral) {
          const referral = res.data.hospitalReferral;
          const hasReferral = referral.refer || false;
          setRefer(hasReferral);
          setHospitalName(referral.hospitalName || '');
          setAmbulanceUsed(referral.ambulanceUsed || false);
          setCashlessFormUsed(referral.cashlessFormUsed || false);
          setCashlessFormDocumentUrl(referral.cashlessFormDocumentUrl || '');
          setReferralFormUsed(referral.referralFormUsed || Boolean(referral.referralFormDocumentUrl));
          setReferralFormDocumentUrl(referral.referralFormDocumentUrl || '');
          setStaffWent(referral.staffWent || '');
          setRemarks(referral.remarks || '');
          if (hasReferral || referral.hospitalName) {
            setSaved(true);
            setIsEditing(false);
          }
        }
      } catch (err) {
        console.error('Error fetching referral data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReferralData();
  }, [appointmentId, token]);

  const fetchExistingData = async () => {
    const res = await axios.get(`${apiBaseUrl}/api/tests/${appointmentId}`, {
      params: { token }
    });
    return {
      tests: res.data.tests || [],
      certificate: res.data.certificate || { issued: false }
    };
  };

  const handleSave = async () => {
    setError('');
    setSaveMessage('');
    setIsSaving(true);
    try {
      const existingData = await fetchExistingData();
      const formData = new FormData();
      formData.append('token', token);
      formData.append('appointmentId', appointmentId);
      formData.append('tests', JSON.stringify(existingData.tests));
      formData.append('hospitalReferral', JSON.stringify({
        refer,
        hospitalName,
        ambulanceUsed,
        cashlessFormUsed,
        cashlessFormDocumentUrl: cashlessFormDocument ? '' : cashlessFormDocumentUrl,
        referralFormUsed,
        referralFormDocumentUrl: referralFormDocument ? '' : referralFormDocumentUrl,
        staffWent,
        remarks
      }));
      formData.append('certificate', JSON.stringify(existingData.certificate));

      if (cashlessFormDocument) {
        formData.append('cashlessFormDocument', cashlessFormDocument);
      } else if (cashlessFormDocumentUrl) {
        formData.append('existingCashlessFormDocumentUrl', cashlessFormDocumentUrl);
      }

      if (referralFormDocument) {
        formData.append('referralFormDocument', referralFormDocument);
      } else if (referralFormDocumentUrl) {
        formData.append('existingReferralFormDocumentUrl', referralFormDocumentUrl);
      }

      const response = await axios.post(`${apiBaseUrl}/api/tests/save`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (!response.data.success) {
        throw new Error('The server did not confirm that the referral was saved.');
      }

      setSaved(true);
      setSaveMessage('Referral saved successfully.');
      setIsEditing(false);
      setCashlessFormDocument(null);
      setCashlessFormDocumentUrl(response.data.test?.hospitalReferral?.cashlessFormDocumentUrl || '');
      setReferralFormDocument(null);
      setReferralFormDocumentUrl(response.data.test?.hospitalReferral?.referralFormDocumentUrl || '');
    } catch (err) {
      console.error('Error saving referral:', err);
      setError('Failed to save referral. ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this hospital referral?')) return;

    setError('');
    setIsLoading(true);
    try {
      const existingData = await fetchExistingData();
      const response = await axios.post(`${apiBaseUrl}/api/tests/save`, {
        token,
        appointmentId,
        tests: existingData.tests,
        hospitalReferral: {
          refer: false,
          hospitalName: '',
          ambulanceUsed: false,
          cashlessFormUsed: false,
          cashlessFormDocumentUrl: '',
          referralFormUsed: false,
          referralFormDocumentUrl: '',
          staffWent: '',
          remarks: ''
        },
        certificate: existingData.certificate
      });

      if (response.data.success) {
        setRefer(false);
        setHospitalName('');
        setAmbulanceUsed(false);
        setCashlessFormUsed(false);
        setCashlessFormDocument(null);
        setCashlessFormDocumentUrl('');
        setReferralFormUsed(false);
        setReferralFormDocument(null);
        setReferralFormDocumentUrl('');
        setStaffWent('');
        setRemarks('');
        setSaved(false);
        setIsEditing(true);
      }
    } catch (err) {
      console.error('Error deleting referral:', err);
      setError('Failed to delete referral. ' + (err.response?.data?.error || ''));
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return null;

  if (!isEditing && refer) {
    return (
      <div className="hospital-referral view-mode">
        <div className="referral-summary-card">
          <div className="summary-header">
            <h5 className="summary-title">Hospital Referral Details</h5>
            <span className="saved-badge">Saved</span>
          </div>

          <div className="summary-grid">
            <div className="summary-item"><span className="summary-label">Hospital Name:</span><span className="summary-value">{hospitalName || 'Not specified'}</span></div>
            <div className="summary-item"><span className="summary-label">Ambulance:</span><span className="summary-value">{ambulanceUsed ? 'Yes' : 'No'}</span></div>
            <div className="summary-item"><span className="summary-label">Cashless Form:</span><span className="summary-value">{cashlessFormUsed ? 'Yes' : 'No'}</span></div>
            <div className="summary-item"><span className="summary-label">Referral Form:</span><span className="summary-value">{referralFormUsed ? 'Yes' : 'No'}</span></div>
            <div className="summary-item full-width"><span className="summary-label">Staff / Accompanying:</span><span className="summary-value">{staffWent || 'None'}</span></div>
            {cashlessFormUsed && cashlessFormDocumentUrl && (
              <div className="summary-item full-width">
                <span className="summary-label">Cashless Form Document:</span>
                <CashlessDocumentPreview url={cashlessFormDocumentUrl} />
              </div>
            )}
            {referralFormUsed && referralFormDocumentUrl && (
              <div className="summary-item full-width">
                <span className="summary-label">Referral Form Document:</span>
                <CashlessDocumentPreview url={referralFormDocumentUrl} />
              </div>
            )}
            {remarks && <div className="summary-item full-width"><span className="summary-label">Remarks:</span><span className="summary-value remarks-box">{remarks}</span></div>}
          </div>

          <div className="view-mode-actions">
            <button className="edit-referral-btn" onClick={() => { setIsEditing(true); setSaveMessage(''); setError(''); }}>Edit Referral</button>
            <button className="delete-referral-btn" onClick={handleDelete}>Delete Referral</button>
          </div>
          {saveMessage && <p className="referral-save-status success" aria-live="polite">{saveMessage}</p>}
          {error && <p className="error-message" style={{ margin: '0 1.2rem 1.2rem' }}>{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="hospital-referral">
      <div className="referral-fields">
        <div className="form-group">
          <label>Hospital Name:</label>
          <input type="text" value={hospitalName} onChange={(e) => { setHospitalName(e.target.value); setRefer(true); }} placeholder="Enter hospital name" />
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input type="checkbox" checked={ambulanceUsed} onChange={(e) => { setAmbulanceUsed(e.target.checked); setRefer(true); }} />
            <span>Ambulance Used</span>
          </label>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={cashlessFormUsed}
              onChange={(e) => {
                setCashlessFormUsed(e.target.checked);
                if (!e.target.checked) {
                  setCashlessFormDocument(null);
                  setCashlessFormDocumentUrl('');
                }
                setRefer(true);
              }}
            />
            <span>Cashless Form</span>
          </label>
        </div>

        {cashlessFormUsed && (
          <div className="form-group full-width">
            <DocumentUpload
              label="Upload Cashless Form Document"
              previewUrl={cashlessFormDocumentUrl}
              selectedFile={cashlessFormDocument}
              onFileChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setCashlessFormDocument(file);
                setCashlessFormDocumentUrl(URL.createObjectURL(file));
                setRefer(true);
              }}
              onRemove={() => {
                setCashlessFormDocument(null);
                setCashlessFormDocumentUrl('');
              }}
              isEditing
            />
          </div>
        )}

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={referralFormUsed}
              onChange={(e) => {
                setReferralFormUsed(e.target.checked);
                if (!e.target.checked) {
                  setReferralFormDocument(null);
                  setReferralFormDocumentUrl('');
                }
                setRefer(true);
              }}
            />
            <span>Referral Form</span>
          </label>
        </div>

        {referralFormUsed && (
          <div className="form-group full-width">
            <DocumentUpload
              label="Upload Referral Form Document"
              previewUrl={referralFormDocumentUrl}
              selectedFile={referralFormDocument}
              onFileChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setReferralFormDocument(file);
                setReferralFormDocumentUrl(URL.createObjectURL(file));
                setRefer(true);
              }}
              onRemove={() => {
                setReferralFormDocument(null);
                setReferralFormDocumentUrl('');
              }}
              isEditing
            />
          </div>
        )}

        <div className="form-group">
          <label>Staff Went (Name/Details):</label>
          <input type="text" value={staffWent} onChange={(e) => { setStaffWent(e.target.value); setRefer(true); }} placeholder="Enter staff name or details" />
        </div>

        <div className="form-group full-width">
          <label>Remarks:</label>
          <textarea value={remarks} onChange={(e) => { setRemarks(e.target.value); setRefer(true); }} placeholder="Enter any additional remarks" rows={3} />
        </div>

        <div className="form-actions">
          <button className="save-referral-btn" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : saved ? 'Update Referral' : 'Save Referral'}
          </button>
          <button
            className="cancel-edit-btn"
            disabled={isSaving}
            onClick={() => {
              setSaveMessage('');
              setError('');
              if (saved || hospitalName) {
                setIsEditing(false);
              } else {
                setHospitalName('');
                setAmbulanceUsed(false);
                setCashlessFormUsed(false);
                setCashlessFormDocument(null);
                setCashlessFormDocumentUrl('');
                setReferralFormUsed(false);
                setReferralFormDocument(null);
                setReferralFormDocumentUrl('');
                setStaffWent('');
                setRemarks('');
                setRefer(false);
              }
            }}
          >
            Cancel
          </button>
        </div>
        <p
          className={`referral-save-status${error ? ' error' : saveMessage ? ' success' : ''}${isSaving ? ' saving' : ''}`}
          aria-live="polite"
          aria-atomic="true"
        >
          {isSaving ? 'Saving referral...' : saveMessage || error || '\u00a0'}
        </p>
      </div>
    </div>
  );
}

export default DoctorHospitalReferral;
