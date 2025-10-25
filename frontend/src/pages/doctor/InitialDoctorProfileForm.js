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
    times: [{ time: '', status: 'available' }] // Default status is 'available'
  }));
}

function InitialDoctorProfileForm({ apiBaseUrl }) {
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
        times: [...slot.times, { time: '', status: 'available' }], // New slots are also 'available'
      };
    });
    setForm({ ...form, weeklySlots: updatedSlots });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Create a deep copy of the form data to process before submitting
    const processedForm = JSON.parse(JSON.stringify(form));

    // Filter out any time slots that are empty
    processedForm.weeklySlots = processedForm.weeklySlots.map(daySlot => ({
      ...daySlot,
      times: daySlot.times.filter(timeSlot => timeSlot.time.trim() !== '')
    }));

    try {
      await axios.post(`${apiBaseUrl}/doctors/profile`, processedForm, { // Send the processed form
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
                  // The 'required' attribute has been removed
                />
                {/* The status select dropdown has been removed */}
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
