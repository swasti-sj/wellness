import React, { useState, useEffect } from "react";
import axios from "axios";
import "../../styles/AppointmentBooking.css";

// Helper to get next date for a weekday (Mon-Sun)
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
  return nextDate.toISOString().split("T")[0];
};

export default function AppointmentBooking() {
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [availableTimes, setAvailableTimes] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [events, setEvents] = useState([]);
  const [isBooking, setIsBooking] = useState(false);

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (token) {
      fetchAvailableSlots();
      fetchEvents();
      const interval = setInterval(fetchEvents, 60000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const fetchAvailableSlots = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/doctors/available");
      setDoctors(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEvents = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/appointments/my-appointments", {
        params: { token },
      });
      setEvents(res.data.appointments || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Update available times when doctor or date changes
  useEffect(() => {
    if (selectedDoctorId && selectedDate) {
      const doc = doctors.find((d) => d._id === selectedDoctorId);
      if (doc) {
        const weekday = new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long" });
        const slot = doc.availableSlots?.find((s) => s.day === weekday);
        setAvailableTimes(slot ? slot.times.map(t => t.time) : []);
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
    const res = await axios.post("http://localhost:5000/api/appointments/book", {
      token,
      doctorId: selectedDoctorId,
      slotDay: new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long" }),
      slotTime: selectedTime,
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
    });

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
    console.error("Booking failed:", err.response?.data?.error || err.message);
    alert(err.response?.data?.error || "Booking failed. Please try again.");
  } finally {
    setIsBooking(false);
  }
};

  const cancelEvent = async (ev) => {
  if (!window.confirm("Are you sure you want to cancel?")) return;

  try {
    await axios.delete(`http://localhost:5000/api/appointments/${ev._id}/cancel`, {
      data: { token },
    });

    alert("Cancellation request processed!");
    fetchEvents();
    fetchAvailableSlots();
  } catch (err) {
    console.error(err);
    alert(err.response?.data?.error || "Failed to cancel.");
  }
};


  return (
    <div className="appointment-container">
      <h2 className="appointment-title">Book an Appointment</h2>

      <div className="appointment-form">
        {/* Doctor */}
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

        {/* Date */}
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

        {/* Time */}
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

        <button
          className="appointment-btn"
          onClick={bookAppointment}
          disabled={isBooking}
        >
          {isBooking ? "Booking..." : "Book Appointment"}
        </button>
      </div>

      {/* Upcoming Appointments */}
      <h3>Upcoming Appointments</h3>
      {events.length === 0 ? (
        <p>No appointments</p>
      ) : (
        <ul className="appointments-list">
          {events.map((ev) => (
            <li key={ev._id} className="appointment-item">
              <strong>
                {ev.doctor?.name} ({ev.doctor?.specialization})
              </strong>
              <br />
              {new Date(ev.startDateTime).toLocaleString()} -{" "}
              {new Date(ev.endDateTime).toLocaleString()}
              <br />
              Status: {ev.status}
              {ev.status === "booked" && (
                <button
                  className="appointment-cancel-btn"
                  onClick={() => cancelEvent(ev)}
                >
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}