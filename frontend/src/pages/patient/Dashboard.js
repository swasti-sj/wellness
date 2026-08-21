import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import "../../styles/Dashboard.css";
import { useApi } from "../../context/ApiContext";
export default function Dashboard() {
  const [doctors, setDoctors] = useState([]);
  const [upcomingAppointment, setUpcomingAppointment] = useState(null);
  const [lastVisit, setLastVisit] = useState(null);
  const [lastVisitPrescription, setLastVisitPrescription] = useState(null);
  const [error, setError] = useState("");
  const apiBaseUrl = useApi();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Missing authorization token. Please log in again.");
      return;
    }

    const fetchDoctors = async () => {
      try {
        const res = await axios.get(`${apiBaseUrl}/api/doctors/available`);
        setDoctors(res.data || []);
      } catch (err) {
        console.error("Error fetching doctors:", err);
        setError("Unable to load available doctors right now.");
      }
    };

    const fetchAppointments = async () => {
      try {
        const res = await axios.get(`${apiBaseUrl}/api/appointments/my-appointments`, {
          params: { token },
        });
        const appointments = res.data.appointments || [];
        const now = new Date();

        const upcoming = appointments
          .filter((appt) => new Date(appt.startDateTime) > now && appt.status === "booked")
          .sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime))[0];

        const past = appointments
          .filter((appt) => new Date(appt.startDateTime) <= now && ["attended", "walk in", "no show", "cancelled by user", "cancelled by doctor"].includes(appt.status))
          .sort((a, b) => new Date(b.startDateTime) - new Date(a.startDateTime))[0];

        setUpcomingAppointment(upcoming || null);
        setLastVisit(past || null);

        // Fetch prescription for last visit if it exists
        if (past) {
          try {
            const prescriptionRes = await axios.get(`${apiBaseUrl}/api/prescriptions/${past._id}`, {
              params: { token },
            });
            setLastVisitPrescription(prescriptionRes.data);
          } catch (prescriptionErr) {
            console.log("No prescription found for last visit:", prescriptionErr);
            setLastVisitPrescription(null);
          }
        } else {
          setLastVisitPrescription(null);
        }
      } catch (err) {
        const message = err.response?.data?.error || err.message || "Unknown error";
        console.error("Error fetching appointments:", message, err);
        setError(`Unable to load appointment details right now. ${message}`);
      }
    };

    fetchDoctors();
    fetchAppointments();
  }, []);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (doctors.length > 0 || upcomingAppointment || lastVisit || error) {
      setLoading(false);
    }
  }, [doctors, upcomingAppointment, lastVisit, error]);

  const stats = [
    { label: "Available Doctors", value: doctors.length, color: "info" },
    { label: "Upcoming Appts", value: upcomingAppointment ? 1 : 0, color: "success" },
    { label: "Recent Prescriptions", value: lastVisitPrescription?.prescriptions?.length || 0, color: "warning" }
  ];

  const formatDateTime = (datetime) => {
    if (!datetime) return "N/A";
    const date = new Date(datetime);
    return date.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderNextAvailability = (doctor) => {
    const nextSlot = doctor.availableSlots?.[0];
    if (!nextSlot) return "No slots available";
    const nextTime = nextSlot.times?.[0]?.time || "Available";
    const nextDate = new Date(nextSlot.date).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
    return `${nextDate} · ${nextTime}`;
  };

  return (
    <div className="dashboard-container">
      <section className="dashboard-hero">
        <div className="dashboard-hero-content">
          <span className="dashboard-tag">Patient Portal</span>
          <h1>Welcome back to IIT Dharwad Wellness</h1>
          <p>Track appointments, review recent visits, and manage your health profile from one smart dashboard.</p>
        </div>
      </section>

      {/* Stats Grid */}
      {/* <section className="stats-section">
        <div className="stats-grid">
          {stats.map((stat, index) => (
            <div key={index} className={`stat-card ${stat.color}`}>
              <div className="stat-label">{stat.label}</div>
              <div className="stat-value">{stat.value}</div>
            </div>
          ))}
        </div>
      </section> */}

      <section>
        <div className="section-header">
          <h2 className="visiting-doctors-title">Available Doctors</h2>
          <p className="section-subtitle">
            Browse currently available specialists and book the best time for your next visit.
          </p>
        </div>
        {error && <p className="error-message">{error}</p>}
        <div className="visiting-doctors-list">
          {doctors.length > 0 ? (
            doctors.map((d) => {
              return (
                <div
                  key={d._id}
                  className="doctor-card"
                >
                  <div className="doctor-card-body">
                    <div className="doctor-card-heading">
                      <div className="doctor-avatar" aria-hidden="true">Dr</div>
                      <div>
                        <h3 className="doctor-card-title">{d.name}</h3>
                        <p className="doctor-card-specialty">{d.specialization || "General care"}</p>
                      </div>
                    </div>
                    <div className="doctor-card-availability">
                      <span className="availability-mark" aria-hidden="true">●</span>
                      <span><strong>Next opening</strong>{renderNextAvailability(d)}</span>
                    </div>
                    <p className="doctor-card-schedule">

                      {d.availableSlots?.length
                        ? `${d.availableSlots.length} available day${d.availableSlots.length === 1 ? "" : "s"}`
                        : "Schedule unavailable"}
                    </p>
                  </div>
                  <div className="doctor-card-footer">
                    <Link
                      to="/patdashboard/book"
                      className="doctor-card-btn"
                      state={{ selectedDoctorId: d._id }}
                    >
                      Book appointment <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="empty-message">No available doctors found right now. Please check back soon.</p>
          )}
        </div>
      </section>

      <section className="upcoming-section">
        <div className="section-header">
          <h2 className="upcoming-title">Upcoming Appointment</h2>
          <p className="section-subtitle">Your next scheduled appointment is shown below.</p>
        </div>
        {upcomingAppointment ? (
          <div className="appointment-card">
            <p>
              <strong>Doctor:</strong> {upcomingAppointment.doctor?.name || "Unknown"}
            </p>
            <p>
              <strong>Specialization:</strong> {upcomingAppointment.doctor?.specialization || "-"}
            </p>
            <p>
              <strong>Date & time:</strong> {formatDateTime(upcomingAppointment.startDateTime)}
            </p>
            <p>
              <strong>Status:</strong> {upcomingAppointment.status}
            </p>
          </div>
        ) : (
          <p className="empty-message">No upcoming appointments. Book your next visit now.</p>
        )}
      </section>

      <section className="lastvisit-section">
        <div className="section-header">
          <h2 className="lastvisit-title">Recent Visit</h2>
          <p className="section-subtitle">Review the most recent appointment details and its status.</p>
        </div>
        {lastVisit ? (
          <div className="appointment-card">
            <p>
              <strong>Doctor:</strong> {lastVisit.doctor?.name || "Unknown"}
            </p>
            <p>
              <strong>Specialization:</strong> {lastVisit.doctor?.specialization || "-"}
            </p>
            <p>
              <strong>Date & time:</strong> {formatDateTime(lastVisit.startDateTime)}
            </p>
            <p>
              <strong>Status:</strong> {lastVisit.status}
            </p>
            {lastVisitPrescription?.prescriptions?.length > 0 && (
              <div className="prescription-section">
                <p><strong>Prescription:</strong></p>
                <div className="prescription-list">
                  {lastVisitPrescription.prescriptions.map((item, index) => (
                    <div key={index} className="prescription-item">
                      <div className="medication-name">
                        <strong>{item.medication || item.medicine?.name || 'Unknown'}</strong>
                      </div>
                      <div className="medication-details">
                        <span>Dosage: {item.dosage}</span>
                        <span>Frequency: {item.frequency}</span>
                        <span>Quantity: {item.quantity}</span>
                        {item.notes && <span className="notes">Notes: {item.notes}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                {lastVisitPrescription.documentUrl && (
                  <div className="prescription-document">
                    <a
                      href={lastVisitPrescription.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="document-link"
                    >
                      📄 View Prescription Document
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="empty-message">No past visits recorded yet.</p>
        )}
      </section>

    </div>
  );
}
