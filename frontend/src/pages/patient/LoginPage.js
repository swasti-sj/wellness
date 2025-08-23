import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import InitialProfileForm from './InitialProfileForm'; 

export default function LoginPage() {
  const [token, setToken] = useState('');
  const [firstLogin, setFirstLogin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('token');
    const isFirstLogin = urlParams.get('firstLogin') === 'true';

    if (accessToken) {
      setToken(accessToken);
      setFirstLogin(isFirstLogin);
      localStorage.setItem('token', accessToken);
    }
  }, []);

  useEffect(() => {
    if (token && !firstLogin) {
      navigate('/dashboard');
    }
  }, [token, firstLogin, navigate]);

  if (!token) {
    // Not logged in → show Google login button
    return (
      <div style={{ maxWidth: '500px', margin: '100px auto', textAlign: 'center' }}>
        <a
          href="http://localhost:5000/auth/google"
          style={{
            background: '#4285F4',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '5px',
            textDecoration: 'none'
          }}
        >
          Login with Google
        </a>
      </div>
    );
  }

  if (firstLogin) {
    return <InitialProfileForm />;
  }

  return <div>Redirecting...</div>;
}
