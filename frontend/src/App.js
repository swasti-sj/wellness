import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';

import LoginPage from './pages/patient/LoginPage';
import Dashboard from './pages/patient/Dashboard';
import Trial from './pages/doctor/trial';
import './App.css';
import AppointmentBooking from './pages/patient/AppointmentBooking';
import InitialProfile from './pages/patient/InitialProfileForm';
import ProfilePage from './pages/patient/ProfilePage';
import InitialDoctorProfile from './pages/doctor/InitialDoctorProfileForm';

function LoginRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.log("🔄 LoginRedirect useEffect triggered");

    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    const firstLogin = params.get("firstLogin");
    const role = params.get("role");

    console.log("🔑 Extracted query params →", { token, firstLogin, role });

    if (token) {
      console.log("✅ Token found. Saving to localStorage...");
      localStorage.setItem("token", token);
    } else {
      console.warn("⚠️ No token found in query params");
    }

    if (firstLogin === "true") {
      console.log("🆕 First login detected. Role =", role);

      if (role === "doctor") {
        console.log("👨‍⚕️ Redirecting doctor to initial doctor profile setup...");
        navigate("/initial-doctor-profile");
      } else {
        console.log("🙋 Redirecting patient to initial profile setup...");
        navigate("/initial-profile");
      }
    } else {
      console.log("➡️ Not first login. Redirecting to dashboard...");
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
        <Route path="/docdashboard" element={<Trial />} />
        <Route path="/initial-doctor-profile" element={<InitialDoctorProfile />} />
      </Routes>
    </Router>
  );
}

export default App;
