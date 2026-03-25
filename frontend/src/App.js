import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Outlet,
  useNavigate,
  useLocation,
} from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import OthersLoginPage from "./pages/OthersLoginPage";
import Dashboard from "./pages/patient/Dashboard";
import Navbar from "./pages/patient/Navbar";
import "./App.css";
import AppointmentBooking from "./pages/patient/AppointmentBooking";
import InitialProfile from "./pages/patient/InitialProfileForm";
import ProfilePage from "./pages/patient/ProfilePage";
import InitialDoctorProfile from "./pages/doctor/InitialDoctorProfileForm";
import DoctorNote from "./pages/doctor/DoctorNote";
import DoctorReferral from "./pages/doctor/DoctorReferral";
import PatientHistory from "./pages/doctor/PatientHistory";
import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import DoctorProfilePage from "./pages/doctor/DoctorProfilePage";
import DoctorAppointment from "./pages/doctor/DoctorAppointment";
import DoctorNavbar from "./pages/doctor/DoctorNavbar";
import VisitHistory from "./pages/patient/VisitHistory";
import TestPage from "./pages/doctor/TestPage";
import ReceptionistDashboard from "./pages/receptionist/ReceptionistDashboard";
import InitialReceptionistProfileForm from "./pages/receptionist/InitialReceptionistProfileForm";
import NurseDashboard from "./pages/nurse/NurseDashboard";
import InitialNurseProfileForm from "./pages/nurse/InitialNurseProfileForm";
import PharmacistDashboard from "./pages/pharmacist/PharmacistDashboard";
import InitialPharmacistProfileForm from "./pages/pharmacist/InitialPharmacistProfileForm";
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
function LayoutWithDocNavbar() {
  console.log("🛠️ Rendering LayoutWithDocNavbar");
  return (
    <>
      <DoctorNavbar />
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
    </>
  );
}

function DoctorDashboardLayout() {
  return (
    <>
      <LayoutWithDocNavbar /> {/* renders child doctor pages */}
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
      } else if (role === "receptionist") {
        console.log("👩‍💼 Redirecting receptionist to initial profile setup...");
        navigate("/receptionist/initial-profile");
      } else if (role === "nurse") {
        console.log("👩‍⚕️ Redirecting nurse to initial profile setup...");
        navigate("/nurse/initial-profile");
      } else if (role === "pharmacist") {
        console.log("💊 Redirecting pharmacist to initial profile setup...");
        navigate("/pharmacist/initial-profile");
      } else {
        console.log("🙋 Redirecting patient to initial profile setup...");
        navigate("/patdashboard/initial-profile");
      }
    } else {
      console.log("➡️ Not first login. Redirecting to dashboard...");
      if (role === "doctor") {
        navigate("/docdashboard");
      } else if (role === "receptionist") {
        navigate("/receptionist-dashboard");
      } else if (role === "nurse") {
        navigate("/nurse-dashboard");
      } else if (role === "pharmacist") {
        navigate("/pharmacist-dashboard");
      } else {
        navigate("/patdashboard");
      }
    }
  }, [location, navigate]);

  return <p>Redirecting...</p>;
}

function App() {
  console.log("🚀 App component rendering");
  const [apiBaseUrl, setApiBaseUrl] = useState("");

  useEffect(() => {
    // Try to fetch runtime config from backend. If it fails or the
    // backend doesn't return a usable apiBaseUrl, fall back to a
    // sensible default so the app can render.
    fetch("http://localhost:5000/config")
      .then((res) => res.json())
      .then((cfg) => {
        console.log("Config from backend:", cfg);
        const base =
          cfg && cfg.apiBaseUrl ? cfg.apiBaseUrl : "http://localhost:5000";
        if (!cfg || !cfg.apiBaseUrl) {
          console.warn("Config missing apiBaseUrl; using fallback", base);
        }
        setApiBaseUrl(base);
      })
      .catch((err) => {
        console.error(
          "Failed to load config, using fallback http://localhost:5000",
          err
        );
        setApiBaseUrl("http://localhost:5000");
      });
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
        <Route path="/others-login" element={<OthersLoginPage />} />
        <Route path="/login" element={<LoginRedirect />} />
        {/* Patient routes */}
        <Route path="/dashboard" element={<PatientDashboardLayout />}>
          <Route index element={<Dashboard />} />{" "}
          {/* default patient dashboard */}
          <Route path="book" element={<AppointmentBooking />} />
          <Route path="history" element={<VisitHistory />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        {/* Patient onboarding without navbar */}
        <Route
          path="/patdashboard/initial-profile"
          element={<InitialProfile />}
        />

        {/* Doctor routes */}
        <Route path="/docdashboard" element={<DoctorDashboardLayout />}>
          <Route index element={<DoctorDashboard />} />{" "}
          {/* default doctor dashboard */}
          <Route
            path="notes"
            element={<DoctorNote apiBaseUrl={apiBaseUrl} />}
          />
          <Route
            path="referral"
            element={<DoctorReferral apiBaseUrl={apiBaseUrl} />}
          />
          <Route
            path="doctor-appointment"
            element={<DoctorAppointment apiBaseUrl={apiBaseUrl} />}
          />
          <Route
            path="doctor-profile"
            element={<DoctorProfilePage apiBaseUrl={apiBaseUrl} />}
          />
          <Route
            path="history"
            element={<PatientHistory apiBaseUrl={apiBaseUrl} />}
          />
          <Route
            path="test-page"
            element={<TestPage apiBaseUrl={apiBaseUrl} />}
          />
        </Route>
        {/* Doctor onboarding without navbar */}
        <Route
          path="/docdashboard/initial-doctor-profile"
          element={<InitialDoctorProfile apiBaseUrl={apiBaseUrl} />}
        />

        {/* Pharmacist routes */}
        <Route path="/receptionist-dashboard" element={<ReceptionistDashboard />} />
        <Route path="/receptionist/initial-profile" element={<InitialReceptionistProfileForm />} />

        <Route path="/nurse-dashboard" element={<NurseDashboard />} />
        <Route path="/nurse/initial-profile" element={<InitialNurseProfileForm />} />

        <Route path="/pharmacist-dashboard" element={<PharmacistDashboard />} />
        <Route path="/pharmacist/initial-profile" element={<InitialPharmacistProfileForm />} />
      </Routes>
    </Router>
  );
}

export default App;
