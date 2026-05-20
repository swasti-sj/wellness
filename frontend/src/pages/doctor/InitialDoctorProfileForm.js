import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../../styles/InitialProfileForm.css';

const daysOfWeek = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

const dayAbbrev = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' };

function emptyWeeklySlots() {
  return daysOfWeek.map(day => ({
    day,
    times: [{ time: '', status: 'available' }]
  }));
}

function InitialDoctorProfileForm({ apiBaseUrl }) {
  const [form, setForm] = useState({
    name: '',
    specialization: '',
    phone: '',
    weeklySlots: emptyWeeklySlots(),
  });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

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

  const removeTimeSlot = (dayIndex, timeIndex) => {
    const updatedSlots = form.weeklySlots.map((slot, idx) => {
      if (idx !== dayIndex) return slot;
      if (slot.times.length <= 1) return slot; // keep at least one
      return {
        ...slot,
        times: slot.times.filter((_, tIdx) => tIdx !== timeIndex),
      };
    });
    setForm({ ...form, weeklySlots: updatedSlots });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const processedForm = JSON.parse(JSON.stringify(form));
    processedForm.weeklySlots = processedForm.weeklySlots.map(daySlot => ({
      ...daySlot,
      times: daySlot.times.filter(timeSlot => timeSlot.time.trim() !== '')
    }));

    try {
      await axios.post(`${apiBaseUrl}/api/doctors/profile`, processedForm, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      alert('Profile saved');
      navigate('/docdashboard');
    } catch (err) {
      console.error(err);
      alert('Failed to save profile');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ipf-wrapper">
      <div className="ipf-card ipf-card--doctor">
        <div className="ipf-header ipf-header--compact">
          <img src="/WebIcon.plain.svg" alt="IIT Dharwad" className="ipf-logo" />
          <div>
            <h1 className="ipf-title">Complete Your Doctor Profile</h1>
            <p className="ipf-subtitle">IIT Dharwad Medical Portal</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="ipf-form">
          {/* Basic Info — all 3 fields in one row */}
          <div className="ipf-row ipf-row--three">
            <div className="ipf-field">
              <label htmlFor="doc-name">Full Name <span className="ipf-required">*</span></label>
              <input
                id="doc-name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g., Dr. Ramesh Kumar"
                required
              />
            </div>

            <div className="ipf-field">
              <label htmlFor="doc-spec">Specialization <span className="ipf-required">*</span></label>
              <input
                id="doc-spec"
                name="specialization"
                type="text"
                value={form.specialization}
                onChange={handleChange}
                placeholder="e.g., General Medicine"
                required
              />
            </div>

            <div className="ipf-field">
              <label htmlFor="doc-phone">Phone Number <span className="ipf-required">*</span></label>
              <input
                id="doc-phone"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                placeholder="e.g., +91 98765 43210"
                required
              />
            </div>
          </div>

          {/* Weekly Slots */}
          <div className="ipf-slots-section">
            <div className="ipf-slots-header">
              <h2 className="ipf-slots-title">Weekly Availability</h2>
              <p className="ipf-slots-desc">Set your consultation time slots for each day</p>
            </div>

            <div className="ipf-slots-grid">
              {form.weeklySlots.map((slot, dayIdx) => (
                <div key={slot.day} className="ipf-day-card">
                  <div className="ipf-day-label">
                    <span className="ipf-day-abbrev">{dayAbbrev[slot.day]}</span>
                    <span className="ipf-day-full">{slot.day}</span>
                  </div>
                  <div className="ipf-day-times">
                    {slot.times.map((t, timeIdx) => (
                      <div key={timeIdx} className="ipf-time-chip">
                        <input
                          type="time"
                          className="ipf-time-input"
                          value={t.time}
                          onChange={e => handleSlotChange(dayIdx, timeIdx, 'time', e.target.value)}
                        />
                        {slot.times.length > 1 && (
                          <button
                            type="button"
                            className="ipf-time-remove"
                            onClick={() => removeTimeSlot(dayIdx, timeIdx)}
                            title="Remove slot"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="ipf-add-time"
                      onClick={() => addTimeSlot(dayIdx)}
                    >
                      + Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className="ipf-submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save & Enter Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default InitialDoctorProfileForm;