import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import '../../styles/doctor/DoctorCertificate.css';
import DocumentUpload from './documentUpload';

function DoctorCertificate({ appointmentId }) {
  const [issued, setIssued] = useState(false);
  const [clinicalDetails, setClinicalDetails] = useState('');
  const [certificateFile, setCertificateFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchCertificateData = async () => {
      if (!appointmentId) return;

      setIsLoading(true);
      setError('');
      try {
        const res = await axios.get(`http://localhost:5000/api/tests/${appointmentId}`, {
          params: { token }
        });

        if (res.data.certificate && res.data.certificate.issued) {
          setIssued(true);
          setSaved(true);
          setIsEditing(false);
          setClinicalDetails(res.data.certificate.clinicalDetails || '');
          setPreviewUrl(res.data.certificate.imageUrl || '');
        }
      } catch (err) {
        console.error('Error fetching certificate data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCertificateData();
  }, [appointmentId, token]);

  const fetchExistingData = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/tests/${appointmentId}`, {
        params: { token }
      });
      return {
        tests: res.data.tests || [],
        hospitalReferral: res.data.hospitalReferral || { refer: false }
      };
    } catch (err) {
      console.error('Error fetching existing data:', err);
      return { tests: [], hospitalReferral: { refer: false } };
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCertificateFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveCertificate = async () => {
    if (!window.confirm('Are you sure you want to delete this certificate?')) return;

    setIssued(false);
    setCertificateFile(null);
    setPreviewUrl('');
    setClinicalDetails('');
    setSaved(false);
    setIsEditing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';

    setUploading(true);
    try {
      const existingData = await fetchExistingData();
      const formData = new FormData();
      formData.append('token', token);
      formData.append('appointmentId', appointmentId);
      formData.append('tests', JSON.stringify(existingData.tests));
      formData.append('hospitalReferral', JSON.stringify(existingData.hospitalReferral));
      formData.append('certificate', JSON.stringify({ issued: false, clinicalDetails: '' }));
      await axios.post('http://localhost:5000/api/tests/save', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    } catch (err) {
      console.error('Error removing certificate:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setError('');
    setUploading(true);
    try {
      const existingData = await fetchExistingData();
      const formData = new FormData();
      formData.append('token', token);
      formData.append('appointmentId', appointmentId);
      formData.append('tests', JSON.stringify(existingData.tests));
      formData.append('hospitalReferral', JSON.stringify(existingData.hospitalReferral));
      formData.append('certificate', JSON.stringify({ issued, clinicalDetails }));

      if (certificateFile) {
        formData.append('certificateImage', certificateFile);
      } else if (previewUrl) {
        formData.append('existingImageUrl', previewUrl);
      }

      const response = await axios.post('http://localhost:5000/api/tests/save', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        setSaved(true);
        setIsEditing(false);
        setCertificateFile(null);
        setPreviewUrl(response.data.test?.certificate?.imageUrl || '');
      }
    } catch (err) {
      console.error('Error saving certificate:', err);
      setError('Failed to save certificate. ' + (err.response?.data?.error || ''));
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) return <p>Loading certificate data...</p>;

  return (
    <div className="doctor-certificate">
      {error && <p className="error-message">{error}</p>}

      {!issued ? (
        <div className="issue-certificate-section">
          <button className="issue-certificate-btn" onClick={() => { setIssued(true); setSaved(false); setIsEditing(true); }}>
            Issue Certificate
          </button>
        </div>
      ) : saved && !isEditing ? (
        <div className="certificate-preview-page">
          <div className="certificate-header">
            <span className="issued-badge">Certificate issued</span>
            <div className="certificate-actions">
              <button className="edit-certificate-btn" onClick={() => setIsEditing(true)}>Edit</button>
              <button className="remove-certificate-btn" onClick={handleRemoveCertificate}>Delete</button>
            </div>
          </div>

          <div className="preview-content">
            {clinicalDetails && (
              <div className="preview-details">
                <label>Clinical Details</label>
                <p className="clinical-text">{clinicalDetails}</p>
              </div>
            )}

            <DocumentUpload
              label="Certificate Document"
              previewUrl={previewUrl}
              selectedFile={certificateFile}
              isEditing={false}
              emptyMessage="No certificate uploaded"
            />
          </div>
        </div>
      ) : (
        <div className="certificate-form">
          <div className="certificate-header">
            <span className="form-title">{saved ? 'Edit Certificate' : 'New Certificate'}</span>
            <button
              className="cancel-edit-btn"
              onClick={() => {
                if (saved) {
                  setIsEditing(false);
                } else {
                  setIssued(false);
                  setCertificateFile(null);
                  setPreviewUrl('');
                  setClinicalDetails('');
                }
              }}
            >
              Cancel
            </button>
          </div>

          <div className="form-group">
            <label>Clinical Details</label>
            <textarea
              value={clinicalDetails}
              onChange={(e) => setClinicalDetails(e.target.value)}
              placeholder="Enter clinical details"
              rows={4}
            />
          </div>

          <DocumentUpload
            label="Upload Certificate Document"
            previewUrl={previewUrl}
            selectedFile={certificateFile}
            onFileChange={handleFileChange}
            onRemove={() => {
              setCertificateFile(null);
              setPreviewUrl('');
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            uploading={uploading}
            isEditing
          />

          <div className="form-actions">
            <button className="save-certificate-btn" onClick={handleSave} disabled={uploading}>
              {uploading ? 'Saving...' : 'Save Certificate'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DoctorCertificate;
