import React, { useState, useEffect } from "react";
import axios from "axios";
import ReferredNotes from "./ReferredNotes";

function DoctorReferral({ apiBaseUrl, onClose }) {
  const [patientEmail, setPatientEmail] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [reason, setReason] = useState("");
  const [doctors, setDoctors] = useState([]);
  const token = localStorage.getItem("token");

  // Fetch all doctors
  useEffect(() => {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!patientEmail || !doctorId) return alert("Please enter patient email and select a doctor");

    try {
      const response = await axios.post(`${apiBaseUrl}/referrals`, { token, patientEmail, referredDoctorId: doctorId, reason });
      if (response.data.success) {
        alert("Patient referred successfully!");
        setPatientEmail(""); setDoctorId(""); setReason("");
        onClose?.();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to refer patient: " + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="referral-page">
      <h2>Refer Patient</h2>

      <form onSubmit={handleSubmit} className="referral-form">
        <label>Enter Patient Email:</label>
        <input type="email" value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} placeholder="Enter patient email" />

        <label>Select Doctor:</label>
        <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
          <option value="">Select Doctor</option>
          {doctors.map(doc => <option key={doc._id} value={doc._id}>{doc.name} ({doc.specialization})</option>)}
        </select>

        <label>Reason for Referral:</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Enter reason" />

        <button type="submit">Refer</button>
      </form>

      {/* Show all notes referred to this doctor */}
      <ReferredNotes apiBaseUrl={apiBaseUrl} />
    </div>
  );
}

export default DoctorReferral;
