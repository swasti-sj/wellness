import React, { useState, useEffect } from 'react';
import axios from 'axios';

function HospitalReferralSummary({ appointmentId }) {
  const [referral, setReferral] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchReferral = async () => {
      if (!appointmentId) return;
      
      try {
        const res = await axios.get(`http://localhost:5000/api/tests/${appointmentId}`, {
          params: { token }
        });
        
        if (res.data.hospitalReferral) {
          setReferral(res.data.hospitalReferral);
        }
      } catch (err) {
        console.error('Error fetching referral:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReferral();
  }, [appointmentId, token]);

  if (isLoading) return null;
  
  if (!referral || !referral.refer) {
    return (
      <div className="hospital-referral-summary">
        <div className="summary-header">
          <h4>Hospital Referral</h4>
        </div>
        <p className="no-data">Not referred to hospital</p>
      </div>
    );
  }

  return (
    <div className="hospital-referral-summary">
      <div className="summary-header">
        <h4>Hospital Referral</h4>
      </div>
      
      <div className="referral-details">
        <p><strong>Hospital:</strong> {referral.hospitalName || 'N/A'}</p>
        <p><strong>Ambulance Used:</strong> {referral.ambulanceUsed ? 'Yes' : 'No'}</p>
        <p><strong>Staff Went:</strong> {referral.staffWent || 'N/A'}</p>
        <p><strong>Remarks:</strong> {referral.remarks || 'N/A'}</p>
      </div>
    </div>
  );
}

export default HospitalReferralSummary;
