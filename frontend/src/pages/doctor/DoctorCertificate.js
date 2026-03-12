import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import '../../styles/doctor/DoctorCertificate.css';

function DoctorCertificate({ appointmentId }) {
  const [issued, setIssued] = useState(false);
  const [clinicalDetails, setClinicalDetails] = useState('');
  const [certificateImage, setCertificateImage] = useState(null);
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
          if (res.data.certificate.imageUrl) {
            setPreviewUrl(res.data.certificate.imageUrl);
          }
        }
      } catch (err) {
        console.error('Error fetching certificate data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCertificateData();
  }, [appointmentId, token]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCertificateImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleIssueCertificate = () => {
    setIssued(true);
    setSaved(false);
    setIsEditing(true);
  };

  const handleRemoveCertificate = async () => {
    if (window.confirm("Are you sure you want to delete this certificate?")) {
      setIssued(false);
      setCertificateImage(null);
      setPreviewUrl('');
      setClinicalDetails('');
      setSaved(false);
      setIsEditing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Auto-save the deletion to backend
      setUploading(true);
      try {
        const existingData = await fetchExistingData();
        const formData = new FormData();
        formData.append('token', token);
        formData.append('appointmentId', appointmentId);
        formData.append('tests', JSON.stringify(existingData.tests));
        formData.append('hospitalReferral', JSON.stringify(existingData.hospitalReferral));
        formData.append('certificate', JSON.stringify({
          issued: false,
          clinicalDetails: ''
        }));
        await axios.post('http://localhost:5000/api/tests/save', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } catch (err) {
        console.error('Error removing certificate:', err);
      } finally {
        setUploading(false);
      }
    }
  };

  // Fetch existing tests and hospital referral data to preserve when saving
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

  const handleSave = async () => {
    setError('');
    setUploading(true);
    try {
      // First fetch existing data to preserve tests and hospital referral
      const existingData = await fetchExistingData();

      const formData = new FormData();
      formData.append('token', token);
      formData.append('appointmentId', appointmentId);
      formData.append('tests', JSON.stringify(existingData.tests));
      formData.append('hospitalReferral', JSON.stringify(existingData.hospitalReferral));
      formData.append('certificate', JSON.stringify({
        issued,
        clinicalDetails
      }));

      if (certificateImage && !previewUrl.startsWith('http')) {
        formData.append('certificateImage', certificateImage);
      } else if (previewUrl) {
        formData.append('existingImageUrl', previewUrl);
      }

      const response = await axios.post('http://localhost:5000/api/tests/save', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        setSaved(true);
        setIsEditing(false);
        setCertificateImage(null); // Reset after save
        if (response.data.test?.certificate?.imageUrl) {
          setPreviewUrl(response.data.test.certificate.imageUrl);
        }
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
      <h4>Medical Certificate</h4>
      {error && <p className="error-message">{error}</p>}

      {!issued ? (
        <div className="issue-certificate-section">
          <button className="issue-certificate-btn" onClick={handleIssueCertificate}>
            Issue Certificate
          </button>
        </div>
      ) : saved && !isEditing ? (
        <div className="certificate-preview-page">
          <div className="certificate-header">
            <span className="issued-badge">✓ Certificate Issued</span>
            <div className="certificate-actions">
              <button className="edit-certificate-btn" onClick={() => setIsEditing(true)}>
                Edit
              </button>
              <button className="remove-certificate-btn" onClick={handleRemoveCertificate}>
                Delete
              </button>
            </div>
          </div>
          
          <div className="preview-content">
            {clinicalDetails && (
              <div className="preview-details">
                <label>Clinical Details:</label>
                <p className="clinical-text">{clinicalDetails}</p>
              </div>
            )}
            
            {previewUrl && (
              <div className="certificate-preview">
                <label>Certificate Image:</label>
                <div className="preview-container view-only">
                  <img src={previewUrl.startsWith('/') ? `http://localhost:5000${previewUrl}` : previewUrl} alt="Certificate preview" />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="certificate-form">
          <div className="certificate-header">
            <span className="form-title">{saved ? "Edit Certificate" : "New Certificate"}</span>
            <button className="cancel-edit-btn" onClick={() => {
              if (saved) {
                setIsEditing(false);
              } else {
                setIssued(false);
                setCertificateImage(null);
                setPreviewUrl('');
                setClinicalDetails('');
              }
            }}>
              Cancel
            </button>
          </div>

          <div className="form-group">
            <label>Clinical Details:</label>
            <textarea
              value={clinicalDetails}
              onChange={(e) => setClinicalDetails(e.target.value)}
              placeholder="Enter clinical details..."
              rows={4}
            />
          </div>

          <div className="form-group">
            <label>Upload Certificate Image:</label>
            <div className="file-upload-container">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="file-input"
              />
              <div className="upload-instructions">
                <span>Click to upload or drag and drop</span>
                <span className="file-types">PNG, JPG, JPEG</span>
              </div>
            </div>
          </div>

          {previewUrl && (
            <div className="certificate-preview">
              <label>Preview:</label>
              <div className="preview-container">
                <img src={previewUrl.startsWith('/') && !certificateImage ? `http://localhost:5000${previewUrl}` : previewUrl} alt="Certificate preview" />
              </div>
            </div>
          )}

          <div className="form-actions">
            <button
              className="save-certificate-btn"
              onClick={handleSave}
              disabled={uploading}
            >
              {uploading ? 'Saving...' : 'Save Certificate'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DoctorCertificate;