import React, { useState, useEffect } from "react";
import axios from "axios";
import DoctorNote from "./DoctorNote";
import DoctorPrescription from "./DoctorPrescription";
import "../../styles/doctor/PatientHistory.css";

export default function PatientHistory({ apiBaseUrl }) {
  const [query, setQuery] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const token = localStorage.getItem("token");

  // patient info
  const [patientInfo, setPatientInfo] = useState(null);

  // referral
  const [doctorId, setDoctorId] = useState("");
  const [reason, setReason] = useState("");
  const [doctors, setDoctors] = useState([]);

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
      setPatientInfo(appts[0]?.user || null);

      if (appts.length === 0) setError("No records found for this patient.");
    } catch (err) {
      console.error("Failed to fetch patient history:", err);
      setError("Failed to fetch patient history.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpanded(expanded === id ? null : id);
  };

  const handleSubmitReferral = async (e) => {
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
    <div className="appointment-container">
      <h2 className="appointment-title">Patient History</h2>

      {/* --- Patient Search --- */}
      <div className="appointment-form" style={{ marginBottom: "1.5rem" }}>
        <input
          type="text"
          className="appointment-select"
          placeholder="Enter patient name, roll number or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="appointment-btn" onClick={searchPatient} disabled={isLoading}>
          {isLoading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {/* --- Patient Info --- */}
      {patientInfo && (
        <>
            <div className="patient-summary">
            <h3>{patientInfo.name}</h3>
            <p><b>Email:</b> {patientInfo.email}</p>
            <p><b>Phone:</b> {patientInfo.phone || "N/A"}</p>
            <p><b>Age:</b> {patientInfo.age || "N/A"}</p>
            <p><b>Roll Number:</b> {patientInfo.roll || "N/A"}</p>
            <p><b>Sex:</b> {patientInfo.sex || "N/A"}</p>
            </div>

            {/* Referral Form */}
            <form className="referral-section" onSubmit={handleSubmitReferral}>
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
        </>
        )}

      {/* --- Appointments --- */}
      <div className="appointment-list">
        {appointments.map((a) => (
          <div key={a._id} className="appointment-card">
            <div className="appointment-summary" onClick={() => toggleExpand(a._id)}>
              <h4>
                {new Date(a.startDateTime).toLocaleDateString()} |{" "}
                {new Date(a.startDateTime).toLocaleTimeString()}
              </h4>
              <p>
                <b>Mode:</b> {a.mode || "Walk-in"} |{" "}
                <b>Last Medication:</b> {a.lastMedication || "Not recorded"}
              </p>
              
              <p className="expand-hint">{expanded === a._id ? "▲ Collapse" : "▼ Expand"}</p>
            </div>

            {expanded === a._id && (
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
                  <DoctorPrescription appointmentId={a._id} patientId={a.user?._id} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
