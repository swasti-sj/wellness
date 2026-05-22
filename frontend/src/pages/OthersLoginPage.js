import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LoginPage.css';
import { useApi } from '../context/ApiContext';

export default function OthersLoginPage() {
  const navigate = useNavigate();
  const apiBaseUrl = useApi();
  const [error, setError] = useState('');

  // Add 'login-page' class to body only on this page
  useEffect(() => {
    document.body.classList.add('login-page');

    const query = new URLSearchParams(window.location.search);
    const authError = query.get('error');
    if (authError === 'admin_not_authorized') {
      setError('Admin login is restricted to authorized email accounts only.');
    }

    // Clean up when component unmounts
    return () => {
      document.body.classList.remove('login-page');
    };
  }, []);

  const handleBackClick = () => {
    navigate('/');
  };

  return (
    <div className="login-container-horizontal">
      <div className="login-left">
        <button className="back-btn" onClick={handleBackClick}>
          ← Back to Main Login
        </button>
        <img src="/college-logo.png" alt="College Logo" className="login-logo" />
        <h2>OTHERS LOGIN</h2>
        <p className="login-subtitle" style={{color: 'black'}}>
          Select your role to access the dashboard.
        </p>
      </div>

      <div className="login-right">
        {error && <div className="login-error-message">{error}</div>}
        <a
          href={`${apiBaseUrl}/api/auth/google?role=receptionist`}
          className="google-btn pat"
        >
          Login as Receptionist
        </a>
        <a
          href={`${apiBaseUrl}/api/auth/google?role=nurse`}
          className="google-btn doc"
        >
          Login as Nurse
        </a>
        <a
          href={`${apiBaseUrl}/api/auth/google?role=pharmacist`}
          className="google-btn others"
        >
          Login as Pharmacist
        </a>
        <a
          href={`${apiBaseUrl}/api/auth/google?role=admin`}
          className="google-btn others"
          style={{ backgroundColor: '#4A90E2' }}
        >
          Login as Admin
        </a>
      </div>
    </div>
  );
}