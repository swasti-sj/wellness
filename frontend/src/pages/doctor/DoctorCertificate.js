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

        if (res.data.certificate) {
          setIssued(res.data.certificate.issued || false);
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
  };

  const handleRemoveCertificate = () => {
    setIssued(false);
    setCertificateImage(null);
    setPreviewUrl('');
    setClinicalDetails('');
    setSaved(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
      
      let imageUrl = previewUrl;

      // If there's a new image file, upload it first (simplified - stores as base64 for now)
      // In production, you'd upload to cloud storage and get the URL
      if (certificateImage && !previewUrl.startsWith('http')) {
        // Keep the base64 image for now
        imageUrl = previewUrl;
      }

      const response = await axios.post('http://localhost:5000/api/tests/save', {
        token,
        appointmentId,
        tests: existingData.tests,
        hospitalReferral: existingData.hospitalReferral,
        certificate: {
          issued,
          imageUrl: imageUrl || '',
          clinicalDetails
        }
      });

      if (response.data.success) {
        setSaved(true);
        setCertificateImage(null); // Reset after save
        alert('Certificate saved successfully!');
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
      ) : (
        <div className="certificate-form">
          <div className="certificate-header">
            <span className="issued-badge">✓ Certificate Issued</span>
            <button className="remove-certificate-btn" onClick={handleRemoveCertificate}>
              Remove
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
                <img src={previewUrl} alt="Certificate preview" />
              </div>
            </div>
          )}

          <button 
            className="save-certificate-btn" 
            onClick={handleSave}
            disabled={uploading}
          >
            {uploading ? 'Saving...' : 'Save Certificate'}
          </button>
          
          {saved && <span className="save-confirmation">✓ Saved</span>}
        </div>
      )}
    </div>
  );
}

export default DoctorCertificate;
