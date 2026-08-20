import { React, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Outlet,
  useNavigate,
  useLocation,
} from "react-router-dom";
import AdminInitialProfile from "./pages/admin/AdminInitialProfile";
import LoginPage from "./pages/LoginPage";
import AdminDashboardLayout from "./pages/admin/AdminDashboardLayout";
import OthersLoginPage from "./pages/OthersLoginPage";
import Dashboard from "./pages/patient/Dashboard";
import Navbar from "./pages/patient/Navbar";
import PharmacistAnalytics from './pages/pharmacist/PharmacistAnalytics';
// PharmacistAdvancedAnalytics and PharmacistMedicineWiseAnalytics merged into PharmacistAnalytics
// import InitialAdminProfileForm from "./pages/admin/InitialAdminProfileForm";
import AdminNavbar from "./pages/admin/AdminNavbar";
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
import ReceptionistProfilePage from "./pages/receptionist/ReceptionistProfilePage";
import NurseDashboard from "./pages/nurse/NurseDashboard";
import NurseNavbar from "./pages/nurse/NurseNavbar";
import NurseProfilePage from "./pages/nurse/NurseProfilePage";
import NurseAppointment from "./pages/nurse/NurseAppointment";
import NursePatientHistory from "./pages/nurse/NursePatientHistory";
import InitialNurseProfileForm from "./pages/nurse/InitialNurseProfileForm";
import PharmacistDashboard from "./pages/pharmacist/PharmacistDashboard";
import PharmacistMedicineStock from "./pages/pharmacist/PharmacistMedicineStock";
import PharmacistIssuanceRecords from "./pages/pharmacist/PharmacistIssuanceRecords";
import InitialPharmacistProfileForm from "./pages/pharmacist/InitialPharmacistProfileForm";
import PharmacistNavbar from "./pages/pharmacist/PharmacistNavbar";
import PharmacistProfile from "./pages/pharmacist/PharmacistProfile";
import PharmacistStockHistory from './pages/pharmacist/PharmacistStockHistory';
import AdminAuditPage from './pages/admin/AdminAuditPage';
import AdminProfilePage from "./pages/admin/AdminProfilePage";
import { useApi } from './context/ApiContext';



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
function LayoutWithPharmNavbar({ children }) {
  return (
    <>
      <PharmacistNavbar />
      <div style={{ paddingTop: "80px" }}>
        {children}
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

function LayoutWithNurseNavbar() {
  console.log("🛠️ Rendering LayoutWithNurseNavbar");
  return (
    <>
      <NurseNavbar />
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

function NurseDashboardLayout() {
  return (
    <>
      <LayoutWithNurseNavbar /> {/* renders child nurse pages */}
    </>
  );
}
function LoginRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  const decodeJwtRole = (token) => {
    try {
      const segments = token.split('.');
      if (segments.length < 2) return null;
      const payload = JSON.parse(atob(segments[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.role || null;
    } catch (error) {
      console.warn('Unable to decode JWT role', error);
      return null;
    }
  };

  useEffect(() => {
    console.log("🔄 LoginRedirect useEffect triggered");
    console.log("📍 Current location:", location);
    console.log("📍 Location search string:", location.search);

    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    const firstLogin = params.get("firstLogin");
    const queryRole = params.get("role");
    const jwtRole = token ? decodeJwtRole(token) : null;
    const role = queryRole || jwtRole;

    console.log("🔑 Extracted login data →", { token, firstLogin, queryRole, jwtRole, role });

    if (token) {
      console.log("✅ Token found. Saving to localStorage...");
      localStorage.setItem("token", token);
      if (role) {
        localStorage.setItem("role", role);
      }
    } else {
      console.warn("⚠️ No token found in query params");
    }

    if (firstLogin === "true") {
      console.log("🆕 First login detected. Role =", role);

      if (role === "doctor") {
        console.log("👨‍⚕️ Redirecting doctor to initial doctor profile setup...");
        navigate("/docdashboard/initial-doctor-profile", { replace: true });
      } else if (role === "receptionist") {
        console.log("👩‍💼 Redirecting receptionist to initial profile setup...");
        navigate("/receptionist/initial-profile", { replace: true });
      } else if (role === "nurse") {
        console.log("👩‍⚕️ Redirecting nurse to initial profile setup...");
        navigate("/nurse/initial-profile", { replace: true });
      } else if (role === "pharmacist") {
        console.log("💊 Redirecting pharmacist to initial profile setup...");
        navigate("/pharmacist/initial-profile", { replace: true });
      } else if (role === "admin") {
        console.log("🛡️ Redirecting admin to audit page...");
        navigate("/admin/initial-profile", { replace: true });
      } else {
        console.log("🙋 Redirecting patient to initial profile setup...");
        navigate("/patdashboard/initial-profile", { replace: true });
      }
    } else {
      console.log("➡️ Not first login. Redirecting to dashboard...");
      if (role === "doctor") {
        navigate("/docdashboard", { replace: true });
      } else if (role === "receptionist") {
        navigate("/receptionist-dashboard", { replace: true });
      } else if (role === "nurse") {
        navigate("/nurse-dashboard", { replace: true });
      } else if (role === "pharmacist") {
        navigate("/pharmacist-dashboard", { replace: true });
      } else if (role === "admin") {
        navigate("/admin-dashboard/audit", { replace: true });
      } else {
        navigate("/patdashboard", { replace: true });
      }
    }
  }, [location, navigate]);

  return <p>Redirecting...</p>;
}

function App() {
  console.log("🚀 App component rendering");
  const apiBaseUrl = useApi();

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
        {/* Admin routes */}
        {/* <Route path="/admin/audit" element={<AdminAuditPage />} /> */}
        <Route
          path="/admin/initial-profile"
          element={<AdminInitialProfile />}
        />
        <Route path="/admin-dashboard" element={<AdminDashboardLayout />}>
          <Route path="audit" element={<AdminAuditPage />} />
          <Route path="profile" element={<AdminProfilePage apiBaseUrl={apiBaseUrl} />} />
        </Route>

        {/* Patient routes */}
        <Route path="/dashboard" element={<PatientDashboardLayout />}>
          <Route index element={<Dashboard />} />{" "}
          {/* default patient dashboard */}
          <Route path="book" element={<AppointmentBooking />} />
          <Route path="history" element={<VisitHistory />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        {/* Patient dashboard */}
        <Route path="/patdashboard" element={<PatientDashboardLayout />}>
          <Route index element={<Dashboard />} />
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
        <Route path="/receptionist-dashboard/profile" element={<ReceptionistProfilePage />} />
        <Route path="/receptionist/initial-profile" element={<InitialReceptionistProfileForm />} />

        {/* Nurse routes */}
        <Route path="/nurse-dashboard" element={<NurseDashboardLayout />}>
          <Route index element={<NurseDashboard />} />
          <Route path="appointments" element={<NurseAppointment apiBaseUrl={apiBaseUrl} />} />
          <Route path="nurse-profile" element={<NurseProfilePage apiBaseUrl={apiBaseUrl} />} />
          <Route path="patient-history" element={<NursePatientHistory apiBaseUrl={apiBaseUrl} />} />
          <Route path="test-page" element={<TestPage apiBaseUrl={apiBaseUrl} />} />
        </Route>
        <Route path="/nurse/initial-profile" element={<InitialNurseProfileForm />} />

        {/* Pharmacist routes */}
        <Route path="/pharmacist-dashboard" element={<LayoutWithPharmNavbar><PharmacistDashboard /></LayoutWithPharmNavbar>} />
        <Route path="/pharmacist-dashboard/stock" element={<LayoutWithPharmNavbar><PharmacistMedicineStock /></LayoutWithPharmNavbar>} />
        <Route path="/pharmacist-dashboard/records" element={<LayoutWithPharmNavbar><PharmacistIssuanceRecords /></LayoutWithPharmNavbar>} />
        <Route path="/pharmacist-dashboard/analytics" element={<LayoutWithPharmNavbar><PharmacistAnalytics /></LayoutWithPharmNavbar>} />
        {/* Legacy routes redirect to unified analytics */}
        <Route path="/pharmacist-dashboard/medicine-analytics" element={<LayoutWithPharmNavbar><PharmacistAnalytics /></LayoutWithPharmNavbar>} />
        <Route path="/pharmacist-dashboard/advanced-analytics" element={<LayoutWithPharmNavbar><PharmacistAnalytics /></LayoutWithPharmNavbar>} />
        <Route path="/pharmacist-dashboard/stock-history" element={<LayoutWithPharmNavbar><PharmacistStockHistory /></LayoutWithPharmNavbar>} />
        <Route path="/pharmacist-dashboard/profile" element={<LayoutWithPharmNavbar><PharmacistProfile /></LayoutWithPharmNavbar>} />
        <Route path="/pharmacist/initial-profile" element={<InitialPharmacistProfileForm />} />
      </Routes>
    </Router>
  );
}

export default App;
