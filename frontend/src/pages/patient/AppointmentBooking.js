import React, { useEffect, useState } from 'react';
import axios from 'axios';

function AppointmentBooking() {
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [availableTimes, setAvailableTimes] = useState([]);
  const [selectedTime, setSelectedTime] = useState('');

  useEffect(() => {
    axios.get('http://localhost:5000/api/doctors')
      .then(res => setDoctors(res.data))
      .catch(err => console.error(err));
  }, []);

  const handleDoctorChange = (e) => {
  const doc = doctors.find(d => d._id === e.target.value);
  setSelectedDoctor(doc);
  setSelectedDate('');
  setSelectedTime('');
  setAvailableTimes([]);
};

  const handleDateChange = (e) => {
    const date = e.target.value;
    setSelectedDate(date);
    const slot = selectedDoctor?.availableSlots?.find(s => s.date === date);
    setAvailableTimes(slot ? slot.times : []);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedDoctor || !selectedDate || !selectedTime) return;

    const payload = {
    doctorId: selectedDoctor._id,
    date: selectedDate,
    time: selectedTime,
  };

    axios.post('http://localhost:5000/api/appointments/book', payload, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    })
      .then(() => alert('Appointment booked successfully!'))
      .catch(() => alert('Failed to book.'));
  };

  return (
    <div>
      <h2>Book an Appointment</h2>
      <form onSubmit={handleSubmit}>
        <label>Doctor:</label>
        <select onChange={handleDoctorChange} required>
          <option value="">Select Doctor</option>
          {doctors.map(doc => (
            <option key={doc._id} value={doc._id}>
              {doc.name} - {doc.specialization}
            </option>
          ))}
        </select>

        {selectedDoctor && (
          <>
            <label>Date:</label>
            <select onChange={handleDateChange} value={selectedDate} required>
              <option value="">Select Date</option>
              {selectedDoctor.availableSlots.map(slot => (
                <option key={slot.date} value={slot.date}>{slot.date}</option>
              ))}
            </select>
          </>
        )}

        {availableTimes.length > 0 && (
          <>
            <label>Time:</label>
            <select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              required
            >
              <option value="">Select Time</option>
              {availableTimes.map((t, idx) => (
                <option key={idx} value={t}>{t}</option>
              ))}
            </select>
          </>
        )}

        <button
          type="submit"
          disabled={!selectedDoctor || !selectedDate || !selectedTime}
        >
          Book
        </button>
      </form>
    </div>
  );
}

export default AppointmentBooking;
