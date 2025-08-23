import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Helper to get next date for a weekday (Mon-Sun)
const getNextDateForDay = (dayName) => {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today = new Date();
  const dayIndex = days.indexOf(dayName);
  const diff = (dayIndex + 7 - today.getDay()) % 7 || 7;
  const nextDate = new Date();
  nextDate.setDate(today.getDate() + diff);
  return nextDate;
};

export default function AppointmentBooking() {
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [events, setEvents] = useState([]);
  const [isBooking, setIsBooking] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (token) {
      fetchEvents();
      fetchAvailableSlots();
      const interval = setInterval(fetchEvents, 60000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const fetchAvailableSlots = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/doctors/available');
      setDoctors(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEvents = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/appointments/my-appointments', {
        params: { token },
      });
      setEvents(res.data.appointments || []); 
    } catch (err) {
      console.error('Error fetching events:', err);
    }
  };

  const bookAppointment = async () => {
    if (!selectedDoctor || !selectedDate || !selectedTime) {
      alert('Please fill in all fields.');
      return;
    }

    const selectedDoc = doctors.find(d => d._id === selectedDoctor);
    const slotDay = selectedDoc?.availableSlots?.find(s => getNextDateForDay(s.day).toISOString().split("T")[0] === selectedDate)?.day;

    if (!slotDay) {
      alert("Invalid slot selected.");
      return;
    }

    setIsBooking(true);
    const startDateTime = new Date(`${selectedDate}T${selectedTime}`);
    const endDateTime = new Date(startDateTime.getTime() + 30 * 60000);

    try {
      const res = await axios.post('http://localhost:5000/api/appointments/book', {
        token,
        doctorId: selectedDoctor,
        slotDay,
        slotTime: selectedTime,
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
      });

      alert('Booked! Event ID: ' + res.data.event.id);
      fetchEvents();
      fetchAvailableSlots();
      setSelectedDate('');
      setSelectedTime('');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to book.');
    } finally {
      setIsBooking(false);
    }
  };

  const cancelEvent = async (ev) => {
  if (
    !window.confirm(
      "Are you sure you want to cancel?\n\n Reminder: If you cancel within 15 minutes of booking, the appointment will be fully deleted. Otherwise, it will be marked as 'Cancelled by user'."
    )
  ) {
    return;
  }
  try {
    await axios.delete(`http://localhost:5000/api/appointments/${ev.calendarEventId}/cancel`, {
      data: { 
        token,
        doctorId: ev.doctor._id,
        slotDay: ev.slotDay,
        slotTime: ev.slotTime
      }
    });

    alert('Cancellation request processed!');
    fetchEvents();
    fetchAvailableSlots();
  } catch (err) {
    console.error(err);
    alert('Failed to cancel.');
  }
};


  const selectedDoc = doctors.find(d => d._id === selectedDoctor);
  const availableSlots = selectedDoc?.availableSlots || [];

  return (
    <div style={{ maxWidth: '600px', margin: '30px auto', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontFamily: 'Arial, sans-serif', backgroundColor: '#f9f9f9' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#012970' }}>Book Appointment</h2>

      {/* Doctor */}
      <div style={{ marginBottom: '15px' }}>
        <label>Doctor:</label>
        <select value={selectedDoctor} onChange={e => { setSelectedDoctor(e.target.value); setSelectedDate(''); setSelectedTime(''); }} style={{ width: '100%', padding: '8px' }}>
          <option value="">Select Doctor</option>
          {doctors.map(d => <option key={d._id} value={d._id}>{d.name} ({d.specialization})</option>)}
        </select>
      </div>

      {/* Date */}
      {selectedDoctor && (
        <div style={{ marginBottom: '15px' }}>
          <label>Date:</label>
          <select value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setSelectedTime(''); }} style={{ width: '100%', padding: '8px' }}>
            <option value="">Select Date</option>
            {availableSlots.filter(s => s.times.length > 0).map(s => {
              const realDate = getNextDateForDay(s.day);
              const isoDate = realDate.toISOString().split("T")[0];
              return <option key={s.day} value={isoDate}>{isoDate} ({s.day})</option>
            })}
          </select>
        </div>
      )}

      {/* Time */}
      {selectedDate && (
        <div style={{ marginBottom: '20px' }}>
          <label>Time:</label>
          <select value={selectedTime} onChange={e => setSelectedTime(e.target.value)} style={{ width: '100%', padding: '8px' }}>
            <option value="">Select Time</option>
            {availableSlots.find(s => getNextDateForDay(s.day).toISOString().split("T")[0] === selectedDate)?.times.map(t => (
              <option key={t.time} value={t.time}>{t.time}</option>
            ))}
          </select>
        </div>
      )}

      <button onClick={bookAppointment} disabled={isBooking} style={{ width: '100%', padding: '10px', backgroundColor: '#012970', color: 'white', borderRadius: '5px', marginBottom: '30px' }}>
        {isBooking ? 'Booking...' : 'Book Appointment'}
      </button>

      <h3>Upcoming Appointments</h3>
      {events.length === 0 ? <p>No appointments</p> : (
        <ul>
          {events.map(ev => (
            <li key={ev._id} style={{ marginBottom: '15px', padding: '10px', border: '1px solid #ddd' }}>
              <strong>{ev.doctor?.name} ({ev.doctor?.specialization})</strong><br/>
              {new Date(ev.startDateTime).toLocaleString()} - {new Date(ev.endDateTime).toLocaleString()}<br/>
              Status: {ev.status}
              
              {/* Only show cancel if status === booked */}
              {ev.status === "booked" && (
                <button 
                  onClick={() => cancelEvent(ev)} 
                  style={{ marginTop: '5px', padding: '5px', backgroundColor: '#EA4335', color: 'white' }}
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
