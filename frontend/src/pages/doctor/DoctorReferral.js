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

  // ── NEW: track which referral's history is loading ──
  const [historyLoading, setHistoryLoading] = useState(null);

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

  // ── NEW: Download patient history PDF for referred patient ──
  const handleViewPatientHistory = async (e, referral) => {
    e.stopPropagation();
    const patientEmail = referral.patient?.email;
    if (!patientEmail) return alert("Patient email not found");

    setHistoryLoading(referral._id);
    try {
      // Step 1: fetch all appointments for this patient
      const res = await axios.get(`${apiBaseUrl}/appointments/patient-history`, {
        params: { token, query: patientEmail },
      });
      const appts = res.data?.appointments || [];
      const patientAppts = appts.filter(a => a.user?.email === patientEmail);
      const patient = patientAppts[0]?.user || referral.patient;

      if (patientAppts.length === 0) {
        alert("No appointment history found for this patient.");
        setHistoryLoading(null);
        return;
      }

      // Step 2: fetch clinical data for each appointment
      const visitDataArr = await Promise.all(
        patientAppts.map(async (a) => {
          const [vitalsRes, notesRes, rxRes, testsRes] = await Promise.allSettled([
            axios.get(`${apiBaseUrl}/vitals/${a._id}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
            axios.get(`${apiBaseUrl}/notes/${a._id}`, { params: { token } }).catch(() => null),
            axios.get(`${apiBaseUrl}/prescriptions/${a._id}`, { params: { token } }).catch(() => null),
            axios.get(`${apiBaseUrl}/tests/${a._id}`, { params: { token } }).catch(() => null),
          ]);
          return {
            appt: a,
            vitals: vitalsRes.value?.data?.vital || null,
            notes: notesRes.value?.data?.notes || [],
            prescriptions: rxRes.value?.data?.prescriptions || [],
            tests: testsRes.value?.data?.tests || [],
            hospitalReferral: testsRes.value?.data?.hospitalReferral || null,
            certificate: testsRes.value?.data?.certificate || null,
          };
        })
      );

      // Step 3: build and open PDF
      const formatDate = (d) =>
        new Date(d).toLocaleString("en-IN", {
          day: "2-digit", month: "short", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        });

      const td = `padding:4px 7px;border:1px solid #ddd;vertical-align:top`;
      const tdH = `padding:4px 7px;border:1px solid #ddd;font-weight:bold;background:#f5f0ff;width:120px;vertical-align:top`;
      const th = `padding:5px 7px;border:1px solid rgba(255,255,255,0.3);text-align:left`;
      const secHead = `font-size:12px;font-weight:bold;color:#4A1060;background:#EDE0FA;padding:3px 7px;margin-bottom:4px;border-left:3px solid #C8860A`;

      let visitsHtml = visitDataArr.map(v => {
        let inner = "";

        if (v.vitals) {
          let rows = "";
          if (v.vitals.department) rows += `<tr><td style="${tdH}">Department</td><td style="${td}" colspan="3">${v.vitals.department}</td></tr>`;
          if (v.vitals.chiefComplaints) rows += `<tr style="background:#FAF4FF"><td style="${tdH}">Chief Complaints</td><td style="${td}" colspan="3">${v.vitals.chiefComplaints}</td></tr>`;
          if (v.vitals.pastMedicalHistory) rows += `<tr><td style="${tdH}">Past Medical History</td><td style="${td}" colspan="3">${v.vitals.pastMedicalHistory}</td></tr>`;
          if (v.vitals.medicalAllergy) rows += `<tr style="background:#FAF4FF"><td style="${tdH}">Allergies</td><td style="${td}" colspan="3">${v.vitals.medicalAllergy}</td></tr>`;
          if (v.vitals.generalPhysicalExamination) rows += `<tr><td style="${tdH}">General Examination</td><td style="${td}" colspan="3">${v.vitals.generalPhysicalExamination}</td></tr>`;
          if (v.vitals.systemicExamination) rows += `<tr style="background:#FAF4FF"><td style="${tdH}">Systemic Examination</td><td style="${td}" colspan="3">${v.vitals.systemicExamination}</td></tr>`;
          if (v.vitals.investigations) rows += `<tr><td style="${tdH}">Investigations</td><td style="${td}" colspan="3">${v.vitals.investigations}</td></tr>`;
          if (v.vitals.treatmentAdvice) rows += `<tr style="background:#FAF4FF"><td style="${tdH}">Treatment Advice</td><td style="${td}" colspan="3">${v.vitals.treatmentAdvice}</td></tr>`;
          if (v.vitals.bloodPressureSystolic) rows += `<tr><td style="${tdH}">BP</td><td style="${td}">${v.vitals.bloodPressureSystolic}/${v.vitals.bloodPressureDiastolic} mmHg</td><td style="${tdH}">Pulse</td><td style="${td}">${v.vitals.pulse || "N/A"} bpm</td></tr>`;
          if (v.vitals.temperature) rows += `<tr style="background:#FAF4FF"><td style="${tdH}">Temp</td><td style="${td}">${v.vitals.temperature}°F</td><td style="${tdH}">SpO₂</td><td style="${td}">${v.vitals.spO2 || "N/A"}%</td></tr>`;
          if (v.vitals.weight) rows += `<tr><td style="${tdH}">Weight</td><td style="${td}">${v.vitals.weight} kg</td><td style="${tdH}">Height</td><td style="${td}">${v.vitals.height || "N/A"} cm</td></tr>`;
          if (v.vitals.followUpDate) rows += `<tr style="background:#FAF4FF"><td style="${tdH}">Follow-up</td><td style="${td}" colspan="3">${formatDate(v.vitals.followUpDate)}</td></tr>`;
          inner += `<div style="margin-bottom:8px"><div style="${secHead}">📋 Case Sheet &amp; Vitals</div><table style="width:100%;border-collapse:collapse;font-size:11px"><tbody>${rows}</tbody></table></div>`;
        }

        if (v.notes.length > 0) {
          const noteRows = v.notes.map((n, ni) => `<div style="padding:5px 8px;background:${ni%2===0?"#fff":"#F9F6FF"};border:1px solid #E0D0EF;border-radius:4px;margin-bottom:3px;font-size:11px">${n.text}</div>`).join("");
          inner += `<div style="margin-bottom:8px"><div style="${secHead}">📝 Doctor Notes</div>${noteRows}</div>`;
        }

        if (v.prescriptions.length > 0) {
          const rxRows = v.prescriptions.map((p, pi) => `<tr style="background:${pi%2===0?"#fff":"#FFFBF0"}"><td style="${td}">${pi+1}</td><td style="${td}">${p.medication}</td><td style="${td}">${p.dosage}</td><td style="${td}">${p.frequency}</td><td style="${td}">${p.notes || "—"}</td></tr>`).join("");
          inner += `<div style="margin-bottom:8px"><div style="${secHead}">💊 Prescription</div><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#C8860A;color:#fff"><th style="${th}">#</th><th style="${th}">Medication</th><th style="${th}">Dosage</th><th style="${th}">Frequency</th><th style="${th}">Notes</th></tr></thead><tbody>${rxRows}</tbody></table></div>`;
        }

        const selectedTests = v.tests.filter(t => t.selected);
        if (selectedTests.length > 0) {
          const testRows = selectedTests.map((t, ti) => `<tr style="background:${ti%2===0?"#fff":"#F0FFF6"}"><td style="${td}">${ti+1}</td><td style="${td}">${t.testName}</td><td style="${td}">${t.category}</td></tr>`).join("");
          inner += `<div style="margin-bottom:8px"><div style="${secHead}">🧪 Tests Ordered</div><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#1E8A55;color:#fff"><th style="${th}">#</th><th style="${th}">Test Name</th><th style="${th}">Category</th></tr></thead><tbody>${testRows}</tbody></table></div>`;
        }

        if (!v.vitals && v.notes.length===0 && v.prescriptions.length===0 && selectedTests.length===0) {
          inner += `<div style="font-size:11px;color:#999;font-style:italic;padding:4px 0">No clinical data recorded for this visit.</div>`;
        }

        return `<div style="margin-bottom:18px">
          <div style="background:#4A1060;color:#fff;padding:5px 10px;font-size:12px;font-weight:bold;border-radius:4px 4px 0 0">Clinical Details — ${formatDate(v.appt.startDateTime)}</div>
          <div style="border:1px solid #6C1B85;border-top:none;padding:8px 10px;border-radius:0 0 4px 4px">${inner}</div>
        </div>`;
      }).join("");

      const apptTableRows = patientAppts.map((a, i) =>
        `<tr style="background:${i%2===0?"#fff":"#FAF4FF"}"><td style="${td}">${i+1}</td><td style="${td}">${formatDate(a.startDateTime)}</td><td style="${td}">${a.mode || "Walk-in"}</td></tr>`
      ).join("");

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
        <title>Patient History — ${patient?.name || patientEmail}</title>
        <style>
          * { box-sizing:border-box;margin:0;padding:0 }
          body { font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1E0733;background:#fff;padding:15mm }
          table { border-collapse:collapse;width:100% }
          td,th { border:1px solid #ddd;padding:4px 7px;vertical-align:top }
          @page { size:A4 portrait;margin:12mm 15mm }
          @media print { body { padding:0 } .no-print { display:none !important } }
        </style>
      </head><body>
        <div class="no-print" style="position:fixed;top:16px;right:16px;display:flex;gap:8px;z-index:9999">
          <button onclick="window.print()" style="padding:8px 18px;border:none;border-radius:7px;font-size:13px;font-weight:700;background:#4A1060;color:#fff;cursor:pointer">⬇ Save as PDF</button>
          <button onclick="window.close()" style="padding:8px 18px;border:none;border-radius:7px;font-size:13px;font-weight:700;background:#eee;color:#333;cursor:pointer">✕ Close</button>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
          <div>
            <div style="font-size:18px;font-weight:bold;color:#4A1060">IIT Dharwad Wellness Centre</div>
            <div style="font-size:12px;color:#555;margin-top:2px">Patient Complete Visit Summary</div>
          </div>
          <div style="text-align:right;font-size:11px;color:#777">Generated: ${new Date().toLocaleString("en-IN")}</div>
        </div>
        <div style="border-bottom:3px solid #C8860A;margin-bottom:10px"></div>

        <div style="font-size:13px;font-weight:bold;color:#4A1060;margin-bottom:5px">Patient Information</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:12px">
          <tbody>
            <tr style="background:#F0E4FA">
              <td style="${tdH}">Name</td><td style="${td}">${patient?.name || "N/A"}</td>
              <td style="${tdH}">Roll No.</td><td style="${td}">${patient?.roll || "N/A"}</td>
            </tr>
            <tr>
              <td style="${tdH}">Email</td><td style="${td}">${patient?.email || patientEmail}</td>
              <td style="${tdH}">Phone</td><td style="${td}">${patient?.phone || "N/A"}</td>
            </tr>
            <tr style="background:#F0E4FA">
              <td style="${tdH}">Age / Sex</td><td style="${td}">${patient?.age || "N/A"} / ${patient?.sex || "N/A"}</td>
              <td style="${tdH}">Blood Group</td><td style="${td}">${patient?.bloodGroup || "N/A"}</td>
            </tr>
          </tbody>
        </table>

        <div style="font-size:13px;font-weight:bold;color:#4A1060;margin-bottom:5px">Visit Summary — ${patientAppts.length} Total Visit${patientAppts.length !== 1 ? "s" : ""}</div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:14px">
          <thead><tr style="background:#4A1060;color:#fff">
            <th style="${th}">#</th><th style="${th}">Date &amp; Time</th><th style="${th}">Mode</th>
          </tr></thead>
          <tbody>${apptTableRows}</tbody>
        </table>

        ${visitsHtml}

        <div style="border-top:1px solid #ddd;padding-top:6px;font-size:10px;color:#999;margin-top:8px">
          Computer-generated summary — IIT Dharwad Wellness Centre. For complete clinical details, refer to the system record.
        </div>
      </body></html>`;

      const blob = new Blob([html], { type: "text/html" });
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (err) {
      alert("Failed to load patient history: " + (err.response?.data?.error || err.message));
    } finally {
      setHistoryLoading(null);
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
                              {/* ── NEW: View Patient History button ── */}
                              <button
                                className="ref-act-btn history"
                                onClick={(e) => handleViewPatientHistory(e, r)}
                                disabled={historyLoading === r._id}
                                title="Download patient history PDF"
                              >
                                {historyLoading === r._id ? "⏳" : "📋 History"}
                              </button>
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