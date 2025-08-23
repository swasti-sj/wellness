import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import LoginPage from './pages/patient/LoginPage';
import Dashboard from './pages/patient/Dashboard';
import AppointmentBooking from './pages/patient/AppointmentBooking';
import InitialProfile from './pages/patient/InitialProfileForm';
import ProfilePage from './pages/patient/ProfilePage';

function LoginRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    const firstLogin = params.get("firstLogin");

    if (token) {
      localStorage.setItem("token", token);
    }

    if (firstLogin === "true") {
      navigate("/initial-profile");
    } else {
      navigate("/dashboard");
    }
  }, [location, navigate]);

  return <p>Redirecting...</p>;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginRedirect />} /> 
        <Route path="/initial-profile" element={<InitialProfile />} />
        <Route path="/dashboard" element={<Dashboard />}>
          <Route path="book" element={<AppointmentBooking />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
