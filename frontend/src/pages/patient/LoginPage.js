import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import InitialProfileForm from './InitialProfileForm';
import '../../styles/LoginPage.css';

export default function LoginPage() {
  const [token, setToken] = useState('');
  const [firstLogin, setFirstLogin] = useState(false);
  const navigate = useNavigate();

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
    if (token && !firstLogin) {
      console.log('LoginPage: Token exists and not first login, navigating to dashboard.');
      navigate('/dashboard');
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
      <div className="login-container">
        <h2>Login</h2>
        <a href="http://localhost:5000/auth/google?role=patient">
          <button>Login as Patient</button>
        </a>
        <a href="http://localhost:5000/auth/google?role=doctor">
          <button>Login as Doctor</button>
        </a>
      </div>
    );
  }

  console.log('LoginPage: Token exists, rendering redirecting message.');
  return <div>Redirecting...</div>;
}
