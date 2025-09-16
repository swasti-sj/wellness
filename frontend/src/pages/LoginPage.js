import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LoginPage.css';
import InitialProfileForm from './patient/InitialProfileForm';

export default function LoginPage() {
  const [token, setToken] = useState('');
  const [firstLogin, setFirstLogin] = useState(false);
  const navigate = useNavigate();

  // Add 'login-page' class to body only on this page
  useEffect(() => {
    document.body.classList.add('login-page');

    // Clean up when component unmounts
    return () => {
      document.body.classList.remove('login-page');
    };
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('token');
    const isFirstLogin = urlParams.get('firstLogin') === 'true';
    const role = urlParams.get('role');

    if (accessToken) {
      setToken(accessToken);
      setFirstLogin(isFirstLogin);
      localStorage.setItem('token', accessToken);
      if (role) localStorage.setItem('role', role);
    }
  }, []);

  useEffect(() => {
    const role = localStorage.getItem('role');
    if (token && !firstLogin) {
      if (role === 'doctor') navigate('/docdashboard');
      else navigate('/dashboard');
    }
  }, [token, firstLogin, navigate]);

  if (firstLogin) return <InitialProfileForm />;

  if (!token) {
    return (
      <div className="login-container-horizontal">
        <div className="login-left">
          <img src="/college-logo.png" alt="College Logo" className="login-logo" />
          <h2>WELCOME BACK!</h2>
          <p className="login-subtitle" style={{color: 'black'}}>
            Access your dashboard and manage your profile. Login as a Student or Doctor to continue.
          </p>
        </div>

        <div className="login-right">
          <a
            href="http://localhost:5000/auth/google?role=patient"
            className="google-btn pat"
          >
            Login as Patient
          </a>
          <a
            href="http://localhost:5000/auth/google?role=doctor"
            className="google-btn doc"
          >
            Login as Doctor
          </a>
        </div>
      </div>
    );
  }

  return <div>Redirecting...</div>;
}
