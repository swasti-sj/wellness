import React, { useState, useEffect } from "react";
import axios from "axios";
import { Calendar, momentLocalizer } from "react-big-calendar";
import { useNavigate, useLocation } from "react-router-dom";
import moment from "moment";
import { format } from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../../styles/doctor/DoctorAppointment.css";
import DoctorNote from "./DoctorNote";
import DoctorPrescription from "./DoctorPrescription";
import DoctorVitals from "./DoctorVitals";
import DoctorHospitalReferral from "./DoctorHospitalReferral";
import DoctorCertificate from "./DoctorCertificate";
import SelectedTestsSummary from "./SelectedTestsSummary";
import CustomToolbar from "./CustomToolbar";

const localizer = momentLocalizer(moment);

export default function DoctorAppointment({ apiBaseUrl }) {
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [view, setView] = useState("month");
  const [date, setDate] = useState(new Date());
  // Track which sub-section accordion is open inside the modal
  const [openSubSection, setOpenSubSection] = useState(null);

  const [bookingData, setBookingData] = useState({
    patientEmail: "",
    patientPhone: "",
    date: "",
    time: "",
    duration: 30,
  });

  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const location = useLocation();

  // ── Reopen appointment modal when returning from TestPage ──
  useEffect(() => {
    if (location.state?.openAppointmentId && location.state?.openSection) {
      const targetId = location.state.openAppointmentId;
      const targetSection = location.state.openSection;
      // Wait until appointments are loaded, then find & open the event
      if (appointments.length > 0) {
        const evt = appointments.find(a => a.id === targetId);
        if (evt) {
          setSelectedEvent(evt);
          setOpenSubSection(targetSection);
          // Clear the location state so it doesn't re-trigger
          navigate(location.pathname, { replace: true, state: {} });
        }
      }
    }
  }, [appointments, location.state]);

  useEffect(() => {
    if (!apiBaseUrl || !token) return;
    fetchAppointments();
    fetchAvailableSlots();
    const interval = setInterval(fetchAppointments, 60000);
    return () => clearInterval(interval);
  }, [apiBaseUrl, token]);

  const fetchAppointments = async () => {
    try {
      const res = await axios.get(`${apiBaseUrl}/api/appointments/doctor-appointments`, {
        params: { token },
      });
      const formatted = res.data.appointments.map((appt) => {
        const user = appt.user || appt.fullData?.user;
        const dependant = appt.dependant || appt.fullData?.dependant || null;
        const patientDisplayName = user?.name || user?.email || user?.roll || "Unknown Patient";
        const dependantLabel = dependant?.name
          ? `${dependant.name} (${dependant.relationship || "Dependant"})`
          : null;
        const eventTitle = dependantLabel
          ? `${dependantLabel} — ${patientDisplayName} (${appt.status})`
          : `${patientDisplayName} (${appt.status})`;

        return {
          id: appt._id,
          title: eventTitle,
          start: new Date(appt.startDateTime),
          end: new Date(appt.endDateTime),
          status: appt.status,
          patient: user,
          patientDisplayName,
          dependant,
          dependantLabel,
          slotDay: appt.slotDay,
          slotTime: appt.slotTime,
          fullData: appt,
        };
      });
      setAppointments(formatted);
    } catch (err) {
      console.error("Error fetching appointments:", err);
      setError("Failed to fetch appointments.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableSlots = async () => {
    try {
      const res = await axios.get(`${apiBaseUrl}/api/appointments/my-slots`, { params: { token } });
      setAvailableSlots(res.data.slots);
    } catch (err) {
      console.error("Error fetching available slots:", err);
    }
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setOpenSubSection(null);
  };
  const handleCloseModal = () => setSelectedEvent(null);

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    try {
      const startDateTime = new Date(`${bookingData.date}T${bookingData.time}:00`).toISOString();
      const endDateTime = new Date(new Date(startDateTime).getTime() + bookingData.duration * 60000).toISOString();
      const res = await axios.post(`${apiBaseUrl}/api/appointments/doctor-book`, {
        token,
        patientEmail: bookingData.patientEmail,
        patientPhone: bookingData.patientPhone,
        startDateTime,
        endDateTime,
        slotDay: new Date(bookingData.date).toLocaleDateString("en-US", { weekday: "long" }),
        slotTime: bookingData.time,
      });
      if (res.data.success) {
        setShowBookingForm(false);
        setBookingData({ patientEmail: "", patientPhone: "", date: "", time: "", duration: 30 });
        fetchAppointments();
        fetchAvailableSlots();
        alert("Appointment booked successfully!");
      }
    } catch (err) {
      alert("Failed to book appointment: " + (err.response?.data?.error || err.message));
    }
  };

  const handleCancelAppointment = async (appointmentId, slotDay, slotTime) => {
    if (!window.confirm("Are you sure you want to cancel this appointment?")) return;
    try {
      const res = await axios.delete(`${apiBaseUrl}/api/appointments/${appointmentId}/doctor-cancel`, {
        data: { token, slotDay, slotTime },
      });
      if (res.data.success) {
        fetchAppointments();
        fetchAvailableSlots();
        alert("Appointment cancelled successfully");
        setSelectedEvent(null);
      }
    } catch (err) {
      alert("Failed to cancel appointment: " + (err.response?.data?.error || err.message));
    }
  };

  const handleViewHistory = (patient) => {
    if (!patient?.roll && !patient?.email) {
      alert("No roll number or email available for this patient");
      return;
    }
    navigate("/docdashboard/history", { state: { query: patient.roll || patient.email } });
  };

  const handleStatusUpdate = async (appointmentId, newStatus) => {
    try {
      const res = await axios.patch(`${apiBaseUrl}/api/appointments/${appointmentId}/status`, {
        token, status: newStatus,
      });
      if (res.data.success) {
        fetchAppointments();
        alert(`Appointment marked as ${newStatus}`);
        setSelectedEvent(null);
      }
    } catch (err) {
      alert("Failed to update status: " + (err.response?.data?.error || err.message));
    }
  };

  // ── Sub-section accordion for the bottom part of the modal ──────
  const toggleSub = (key) => setOpenSubSection((p) => (p === key ? null : key));

  const SubSection = ({ id, icon, title, subtitle, children }) => {
    const isOpen = openSubSection === id;
    return (
      <div className="modal-sub-section">
        <button
          type="button"
          className={`modal-sub-toggle${isOpen ? " open" : ""}`}
          onClick={() => toggleSub(id)}
        >
          <div className="modal-sub-left">
            <span className="modal-sub-icon">{icon}</span>
            <div>
              <div className="modal-sub-title">{title}</div>
              {subtitle && <div className="modal-sub-subtitle">{subtitle}</div>}
            </div>
          </div>
          <span className="modal-sub-chevron">▼</span>
        </button>
        <div className={`modal-sub-body${isOpen ? " open" : ""}`}>
          {children}
        </div>
      </div>
    );
  };

  // ── Event color getter ───────────────────────────────────────────
  const eventStyleGetter = (event) => {
    const status = event.status?.toLowerCase() || "booked";

    let c = { bg: "#FFF7E6", border: "#C8860A", text: "#9A6408" }; // Default: booked

    if (status === "attended") {
      c = { bg: "#E8F6EF", border: "#1E8A55", text: "#166640" };
    } else if (status.includes("cancel")) {
      c = { bg: "#FCECEF", border: "#B8243A", text: "#8C1A2A" };
    } else if (status === "no show") {
      c = { bg: "#F0F0F4", border: "#5A5A70", text: "#3A3A50" };
    } else if (status === "walk in") {
      c = { bg: "#F4E9F9", border: "#6C1B85", text: "#4A1060" };
    }

    return {
      style: {
        backgroundColor: c.bg,
        borderLeft: `4px solid ${c.border}`,
        borderTop: `1px solid ${c.border}40`,
        borderRight: `1px solid ${c.border}40`,
        borderBottom: `1px solid ${c.border}40`,
        borderRadius: "6px",
        color: c.text,
        fontFamily: "'DM Sans', sans-serif",
        fontSize: "0.82rem",
        fontWeight: 600,
        padding: "3px 6px",
      },
    };
  };

  return (
    <div className="appointments-container">
      {/* ── Page Header ── */}
      <div className="calendar-header">
        <h2>My Appointments</h2>
        <button onClick={() => setShowBookingForm(true)} className="add-appointment-btn">
          + New Appointment
        </button>
      </div>

      {isLoading && <p className="loading-text">Loading appointments…</p>}
      {error && <p className="error-message">{error}</p>}

      {!isLoading && !error && (
        <div className="calendar-container">
          <Calendar
            localizer={localizer}
            events={appointments}
            startAccessor="start"
            endAccessor="end"
            style={{ height: "auto", minHeight: "80vh" }}
            views={["month", "week", "day", "agenda"]}
            view={view}
            onView={(v) => setView(v)}
            date={date}
            onNavigate={(d) => setDate(d)}
            popup
            onSelectEvent={handleSelectEvent}
            components={{ toolbar: CustomToolbar }}
            eventPropGetter={eventStyleGetter}
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          APPOINTMENT DETAILS MODAL
      ════════════════════════════════════════════════════════════ */}
      {selectedEvent && (
        <div className="appointment-modal" onClick={(e) => e.target === e.currentTarget && handleCloseModal()}>
          <div className="modal-content">

            {/* ── Gradient Header ── */}
            <div className="modal-header-bar">
              <button className="close-btn" onClick={handleCloseModal} title="Close">✕</button>
              <div className="modal-patient-name">
                {selectedEvent.dependantLabel
                  ? selectedEvent.dependantLabel
                  : selectedEvent.patientDisplayName || selectedEvent.patient?.name || "Unknown Patient"}
              </div>
              <div className="modal-meta">
                <span><strong>Primary Patient:</strong> {selectedEvent.patientDisplayName || selectedEvent.patient?.name || "N/A"}</span>
                {selectedEvent.dependant?.name && (
                  <span><strong>Dependant:</strong> {selectedEvent.dependant.name}</span>
                )}
                <span><strong>Email:</strong> {selectedEvent.patient?.email || "N/A"}</span>
                <span><strong>Date:</strong> {format(selectedEvent.start, "dd MMM yyyy")}</span>
                <span><strong>Time:</strong> {format(selectedEvent.start, "hh:mm a")} – {format(selectedEvent.end, "hh:mm a")}</span>
                <span>
                  <span className={`modal-status-badge ${selectedEvent.status?.toLowerCase().includes("cancel") ? "cancelled" : selectedEvent.status?.replace(" ", "-").toLowerCase()}`}>
                    {selectedEvent.status}
                  </span>
                </span>
              </div>
            </div>

            {/* ── Modal Body ── */}
            <div className="modal-body">

              {/* Status update dropdown */}
              {selectedEvent.status === "booked" && (
                <div className="status-update">
                  <label>Update Status</label>
                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <select
                      value={selectedEvent.status}
                      onChange={(e) => handleStatusUpdate(selectedEvent.id, e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="booked" disabled>— Update Status —</option>
                      <option value="attended">Mark Completed</option>
                      <option value="no show">Mark No-Show</option>
                      <option value="walk_in">Mark Walk-in</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="modal-actions" style={{ display: 'flex', gap: '0.65rem' }}>
                {(selectedEvent.status === "booked" || selectedEvent.status === "in-progress") && (
                  <button
                    className="cancel-btn"
                    onClick={() => handleCancelAppointment(selectedEvent.id, selectedEvent.slotDay, selectedEvent.slotTime)}
                  >
                    Cancel Appointment
                  </button>
                )}
                <button
                  className="history-btn"
                  onClick={() => handleViewHistory(selectedEvent.patient)}
                  style={{ margin: 0 }}
                >
                  View History
                </button>
              </div>

              <div className="modal-divider" />

              {/* ── Case Sheet (DoctorVitals — already has its own accordion) ── */}
              <SubSection id="casesheet" icon="📋" title="Case Sheet" subtitle="Basic details, vitals, medical history, treatment">
                <DoctorVitals
                  appointmentId={selectedEvent.id}
                  patientId={selectedEvent.patient?._id}
                  apiBaseUrl={apiBaseUrl}
                />
              </SubSection>

              {/* ── Clinical Notes ── */}
              <SubSection id="notes" icon="🗒️" title="Clinical Notes" subtitle="Doctor's running notes for this visit">
                <DoctorNote appointmentId={selectedEvent.id} />
              </SubSection>

              {/* ── Prescription ── */}
              <SubSection id="prescription" icon="💊" title="Prescription" subtitle="Medicines, dosage, frequency">
                <DoctorPrescription
                  appointmentId={selectedEvent.id}
                  patientId={selectedEvent.patient?._id}
                />
              </SubSection>

              {/* ── Tests ── */}
              <SubSection id="tests" icon="🧪" title="Lab Tests" subtitle="Ordered investigations">
                <SelectedTestsSummary
                  appointmentId={selectedEvent.id}
                  onEditClick={() =>
                    navigate(
                      `/docdashboard/test-page?appointmentId=${selectedEvent.id}&patientId=${selectedEvent.patient?._id}`,
                      {
                        state: {
                          openAppointmentId: selectedEvent.id,
                          openSection: "tests",
                          returnUrl: "/docdashboard/doctor-appointment",
                        }
                      }
                    )
                  }
                />
              </SubSection>

              {/* ── Hospital Referral ── */}
              <SubSection id="referral" icon="🏥" title="Hospital Referral" subtitle="Refer to external hospital">
                <DoctorHospitalReferral appointmentId={selectedEvent.id} />
              </SubSection>

              {/* ── Certificate ── */}
              <SubSection id="certificate" icon="📜" title="Medical Certificate" subtitle="Issue fitness / medical certificate">
                <DoctorCertificate appointmentId={selectedEvent.id} />
              </SubSection>

            </div>{/* end modal-body */}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          NEW BOOKING MODAL
      ════════════════════════════════════════════════════════════ */}
      {showBookingForm && (
        <div className="appointment-modal" onClick={(e) => e.target === e.currentTarget && setShowBookingForm(false)}>
          <div className="modal-content booking-modal-content">
            <div className="modal-header-bar">
              <button className="close-btn" onClick={() => setShowBookingForm(false)}>✕</button>
              <div className="modal-patient-name">Book New Appointment</div>
            </div>
            <div className="modal-body">
              <form onSubmit={handleBookAppointment} className="booking-form">
                <div className="booking-field">
                  <label>Patient Email</label>
                  <input type="email" value={bookingData.patientEmail}
                    onChange={(e) => setBookingData({ ...bookingData, patientEmail: e.target.value })} required />
                </div>
                <div className="booking-field">
                  <label>Patient Phone (optional)</label>
                  <input type="tel" value={bookingData.patientPhone}
                    onChange={(e) => setBookingData({ ...bookingData, patientPhone: e.target.value })} />
                </div>
                <div className="booking-field">
                  <label>Date</label>
                  <input type="date" value={bookingData.date}
                    onChange={(e) => setBookingData({ ...bookingData, date: e.target.value })}
                    min={new Date().toISOString().split("T")[0]} required />
                </div>
                <div className="booking-field">
                  <label>Time</label>
                  <input type="time" value={bookingData.time}
                    onChange={(e) => setBookingData({ ...bookingData, time: e.target.value })} required />
                </div>
                <div className="booking-field">
                  <label>Duration (minutes)</label>
                  <select value={bookingData.duration}
                    onChange={(e) => setBookingData({ ...bookingData, duration: parseInt(e.target.value) })}>
                    <option value={15}>15</option>
                    <option value={30}>30</option>
                    <option value={45}>45</option>
                    <option value={60}>60</option>
                  </select>
                </div>
                <div className="modal-actions" style={{ marginTop: "1.2rem" }}>
                  <button type="submit" className="booking-submit-btn">Book Appointment</button>
                  <button type="button" className="booking-cancel-btn" onClick={() => setShowBookingForm(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}