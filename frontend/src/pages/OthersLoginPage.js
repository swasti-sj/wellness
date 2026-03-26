import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LoginPage.css';

export default function OthersLoginPage() {
  const navigate = useNavigate();

  // Add 'login-page' class to body only on this page
  useEffect(() => {
    document.body.classList.add('login-page');

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
        <a
          href="http://localhost:5000/auth/google?role=receptionist"
          className="google-btn pat"
        >
          Login as Receptionist
        </a>
        <a
          href="http://localhost:5000/auth/google?role=nurse"
          className="google-btn doc"
        >
          Login as Nurse
        </a>
        <a
          href="http://localhost:5000/auth/google?role=pharmacist"
          className="google-btn others"
        >
          Login as Pharmacist
        </a>
      </div>
    </div>
  );
}