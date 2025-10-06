import React, { useState, useEffect } from "react";
import axios from "axios";
import ReferredNotes from "./ReferredNotes";
import "../../styles/doctor/DoctorReferral.css"; // import CSS

export default function DoctorReferral({ apiBaseUrl, onClose }) {
  const [patientEmail, setPatientEmail] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [reason, setReason] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [tab, setTab] = useState("toMe");
  const token = localStorage.getItem("token");

  useEffect(() => {
    axios
      .get(`${apiBaseUrl}/doctors/list`)
      .then((res) => setDoctors(res.data || []))
      .catch((err) => console.error("Error fetching doctors:", err));
  }, [apiBaseUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!patientEmail || !doctorId)
      return alert("Please enter patient email and select a doctor");
    try {
      const res = await axios.post(`${apiBaseUrl}/referrals`, {
        token,
        patientEmail,
        referredDoctorId: doctorId,
        reason,
      });
      if (res.data.success) {
        alert("Referral created successfully!");
        setPatientEmail("");
        setDoctorId("");
        setReason("");
        onClose?.();
      }
    } catch (err) {
      console.error(err);
      alert(
        "Failed to refer patient: " +
          (err.response?.data?.error || err.message)
      );
    }
  };

  return (
    <div className="referral-container">
      <div className="referral-header">
        <h2>Patient Referral Portal</h2>
        <p>Efficiently manage your referrals between specialists</p>
      </div>

      {/* Referral Form */}
      <div className="referral-card">
        <h3>Create a New Referral</h3>
        <form onSubmit={handleSubmit} className="referral-form">
          <div className="form-group">
            <label>Patient Email</label>
            <input
              type="email"
              value={patientEmail}
              onChange={(e) => setPatientEmail(e.target.value)}
              placeholder="Enter patient email"
            />
          </div>

          <div className="form-group">
            <label>Referred Doctor</label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
            >
              <option value="">Select Doctor</option>
              {doctors.map((doc) => (
                <option key={doc._id} value={doc._id}>
                  {doc.name} ({doc.specialization})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Reason for Referral</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for referral"
            ></textarea>
          </div>

          <button type="submit" className="primary-btn">
            Refer Patient
          </button>
        </form>
      </div>

      {/* Tabs */}
      <div className="referral-tabs">
        <button
          onClick={() => setTab("toMe")}
          className={tab === "toMe" ? "active-tab" : ""}
        >
          Referred to Me
        </button>
        <button
          onClick={() => setTab("byMe")}
          className={tab === "byMe" ? "active-tab" : ""}
        >
          Referred by Me
        </button>
      </div>

      {/* Notes Section */}
      <div className="referral-list">
        {tab === "toMe" ? (
          <ReferredNotes apiBaseUrl={apiBaseUrl} endpoint="/referrals/all" />
        ) : (
          <ReferredNotes apiBaseUrl={apiBaseUrl} endpoint="/referrals/mine" />
        )}
      </div>
    </div>
  );
}
