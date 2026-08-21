import React, { useState, useEffect } from "react";
import axios from "axios";
import { Calendar, momentLocalizer } from "react-big-calendar";
import { useNavigate, useLocation } from "react-router-dom";
import moment from "moment";
import { format } from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../../styles/doctor/DoctorAppointment.css";
import DoctorNote from "../doctor/DoctorNote";
import DoctorPrescription from "../doctor/DoctorPrescription";
import DoctorVitals from "../doctor/DoctorVitals";
import DoctorHospitalReferral from "../doctor/DoctorHospitalReferral";
import DoctorCertificate from "../doctor/DoctorCertificate";
import SelectedTestsSummary from "../doctor/SelectedTestsSummary";
import CustomToolbar from "../doctor/CustomToolbar";

const localizer = momentLocalizer(moment);

export default function NurseAppointment({ apiBaseUrl }) {
  const [appointments, setAppointments] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [view, setView] = useState("month");
  const [date, setDate] = useState(new Date());
  const [openSubSection, setOpenSubSection] = useState(null);

  // Filters
  const [patientSearch, setPatientSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [bookingData, setBookingData] = useState({
    patientEmail: "",
    patientPhone: "",
    dependantId: "",
    doctorId: "",
    date: "",
    time: "",
    duration: 30,
  });
  const [isBooking, setIsBooking] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [dependants, setDependants] = useState([]);
  const [patientCategory, setPatientCategory] = useState("");
  const [dependantsLoading, setDependantsLoading] = useState(false);

  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const email = bookingData.patientEmail.trim();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    setDependants([]);
    setPatientCategory("");
    setBookingData((current) => ({ ...current, dependantId: "" }));
    if (!isValidEmail || !token || !apiBaseUrl) return;

    setDependantsLoading(true);
    axios.get(`${apiBaseUrl}/api/users/patient-dependants`, {
      params: { email },
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => {
      setPatientCategory(res.data.patientCategory || "");
      setDependants(res.data.dependants || []);
    })
      .catch(() => {
        setPatientCategory("");
        setDependants([]);
      })
      .finally(() => setDependantsLoading(false));
  }, [bookingData.patientEmail, apiBaseUrl, token]);

  const patientCanHaveDependants = ["Faculty", "Staff", "Outsourced Staff"].includes(patientCategory);

  // Reopen appointment modal when returning from TestPage
  useEffect(() => {
    if (location.state?.openAppointmentId && location.state?.openSection) {
      const targetId = location.state.openAppointmentId;
      const targetSection = location.state.openSection;
      if (filteredAppointments.length > 0) {
        const evt = filteredAppointments.find(a => a.id === targetId);
        if (evt) {
          setSelectedEvent(evt);
          setOpenSubSection(targetSection);
          navigate(location.pathname, { replace: true, state: {} });
        }
      }
    }
  }, [filteredAppointments, location.state]);

  useEffect(() => {
    if (!apiBaseUrl || !token) return;
    fetchAppointments();
    fetchDoctors();
    const interval = setInterval(fetchAppointments, 60000);
    return () => clearInterval(interval);
  }, [apiBaseUrl, token]);

  const fetchDoctors = async () => {
    try {
      const res = await axios.get(`${apiBaseUrl}/api/doctors/list`);
      setDoctors(res.data || []);
    } catch (err) {
      console.error("Error fetching doctors:", err);
    }
  };

  const fetchAppointments = async () => {
    try {
      const res = await axios.get(`${apiBaseUrl}/api/appointments/all-appointments`, {
        params: { token },
      });
      const formatted = res.data.appointments.map((appt) => {
        const patient = appt.user || appt.fullData?.user;
        const dependant = appt.dependant || appt.fullData?.dependant || null;
        const patientName = patient?.name || patient?.email || patient?.roll || "Unknown";
        const dependantLabel = dependant?.name
          ? `${dependant.name} (${dependant.relationship || "Dependant"})`
          : null;
        return {
          id: appt._id,
          title: dependantLabel
            ? `${dependantLabel} — ${patientName} (${appt.status})`
            : `${patientName} (${appt.status})`,
          start: new Date(appt.startDateTime),
          end: new Date(appt.endDateTime),
          status: appt.status,
          patient,
          patientName,
          doctor: appt.doctor,
          dependant,
          dependantLabel,
          slotDay: appt.slotDay,
          slotTime: appt.slotTime,
          fullData: appt,
        };
      });
      setAppointments(formatted);
      filterAppointments(formatted, patientSearch, startDate, endDate, statusFilter);
    } catch (err) {
      console.error("Error fetching appointments:", err);
      setError("Failed to fetch appointments.");
    } finally {
      setIsLoading(false);
    }
  };

  const filterAppointments = (appts, patient = "", start = "", end = "", status = "") => {
    let filtered = appts;

    if (patient.trim()) {
      filtered = filtered.filter(
        (appt) =>
          appt.patient?.name?.toLowerCase().includes(patient.toLowerCase()) ||
          appt.patient?.email?.toLowerCase().includes(patient.toLowerCase()) ||
          appt.patient?.roll?.toLowerCase().includes(patient.toLowerCase())
      );
    }

    if (start) {
      const startDt = new Date(start);
      filtered = filtered.filter((appt) => appt.start >= startDt);
    }
    if (end) {
      const endDt = new Date(end);
      filtered = filtered.filter((appt) => appt.start <= endDt);
    }

    if (status) {
      filtered = filtered.filter((appt) => appt.status === status);
    }

    setFilteredAppointments(filtered);
  };

  const handleFilterChange = () => {
    filterAppointments(appointments, patientSearch, startDate, endDate, statusFilter);
  };

  useEffect(() => {
    handleFilterChange();
  }, [patientSearch, startDate, endDate, statusFilter]);

  const handleSelectEvent = (event) => { setSelectedEvent(event); setOpenSubSection(null); };
  const handleCloseModal = () => setSelectedEvent(null);

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (isBooking) return;
    setIsBooking(true);
    try {
      const startDateTime = new Date(`${bookingData.date}T${bookingData.time}:00`).toISOString();
      const endDateTime = new Date(new Date(startDateTime).getTime() + bookingData.duration * 60000).toISOString();
      const res = await axios.post(`${apiBaseUrl}/api/appointments/nurse-book`, {
        token,
        patientEmail: bookingData.patientEmail,
        patientPhone: bookingData.patientPhone,
        dependantId: bookingData.dependantId,
        doctorId: bookingData.doctorId,
        startDateTime,
        endDateTime,
        slotDay: new Date(bookingData.date).toLocaleDateString("en-US", { weekday: "long" }),
        slotTime: bookingData.time,
      });
      if (res.data.success) {
        setShowBookingForm(false);
        setBookingData({ patientEmail: "", patientPhone: "", dependantId: "", doctorId: "", date: "", time: "", duration: 30 });
        fetchAppointments();
        alert("Appointment booked successfully!");
      }
    } catch (err) {
      alert("Failed to book appointment: " + (err.response?.data?.error || err.message));
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancelAppointment = async (appointmentId, slotDay, slotTime) => {
    if (!window.confirm("Are you sure you want to cancel this appointment?")) return;
    try {
      const res = await axios.delete(`${apiBaseUrl}/api/appointments/${appointmentId}/nurse-cancel`, {
        data: { token, slotDay, slotTime },
      });
      if (res.data.success) {
        fetchAppointments();
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
    navigate("/nurse-dashboard/patient-history", { state: { query: patient.roll || patient.email } });
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

  // ── Sub-section accordion ──
  const toggleSub = (key) => setOpenSubSection((p) => (p === key ? null : key));

  const SubSection = ({ id, title, subtitle, children }) => {
    const isOpen = openSubSection === id;
    return (
      <div className="modal-sub-section">
        <button
          type="button"
          className={`modal-sub-toggle${isOpen ? " open" : ""}`}
          onClick={() => toggleSub(id)}
        >
          <div className="modal-sub-left">
            <div>
              <div className="modal-sub-title">{title}</div>
              {subtitle && <div className="modal-sub-subtitle">{subtitle}</div>}
            </div>
          </div>
          <span className="modal-sub-chevron">&#8250;</span>
        </button>
        <div className={`modal-sub-body${isOpen ? " open" : ""}`}>
          {children}
        </div>
      </div>
    );
  };

  const eventStyleGetter = (event) => {
    const status = event.status?.toLowerCase() || "booked";
    let c = { bg: "#FFF7E6", border: "#C8860A", text: "#9A6408" };

    if (status === "attended") c = { bg: "#E8F6EF", border: "#1E8A55", text: "#166640" };
    else if (status.includes("cancel")) c = { bg: "#FCECEF", border: "#B8243A", text: "#8C1A2A" };
    else if (status === "no show") c = { bg: "#F0F0F4", border: "#5A5A70", text: "#3A3A50" };
    else if (status === "walk in") c = { bg: "#F4E9F9", border: "#6C1B85", text: "#4A1060" };

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
        <h2>All Appointments</h2>
        <button onClick={() => setShowBookingForm(true)} className="add-appointment-btn">
          + New Appointment
        </button>
      </div>

      {/* ── Filter Bar ── */}
      <div className="appt-filter-bar">
        <div className="appt-filter-group">
          <label className="appt-filter-label">Search Patient</label>
          <input
            type="text"
            className="appt-filter-input"
            placeholder="Name, Email, or Roll"
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
          />
        </div>
        <div className="appt-filter-group">
          <label className="appt-filter-label">Start Date</label>
          <input
            type="date"
            className="appt-filter-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="appt-filter-group">
          <label className="appt-filter-label">End Date</label>
          <input
            type="date"
            className="appt-filter-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="appt-filter-group">
          <label className="appt-filter-label">Status</label>
          <select
            className="appt-filter-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="booked">Booked</option>
            <option value="attended">Attended</option>
            <option value="no show">No Show</option>
            <option value="cancelled by user">Cancelled by User</option>
            <option value="cancelled by doctor">Cancelled by Doctor</option>
            <option value="walk in">Walk In</option>
          </select>
        </div>
      </div>

      {isLoading && <p className="loading-text">Loading appointments…</p>}
      {error && <p className="error-message">{error}</p>}

      {!isLoading && !error && (
        <div className="calendar-container">
          <Calendar
            localizer={localizer}
            events={filteredAppointments}
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
            <div className="modal-header-bar">
              <button className="close-btn" onClick={handleCloseModal} title="Close">&#10005;</button>
              <div className="modal-patient-name">
                {selectedEvent.dependantLabel
                  ? selectedEvent.dependantLabel
                  : selectedEvent.patientName || selectedEvent.patient?.name || "Unknown Patient"}
              </div>
              <div className="modal-meta">
                {selectedEvent.dependant?.name && (
                  <>
                    <span><strong>Primary Patient:</strong> {selectedEvent.dependant.name}</span>
                    <span><strong>UHID:</strong> {selectedEvent.dependant.uhid || "N/A"}</span>
                    <span><strong>Dependant of:</strong> {selectedEvent.patientName || selectedEvent.patient?.name || "N/A"}</span>
                  </>
                )}
                {!selectedEvent.dependant?.name && (
                  <span><strong>Patient:</strong> {selectedEvent.patientName || selectedEvent.patient?.name || "N/A"}</span>
                )}
                <span><strong>Email:</strong> {selectedEvent.patient?.email || "N/A"}</span>
                <span><strong>Date:</strong> {format(selectedEvent.start, "dd MMM yyyy")}</span>
                <span><strong>Time:</strong> {format(selectedEvent.start, "hh:mm a")} – {format(selectedEvent.end, "hh:mm a")}</span>
                {selectedEvent.doctor && (
                  <span><strong>Doctor:</strong> Dr. {selectedEvent.doctor.name || "—"}</span>
                )}
                <span>
                  <span className={`modal-status-badge ${selectedEvent.status?.toLowerCase().includes("cancel") ? "cancelled" : selectedEvent.status?.replace(" ", "-").toLowerCase()}`}>
                    {selectedEvent.status}
                  </span>
                </span>
              </div>
            </div>

            <div className="modal-body">
              {/* Status update */}
              {selectedEvent.status === "booked" && (
                <div className="status-update">
                  <label>Update Status</label>
                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <select
                      value={selectedEvent.status}
                      onChange={(e) => handleStatusUpdate(selectedEvent.id, e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="booked" disabled>— Update Status —</option>
                      <option value="attended">Mark Completed</option>
                      <option value="no show">Mark No-Show</option>
                      <option value="walk in">Mark Walk-in</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="modal-actions" style={{ display: "flex", gap: "0.65rem" }}>
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

              <SubSection id="casesheet" title="Case Sheet" subtitle="Basic details, vitals, medical history, treatment">
                <DoctorVitals
                  appointmentId={selectedEvent.id}
                  patientId={selectedEvent.patient?._id}
                  dependantUhid={selectedEvent.dependant?.uhid}
                  apiBaseUrl={apiBaseUrl}
                />
              </SubSection>

              <SubSection id="notes" title="Clinical Notes" subtitle="Running notes for this visit">
                <DoctorNote appointmentId={selectedEvent.id} />
              </SubSection>

              <SubSection id="prescription" title="Prescription" subtitle="Medicines, dosage, frequency">
                <DoctorPrescription
                  appointmentId={selectedEvent.id}
                  patientId={selectedEvent.patient?._id}
                />
              </SubSection>

              <SubSection id="tests" title="Lab Tests" subtitle="Ordered investigations">
                <SelectedTestsSummary
                  appointmentId={selectedEvent.id}
                  onEditClick={() =>
                    navigate(
                      `/nurse-dashboard/test-page?appointmentId=${selectedEvent.id}&patientId=${selectedEvent.patient?._id}`,
                      {
                        state: {
                          openAppointmentId: selectedEvent.id,
                          openSection: "tests",
                          returnUrl: "/nurse-dashboard/appointments",
                        },
                      }
                    )
                  }
                />
              </SubSection>

              <SubSection id="referral" title="Hospital Referral" subtitle="Refer to external hospital">
                <DoctorHospitalReferral appointmentId={selectedEvent.id} />
              </SubSection>

              <SubSection id="certificate" title="Medical Certificate" subtitle="Issue fitness / medical certificate">
                <DoctorCertificate appointmentId={selectedEvent.id} />
              </SubSection>
            </div>
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
              <button className="close-btn" onClick={() => setShowBookingForm(false)}>&#10005;</button>
              <div className="modal-patient-name">Book New Appointment</div>
            </div>
            <div className="modal-body">
              <form onSubmit={handleBookAppointment} className="booking-form">
                <div className="booking-field">
                  <label>Patient Email</label>
                  <input
                    type="email"
                    value={bookingData.patientEmail}
                    onChange={(e) => setBookingData({ ...bookingData, patientEmail: e.target.value })}
                    required
                  />
                </div>
                <div className="booking-field">
                  <label>Patient Phone (optional)</label>
                  <input
                    type="tel"
                    value={bookingData.patientPhone}
                    onChange={(e) => setBookingData({ ...bookingData, patientPhone: e.target.value })}
                  />
                </div>
                <div className="booking-field">
                  {patientCanHaveDependants && <label>Book For (required)</label>}
                  {patientCanHaveDependants && (
                    <select
                      value={bookingData.dependantId}
                      onChange={(e) => setBookingData({ ...bookingData, dependantId: e.target.value })}
                      disabled={dependantsLoading || !dependants.length}
                      required
                    >
                      <option value="">Select dependant</option>
                      {dependantsLoading && <option disabled>Loading dependants...</option>}
                      {!dependantsLoading && !dependants.length && (
                        <option disabled>No dependants found</option>
                      )}
                      {dependants.map((dependant) => (
                        <option key={dependant._id} value={dependant._id}>
                          {dependant.name}{dependant.relationship ? ` (${dependant.relationship})` : ""}
                        </option>
                      ))}
                    </select>)}
                </div>
                <div className="booking-field">
                  <label>Doctor</label>
                  <select
                    value={bookingData.doctorId}
                    onChange={(e) => setBookingData({ ...bookingData, doctorId: e.target.value })}
                    required
                  >
                    <option value="">-- Select Doctor --</option>
                    {doctors.map(doc => (
                      <option key={doc._id} value={doc._id}>
                        {doc.name} ({doc.specialization || "General"})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="booking-field">
                  <label>Date</label>
                  <input
                    type="date"
                    value={bookingData.date}
                    onChange={(e) => setBookingData({ ...bookingData, date: e.target.value })}
                    min={new Date().toISOString().split("T")[0]}
                    required
                  />
                </div>
                <div className="booking-field">
                  <label>Time</label>
                  <input
                    type="time"
                    value={bookingData.time}
                    onChange={(e) => setBookingData({ ...bookingData, time: e.target.value })}
                    required
                  />
                </div>
                <div className="booking-field">
                  <label>Duration (minutes)</label>
                  <select
                    value={bookingData.duration}
                    onChange={(e) => setBookingData({ ...bookingData, duration: parseInt(e.target.value) })}
                  >
                    <option value={15}>15</option>
                    <option value={30}>30</option>
                    <option value={45}>45</option>
                    <option value={60}>60</option>
                  </select>
                </div>
                <div className="modal-actions" style={{ marginTop: "1.2rem" }}>
                  <button type="submit" className="booking-submit-btn" disabled={isBooking}>
                    {isBooking ? "Booking..." : "Book Appointment"}
                  </button>
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