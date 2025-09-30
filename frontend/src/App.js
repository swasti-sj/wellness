import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, useNavigate, useLocation } from 'react-router-dom';

import LoginPage from './pages/LoginPage';
import Dashboard from './pages/patient/Dashboard';
import Navbar from "./pages/patient/Navbar";
import './App.css';
import AppointmentBooking from './pages/patient/AppointmentBooking';
import InitialProfile from './pages/patient/InitialProfileForm';
import ProfilePage from './pages/patient/ProfilePage';
import InitialDoctorProfile from './pages/doctor/InitialDoctorProfileForm';
import DoctorNote from './pages/doctor/DoctorNote';
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import DoctorProfilePage from './pages/doctor/DoctorProfilePage';
import DoctorAppointment from './pages/doctor/DoctorAppointment';

// Layout wrapper with Navbar
function LayoutWithNavbar() {
  console.log("🛠️ Rendering LayoutWithNavbar");
  return (
    <>
      <Navbar />
      <div style={{ paddingTop: "60px" }}>
        <Outlet />
      </div>
    </>
  );
}

function PatientDashboardLayout() {
  return (
    <>
      <LayoutWithNavbar />
      <Outlet /> {/* renders child patient pages */}
    </>
  );
}

function DoctorDashboardLayout() {
  return (
    <>
      <Outlet /> {/* renders child doctor pages */}
    </>
  );
}
function LoginRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.log("🔄 LoginRedirect useEffect triggered");
    console.log("📍 Current location:", location);
    console.log("📍 Location search string:", location.search);

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
        navigate("/docdashboard/initial-doctor-profile");
      } else {
        console.log("🙋 Redirecting patient to initial profile setup...");
        navigate("/initial-profile");
      }
    } else {
      console.log("➡️ Not first login. Redirecting to dashboard...");
      if (role==="doctor") {navigate("/docdashboard");}
      else {navigate("/patdashboard");}
    }
  }, [location, navigate]);

  return <p>Redirecting...</p>;
}

function App() {
  console.log("🚀 App component rendering");
  const [apiBaseUrl, setApiBaseUrl] = useState('');

  useEffect(() => {
    fetch('http://localhost:5000/config')
      .then(res => res.json())
      .then(cfg => {
        console.log('Config from backend:', cfg);
        setApiBaseUrl(cfg.apiBaseUrl);
      })
      .catch(err => console.error('Failed to load config:', err));
  }, []);

  if (!apiBaseUrl) {
    return <div>Loading Application...</div>;
  }

  return (
    <Router>
      {console.log("🛣️ Defining routes")}
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginRedirect />} />
        {/* Patient routes */}
        <Route path="/patdashboard" element={<PatientDashboardLayout />}>
          <Route index element={<Dashboard />} /> {/* default patient dashboard */}
          <Route path="book" element={<AppointmentBooking />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        {/* Patient onboarding without navbar */}
        <Route path="/patdashboard/initial-profile" element={<InitialProfile />} />

        {/* Doctor routes */}
        <Route path="/docdashboard" element={<DoctorDashboardLayout />}>
          <Route index element={<DoctorDashboard />} /> {/* default doctor dashboard */}
          <Route path="notes" element={<DoctorNote apiBaseUrl={apiBaseUrl} />} />
          <Route path="doctor-appointment" element={<DoctorAppointment apiBaseUrl={apiBaseUrl} />} />
          <Route path="doctor-profile" element={<DoctorProfilePage apiBaseUrl={apiBaseUrl} />} />
        </Route>
        {/* Doctor onboarding without navbar */}
        <Route
          path="/docdashboard/initial-doctor-profile"
          element={<InitialDoctorProfile apiBaseUrl={apiBaseUrl} />}
        />
      </Routes>
    </Router>
  );
}

export default App;
