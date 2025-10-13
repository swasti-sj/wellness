import React, { useState, useEffect } from "react";
import axios from "axios";
import { Calendar, momentLocalizer } from "react-big-calendar";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import { format } from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../../styles/doctor/DoctorAppointment.css";
import DoctorNote from "./DoctorNote";
import DoctorPrescription from "./DoctorPrescription";
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

  const [bookingData, setBookingData] = useState({
    patientEmail: "",
    patientPhone: "",
    date: "",
    time: "",
    duration: 30,
  });

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!apiBaseUrl || !token) return;
    fetchAppointments();
    fetchAvailableSlots();
    const interval = setInterval(fetchAppointments, 60000);
    return () => clearInterval(interval);
  }, [apiBaseUrl, token]);

  const fetchAppointments = async () => {
    try {
      const res = await axios.get(`${apiBaseUrl}/appointments/doctor-appointments`, {
        params: { token },
      });

      const formatted = res.data.appointments.map((appt) => ({
        id: appt._id,
        title: `${appt.user?.name || "Unknown"} (${appt.status})`,
        start: new Date(appt.startDateTime),
        end: new Date(appt.endDateTime),
        status: appt.status,
        patient: appt.user,
        slotDay: appt.slotDay,
        slotTime: appt.slotTime,
        fullData: appt,
      }));

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
      const res = await axios.get(`${apiBaseUrl}/appointments/my-slots`, {
        params: { token },
      });
      setAvailableSlots(res.data.slots);
    } catch (err) {
      console.error("Error fetching available slots:", err);
    }
  };

  const handleSelectEvent = (event) => setSelectedEvent(event);
  const handleCloseModal = () => setSelectedEvent(null);

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    try {
      const startDateTime = new Date(`${bookingData.date}T${bookingData.time}:00`).toISOString();
      const endDateTime = new Date(new Date(startDateTime).getTime() + bookingData.duration * 60000).toISOString();

      const res = await axios.post(`${apiBaseUrl}/appointments/doctor-book`, {
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
      console.error("Booking failed:", err);
      alert("Failed to book appointment: " + (err.response?.data?.error || err.message));
    }
  };

  const handleCancelAppointment = async (appointmentId, slotDay, slotTime) => {
    if (!window.confirm("Are you sure you want to cancel this appointment?")) return;

    try {
      const res = await axios.delete(`${apiBaseUrl}/appointments/${appointmentId}/doctor-cancel`, {
        data: { token, slotDay, slotTime },
      });

      if (res.data.success) {
        fetchAppointments();
        fetchAvailableSlots();
        alert("Appointment cancelled successfully");
        setSelectedEvent(null);
      }
    } catch (err) {
      console.error("Error cancelling appointment:", err);
      alert("Failed to cancel appointment: " + (err.response?.data?.error || err.message));
    }
  };

  const navigate = useNavigate();

  const handleViewHistory = (patient) => {
    if (!patient?.roll && !patient?.email) {
      alert("No roll number or email available for this patient");
      return;
    }

    // Prefer roll number, fallback to email
    const identifier = patient.roll || patient.email;
    navigate("/docdashboard/history", { state: { query: identifier } });
  };

  const handleStatusUpdate = async (appointmentId, newStatus) => {
    try {
      const res = await axios.patch(`${apiBaseUrl}/appointments/${appointmentId}/status`, {
        token,
        status: newStatus,
      });
      if (res.data.success) {
        fetchAppointments();
        alert(`Appointment marked as ${newStatus}`);
        setSelectedEvent(null);
      }
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Failed to update status: " + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="appointments-container">
      <div className="calendar-header">
        <h2>My Appointments</h2>
        <button
          onClick={() => setShowBookingForm(true)}
          className="add-appointment-btn"
        >
          + New Appointment
        </button>
      </div>

      {isLoading && <p>Loading appointments...</p>}
      {error && <p className="error-message">{error}</p>}

      {!isLoading && !error && (
        <div className="calendar-container">
          <Calendar
            localizer={localizer}
            events={appointments}
            startAccessor="start"
            endAccessor="end"
            style={{ height: "80vh" }}
            views={["month", "week", "day", "agenda"]}
            view={view}                          
            onView={(newView) => setView(newView)}  
            date={date}                          
            onNavigate={(newDate) => setDate(newDate)}            
            popup
            onSelectEvent={handleSelectEvent}
            components={{ toolbar: CustomToolbar }}
            eventPropGetter={(event) => {
              let backgroundColor = "#012970";
              if (event.status === "attended") backgroundColor = "#28a745";
              else if (event.status === "cancelled") backgroundColor = "#dc3545";
              else if (event.status === "no show") backgroundColor = "#6c757d";
              return { style: { backgroundColor, borderRadius: "8px", color: "#fff" } };
            }}
          />
        </div>
      )}

      {selectedEvent && (
        <div className="appointment-modal">
          <div className="modal-content">
            <h3>{selectedEvent.patient?.name || "Unknown Patient"}</h3>
            <p><strong>Email:</strong> {selectedEvent.patient?.email || "N/A"}</p>
            <p><strong>Date:</strong> {format(selectedEvent.start, "dd MMM yyyy")}</p>
            <p>
              <strong>Time:</strong> {format(selectedEvent.start, "hh:mm a")} – {format(selectedEvent.end, "hh:mm a")}
            </p>
            <p><strong>Status:</strong> {selectedEvent.status}</p>

            {selectedEvent.status === "booked" && (
              <div className="status-update">
                <select
                  onChange={(e) => handleStatusUpdate(selectedEvent.id, e.target.value)}
                  defaultValue=""
                >
                  <option value="" disabled>Update Status</option>
                  <option value="attended">Mark Completed</option>
                  <option value="no show">Mark No-Show</option>
                  <option value="walk in">Mark Walk In</option>
                </select>
              </div>
            )}

            <div className="modal-actions">
              {(selectedEvent.status === "booked" ||
                selectedEvent.status === "in-progress") && (
                <button
                  onClick={() =>
                    handleCancelAppointment(
                      selectedEvent.id,
                      selectedEvent.slotDay,
                      selectedEvent.slotTime
                    )
                  }
                  className="cancel-btn"
                >
                  Cancel Appointment
                </button>
              )}
              <button onClick={handleCloseModal} className="close-btn">
                Close
              </button>
              <button
                onClick={() => handleViewHistory(selectedEvent.patient)}
                className="history-btn"
              >
                View History
              </button>

            </div>

            <hr />
            <DoctorNote appointmentId={selectedEvent.id} />
            <DoctorPrescription
              appointmentId={selectedEvent.id}
              patientId={selectedEvent.patient?._id}
            />
          </div>
        </div>
      )}

      {showBookingForm && (
        <div className="appointment-modal">
          <div className="modal-content">
            <h3>Book New Appointment</h3>
            <form onSubmit={handleBookAppointment} className="booking-form">
              <div className="form-group">
                <label>Patient Email:</label>
                <input
                  type="email"
                  value={bookingData.patientEmail}
                  onChange={(e) => setBookingData({ ...bookingData, patientEmail: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Patient Phone (optional):</label>
                <input
                  type="tel"
                  value={bookingData.patientPhone}
                  onChange={(e) => setBookingData({ ...bookingData, patientPhone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Date:</label>
                <input
                  type="date"
                  value={bookingData.date}
                  onChange={(e) => setBookingData({ ...bookingData, date: e.target.value })}
                  min={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>
              <div className="form-group">
                <label>Time:</label>
                <input
                  type="time"
                  value={bookingData.time}
                  onChange={(e) => setBookingData({ ...bookingData, time: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Duration (minutes):</label>
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

              <div className="modal-actions">
                <button type="submit" className="submit-btn">Book</button>
                <button
                  type="button"
                  onClick={() => setShowBookingForm(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
