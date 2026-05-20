import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../../styles/InitialProfileForm.css';
import { useApi } from '../../context/ApiContext';

export default function InitialReceptionistProfileForm() {
  const [form, setForm] = useState({ name: '', phone: '', age: '', sex: '' });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const apiBaseUrl = useApi();
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post(`${apiBaseUrl}/api/receptionist/profile`, form, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      navigate('/receptionist-dashboard');
    } catch (err) {
      console.error(err);
      alert('Failed to save profile. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ipf-wrapper">
      <div className="ipf-card">
        <div className="ipf-header">
          <img src="/WebIcon.plain.svg" alt="IIT Dharwad" className="ipf-logo" />
          <h1 className="ipf-title">IIT Dharwad Medical Portal</h1>
          <p className="ipf-subtitle">Complete your Receptionist profile to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="ipf-form">
          <div className="ipf-field">
            <label htmlFor="name">Full Name <span className="ipf-required">*</span></label>
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter your full name"
              required
            />
          </div>

          <div className="ipf-field">
            <label htmlFor="phone">Phone Number <span className="ipf-required">*</span></label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              placeholder="e.g., +91 98765 43210"
              required
            />
          </div>

          <div className="ipf-row">
            <div className="ipf-field">
              <label htmlFor="age">Age <span className="ipf-required">*</span></label>
              <input
                id="age"
                name="age"
                type="number"
                min="18"
                max="100"
                value={form.age}
                onChange={handleChange}
                placeholder="e.g., 28"
                required
              />
            </div>

            <div className="ipf-field">
              <label htmlFor="sex">Sex <span className="ipf-required">*</span></label>
              <select
                id="sex"
                name="sex"
                value={form.sex}
                onChange={handleChange}
                required
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <button type="submit" className="ipf-submit" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save and Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}