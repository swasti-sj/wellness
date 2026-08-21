import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useApi } from "../../context/ApiContext";
import DoctorVitals from "../doctor/DoctorVitals";
import PatientDocumentPreview from "./PatientDocumentPreview";
import "../../styles/doctor/PatientHistory.css";

const SECTIONS = [
    { key: "vitals", label: "Case Sheet" },
    { key: "notes", label: "Notes" },
    { key: "rx", label: "Prescription" },
    { key: "tests", label: "Tests and Documents" },
];

const formatDate = (value) => new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});

export default function VisitHistory() {
    const apiBaseUrl = useApi();
    const token = localStorage.getItem("token");
    const [records, setRecords] = useState([]);
    const [expandedAppt, setExpandedAppt] = useState(null);
    const [openSection, setOpenSection] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchRecords = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await axios.get(`${apiBaseUrl}/api/appointments/my-records`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setRecords(response.data.records || []);
        } catch (err) {
            setError(err.response?.data?.error || "Unable to load your appointment history.");
        } finally {
            setLoading(false);
        }
    }, [apiBaseUrl, token]);

    useEffect(() => {
        if (apiBaseUrl && token) fetchRecords();
    }, [apiBaseUrl, token, fetchRecords]);

    const toggleAppointment = (id) => {
        setExpandedAppt((current) => current === id ? null : id);
        setOpenSection({});
    };

    const toggleSection = (appointmentId, section) => {
        setOpenSection((current) => ({
            ...current,
            [appointmentId]: current[appointmentId] === section ? null : section,
        }));
    };

    const cancelAppointment = async (appointmentId) => {
        if (!window.confirm("Are you sure you want to cancel this appointment?")) return;
        try {
            await axios.delete(`${apiBaseUrl}/api/appointments/${appointmentId}/cancel`, {
                data: { token },
            });
            await fetchRecords();
            setExpandedAppt(null);
        } catch (err) {
            alert(err.response?.data?.error || "Failed to cancel appointment.");
        }
    };

    const patient = records[0]?.user;

    return (
        <div className="ph-container patient-history-replica">
            <h2 className="ph-title">Visit History</h2>
            <p className="ph-page-subtitle">Open an appointment to view your complete clinical record.</p>

            {loading && <p className="ph-loading">Loading your appointments...</p>}
            {error && <p className="ph-error">{error}</p>}

            {!loading && !error && patient && (
                <div className="ph-patient-list">
                    <section className="ph-patient-card">
                        <div className="ph-patient-top patient-profile-row">
                            <div className="ph-patient-info">
                                <h3 className="ph-patient-name">{patient.name || "Patient"}</h3>
                                <p className="ph-patient-meta">
                                    {patient.email || ""} {patient.roll ? ` · Roll: ${patient.roll}` : ""}
                                </p>
                            </div>
                            <span className="ph-visit-count">{records.length} visit{records.length === 1 ? "" : "s"}</span>
                        </div>

                        <div className="ph-patient-body">
                            <div className="ph-quick-info">
                                <span><strong>Phone:</strong> {patient.phone || "N/A"}</span>
                                <span><strong>UHID:</strong> {patient.uhid || "N/A"}</span>
                                <span><strong>Age:</strong> {patient.age || "N/A"}</span>
                            </div>

                            <h4 className="ph-section-title">Appointments</h4>
                            <div className="ph-appt-list">
                                {records.map((appointment) => {
                                    const isOpen = expandedAppt === appointment._id;
                                    const activeSection = openSection[appointment._id];
                                    const dependant = appointment.dependant;
                                    return (
                                        <article key={appointment._id} className="ph-appt-card">
                                            <div className="ph-appt-top" onClick={() => toggleAppointment(appointment._id)}>
                                                <div>
                                                    <span className="ph-appt-date">{formatDate(appointment.startDateTime)}</span>
                                                    <span className="ph-appt-meta">
                                                        Dr. {appointment.doctor?.name || "Unknown"} · {appointment.doctor?.specialization || "General care"}
                                                        {dependant?.name ? ` · For ${dependant.name}` : ""}
                                                    </span>
                                                </div>
                                                <div className="ph-appt-right">
                                                    <span className={`ph-status ${appointment.status}`}>{appointment.status}</span>
                                                    {appointment.status === "booked" && (
                                                        <button className="ph-cancel-btn" onClick={(event) => { event.stopPropagation(); cancelAppointment(appointment._id); }}>
                                                            Cancel
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        className={`ph-expand-button${isOpen ? " open" : ""}`}
                                                        onClick={(event) => { event.stopPropagation(); toggleAppointment(appointment._id); }}
                                                        aria-label={isOpen ? "Collapse appointment details" : "Open appointment details"}
                                                        aria-expanded={isOpen}
                                                    >
                                                        <span aria-hidden="true">⌄</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {isOpen && (
                                                <div className="ph-appt-body">
                                                    <div className="ph-appointment-context">
                                                        {dependant?.name ? (
                                                            <><strong>Patient:</strong> {dependant.name}<strong>Dependant of:</strong> {patient.name}<strong>UHID:</strong> {dependant.uhid || "N/A"}</>
                                                        ) : (
                                                            <><strong>Patient:</strong> {patient.name}<strong>UHID:</strong> {patient.uhid || "N/A"}</>
                                                        )}
                                                    </div>
                                                    <div className="ph-section-btns">
                                                        {SECTIONS.map((section) => (
                                                            <button
                                                                key={section.key}
                                                                className={`ph-sec-btn${activeSection === section.key ? " active" : ""}`}
                                                                onClick={() => toggleSection(appointment._id, section.key)}
                                                            >
                                                                <span>{section.label}</span>
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {activeSection === "vitals" && (
                                                        <div className="ph-section-panel">
                                                            <DoctorVitals
                                                                appointmentId={appointment._id}
                                                                patientId={patient._id}
                                                                dependantUhid={dependant?.uhid}
                                                                apiBaseUrl={apiBaseUrl}
                                                                readOnly
                                                            />
                                                        </div>
                                                    )}
                                                    {activeSection === "notes" && (
                                                        <div className="ph-section-panel ph-read-panel">
                                                            {appointment.notes?.length ? appointment.notes.map((note) => (
                                                                <article className="ph-read-item" key={note._id}><strong>Clinical note</strong><p>{note.text}</p></article>
                                                            )) : <p className="ph-empty">No clinical notes have been recorded.</p>}
                                                        </div>
                                                    )}
                                                    {activeSection === "rx" && (
                                                        <div className="ph-section-panel ph-read-panel">
                                                            {appointment.prescription?.prescriptions?.length ? appointment.prescription.prescriptions.map((item, index) => (
                                                                <article className="ph-read-item" key={`${item.medication}-${index}`}>
                                                                    <strong>{item.medication || item.medicine?.name || "Medication"}</strong>
                                                                    <p>{item.dosage || ""} · {item.frequency || ""} · Quantity {item.quantity || "N/A"}</p>
                                                                    {item.notes && <small>{item.notes}</small>}
                                                                </article>
                                                            )) : <p className="ph-empty">No prescription has been issued.</p>}
                                                            <PatientDocumentPreview title="Prescription Document" url={appointment.prescription?.documentUrl} emptyMessage="No prescription document uploaded." />
                                                        </div>
                                                    )}
                                                    {activeSection === "tests" && (
                                                        <div className="ph-section-panel ph-read-panel">
                                                            {appointment.tests?.tests?.length ? <ul className="ph-test-list">{appointment.tests.tests.filter((test) => test.selected !== false).map((test) => <li key={test._id || test.testName}>{test.testName}</li>)}</ul> : <p className="ph-empty">No tests recorded.</p>}
                                                            <PatientDocumentPreview title="Lab Test Document" url={appointment.tests?.labTestDocumentUrl} emptyMessage="No lab test document uploaded." />
                                                            <PatientDocumentPreview title="Referral Document" url={appointment.tests?.hospitalReferral?.cashlessFormDocumentUrl} emptyMessage="No referral document uploaded." />
                                                            <PatientDocumentPreview title="Medical Certificate" url={appointment.tests?.certificate?.imageUrl} emptyMessage="No medical certificate uploaded." />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {!loading && !error && !patient && <p className="ph-empty">No appointment history is available yet.</p>}
        </div>
    );
}
