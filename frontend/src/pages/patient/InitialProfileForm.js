import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../../styles/InitialProfileForm.css';
import { useApi } from '../../context/ApiContext';
const PATIENT_CATEGORIES = ["Student", "Faculty", "Staff", "Outsourced Staff"];
function InitialProfileForm() {
  const [form, setForm] = useState({ name: '', roll: '', sex: '', age: '', phone: '', uhid: '', patientCategory: '', consentAccepted: false });
  const navigate = useNavigate();
  const apiBaseUrl = useApi();
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${apiBaseUrl}/api/users/profile`, form, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      alert('Profile saved');
      navigate('/patdashboard', { replace: true });

    } catch (err) {
      console.error(err);
      alert('Failed to save profile');
    }
  };

  return (
    <div className="patient-profile-page">
      <div className="patient-profile-shell">
        <div className="profile-hero">
          <div>
            <div className="profile-kicker">Welcome to Wellness</div>
            <h1>Complete Your Profile</h1>
            <p className="profile-subtitle">
              Please provide your basic information to help us provide you with the best clinical care.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="profile-form profile-form-modern">
          <div className="profile-grid">
            <label className="profile-span-2">
              Full Name:
              <input name="name" value={form.name} onChange={handleChange} placeholder="As per official records" required />
            </label>
            
            <label>
              Roll Number / ID:
              <input name="roll" value={form.roll} onChange={handleChange} placeholder="e.g. 210010001" required />
            </label>

            <label>
              Patient Category:
              <select name="patientCategory" value={form.patientCategory} onChange={handleChange} required>
                <option value="">Select Category</option>
                {PATIENT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Sex:
              <select name="sex" value={form.sex} onChange={handleChange} required>
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <label>
              Age:
              <input name="age" type="number" value={form.age} onChange={handleChange} placeholder="Years" required />
            </label>

            <label>
              Phone Number:
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="e.g. +91 XXXXX XXXXX" required />
            </label>
            <label>
              UHID Number:
              <input name="uhid" value={form.uhid} onChange={handleChange} placeholder="Unique Health ID" required />
            </label>
          </div>

          <div className="consent-card">
            <div className="consent-copy">
              <h3>Patient Consent</h3>
              <p>I agree to the processing of my medical data for clinical purposes.</p>
            </div>
            <label className="consent-check">
              <input name="consentAccepted" type="checkbox" checked={form.consentAccepted} onChange={handleChange} required />
              I Agree
            </label>
          </div>

          <button type="submit">Save & Enter Dashboard</button>
        </form>
      </div>
    </div>
  );
}

export default InitialProfileForm;
