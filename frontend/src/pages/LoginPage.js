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
    console.log('LoginPage: Component mounted.');
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('token');
    const isFirstLogin = urlParams.get('firstLogin') === 'true';

    console.log('LoginPage: URL params processed.', { accessToken, isFirstLogin });

    if (accessToken) {
      console.log('LoginPage: Access token found, updating state.');
      setToken(accessToken);
      setFirstLogin(isFirstLogin);
      localStorage.setItem('token', accessToken);
      // Store role in localStorage
      const role = urlParams.get('role');
      if (role) {
        localStorage.setItem('role', role);
      }
    } else {
      console.log('LoginPage: No access token found in URL.');
    }
  }, []);

  useEffect(() => {
    console.log('LoginPage: Token or firstLogin state changed.', { token, firstLogin });
    const urlParams = new URLSearchParams(window.location.search);
    const role = urlParams.get('role');
    if (token && !firstLogin) {
      console.log('LoginPage: Token exists and not first login, navigating to dashboard.');
      if(role==='doctor'){
        console.log('LoginPage: Role is doctor, navigating to doctor dashboard.');
        navigate('/docdashboard');
      }
      else{
        console.log('LoginPage: Role is patient, navigating to patient dashboard.');
        navigate('/dashboard');
      }
    } else {
      console.log('LoginPage: Conditions for dashboard navigation not met.');
    }
  }, [token, firstLogin, navigate]);

  if (firstLogin) {
    const urlParams = new URLSearchParams(window.location.search);
    const role = urlParams.get('role');
    console.log('LoginPage: First login detected, checking role.', { role });
    if (role === 'doctor') {
      console.log('LoginPage: Role is doctor, navigating to initial doctor profile.');
      navigate('/initial-doctor-profile');
      return <div>Redirecting to doctor profile...</div>;
    }
    
    console.log('LoginPage: Role is not doctor, rendering InitialProfileForm.');
    return <InitialProfileForm />;
  }

  if (!token) {
    console.log('LoginPage: No token, rendering login buttons.');
    // Not logged in → show Google login buttons
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

  console.log('LoginPage: Token exists, rendering redirecting message.');
  return <div>Redirecting...</div>;
}
