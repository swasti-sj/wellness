import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "../../styles/doctor/DoctorReferral.css";

const STATUS_CONFIG = {
  pending:  { label: "Pending",  color: "#C8860A", bg: "#FFF4DC", icon: "⏳" },
  viewed:   { label: "Viewed",   color: "#4A1060", bg: "#F0E4FA", icon: "👁" },
  accepted: { label: "Accepted", color: "#1E8A55", bg: "#E8F8EF", icon: "✓" },
  rejected: { label: "Rejected", color: "#B8243A", bg: "#FDE8EB", icon: "✕" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className="ref-status-badge" style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function DoctorReferral({ apiBaseUrl, onClose }) {
  const [patientEmail, setPatientEmail] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [reason, setReason] = useState("");
  const [doctors, setDoctors] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [sent, setSent] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState("incoming");

  // Inline drawer state — replaces modal completely
  const [activeDrawer, setActiveDrawer] = useState(null);
  const [responseNote, setResponseNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Separate dismissed sets — persisted in localStorage so page navigation doesn't reset them
  const [dismissedIncoming, setDismissedIncoming] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("ref_dismissed_incoming") || "[]")); }
    catch { return new Set(); }
  });
  const [dismissedSent, setDismissedSent] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("ref_dismissed_sent") || "[]")); }
    catch { return new Set(); }
  });

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

  // Fetch referrals
  const fetchReferrals = useCallback(async () => {
    try {
      const [incomingRes, sentRes] = await Promise.all([
        axios.get(`${apiBaseUrl}/referrals/all`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${apiBaseUrl}/referrals/mine`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const incNotes = incomingRes.data.notes || [];
      const unread = incNotes.filter((n) => !n.read).length;
      setUnreadCount(unread);

      // Sort: unread first, then by date
      const sortedIncoming = [
        ...incNotes.filter((n) => !n.read),
        ...incNotes.filter((n) => n.read),
      ];
      setIncoming(sortedIncoming);
      setSent(sentRes.data.notes || []);
    } catch (err) {
      console.error("Error fetching referrals:", err);
    }
  }, [apiBaseUrl, token]);

  useEffect(() => {
    fetchReferrals();
    const interval = setInterval(fetchReferrals, 15000);
    return () => clearInterval(interval);
  }, [fetchReferrals]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!patientEmail || !doctorId)
      return alert("Please enter patient email and select a doctor");

    try {
      const response = await axios.post(
        `${apiBaseUrl}/referrals`,
        { token, patientEmail, referredDoctorId: doctorId, reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert("Patient referred successfully!");
        setPatientEmail("");
        setDoctorId("");
        setReason("");
        fetchReferrals();
        onClose?.();
      }
    } catch (err) {
      alert("Failed to refer patient: " + (err.response?.data?.error || err.message));
    }
  };

  const markAsRead = async (id) => {
    try {
      await axios.patch(
        `${apiBaseUrl}/referrals/${id}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIncoming((prev) =>
        prev.map((r) => (r._id === id ? { ...r, read: true, status: r.status === 'pending' ? 'viewed' : r.status } : r))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error("Error marking as read", err);
    }
  };

  const openDrawer = (id, action) => {
    setActiveDrawer(prev => (prev?.id === id && prev?.action === action) ? null : { id, action });
    setResponseNote("");
  };

  const closeDrawer = () => {
    setActiveDrawer(null);
    setResponseNote("");
  };

  const handleRespond = async () => {
    if (!activeDrawer) return;
    setSubmitting(true);
    try {
      await axios.patch(
        `${apiBaseUrl}/referrals/${activeDrawer.id}/${activeDrawer.action}`,
        { responseNote },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIncoming((prev) =>
        prev.map((r) =>
          r._id === activeDrawer.id
            ? { ...r, status: activeDrawer.action === "accept" ? "accepted" : "rejected", read: true, responseNote }
            : r
        )
      );
      closeDrawer();
    } catch (err) {
      alert("Failed to respond: " + (err.response?.data?.error || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const clearResolved = (list) => {
    const ids = list
      .filter(r => r.status === "accepted" || r.status === "rejected")
      .map(r => r._id);
    setDismissedIncoming(prev => {
      const next = new Set([...prev, ...ids]);
      localStorage.setItem("ref_dismissed_incoming", JSON.stringify([...next]));
      return next;
    });
  };

  const clearOldSent = (list) => {
    const ids = list.map(r => r._id);
    setDismissedSent(prev => {
      const next = new Set([...prev, ...ids]);
      localStorage.setItem("ref_dismissed_sent", JSON.stringify([...next]));
      return next;
    });
  };

  const formatDate = (d) =>
    new Date(d).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  return (
    <div className="ref-page">
      {/* ── Header ── */}
      <div className="ref-header">
        <h2 className="ref-title">Doctor Referral Portal</h2>
        <p className="ref-subtitle">Manage patient referrals professionally and efficiently.</p>
        <div className="ref-notification">
          {unreadCount > 0 ? (
            <span className="ref-notif-badge unread">
              🔔 {unreadCount} New Referral{unreadCount > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="ref-notif-badge">🔔 No new referrals</span>
          )}
        </div>
      </div>

      {/* ── Send Referral Form ── */}
      <div className="ref-send-card">
        <h3 className="ref-card-title">Refer a Patient</h3>
        <form className="ref-form" onSubmit={handleSubmit}>
          <div className="ref-form-group">
            <label>Patient Email</label>
            <input
              type="email"
              value={patientEmail}
              onChange={(e) => setPatientEmail(e.target.value)}
              placeholder="patient@iitdh.ac.in"
              required
            />
          </div>
          <div className="ref-form-group">
            <label>Select Doctor</label>
            <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} required>
              <option value="">— Choose Doctor —</option>
              {doctors.map((doc) => (
                <option key={doc._id} value={doc._id}>
                  {doc.name} · {doc.specialization}
                </option>
              ))}
            </select>
          </div>
          <div className="ref-form-group">
            <label>Reason for Referral</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the reason for referring this patient…"
              rows={3}
            />
          </div>
          <button type="submit" className="ref-submit-btn">
            Send Referral →
          </button>
        </form>
      </div>

      {/* ── Tabs ── */}
      <div className="ref-tabs">
        <button
          className={`ref-tab${activeTab === "incoming" ? " active" : ""}`}
          onClick={() => setActiveTab("incoming")}
        >
          Incoming
          {unreadCount > 0 && <span className="ref-tab-dot">{unreadCount}</span>}
        </button>
        <button
          className={`ref-tab${activeTab === "sent" ? " active" : ""}`}
          onClick={() => setActiveTab("sent")}
        >
          Sent
        </button>
      </div>

      {/* ── Tab Content ── */}
      <div className="ref-list-section">
        {activeTab === "incoming" ? (
          <>
            {(() => {
              const visible = incoming.filter(r => !dismissedIncoming.has(r._id));
              const hasResolved = visible.some(r => r.status === "accepted" || r.status === "rejected");
              return (
                <>
                  {hasResolved && (
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
                      <button
                        onClick={() => clearResolved(visible)}
                        style={{ padding: "0.3rem 0.9rem", fontSize: "0.78rem", fontWeight: 600, background: "#FDE8EB", color: "#B8243A", border: "1px solid #F5C6CB", borderRadius: "6px", cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}
                      >
                        🗑 Clear Resolved
                      </button>
                    </div>
                  )}
                  {visible.length === 0 ? (
                    <div className="ref-empty">
                      <span>📭</span>
                      <p>No incoming referrals yet.</p>
                    </div>
                  ) : (
                    visible.map((r) => (
                <div
                  key={r._id}
                  className={`ref-card${!r.read ? " unread" : ""}`}
                  onClick={() => !r.read && markAsRead(r._id)}
                >
                  <div className="ref-card-top">
                    <div className="ref-card-info">
                      <span className="ref-card-label">From</span>
                      <span className="ref-card-name">{r.doctor?.name}</span>
                    </div>
                    <StatusBadge status={r.status || "pending"} />
                  </div>

                  <div className="ref-card-patient">
                    <span className="ref-card-label">Patient</span>
                    <span>{r.patient?.name} <em>({r.patient?.email})</em></span>
                  </div>

                  {r.text && r.text !== "No reason provided" && (
                    <div className="ref-card-reason">
                      <span className="ref-card-label">Reason</span>
                      <p>{r.text}</p>
                    </div>
                  )}

                  {r.responseNote && (
                    <div className="ref-card-response">
                      <span className="ref-card-label">Your Note</span>
                      <p>{r.responseNote}</p>
                    </div>
                  )}

                  <div className="ref-card-footer">
                    <span className="ref-card-time">{formatDate(r.createdAt)}</span>

                    {(r.status === "pending" || r.status === "viewed" || !r.status) && (
                      <div className="ref-card-actions">
                        <button
                          className={`ref-act-btn accept${activeDrawer?.id === r._id && activeDrawer?.action === "accept" ? " active" : ""}`}
                          onClick={(e) => { e.stopPropagation(); openDrawer(r._id, "accept"); }}
                        >✓ Accept</button>
                        <button
                          className={`ref-act-btn reject${activeDrawer?.id === r._id && activeDrawer?.action === "reject" ? " active" : ""}`}
                          onClick={(e) => { e.stopPropagation(); openDrawer(r._id, "reject"); }}
                        >✕ Decline</button>
                      </div>
                    )}
                  </div>

                  {/* Inline drawer — opens below card when accept/reject clicked */}
                  {activeDrawer?.id === r._id && (
                    <div className="ref-inline-drawer" onClick={e => e.stopPropagation()}>
                      <p className="ref-drawer-title">
                        {activeDrawer.action === "accept" ? "✓ Accepting referral" : "✕ Declining referral"}
                      </p>
                      <textarea
                        className="ref-drawer-ta"
                        value={responseNote}
                        onChange={e => setResponseNote(e.target.value)}
                        placeholder={activeDrawer.action === "accept" ? "Optional note for referring doctor…" : "Reason for declining…"}
                        rows={2}
                      />
                      <div className="ref-drawer-btns">
                        <button
                          className={`ref-drawer-confirm ${activeDrawer.action}`}
                          onClick={handleRespond}
                          disabled={submitting}
                        >
                          {submitting ? "Saving…" : activeDrawer.action === "accept" ? "Confirm Accept" : "Confirm Decline"}
                        </button>
                        <button className="ref-drawer-cancel" onClick={closeDrawer}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
                    ))
                  )}
                </>
              );
            })()}
          </>
        ) : (
          <>
            {(() => {
              const visibleSent = sent.filter(r => !dismissedSent.has(r._id));
              return (
                <>
                  {visibleSent.length > 0 && (
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
                      <button
                        onClick={() => clearOldSent(visibleSent)}
                        style={{ padding: "0.3rem 0.9rem", fontSize: "0.78rem", fontWeight: 600, background: "#F0E4FA", color: "#6C1B85", border: "1px solid #E0D0EF", borderRadius: "6px", cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}
                      >
                        🗑 Clear All Sent
                      </button>
                    </div>
                  )}
                  {visibleSent.length === 0 ? (
                    <div className="ref-empty">
                      <span>📤</span>
                      <p>No sent referrals yet.</p>
                    </div>
                  ) : (
                    visibleSent.map((r) => (
                <div key={r._id} className="ref-card sent-card">
                  <div className="ref-card-top">
                    <div className="ref-card-info">
                      <span className="ref-card-label">Referred To</span>
                      <span className="ref-card-name">
                        {r.referredTo?.name}
                        {r.referredTo?.specialization && (
                          <em> · {r.referredTo.specialization}</em>
                        )}
                      </span>
                    </div>
                    <StatusBadge status={r.status || "pending"} />
                  </div>

                  <div className="ref-card-patient">
                    <span className="ref-card-label">Patient</span>
                    <span>{r.patient?.name} <em>({r.patient?.email})</em></span>
                  </div>

                  {r.text && r.text !== "No reason provided" && (
                    <div className="ref-card-reason">
                      <span className="ref-card-label">Reason</span>
                      <p>{r.text}</p>
                    </div>
                  )}

                  {r.responseNote && (
                    <div className="ref-card-response">
                      <span className="ref-card-label">Doctor's Note</span>
                      <p>{r.responseNote}</p>
                    </div>
                  )}

                  <div className="ref-card-footer">
                    <span className="ref-card-time">{formatDate(r.createdAt)}</span>
                  </div>
                </div>
              ))
                  )}
                </>
              );
            })()}
          </>
        )}
      </div>

    </div>
  );
}

export default DoctorReferral;