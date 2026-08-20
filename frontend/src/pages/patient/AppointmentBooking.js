import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "../../styles/doctor/DoctorAppointment.css";
import "../../styles/AppointmentBooking.css";
import "../../styles/doctor/PatientHistory.css";
import CustomToolbar from "../doctor/CustomToolbar";
import DoctorVitals from "../doctor/DoctorVitals";
import PatientDocumentPreview from "./PatientDocumentPreview";
import { useApi } from "../../context/ApiContext";

const localizer = momentLocalizer(moment);

const RECORD_SECTIONS = [
  { key: "vitals", label: "Case Sheet" },
  { key: "notes", label: "Notes" },
  { key: "rx", label: "Prescription" },
  { key: "tests", label: "Lab Tests" },
  { key: "referral", label: "Referral" },
  { key: "cert", label: "Certificate" },
];

const getNextDateForDay = (dayName) => {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const today = new Date();
  const dayIndex = days.indexOf(dayName);
  const diff = (dayIndex + 7 - today.getDay()) % 7 || 7;
  const nextDate = new Date();
  nextDate.setDate(today.getDate() + diff);
  return nextDate.toLocaleDateString("en-CA");
};

export default function AppointmentBooking() {
  const location = useLocation();
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [availableTimes, setAvailableTimes] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedDependantId, setSelectedDependantId] = useState("self");
  const [dependants, setDependants] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [isBooking, setIsBooking] = useState(false);
  const [view, setView] = useState("month");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [patientRecords, setPatientRecords] = useState([]);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordError, setRecordError] = useState("");
  const [activeRecordSection, setActiveRecordSection] = useState("vitals");
  const apiBaseUrl = useApi();
  const token = localStorage.getItem("token");

  const fetchUserProfile = useCallback(async () => {
    try {
      const res = await axios.get(`${apiBaseUrl}/api/users/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setPatientId(res.data?._id || res.data?.user?._id || "");
      setDependants(res.data.dependants || []);
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
    }
  }, [apiBaseUrl, token]);

  useEffect(() => {
    if (location.state?.selectedDoctorId) {
      setSelectedDoctorId(location.state.selectedDoctorId);
    }
  }, [location.state]);

  const fetchAvailableSlots = useCallback(async () => {
    try {
      const res = await axios.get(
        `${apiBaseUrl}/api/doctors/available`
      );
      setDoctors(res.data || []);
    } catch (err) {
      console.error(err);
    }
  }, [apiBaseUrl]);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await axios.get(
        `${apiBaseUrl}/api/appointments/my-appointments`,
        {
          params: { token },
        }
      );

      const calEvents = (res.data.appointments || []).map((ev) => ({
        id: ev._id,
        title: `${ev.doctor?.name || "Doctor"} (${ev.status})`,
        start: new Date(ev.startDateTime),
        end: new Date(ev.endDateTime),
        status: ev.status,
        appointment: ev,
      }));
      setCalendarEvents(calEvents);
    } catch (err) {
      console.error(err);
    }
  }, [apiBaseUrl, token]);

  const fetchPatientRecords = useCallback(async () => {
    setRecordLoading(true);
    setRecordError("");
    try {
      const res = await axios.get(`${apiBaseUrl}/api/appointments/my-records`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPatientRecords(res.data.records || []);
    } catch (err) {
      setRecordError(err.response?.data?.error || "Unable to load appointment records.");
    } finally {
      setRecordLoading(false);
    }
  }, [apiBaseUrl, token]);

  useEffect(() => {
    if (token) {
      fetchAvailableSlots();
      fetchEvents();
      fetchPatientRecords();
      fetchUserProfile();
      const interval = setInterval(fetchEvents, 60000);
      return () => clearInterval(interval);
    }
  }, [token, fetchAvailableSlots, fetchEvents, fetchPatientRecords, fetchUserProfile]);

  const openAppointmentDetails = async (event) => {
    setSelectedEvent(event);
    setActiveRecordSection("vitals");
    if (patientRecords.length === 0) {
      await fetchPatientRecords();
    }
  };

  useEffect(() => {
    if (selectedDoctorId && selectedDate) {
      const doc = doctors.find((d) => d._id === selectedDoctorId);
      if (doc) {
        const weekday = new Date(selectedDate).toLocaleDateString("en-US", {
          weekday: "long",
        });
        const slot = doc.availableSlots?.find((s) => s.day === weekday);
        setAvailableTimes(slot ? slot.times.map((t) => t.time) : []);
      } else setAvailableTimes([]);
      setSelectedTime("");
    } else setAvailableTimes([]);
  }, [selectedDoctorId, selectedDate, doctors]);

  const bookAppointment = async () => {
    if (!selectedDoctorId || !selectedDate || !selectedTime) {
      alert("Please select doctor, date, and time");
      return;
    }

    setIsBooking(true);
    const startDateTime = new Date(`${selectedDate}T${selectedTime}`);
    const endDateTime = new Date(startDateTime.getTime() + 30 * 60000);

    try {
      const requestBody = {
        token,
        doctorId: selectedDoctorId,
        slotDay: new Date(selectedDate).toLocaleDateString("en-US", {
          weekday: "long",
        }),
        slotTime: selectedTime,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
      };
      if (selectedDependantId && selectedDependantId !== "self") {
        requestBody.dependantId = selectedDependantId;
      }

      const res = await axios.post(`${apiBaseUrl}/api/appointments/book`, requestBody);

      if (res.data?.success) {
        alert("Booked! Appointment saved successfully.");
        fetchEvents();
        fetchAvailableSlots();
        setSelectedDate("");
        setSelectedTime("");
        setSelectedDoctorId("");
      } else {
        alert(res.data?.error || "Booking failed.");
      }
    } catch (err) {
      console.error(
        "Booking failed:",
        err.response?.data?.error || err.message
      );
      alert(err.response?.data?.error || "Booking failed. Please try again.");
    } finally {
      setIsBooking(false);
    }
  };

  const cancelEvent = async (ev) => {
    if (!window.confirm("Are you sure you want to cancel?")) return;
    try {
      await axios.delete(
        `${apiBaseUrl}/api/appointments/${ev.id}/cancel`,
        {
          data: { token },
        }
      );
      alert("Cancellation request processed!");
      fetchEvents();
      fetchAvailableSlots();
      setSelectedEvent(null);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to cancel.");
    }
  };

  const renderAppointmentRecord = () => {
    if (!selectedEvent) return null;

    const record = patientRecords.find((item) => item._id === selectedEvent.id) || selectedEvent.appointment || {};
    const dependant = record.dependant || selectedEvent.appointment?.dependant;
    const patient = record.user || selectedEvent.appointment?.user;

    return (
      <>
        <div className="ph-appointment-context patient-modal-context">
          {dependant?.name ? (
            <>
              <strong>Patient:</strong> {dependant.name}
              <strong>Dependant of:</strong> {patient?.name || "Primary patient"}
              <strong>UHID:</strong> {dependant.uhid || "N/A"}
            </>
          ) : (
            <>
              <strong>Patient:</strong> {patient?.name || "Patient"}
              <strong>UHID:</strong> {patient?.uhid || "N/A"}
            </>
          )}
        </div>

        <div className="ph-section-btns patient-modal-sections">
          {RECORD_SECTIONS.map((section) => (
            <button
              key={section.key}
              type="button"
              className={`ph-sec-btn${activeRecordSection === section.key ? " active" : ""}`}
              onClick={() => setActiveRecordSection(section.key)}
            >
              <span>{section.label}</span>
            </button>
          ))}
        </div>

        {recordLoading && <p className="ph-empty">Loading appointment records...</p>}
        {recordError && <p className="ph-error">{recordError}</p>}

        {!recordLoading && activeRecordSection === "vitals" && (
          <div className="ph-section-panel patient-modal-panel">
            <DoctorVitals
              appointmentId={selectedEvent.id}
              patientId={patient?._id || patientId}
              dependantUhid={dependant?.uhid}
              apiBaseUrl={apiBaseUrl}
              readOnly
            />
          </div>
        )}

        {!recordLoading && activeRecordSection === "notes" && (
          <div className="ph-section-panel ph-read-panel patient-modal-panel">
            {record.notes?.length ? record.notes.map((note) => (
              <article className="ph-read-item" key={note._id}>
                <strong>Clinical note</strong>
                <p>{note.text}</p>
              </article>
            )) : <p className="ph-empty">No clinical notes have been recorded.</p>}
          </div>
        )}

        {!recordLoading && activeRecordSection === "rx" && (
          <div className="ph-section-panel ph-read-panel patient-modal-panel">
            {record.prescription?.prescriptions?.length ? record.prescription.prescriptions.map((item, index) => (
              <article className="ph-read-item" key={`${item.medication || item.medicine?.name || "medicine"}-${index}`}>
                <strong>{item.medication || item.medicine?.name || "Medication"}</strong>
                <p>{item.dosage || ""} - {item.frequency || ""} - Quantity {item.quantity || "N/A"}</p>
                {item.notes && <small>{item.notes}</small>}
              </article>
            )) : <p className="ph-empty">No prescription has been issued.</p>}
            <PatientDocumentPreview title="Prescription Document" url={record.prescription?.documentUrl} emptyMessage="No prescription document uploaded." />
          </div>
        )}

        {!recordLoading && activeRecordSection === "tests" && (
          <div className="ph-section-panel ph-read-panel patient-modal-panel">
            {record.tests?.tests?.length ? (
              <ul className="ph-test-list">
                {record.tests.tests.filter((test) => test.selected !== false).map((test) => (
                  <li key={test._id || test.testName}>{test.testName}</li>
                ))}
              </ul>
            ) : <p className="ph-empty">No tests recorded.</p>}
            <PatientDocumentPreview title="Lab Test Document" url={record.tests?.labTestDocumentUrl} emptyMessage="No lab test document uploaded." />
          </div>
        )}

        {!recordLoading && activeRecordSection === "referral" && (
          <div className="ph-section-panel ph-read-panel patient-modal-panel">
            {record.tests?.hospitalReferral?.refer ? (
              <article className="ph-read-item">
                <strong>{record.tests.hospitalReferral.hospitalName || "Hospital referral"}</strong>
                {record.tests.hospitalReferral.remarks && <p>{record.tests.hospitalReferral.remarks}</p>}
                <small>Ambulance: {record.tests.hospitalReferral.ambulanceUsed ? "Yes" : "No"}</small>
                <small>Cashless form: {record.tests.hospitalReferral.cashlessFormUsed ? "Yes" : "No"}</small>
                {record.tests.hospitalReferral.staffWent && <small>Staff: {record.tests.hospitalReferral.staffWent}</small>}
              </article>
            ) : <p className="ph-empty">No hospital referral has been recorded.</p>}
            <PatientDocumentPreview title="Referral Document" url={record.tests?.hospitalReferral?.cashlessFormDocumentUrl} emptyMessage="No referral document uploaded." />
          </div>
        )}

        {!recordLoading && activeRecordSection === "cert" && (
          <div className="ph-section-panel ph-read-panel patient-modal-panel">
            {record.tests?.certificate?.issued ? (
              <article className="ph-read-item">
                <strong>Medical certificate issued</strong>
                {record.tests.certificate.clinicalDetails && <p>{record.tests.certificate.clinicalDetails}</p>}
              </article>
            ) : <p className="ph-empty">No medical certificate has been issued.</p>}
            <PatientDocumentPreview title="Medical Certificate" url={record.tests?.certificate?.imageUrl} emptyMessage="No medical certificate uploaded." />
          </div>
        )}
      </>
    );
  };

  return (
    <div className="appointment-page">
      {/* LEFT: FORM */}
      <div className="appointment-container">
        <h2 className="appointment-title">Book an Appointment</h2>
        <div className="appointment-form">
          <div>
            <label className="appointment-label">Select Doctor</label>
            <select
              className="appointment-select"
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
            >
              <option value="">Choose a doctor</option>
              {doctors.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} ({d.specialization})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="appointment-label">Select Date</label>
            <select
              className="appointment-select"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            >
              <option value="">Choose a date</option>
              {selectedDoctorId &&
                doctors
                  .find((d) => d._id === selectedDoctorId)
                  ?.availableSlots.map((slot) => {
                    const date = getNextDateForDay(slot.day);
                    return (
                      <option key={date} value={date}>
                        {date} ({slot.day})
                      </option>
                    );
                  })}
            </select>
          </div>

          <div>
            <label className="appointment-label">Select Time</label>
            <select
              className="appointment-select"
              value={selectedTime}
              disabled={availableTimes.length === 0}
              onChange={(e) => setSelectedTime(e.target.value)}
            >
              <option value="">Choose time</option>
              {availableTimes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {dependants.length > 0 && (
            <div>
              <label className="appointment-label">Book For</label>
              <select
                className="appointment-select"
                value={selectedDependantId}
                onChange={(e) => setSelectedDependantId(e.target.value)}
              >
                <option value="self">Self</option>
                {dependants.map((dep) => (
                  <option key={dep._id} value={dep._id}>
                    {dep.name} {dep.relationship ? `(${dep.relationship})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            className="appointment-btn"
            onClick={bookAppointment}
            disabled={isBooking}
          >
            {isBooking ? "Booking..." : "Book Appointment"}
          </button>
        </div>
      </div>

      {/* RIGHT: CALENDAR */}
      <div className="calendar-section">
        <h3 className="calendar-title">Appointment Calendar</h3>
        <div className="calendar-container">
          <Calendar
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 500 }}
            view={view}
            onView={(v) => setView(v)}
            components={{ toolbar: CustomToolbar }}
            eventPropGetter={(event) => {
              let background = "linear-gradient(45deg, #89288f, #ff7b00)";
              if (event.status === "booked")
                background = "linear-gradient(45deg, #ffb300, #ff7b00)";
              if (event.status === "attended")
                background = "linear-gradient(45deg, #28a745, #6dd47e)";
              if (event.status === "cancelled")
                background = "linear-gradient(45deg, #d9534f, #ff7675)";
              return {
                style: {
                  background,
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "2px 6px",
                  cursor: "pointer",
                },
              };
            }}
            onSelectEvent={openAppointmentDetails}
          />
        </div>
      </div>

      {selectedEvent && (
        <div className="appointment-modal" onClick={(e) => e.target === e.currentTarget && setSelectedEvent(null)}>
          <div className="modal-content patient-appointment-detail-modal">
            <div className="modal-header-bar">
              <button className="close-btn" onClick={() => setSelectedEvent(null)} title="Close">x</button>
              <div className="modal-patient-name">
                {selectedEvent.appointment?.dependant?.name || selectedEvent.appointment?.doctor?.name || "Appointment"}
              </div>
              <div className="modal-meta">
                <span><strong>Doctor:</strong> {selectedEvent.appointment?.doctor?.name || "N/A"}</span>
                {selectedEvent.appointment?.dependant?.name && (
                  <>
                    <span><strong>UHID:</strong> {selectedEvent.appointment.dependant.uhid || "N/A"}</span>
                    <span><strong>Dependant of:</strong> {selectedEvent.appointment.user?.name || "Primary patient"}</span>
                  </>
                )}
                <span><strong>Date:</strong> {moment(selectedEvent.start).format("DD MMM YYYY")}</span>
                <span><strong>Time:</strong> {moment(selectedEvent.start).format("hh:mm A")} - {moment(selectedEvent.end).format("hh:mm A")}</span>
                <span><strong>Status:</strong> {selectedEvent.status}</span>
              </div>
            </div>

            <div className="modal-body">
              {selectedEvent.status === "booked" && (
                <div className="modal-actions patient-appointment-actions">
                  <button className="cancel-btn" onClick={() => cancelEvent(selectedEvent)}>
                    Cancel Appointment
                  </button>
                </div>
              )}

              <div className="modal-divider" />
              {renderAppointmentRecord()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
