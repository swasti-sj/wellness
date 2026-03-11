import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import DoctorNote from "./DoctorNote";
import DoctorPrescription from "./DoctorPrescription";
import DoctorVitals from "./DoctorVitals";
import DoctorHospitalReferral from "./DoctorHospitalReferral";
import DoctorCertificate from "./DoctorCertificate";
import SelectedTestsSummary from "./SelectedTestsSummary";
import HospitalReferralSummary from "./HospitalReferralSummary";
import CertificateSummary from "./CertificateSummary";
import "../../styles/doctor/PatientHistory.css";
import Fuse from "fuse.js"; // 🔹 added for fuzzy search

export default function PatientHistory({ apiBaseUrl }) {
  const [appointments, setAppointments] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]); // 🔹 list of unique patients
  const [expandedPatient, setExpandedPatient] = useState(null); // which patient is opened
  const [expandedAppt, setExpandedAppt] = useState(null); // which appointment is expanded
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const token = localStorage.getItem("token");
  const location = useLocation();
  const navigate = useNavigate();

  const [query, setQuery] = useState(location.state?.query || "");
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (location.state?.query) {
      searchPatient(); // auto search if navigated with a query
    }
  }, [location.state]);

  // 🔹 Fetch doctors list
  useEffect(() => {
    if (!apiBaseUrl) return;
    const fetchDoctors = async () => {
      try {
        const res = await axios.get(`${apiBaseUrl}/doctors/list`);
        setDoctors(res.data || []);
      } catch (err) {
        console.error("Error fetching doctors:", err);
      }
    };
    fetchDoctors();
  }, [apiBaseUrl]);

  // 🔹 Main search logic with fuzzy matching
  const searchPatient = async () => {
    if (!query.trim()) return alert("Enter patient name, roll number or email");
    setIsLoading(true);
    setError("");

    try {
      const res = await axios.get(`${apiBaseUrl}/appointments/patient-history`, {
        params: { token, query },
      });

      const appts = res.data?.appointments || [];
      setAppointments(appts);

      // ✅ Extract unique patients
      const seen = new Set();
      const uniquePatients = [];
      appts.forEach((a) => {
        const u = a.user;
        if (u && !seen.has(u._id)) {
          seen.add(u._id);
          uniquePatients.push(u);
        }
      });

      // ✅ Apply fuzzy search
      const fuse = new Fuse(uniquePatients, {
        keys: ["name", "email", "roll"],
        threshold: 0.3, // more tolerance = fuzzier search
      });

      const result =
        query.trim().length > 0 ? fuse.search(query).map((r) => r.item) : uniquePatients;

      setFilteredPatients(result);

      if (result.length === 0) setError("No records found for this patient.");
    } catch (err) {
      console.error("Failed to fetch patient history:", err);
      setError("Failed to load patient list.");
    } finally {
      setIsLoading(false);
    }
  };

  // 🔹 Expand/collapse patient details
  const togglePatientExpand = (id) => {
    setExpandedPatient(expandedPatient === id ? null : id);
    setExpandedAppt(null);
  };

  const toggleApptExpand = (id) => {
    setExpandedAppt(expandedAppt === id ? null : id);
  };

  const handleSubmitReferral = async (e, patientInfo) => {
    e.preventDefault();
    if (!patientInfo?.email || !doctorId)
      return alert("Please ensure patient email and a doctor are selected.");

    try {
      const response = await axios.post(`${apiBaseUrl}/referrals`, {
        token,
        patientEmail: patientInfo.email,
        referredDoctorId: doctorId,
        reason,
      });

      if (response.data?.success) {
        alert("Patient referred successfully!");
        setDoctorId("");
        setReason("");
      } else {
        alert(response.data?.error || "Referral failed");
      }
    } catch (err) {
      console.error("Failed to send referral:", err);
      alert("Failed to refer patient: " + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="patient-history-container">

      <h2 className="appointment-title">Patient History</h2>

      {/* --- Patient Search --- */}
      <form
  className="appointment-form"
  style={{ marginBottom: "1.5rem" }}
  onSubmit={(e) => {
    e.preventDefault(); // prevent page reload
    searchPatient();
  }}
>
  <input
    type="text"
    className="appointment-select"
    placeholder="Enter patient name, roll number or email"
    value={query}
    onChange={(e) => setQuery(e.target.value)}
  />
  <button
    type="submit"
    className="appointment-btn"
    disabled={isLoading}
  >
    {isLoading ? "Searching..." : "Search"}
  </button>
</form>


      {error && <p className="error-text">{error}</p>}

      {/* --- Fuzzy Matched Patient Cards --- */}
      <div className="appointment-list">
        {filteredPatients.map((p) => (
          <div key={p._id} className="appointment-card">
            <div
              className="appointment-summary"
              onClick={() => togglePatientExpand(p._id)}
            >
              <h3>{p.name}</h3>
              <p>
                <b>Email:</b> {p.email} | <b>Roll:</b> {p.roll || "N/A"} |{" "}
                <b>Sex:</b> {p.sex || "N/A"}
              </p>
              <p className="expand-hint">
                {expandedPatient === p._id ? "▲ Hide Details" : "▼ More Details"}
              </p>
            </div>

            {/* --- Expand patient details + appointments --- */}
            {expandedPatient === p._id && (
              <div className="expanded-details">
                <div className="patient-summary">
                  <p><b>Phone:</b> {p.phone || "N/A"}</p>
                  <p><b>Age:</b> {p.age || "N/A"}</p>
                </div>

                {/* Referral form */}
                <form
                  className="referral-section"
                  onSubmit={(e) => handleSubmitReferral(e, p)}
                >
                  <h4>Refer Patient</h4>
                  <select
                    value={doctorId}
                    onChange={(e) => setDoctorId(e.target.value)}
                    required
                  >
                    <option value="">Select Doctor</option>
                    {doctors.map((doc) => (
                      <option key={doc._id} value={doc._id}>
                        {doc.name} ({doc.specialization})
                      </option>
                    ))}
                  </select>

                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for referral (optional)"
                  />

                  <button type="submit" className="primary-btn">
                    Refer
                  </button>
                </form>

                {/* Appointment history for that patient */}
                <h4 className="section-title">Appointments</h4>
                {appointments
                  .filter((a) => a.user?._id === p._id)
                  .map((a) => (
                    <div key={a._id} className="appointment-card inner-card">
                      <div
                        className="appointment-summary"
                        onClick={() => toggleApptExpand(a._id)}
                      >
                        <h5>
                          {new Date(a.startDateTime).toLocaleDateString()} |{" "}
                          {new Date(a.startDateTime).toLocaleTimeString()}
                        </h5>
                        <p>
                          <b>Mode:</b> {a.mode || "Walk-in"} |{" "}
                          <b>Last Medication:</b> {a.lastMedication || "Not recorded"}
                        </p>
                        <p className="expand-hint">
                          {expandedAppt === a._id ? "▲ Collapse" : "▼ Expand"}
                        </p>
                      </div>

                      {expandedAppt === a._id && (
                        <div className="expanded-details">
                          <div className="medications-section">
                            <h5>Previous Medications</h5>
                            {a.medications?.length ? (
                              a.medications.map((m, i) => (
                                <div key={i} className="medication-item">
                                  <input type="checkbox" id={`${a._id}-med-${i}`} />
                                  <label htmlFor={`${a._id}-med-${i}`}>{m}</label>
                                </div>
                              ))
                            ) : (
                              <p className="no-data">No previous medications</p>
                            )}
                          </div>

                          <div className="expand-columns">
                            <DoctorNote appointmentId={a._id} />
                            <DoctorPrescription
                              appointmentId={a._id}
                              patientId={a.user?._id}
                            />
                            <DoctorVitals
                              appointmentId={a._id}
                              patientId={a.user?._id}
                              apiBaseUrl={apiBaseUrl}
                            />
                            {/* Test Summary Section - displays tests like in appointment */}
                            <SelectedTestsSummary 
                              appointmentId={a._id}
                              onEditClick={() => navigate(`/docdashboard/test-page?appointmentId=${a._id}&patientId=${a.user?._id}&returnUrl=/docdashboard/history`)}
                            />
                            {/* Hospital Referral Summary Section - displays referral data */}
                            <HospitalReferralSummary 
                              appointmentId={a._id}
                            />
                            {/* Certificate Summary Section - displays certificate data */}
                            <CertificateSummary 
                              appointmentId={a._id}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
