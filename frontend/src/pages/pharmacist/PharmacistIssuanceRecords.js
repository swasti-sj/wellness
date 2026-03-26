import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../../styles/pharmacist/PharmacistDashboard.css';

export default function PharmacistIssuanceRecords() {
  const [issuances, setIssuances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');

  const apiBaseUrl = 'http://localhost:5000/api';

  useEffect(() => {
    loadIssuances();
  }, []);

  const loadIssuances = async () => {
    setLoading(true);
    setError('');
    try {
      const issRes = await axios.get(`${apiBaseUrl}/issuances`, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setIssuances(issRes.data.issuances || []);
    } catch (e) {
      setError('Failed to load issuances. Check backend server and your login.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="pharm-loading">⏳ Loading issuance records...</div>;
  if (error) return <div className="pharm-error">⚠ {error} <button onClick={loadIssuances}>Retry</button></div>;

  return (
    <div className="pharm-layout">
      <div className="pharm-root">
        <div className="pharm-header">
          <h1 className="pharm-title"> Issuance Records</h1>
          <button className="pharm-btn pharm-btn-primary" onClick={loadIssuances}>
            🔄 Refresh
          </button>
        </div>

      {/* Issuance Records */}
      <div className="pharm-records-section pharm-section">
          <div className="pharm-section-header">
            <span>📝 Medicine Issuance History</span>
            <span>({issuances.length})</span>
          </div>
        <div className="pharm-table-container">
          <table className="pharm-table">
            <thead>
              <tr>
                <th>Patient Name</th>
                <th>Patient Email</th>
                <th>Medicine</th>
                <th>Qty</th>
                <th>Date Issued</th>
                <th>Doctor</th>
              </tr>
            </thead>
            <tbody>
              {issuances.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#7A6890' }}>
                    No issuance records yet
                  </td>
                </tr>
              ) : (
                issuances.map((iss) => (
                  <tr key={iss._id}>
                    <td><strong>{iss.patient?.name || 'N/A'}</strong></td>
                    <td>{iss.patient?.email || 'N/A'}</td>
                    <td>{iss.medicine?.name || 'N/A'}</td>
                    <td style={{ textAlign: 'center' }}><strong>{iss.quantityIssued}</strong></td>
                    <td>{new Date(iss.issuedDate).toLocaleDateString()}</td>
                    <td>{iss.doctor?.name || 'N/A'}</td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
      </div>
      </div>
    </div>
  );
}
