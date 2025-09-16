import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../../styles/InitialProfileForm.css';

// Helper to create empty weekly slots
const daysOfWeek = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

function emptyWeeklySlots() {
  return daysOfWeek.map(day => ({
    day,
    times: [{ time: '', status: 'available' }]
  }));
}

function InitialDoctorProfileForm({apiBaseUrl}) {
  const [form, setForm] = useState({
    name: '',
    specialization: '',
    phone: '',
    weeklySlots: emptyWeeklySlots(),
  });
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Handle slot time change
  const handleSlotChange = (dayIndex, timeIndex, field, value) => {
    const updatedSlots = form.weeklySlots.map((slot, idx) => {
      if (idx !== dayIndex) return slot;
      return {
        ...slot,
        times: slot.times.map((t, tIdx) =>
          tIdx !== timeIndex ? t : { ...t, [field]: value }
        ),
      };
    });
    setForm({ ...form, weeklySlots: updatedSlots });
  };

  // Add new time to a day
  const addTimeSlot = (dayIndex) => {
    const updatedSlots = form.weeklySlots.map((slot, idx) => {
      if (idx !== dayIndex) return slot;
      return {
        ...slot,
        times: [...slot.times, { time: '', status: 'available' }],
      };
    });
    setForm({ ...form, weeklySlots: updatedSlots });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${apiBaseUrl}/doctors/profile`, form, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      alert('Profile saved');
      navigate('/docdashboard');
    } catch (err) {
      console.error(err);
      alert('Failed to save profile');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="profile-form">
      <label>
        Name:
        <input name="name" value={form.name} onChange={handleChange} required />
      </label>
      <label>
        Specialization:
        <input name="specialization" value={form.specialization} onChange={handleChange} required />
      </label>
      <label>
        Phone:
        <input name="phone" value={form.phone} onChange={handleChange} required />
      </label>
      <div>
        <h3>Weekly Slots</h3>
        {form.weeklySlots.map((slot, dayIdx) => (
          <div key={slot.day} style={{ marginBottom: '10px' }}>
            <strong>{slot.day}:</strong>
            {slot.times.map((t, timeIdx) => (
              <span key={timeIdx} style={{ marginLeft: 10 }}>
                <input
                  type="time"
                  value={t.time}
                  onChange={e => handleSlotChange(dayIdx, timeIdx, 'time', e.target.value)}
                  style={{ marginRight: 5 }}
                  required
                />
                <select
                  value={t.status}
                  onChange={e => handleSlotChange(dayIdx, timeIdx, 'status', e.target.value)}
                  style={{ marginRight: 5 }}
                >
                  <option value="available">Available</option>
                  <option value="booked">Booked</option>
                  <option value="attended">Attended</option>
                  <option value="no show">No Show</option>
                  <option value="cancelled by user">Cancelled by User</option>
                  <option value="cancelled by doctor">Cancelled by Doctor</option>
                  <option value="walk in">Walk In</option>
                </select>
              </span>
            ))}
            <button type="button" onClick={() => addTimeSlot(dayIdx)}>+ Add Time</button>
          </div>
        ))}
      </div>
      <button type="submit">Save</button>
    </form>
  );
}

export default InitialDoctorProfileForm;
