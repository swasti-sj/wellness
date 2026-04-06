import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import Fuse from "fuse.js";
import DoctorNote from "../doctor/DoctorNote";
import DoctorPrescription from "../doctor/DoctorPrescription";
import DoctorVitals from "../doctor/DoctorVitals";
import DoctorHospitalReferral from "../doctor/DoctorHospitalReferral";
import DoctorCertificate from "../doctor/DoctorCertificate";
import SelectedTestsSummary from "../doctor/SelectedTestsSummary";
import "../../styles/doctor/PatientHistory.css";
import "../../styles/nurse/NursePatientHistory.css";

const SECTIONS = [
  { key: "vitals", label: "Case Sheet" },
  { key: "notes", label: "Clinical Notes" },
  { key: "rx", label: "Prescription" },
  { key: "tests", label: "Lab Tests" },
  { key: "referral", label: "Hospital Referral" },
  { key: "cert", label: "Medical Certificate" },
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
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState("");
  const [reason, setReason] = useState("");
  const [printData, setPrintData] = useState(null);
  const [readyToPrint, setReadyToPrint] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [printingApptId, setPrintingApptId] = useState(null);
  const printRef = useRef(null);

  const token = localStorage.getItem("token");
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (readyToPrint && printData) {
      const timer = setTimeout(() => { triggerPdfDownload(); setReadyToPrint(false); }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyToPrint, printData]);

  useEffect(() => {
    if (location.state?.query) setQuery(location.state.query);
  }, [location.state]);

  useEffect(() => {
    if (!apiBaseUrl) return;
    axios.get(`${apiBaseUrl}/doctors/list`)
      .then(res => setDoctors(res.data || []))
      .catch(() => { });
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!apiBaseUrl) return;
    const fetchRecent = async () => {
      try {
        const res = await axios.get(`${apiBaseUrl}/appointments/patient-history`, {
          params: { token, query: "", limit: 5 },
        });
        const appts = res.data?.appointments || [];
        const seen = new Set(); const unique = [];
        appts.forEach(a => { if (a.user && !seen.has(a.user._id)) { seen.add(a.user._id); unique.push(a.user); } });
        setRecentPatients(unique.slice(0, 5));
      } catch (err) { }
    };
    fetchRecent();
  }, [apiBaseUrl, token]);

  const searchPatient = async (overrideQuery) => {
    const q = overrideQuery ?? query;
    if (!q.trim()) return alert("Enter patient name, roll number or email");
    setIsLoading(true); setError(""); setHasSearched(true);
    try {
      const res = await axios.get(`${apiBaseUrl}/appointments/patient-history`, {
        params: { token, query: q },
      });
      const appts = res.data?.appointments || [];
      setAppointments(appts);
      const seen = new Set(); const patients = [];
      appts.forEach(a => { if (a.user && !seen.has(a.user._id)) { seen.add(a.user._id); patients.push(a.user); } });
      const fuse = new Fuse(patients, { keys: ["name", "email", "roll"], threshold: 0.3 });
      const result = q.trim().length > 0 ? fuse.search(q).map(r => r.item) : patients;
      setFilteredPatients(result);
      if (result.length === 0) setError("No records found for this patient.");
    } catch (err) {
      setError("Failed to load patient list.");
    } finally {
      setIsLoading(false);
    }
  };

  const countRecentVisits = (patientId) => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return appointments.filter(a => a.user?._id === patientId && new Date(a.startDateTime) > cutoff).length;
  };

  const togglePatientExpand = (id) => { setExpandedPatient(expandedPatient === id ? null : id); setExpandedAppt(null); setOpenSection({}); };
  const toggleApptExpand = (id) => { setExpandedAppt(expandedAppt === id ? null : id); setOpenSection({}); };
  const toggleSection = (apptId, sectionKey) => setOpenSection(prev => ({ ...prev, [apptId]: prev[apptId] === sectionKey ? null : sectionKey }));

  const handleSubmitReferral = async (e, patientInfo) => {
    e.preventDefault();
    if (!patientInfo?.email || !doctorId) return alert("Please ensure patient email and a doctor are selected.");
    try {
      const response = await axios.post(`${apiBaseUrl}/referrals`, { token, patientEmail: patientInfo.email, referredDoctorId: doctorId, reason });
      if (response.data?.success) { alert("Patient referred successfully!"); setDoctorId(""); setReason(""); }
      else alert(response.data?.error || "Referral failed");
    } catch (err) { alert("Failed to refer patient: " + (err.response?.data?.error || err.message)); }
  };

  const fetchVisitData = async (a) => {
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
  };

  const handlePrint = async (patient, patientAppts) => {
    setPrintLoading(true); setPrintingApptId(null);
    const visitDataArr = await Promise.all(patientAppts.map(fetchVisitData));
    setPrintData({ patient, patientAppts, visitDataArr }); setPrintLoading(false); setReadyToPrint(true);
  };

  const handlePrintSingleAppt = async (e, patient, appt) => {
    e.stopPropagation(); setPrintLoading(true); setPrintingApptId(appt._id);
    const visitDataArr = [await fetchVisitData(appt)];
    setPrintData({ patient, patientAppts: [appt], visitDataArr }); setPrintLoading(false); setPrintingApptId(null); setReadyToPrint(true);
  };

  const triggerPdfDownload = () => {
    const el = document.getElementById("nph-print-area");
    if (!el) return;
    const blob = new Blob([`<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Patient Summary — ${printData?.patient?.name || ""}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1E0733;background:#fff;padding:15mm}
        table{border-collapse:collapse;width:100%}
        td,th{border:1px solid #ddd;padding:4px 7px;vertical-align:top}
        @page{size:A4 portrait;margin:12mm 15mm}
        @media print{body{padding:0}.no-print-btn{display:none!important}}
        .no-print-btn{position:fixed;top:16px;right:16px;display:flex;gap:8px;z-index:9999}
        .no-print-btn button{padding:8px 18px;border:none;border-radius:7px;font-size:13px;font-weight:700;cursor:pointer}
        .btn-save{background:#4A1060;color:#fff}.btn-close{background:#eee;color:#333}
      </style>
    </head><body>
      <div class="no-print-btn">
        <button class="btn-save" onclick="window.print()">Save as PDF</button>
        <button class="btn-close" onclick="window.close()">Close</button>
      </div>
      ${el.innerHTML}
    </body></html>`], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank");
  };

  const formatDate = (d) => new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  // Inline styles only used inside the PDF hidden-div (needs to survive new window rendering)
  const td = { padding: "4px 7px", border: "1px solid #ddd", verticalAlign: "top" };
  const tdH = { padding: "4px 7px", border: "1px solid #ddd", fontWeight: "bold", background: "#f5f0ff", width: "120px", verticalAlign: "top" };
  const thPdf = { padding: "5px 7px", border: "1px solid rgba(255,255,255,0.3)", textAlign: "left" };
  const secHead = { fontSize: "12px", fontWeight: "bold", color: "#4A1060", background: "#EDE0FA", padding: "3px 7px", marginBottom: "4px", borderLeft: "3px solid #C8860A" };

  return (
    <div className="nph-page">

      {/* ── Hidden PDF render area ── */}
      {printData && printData.visitDataArr && ReactDOM.createPortal(
        <div id="nph-print-area" ref={printRef} style={{ position: "absolute", left: "-9999px", top: 0, width: "800px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <div>
              <div style={{ fontSize: "18px", fontWeight: "bold", color: "#4A1060" }}>IIT Dharwad Wellness Centre</div>
              <div style={{ fontSize: "12px", color: "#555", marginTop: "2px" }}>Patient Complete Visit Summary</div>
            </div>
            <div style={{ textAlign: "right", fontSize: "11px", color: "#777" }}>Generated: {new Date().toLocaleString("en-IN")}</div>
          </div>
          <div style={{ borderBottom: "3px solid #C8860A", marginBottom: "10px" }} />

          <div style={{ fontSize: "13px", fontWeight: "bold", color: "#4A1060", marginBottom: "5px" }}>Patient Information</div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "12px", fontSize: "12px" }}>
            <tbody>
              <tr style={{ background: "#F0E4FA" }}>
                <td style={tdH}>Name</td><td style={td}>{printData.patient.name}</td>
                <td style={tdH}>Roll No.</td><td style={td}>{printData.patient.roll || "N/A"}</td>
              </tr>
              <tr>
                <td style={tdH}>Email</td><td style={td}>{printData.patient.email}</td>
                <td style={tdH}>Phone</td><td style={td}>{printData.patient.phone || "N/A"}</td>
              </tr>
              <tr style={{ background: "#F0E4FA" }}>
                <td style={tdH}>Age / Sex</td><td style={td}>{printData.patient.age || "N/A"} / {printData.patient.sex || "N/A"}</td>
                <td style={tdH}>Blood Group</td><td style={td}>{printData.patient.bloodGroup || "N/A"}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ fontSize: "13px", fontWeight: "bold", color: "#4A1060", marginBottom: "5px" }}>
            Visit Summary — {printData.patientAppts.length} Visit{printData.patientAppts.length !== 1 ? "s" : ""}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", marginBottom: "14px" }}>
            <thead>
              <tr style={{ background: "#4A1060", color: "#fff" }}>
                <th style={thPdf}>#</th><th style={thPdf}>Date &amp; Time</th><th style={thPdf}>Doctor</th><th style={thPdf}>Status</th>
              </tr>
            </thead>
            <tbody>
              {printData.patientAppts.map((a, i) => (
                <tr key={a._id} style={{ background: i % 2 === 0 ? "#fff" : "#FAF4FF" }}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>{formatDate(a.startDateTime)}</td>
                  <td style={td}>{a.doctor?.name ? `Dr. ${a.doctor.name}` : "—"}</td>
                  <td style={td}>{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {printData.visitDataArr.map((v) => (
            <div key={v.appt._id} style={{ marginBottom: "18px" }}>
              <div style={{ background: "#4A1060", color: "#fff", padding: "5px 10px", fontSize: "12px", fontWeight: "bold", borderRadius: "4px 4px 0 0" }}>
                Clinical Details — {formatDate(v.appt.startDateTime)}
              </div>
              <div style={{ border: "1px solid #6C1B85", borderTop: "none", padding: "8px 10px", borderRadius: "0 0 4px 4px" }}>

                {v.vitals && (
                  <div style={{ marginBottom: "8px" }}>
                    <div style={secHead}>Case Sheet &amp; Vitals</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                      <tbody>
                        {v.vitals.department && <tr><td style={tdH}>Department</td><td style={td} colSpan={3}>{v.vitals.department}</td></tr>}
                        {v.vitals.chiefComplaints && <tr style={{ background: "#FAF4FF" }}><td style={tdH}>Chief Complaints</td><td style={td} colSpan={3}>{v.vitals.chiefComplaints}</td></tr>}
                        {v.vitals.pastMedicalHistory && <tr><td style={tdH}>Past Medical Hx</td><td style={td} colSpan={3}>{v.vitals.pastMedicalHistory}</td></tr>}
                        {v.vitals.medicalAllergy && <tr style={{ background: "#FAF4FF" }}><td style={tdH}>Allergies</td><td style={td} colSpan={3}>{v.vitals.medicalAllergy}</td></tr>}
                        {v.vitals.generalPhysicalExamination && <tr><td style={tdH}>General Exam</td><td style={td} colSpan={3}>{v.vitals.generalPhysicalExamination}</td></tr>}
                        {v.vitals.systemicExamination && <tr style={{ background: "#FAF4FF" }}><td style={tdH}>Systemic Exam</td><td style={td} colSpan={3}>{v.vitals.systemicExamination}</td></tr>}
                        {v.vitals.investigations && <tr><td style={tdH}>Investigations</td><td style={td} colSpan={3}>{v.vitals.investigations}</td></tr>}
                        {v.vitals.treatmentAdvice && <tr style={{ background: "#FAF4FF" }}><td style={tdH}>Treatment</td><td style={td} colSpan={3}>{v.vitals.treatmentAdvice}</td></tr>}
                        {(v.vitals.bloodPressureSystolic || v.vitals.pulse) && (
                          <tr>
                            {v.vitals.bloodPressureSystolic && <><td style={tdH}>BP</td><td style={td}>{v.vitals.bloodPressureSystolic}/{v.vitals.bloodPressureDiastolic} mmHg</td></>}
                            {v.vitals.pulse && <><td style={tdH}>Pulse</td><td style={td}>{v.vitals.pulse} bpm</td></>}
                          </tr>
                        )}
                        {(v.vitals.temperature || v.vitals.spO2) && (
                          <tr style={{ background: "#FAF4FF" }}>
                            {v.vitals.temperature && <><td style={tdH}>Temp</td><td style={td}>{v.vitals.temperature}°F</td></>}
                            {v.vitals.spO2 && <><td style={tdH}>SpO2</td><td style={td}>{v.vitals.spO2}%</td></>}
                          </tr>
                        )}
                        {(v.vitals.weight || v.vitals.height) && (
                          <tr>
                            {v.vitals.weight && <><td style={tdH}>Weight</td><td style={td}>{v.vitals.weight} kg</td></>}
                            {v.vitals.height && <><td style={tdH}>Height</td><td style={td}>{v.vitals.height} cm{v.vitals.bmi ? ` (BMI: ${v.vitals.bmi})` : ""}</td></>}
                          </tr>
                        )}
                        {v.vitals.followUpDate && <tr style={{ background: "#FAF4FF" }}><td style={tdH}>Follow-up</td><td style={td} colSpan={3}>{formatDate(v.vitals.followUpDate)}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}

                {v.notes.length > 0 && (
                  <div style={{ marginBottom: "8px" }}>
                    <div style={secHead}>Clinical Notes</div>
                    {v.notes.map((n, ni) => (
                      <div key={ni} style={{ padding: "5px 8px", background: ni % 2 === 0 ? "#fff" : "#F9F6FF", border: "1px solid #E0D0EF", borderRadius: "4px", marginBottom: "3px", fontSize: "11px" }}>{n.text}</div>
                    ))}
                  </div>
                )}

                {v.prescriptions.length > 0 && (
                  <div style={{ marginBottom: "8px" }}>
                    <div style={secHead}>Prescription</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                      <thead><tr style={{ background: "#C8860A", color: "#fff" }}>
                        <th style={thPdf}>#</th><th style={thPdf}>Medication</th><th style={thPdf}>Dosage</th><th style={thPdf}>Frequency</th><th style={thPdf}>Notes</th>
                      </tr></thead>
                      <tbody>
                        {v.prescriptions.map((p, pi) => (
                          <tr key={pi} style={{ background: pi % 2 === 0 ? "#fff" : "#FFFBF0" }}>
                            <td style={td}>{pi + 1}</td><td style={td}>{p.medication}</td><td style={td}>{p.dosage}</td><td style={td}>{p.frequency}</td><td style={td}>{p.notes || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {v.tests.filter(t => t.selected).length > 0 && (
                  <div style={{ marginBottom: "8px" }}>
                    <div style={secHead}>Tests Ordered</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                      <thead><tr style={{ background: "#1E8A55", color: "#fff" }}>
                        <th style={thPdf}>#</th><th style={thPdf}>Test Name</th><th style={thPdf}>Category</th>
                      </tr></thead>
                      <tbody>
                        {v.tests.filter(t => t.selected).map((t, ti) => (
                          <tr key={ti} style={{ background: ti % 2 === 0 ? "#fff" : "#F0FFF6" }}>
                            <td style={td}>{ti + 1}</td><td style={td}>{t.testName}</td><td style={td}>{t.category}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {v.hospitalReferral?.refer && (
                  <div style={{ marginBottom: "8px" }}>
                    <div style={secHead}>Hospital Referral</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                      <tbody>
                        {v.hospitalReferral.hospitalName && <tr><td style={tdH}>Hospital</td><td style={td}>{v.hospitalReferral.hospitalName}</td></tr>}
                        {v.hospitalReferral.remarks && <tr style={{ background: "#FAF4FF" }}><td style={tdH}>Remarks</td><td style={td}>{v.hospitalReferral.remarks}</td></tr>}
                        <tr style={{ background: "#FAF4FF" }}><td style={tdH}>Ambulance</td><td style={td}>{v.hospitalReferral.ambulanceUsed ? "Yes" : "No"}</td></tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {v.certificate?.issued && (
                  <div style={{ marginBottom: "4px" }}>
                    <div style={secHead}>Medical Certificate</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                      <tbody>
                        {v.certificate.clinicalDetails && <tr><td style={tdH}>Clinical Details</td><td style={td}>{v.certificate.clinicalDetails}</td></tr>}
                        <tr style={{ background: "#FAF4FF" }}><td style={tdH}>Status</td><td style={td}>Certificate Issued</td></tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {!v.vitals && v.notes.length === 0 && v.prescriptions.length === 0 && v.tests.filter(t => t.selected).length === 0 && !v.hospitalReferral?.refer && !v.certificate?.issued && (
                  <div style={{ fontSize: "11px", color: "#999", fontStyle: "italic", padding: "4px 0" }}>No clinical data recorded for this visit.</div>
                )}
              </div>
            </div>
          ))}

          <div style={{ borderTop: "1px solid #ddd", paddingTop: "6px", fontSize: "10px", color: "#999", marginTop: "8px" }}>
            Computer-generated summary — IIT Dharwad Wellness Centre. For complete clinical details, refer to the system record.
          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════════════════════
          PAGE HEADER
      ══════════════════════════════════════════════════════ */}
      <div className="nph-header">
        <h1 className="nph-heading">Patient History</h1>
        <p className="nph-subheading">Search and review complete visit records for any patient</p>
      </div>

      {/* ══════════════════════════════════════════════════════
          SEARCH PANEL
      ══════════════════════════════════════════════════════ */}
      <div className="nph-search-panel">
        <form className="nph-search-row" onSubmit={e => { e.preventDefault(); searchPatient(); }}>
          <div className="nph-search-field">
            <input
              type="text"
              className="nph-search-input"
              placeholder="Search by patient name, roll number or email…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <button type="submit" className="nph-search-btn" disabled={isLoading}>
            {isLoading ? "Searching…" : "Search"}
          </button>
          {query && (
            <button
              type="button"
              className="nph-clear-btn"
              onClick={() => { setQuery(""); setHasSearched(false); setFilteredPatients([]); setAppointments([]); setError(""); }}
            >
              Clear
            </button>
          )}
        </form>

        {recentPatients.length > 0 && !hasSearched && (
          <div className="nph-recents">
            <span className="nph-recents-label">Recent:</span>
            {recentPatients.map(patient => (
              <button key={patient._id} className="nph-recent-chip"
                onClick={() => { setQuery(patient.name); searchPatient(patient.name); }}>
                {patient.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="nph-error">{error}</p>}

      {hasSearched && !isLoading && filteredPatients.length === 0 && !error && (
        <div className="nph-empty">
          <p className="nph-empty-title">No patients found</p>
          <p className="nph-empty-sub">Try a different name, roll number, or email address.</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          RESULTS
      ══════════════════════════════════════════════════════ */}
      <div className="nph-results">
        {filteredPatients.map(p => {
          const patientAppts = appointments.filter(a => a.user?._id === p._id);
          const recentVisits = countRecentVisits(p._id);
          const isFrequent = recentVisits >= 3;
          const isOpen = expandedPatient === p._id;

          return (
            <div key={p._id} className={`nph-patient-card${isOpen ? " open" : ""}${isFrequent ? " frequent" : ""}`}>

              <div className="nph-patient-top" onClick={() => togglePatientExpand(p._id)}>
                <div className="nph-patient-avatar">{(p.name || "?")[0].toUpperCase()}</div>
                <div className="nph-patient-info">
                  <span className="nph-patient-name">{p.name || "Unknown"}</span>
                  <span className="nph-patient-meta">
                    {[p.email, p.roll && `Roll: ${p.roll}`, p.age && `Age: ${p.age}`, p.sex].filter(Boolean).join("  ·  ")}
                  </span>
                </div>
                <div className="nph-patient-right">
                  {isFrequent && <span className="nph-frequent-badge">Frequent ({recentVisits} in 30d)</span>}
                  <span className="nph-visit-count">{patientAppts.length} visit{patientAppts.length !== 1 ? "s" : ""}</span>
                  <button
                    className="nph-print-btn"
                    onClick={e => { e.stopPropagation(); handlePrint(p, patientAppts); }}
                    disabled={printLoading}
                    title="Download complete history as PDF"
                  >
                    {printLoading && printingApptId === null ? "Loading…" : "Download PDF"}
                  </button>
                  <span className={`nph-chevron${isOpen ? " open" : ""}`}>&#8250;</span>
                </div>
              </div>

              {isOpen && (
                <div className="nph-patient-body">

                  <div className="nph-quick-info">
                    <span><strong>Phone:</strong> {p.phone || "N/A"}</span>
                    <span><strong>Age:</strong> {p.age || "N/A"}</span>
                    <span><strong>Total visits:</strong> {patientAppts.length}</span>
                    {patientAppts[0] && <span><strong>Last visit:</strong> {formatDate(patientAppts[0].startDateTime)}</span>}
                  </div>

                  <form className="nph-refer-form" onSubmit={e => handleSubmitReferral(e, p)}>
                    <h4 className="nph-section-title">Refer Patient</h4>
                    <div className="nph-refer-row">
                      <select value={doctorId} onChange={e => setDoctorId(e.target.value)} required>
                        <option value="">Select Doctor</option>
                        {doctors.map(doc => <option key={doc._id} value={doc._id}>{doc.name} · {doc.specialization}</option>)}
                      </select>
                      <button type="submit" className="nph-refer-btn">Refer</button>
                    </div>
                    <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for referral (optional)" rows={2} />
                  </form>

                  <h4 className="nph-section-title">Appointments</h4>
                  <div className="nph-appt-list">
                    {patientAppts.map(a => (
                      <div key={a._id} className="nph-appt-card">
                        <div className="nph-appt-top" onClick={() => toggleApptExpand(a._id)}>
                          <div className="nph-appt-left">
                            <span className="nph-appt-date">{formatDate(a.startDateTime)}</span>
                            {a.doctor && <span className="nph-appt-doctor">Dr. {a.doctor.name || "—"}</span>}
                          </div>
                          <div className="nph-appt-right">
                            <span className={`nph-badge nph-badge--${(a.status || "").toLowerCase().replace(/\s+/g, "-").replace(/cancelled.*/, "cancelled")}`}>
                              {a.status}
                            </span>
                            <button
                              className="nph-print-btn nph-print-btn--sm"
                              onClick={e => handlePrintSingleAppt(e, p, a)}
                              disabled={printLoading}
                              title="Download PDF for this visit"
                            >
                              {printLoading && printingApptId === a._id ? "Loading…" : "Visit PDF"}
                            </button>
                            <span className={`nph-chevron${expandedAppt === a._id ? " open" : ""}`}>&#8250;</span>
                          </div>
                        </div>

                        {expandedAppt === a._id && (
                          <div className="nph-appt-body">
                            <div className="nph-section-btns">
                              {SECTIONS.map(sec => (
                                <button
                                  key={sec.key}
                                  className={`nph-sec-btn${openSection[a._id] === sec.key ? " active" : ""}`}
                                  onClick={() => toggleSection(a._id, sec.key)}
                                >
                                  {sec.label}
                                </button>
                              ))}
                            </div>
                            <div className="nph-section-panel">
                              {openSection[a._id] === "vitals" && <DoctorVitals appointmentId={a._id} patientId={a.user?._id} apiBaseUrl={apiBaseUrl} />}
                              {openSection[a._id] === "notes" && <DoctorNote appointmentId={a._id} />}
                              {openSection[a._id] === "rx" && <DoctorPrescription appointmentId={a._id} patientId={a.user?._id} />}
                              {openSection[a._id] === "tests" && <SelectedTestsSummary appointmentId={a._id} onEditClick={() => navigate(`/nurse-dashboard/test-page?appointmentId=${a._id}&patientId=${a.user?._id}&returnUrl=/nurse-dashboard/patient-history`)} />}
                              {openSection[a._id] === "referral" && <DoctorHospitalReferral appointmentId={a._id} />}
                              {openSection[a._id] === "cert" && <DoctorCertificate appointmentId={a._id} />}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}