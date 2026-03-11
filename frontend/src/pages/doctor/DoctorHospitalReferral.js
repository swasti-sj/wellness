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
          setRefer(res.data.hospitalReferral.refer || false);
          setHospitalName(res.data.hospitalReferral.hospitalName || '');
          setAmbulanceUsed(res.data.hospitalReferral.ambulanceUsed || false);
          setStaffWent(res.data.hospitalReferral.staffWent || '');
          setRemarks(res.data.hospitalReferral.remarks || '');
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
        alert('Hospital referral saved successfully!');
      }
    } catch (err) {
      console.error('Error saving referral:', err);
      setError('Failed to save referral. ' + (err.response?.data?.error || ''));
    }
  };

  if (isLoading) return <p>Loading referral data...</p>;

  return (
    <div className="hospital-referral">
      <h4>Refer to Hospital</h4>
      {error && <p className="error-message">{error}</p>}

      <div className="refer-option">
        <label className="refer-label">
          <input
            type="checkbox"
            checked={refer}
            onChange={(e) => setRefer(e.target.checked)}
          />
          <span className="refer-text">Refer to Hospital</span>
        </label>
      </div>

      {refer && (
        <div className="referral-fields">
          <div className="form-group">
            <label>Hospital Name:</label>
            <input
              type="text"
              value={hospitalName}
              onChange={(e) => setHospitalName(e.target.value)}
              placeholder="Enter hospital name"
            />
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={ambulanceUsed}
                onChange={(e) => setAmbulanceUsed(e.target.checked)}
              />
              <span>Ambulance Used</span>
            </label>
          </div>

          <div className="form-group">
            <label>Staff Went (Name/Details):</label>
            <input
              type="text"
              value={staffWent}
              onChange={(e) => setStaffWent(e.target.value)}
              placeholder="Enter staff name or details"
            />
          </div>

          <div className="form-group">
            <label>Remarks:</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter any additional remarks"
              rows={3}
            />
          </div>
        </div>
      )}

      <button className="save-referral-btn" onClick={handleSave}>
        Save Referral
      </button>
      
      {saved && <span className="save-confirmation">✓ Saved</span>}
    </div>
  );
}

export default DoctorHospitalReferral;
