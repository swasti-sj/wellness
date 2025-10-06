import React, { useState, useEffect } from "react";
import axios from "axios";
import "../../styles/doctor/DoctorReferral.css";

function DoctorReferral({ apiBaseUrl, onClose }) {
  const [patientEmail, setPatientEmail] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [reason, setReason] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [sent, setSent] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState("incoming");
  const token = localStorage.getItem("token");

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

  useEffect(() => {
    const fetchReferrals = async () => {
      try {
        // Incoming referrals
        const incomingRes = await axios.get(`${apiBaseUrl}/referrals/all`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const incNotes = incomingRes.data.notes || [];
        const unread = incNotes.filter((n) => !n.read).length;
        setUnreadCount(unread);

        const sortedIncoming = [
          ...incNotes.filter((n) => !n.read),
          ...incNotes.filter((n) => n.read),
        ];
        setIncoming(sortedIncoming);

        // Sent referrals
        const sentRes = await axios.get(`${apiBaseUrl}/referrals/mine`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSent(sentRes.data.notes || []);
      } catch (err) {
        console.error("Error fetching referrals:", err);
      }
    };

    fetchReferrals();
    const interval = setInterval(fetchReferrals, 15000);
    return () => clearInterval(interval);
  }, [apiBaseUrl, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!patientEmail || !doctorId)
      return alert("Please enter patient email and select a doctor");

    try {
      const response = await axios.post(`${apiBaseUrl}/referrals`, {
        token,
        patientEmail,
        referredDoctorId: doctorId,
        reason,
      });

      if (response.data.success) {
        alert("Patient referred successfully!");
        setPatientEmail("");
        setDoctorId("");
        setReason("");
        onClose?.();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to refer patient: " + (err.response?.data?.error || err.message));
    }
  };

  const markAsRead = async (id) => {
    try {
      await axios.patch(`${apiBaseUrl}/referrals/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setIncoming((prev) =>
        prev.map((r) => (r._id === id ? { ...r, read: true } : r))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error("Error marking as read", err);
    }
  };

  return (
    <div className="referral-container">
      <div className="referral-header">
        <h2>Doctor Referral Portal</h2>
        <p>Manage patient referrals professionally and efficiently.</p>
        <div className="notification-bar">
          {unreadCount > 0 ? (
            <div className="new-referral-alert">
              🔔 {unreadCount} New Referral{unreadCount > 1 ? "s" : ""}
            </div>
          ) : (
            <div className="no-new-referrals">No new referrals</div>
          )}
        </div>
      </div>

      {/* Referral Form */}
      <div className="referral-card">
        <h3>Refer a Patient</h3>
        <form className="referral-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Patient Email:</label>
            <input
              type="email"
              value={patientEmail}
              onChange={(e) => setPatientEmail(e.target.value)}
              placeholder="Enter patient email"
              required
            />
          </div>

          <div className="form-group">
            <label>Select Doctor:</label>
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
          </div>

          <div className="form-group">
            <label>Reason for Referral:</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason"
            />
          </div>

          <button type="submit" className="primary-btn">
            Refer
          </button>
        </form>
      </div>

      {/* Tabs */}
      <div className="referral-tabs">
        <button
          className={`tab-btn ${activeTab === "incoming" ? "active" : ""}`}
          onClick={() => setActiveTab("incoming")}
        >
          Incoming
        </button>
        <button
          className={`tab-btn ${activeTab === "sent" ? "active" : ""}`}
          onClick={() => setActiveTab("sent")}
        >
          Sent
        </button>
      </div>

      {/* Tab Content */}
      <div className="referral-list">
        {activeTab === "incoming" ? (
          <>
            <h3>Incoming Referrals</h3>
            {incoming.length === 0 ? (
              <p className="no-referrals">No referrals yet.</p>
            ) : (
              incoming.map((r) => (
                <div
                  key={r._id}
                  className={`referral-card-item ${r.read ? "read" : "unread"}`}
                  onClick={() => markAsRead(r._id)}
                >
                  <p>
                    <strong>From Doctor:</strong> {r.doctor.name} ({r.doctor.email})
                  </p>
                  <p>
                    <strong>Patient:</strong> {r.patient.name} ({r.patient.email})
                  </p>
                  <p>{r.text}</p>
                  <span className="timestamp">
                    {new Date(r.createdAt).toLocaleString("en-IN")}
                  </span>
                </div>
              ))
            )}
          </>
        ) : (
          <>
            <h3>Sent Referrals</h3>
            {sent.length === 0 ? (
              <p className="no-referrals">No sent referrals yet.</p>
            ) : (
              sent.map((r) => (
                <div key={r._id} className="referral-card-item read">
                  <p>
                    <strong>Patient:</strong> {r.patient.name} ({r.patient.email})
                  </p>
                  <p>
                    <strong>Referred To:</strong> {r.referredTo.name} (
                    {r.referredTo.specialization})
                  </p>
                  <p>{r.text}</p>
                  <span className="timestamp">
                    {new Date(r.createdAt).toLocaleString("en-IN")}
                  </span>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default DoctorReferral;
