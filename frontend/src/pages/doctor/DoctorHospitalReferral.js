import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../../styles/doctor/DoctorHospitalReferral.css';

function DoctorHospitalReferral({ appointmentId }) {
  const [refer, setRefer] = useState(false);
  const [hospitalName, setHospitalName] = useState('');
  const [ambulanceUsed, setAmbulanceUsed] = useState(false);
  const [staffWent, setStaffWent] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(true);

  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchReferralData = async () => {
      if (!appointmentId) return;

      setIsLoading(true);
      setError('');
      try {
        const res = await axios.get(`http://localhost:5000/api/tests/${appointmentId}`, {
          params: { token }
        });

        if (res.data.hospitalReferral) {
          const hasReferral = res.data.hospitalReferral.refer || false;
          setRefer(hasReferral);
          setHospitalName(res.data.hospitalReferral.hospitalName || '');
          setAmbulanceUsed(res.data.hospitalReferral.ambulanceUsed || false);
          setStaffWent(res.data.hospitalReferral.staffWent || '');
          setRemarks(res.data.hospitalReferral.remarks || '');

          // If a referral already exists, default to view mode
          if (hasReferral || res.data.hospitalReferral.hospitalName) {
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

  // Fetch existing tests and certificate data to preserve when saving
  const fetchExistingData = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/tests/${appointmentId}`, {
        params: { token }
      });
      return {
        tests: res.data.tests || [],
        certificate: res.data.certificate || { issued: false }
      };
    } catch (err) {
      console.error('Error fetching existing data:', err);
      return { tests: [], certificate: { issued: false } };
    }
  };

  const handleSave = async () => {
    setError('');
    try {
      // First fetch existing data to preserve tests and certificate
      const existingData = await fetchExistingData();

      const response = await axios.post('http://localhost:5000/api/tests/save', {
        token,
        appointmentId,
        tests: existingData.tests,
        hospitalReferral: {
          refer,
          hospitalName,
          ambulanceUsed,
          staffWent,
          remarks
        },
        certificate: existingData.certificate
      });

      if (response.data.success) {
        setSaved(true);
        setIsEditing(false);
        alert('Hospital referral saved successfully!');
      }
    } catch (err) {
      console.error('Error saving referral:', err);
      setError('Failed to save referral. ' + (err.response?.data?.error || ''));
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this hospital referral?')) return;

    setError('');
    setIsLoading(true);
    try {
      const existingData = await fetchExistingData();

      const response = await axios.post('http://localhost:5000/api/tests/save', {
        token,
        appointmentId,
        tests: existingData.tests,
        hospitalReferral: {
          refer: false,
          hospitalName: '',
          ambulanceUsed: false,
          staffWent: '',
          remarks: ''
        },
        certificate: existingData.certificate
      });

      if (response.data.success) {
        setRefer(false);
        setHospitalName('');
        setAmbulanceUsed(false);
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

  // ── VIEW MODE (Read-Only Summary) ──
  if (!isEditing && refer) {
    return (
      <div className="hospital-referral view-mode">
        <div className="referral-summary-card">
          <div className="summary-header">
            <h5 className="summary-title">Hospital Referral Details</h5>
            <span className="saved-badge">✓ Saved</span>
          </div>

          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">Hospital Name:</span>
              <span className="summary-value">{hospitalName || 'Not specified'}</span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Ambulance:</span>
              <span className="summary-value">
                {ambulanceUsed ? (
                  <span className="badge-yes">Yes</span>
                ) : (
                  <span className="badge-no">No</span>
                )}
              </span>
            </div>

            <div className="summary-item full-width">
              <span className="summary-label">Staff / Accompanying:</span>
              <span className="summary-value">{staffWent || 'None'}</span>
            </div>

            {remarks && (
              <div className="summary-item full-width">
                <span className="summary-label">Remarks:</span>
                <span className="summary-value remarks-box">{remarks}</span>
              </div>
            )}
          </div>

          <div className="view-mode-actions">
            <button className="edit-referral-btn" onClick={() => setIsEditing(true)}>
              Edit Referral
            </button>
            <button className="delete-referral-btn" onClick={handleDelete}>
              Delete Referral
            </button>
          </div>
          {error && <p className="error-message" style={{ margin: "0 1.2rem 1.2rem" }}>{error}</p>}
        </div>
      </div>
    );
  }

  const handleCancelEdit = () => {
    if (saved || hospitalName) {
      // If we have saved data, just go back to view mode
      setIsEditing(false);
    } else {
      // If no saved data, clear the form
      setHospitalName('');
      setAmbulanceUsed(false);
      setStaffWent('');
      setRemarks('');
      setRefer(false);
    }
  };

  // ── EDIT MODE (Form) ──
  return (
    <div className="hospital-referral">
      <div className="referral-fields">
        <div className="form-group">
          <label>Hospital Name:</label>
          <input
            type="text"
            value={hospitalName}
            onChange={(e) => {
              setHospitalName(e.target.value);
              setRefer(true); // Automatically set refer to true when typing
            }}
            placeholder="Enter hospital name"
          />
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={ambulanceUsed}
              onChange={(e) => {
                setAmbulanceUsed(e.target.checked);
                setRefer(true); // Automatically set refer to true when checking
              }}
            />
            <span>Ambulance Used</span>
          </label>
        </div>

        <div className="form-group">
          <label>Staff Went (Name/Details):</label>
          <input
            type="text"
            value={staffWent}
            onChange={(e) => {
              setStaffWent(e.target.value);
              setRefer(true); // Automatically set refer to true when typing
            }}
            placeholder="Enter staff name or details"
          />
        </div>

        <div className="form-group full-width">
          <label>Remarks:</label>
          <textarea
            value={remarks}
            onChange={(e) => {
              setRemarks(e.target.value);
              setRefer(true); // Automatically set refer to true when typing
            }}
            placeholder="Enter any additional remarks"
            rows={3}
          />
        </div>

        <div className="form-actions">
          <button className="save-referral-btn" onClick={handleSave}>
            Save Referral
          </button>
          <button className="cancel-edit-btn" onClick={handleCancelEdit}>
            Cancel
          </button>
        </div>
        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  );
}

export default DoctorHospitalReferral;