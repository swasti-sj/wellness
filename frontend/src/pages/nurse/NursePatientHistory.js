import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import DoctorNote from "../doctor/DoctorNote";
import DoctorPrescription from "../doctor/DoctorPrescription";
import DoctorVitals from "../doctor/DoctorVitals";
import DoctorHospitalReferral from "../doctor/DoctorHospitalReferral";
import DoctorCertificate from "../doctor/DoctorCertificate";
import SelectedTestsSummary from "../doctor/SelectedTestsSummary";
import "../../styles/doctor/PatientHistory.css";
import Fuse from "fuse.js";

const SECTIONS = [
  { key: "vitals",   icon: "💓", label: "Case Sheet"    },
  { key: "notes",    icon: "📝", label: "Notes"         },
  { key: "rx",       icon: "💊", label: "Prescription"  },
  { key: "tests",    icon: "🧪", label: "Tests"         },
  { key: "referral", icon: "🏥", label: "Hosp. Referral"},
  { key: "cert",     icon: "📋", label: "Certificate"   },
];

export default function NursePatientHistory({ apiBaseUrl }) {
  const [appointments, setAppointments] = useState([]);
  const [recentPatients, setRecentPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [expandedPatient, setExpandedPatient] = useState(null);
  const [expandedAppt, setExpandedAppt] = useState(null);
  const [openSection, setOpenSection] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [query, setQuery] = useState("");

  const token = localStorage.getItem("token");
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state?.query) setQuery(location.state.query);
  }, [location.state]);

  useEffect(() => {
    if (!apiBaseUrl) return;
    const fetchRecent = async () => {
      try {
        const res = await axios.get(`${apiBaseUrl}/appointments/patient-history`, {
          params: { token, query: "", limit: 5 },
        });
        const appts = res.data?.appointments || [];
        const seen = new Set();
        const unique = [];
        appts.forEach(a => {
          if (a.user && !seen.has(a.user._id)) {
            seen.add(a.user._id);
            unique.push(a.user);
          }
        });
        setRecentPatients(unique.slice(0, 5));
      } catch (err) {
        console.error("Error fetching recent patients:", err);
      }
    };
    fetchRecent();
  }, [apiBaseUrl, token]);

  const searchPatient = async (overrideQuery) => {
    const q = overrideQuery ?? query;
    if (!q.trim()) return alert("Enter patient name, roll number or email");
    setIsLoading(true);
    setError("");
    setHasSearched(true);
    try {
      const res = await axios.get(`${apiBaseUrl}/appointments/patient-history`, {
        params: { token, query: q },
      });
      const appts = res.data?.appointments || [];
      setAppointments(appts);

      const seen = new Set();
      const patients = [];
      appts.forEach(a => {
        if (a.user && !seen.has(a.user._id)) {
          seen.add(a.user._id);
          patients.push({ ...a.user, appointmentCount: appts.filter(ap => ap.user._id === a.user._id).length });
        }
      });
      setFilteredPatients(patients);
    } catch (err) {
      console.error("Error searching patients:", err);
      setError(err.response?.data?.message || "Error fetching patient history");
      setAppointments([]);
      setFilteredPatients([]);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePatient = (patientId) => {
    setExpandedPatient(expandedPatient === patientId ? null : patientId);
    setExpandedAppt(null);
  };

  const toggleAppt = (apptId) => {
    setExpandedAppt(expandedAppt === apptId ? null : apptId);
  };

  const toggleSection = (apptId, section) => {
    const key = `${apptId}-${section}`;
    setOpenSection(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div style={{ padding: "2rem 1rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1rem" }}>Patient History</h1>

      <div style={{
        background: "#f9f9f9",
        padding: "1.5rem",
        borderRadius: "8px",
        marginBottom: "2rem"
      }}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          <input
            type="text"
            placeholder="Search: Patient Name, Roll #, or Email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && searchPatient()}
            style={{
              flex: 1,
              padding: "0.8rem",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "1rem",
            }}
          />
          <button
            onClick={() => searchPatient()}
            style={{
              padding: "0.8rem 1.5rem",
              background: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            Search
          </button>
        </div>

        {recentPatients.length > 0 && !hasSearched && (
          <div style={{ marginTop: "1rem" }}>
            <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.5rem" }}>Recent Patients:</p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {recentPatients.map(patient => (
                <button
                  key={patient._id}
                  onClick={() => {
                    setQuery(patient.name);
                    searchPatient(patient.name);
                  }}
                  style={{
                    padding: "0.5rem 1rem",
                    background: "#e9ecef",
                    border: "1px solid #dee2e6",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  {patient.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {isLoading && <p>Loading patient data...</p>}
      {error && <p style={{ color: "red", marginBottom: "1rem" }}>Error: {error}</p>}

      {hasSearched && filteredPatients.length > 0 && (
        <div>
          {filteredPatients.map(patient => (
            <div key={patient._id} style={{ marginBottom: "1.5rem", border: "1px solid #ddd", borderRadius: "8px", overflow: "hidden" }}>
              <div
                onClick={() => togglePatient(patient._id)}
                style={{
                  padding: "1rem",
                  background: "#f5f5f5",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <h3 style={{ margin: "0 0 0.3rem 0" }}>{patient.name}</h3>
                  <p style={{ margin: 0, fontSize: "0.9rem", color: "#666" }}>
                    Email: {patient.email} | Roll: {patient.roll} | Age: {patient.age} | Sex: {patient.sex}
                  </p>
                </div>
                <span style={{ fontSize: "1.2rem" }}>{expandedPatient === patient._id ? "▼" : "▶"}</span>
              </div>

              {expandedPatient === patient._id && (
                <div style={{ padding: "1rem", background: "white" }}>
                  {appointments
                    .filter(a => a.user._id === patient._id)
                    .map(appt => (
                      <div key={appt._id} style={{ marginBottom: "1rem", border: "1px solid #e0e0e0", borderRadius: "4px" }}>
                        <div
                          onClick={() => toggleAppt(appt._id)}
                          style={{
                            padding: "0.8rem",
                            background: "#f9f9f9",
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <p style={{ margin: 0, fontWeight: 500 }}>
                              {new Date(appt.startDateTime).toLocaleDateString()} - {new Date(appt.startDateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </p>
                            <p style={{ margin: "0.3rem 0 0 0", fontSize: "0.9rem", color: "#666" }}>
                              Status: <strong>{appt.status}</strong>
                            </p>
                          </div>
                          <span style={{ fontSize: "1.2rem" }}>{expandedAppt === appt._id ? "▼" : "▶"}</span>
                        </div>

                        {expandedAppt === appt._id && (
                          <div style={{ padding: "1rem", background: "white" }}>
                            {SECTIONS.map(section => (
                              <div key={section.key} style={{ marginBottom: "0.5rem" }}>
                                <button
                                  onClick={() => toggleSection(appt._id, section.key)}
                                  style={{
                                    width: "100%",
                                    padding: "0.8rem",
                                    background: "#f5f5f5",
                                    border: "1px solid #ddd",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <span>{section.icon} {section.label}</span>
                                  <span>{openSection[`${appt._id}-${section.key}`] ? "▼" : "▶"}</span>
                                </button>

                                {openSection[`${appt._id}-${section.key}`] && (
                                  <div style={{ padding: "1rem", background: "#fafafa", borderRadius: "0 0 4px 4px" }}>
                                    {section.key === "vitals" && (
                                      <DoctorVitals
                                        appointmentId={appt._id}
                                        patientId={patient._id}
                                        apiBaseUrl={apiBaseUrl}
                                      />
                                    )}
                                    {section.key === "notes" && (
                                      <DoctorNote appointmentId={appt._id} />
                                    )}
                                    {section.key === "rx" && (
                                      <DoctorPrescription
                                        appointmentId={appt._id}
                                        patientId={patient._id}
                                      />
                                    )}
                                    {section.key === "tests" && (
                                      <SelectedTestsSummary appointmentId={appt._id} />
                                    )}
                                    {section.key === "referral" && (
                                      <DoctorHospitalReferral appointmentId={appt._id} />
                                    )}
                                    {section.key === "cert" && (
                                      <DoctorCertificate appointmentId={appt._id} />
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {hasSearched && filteredPatients.length === 0 && !isLoading && (
        <p style={{ textAlign: "center", color: "#666" }}>No patients found matching your search.</p>
      )}
    </div>
  );
}
