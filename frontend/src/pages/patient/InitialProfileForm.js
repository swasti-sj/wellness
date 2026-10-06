import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../../styles/InitialProfileForm.css';
import { useApi } from '../../context/ApiContext';

const PATIENT_CATEGORIES = ["Student", "Faculty", "Regular Staff", "Contractual Staff", "Outsourced Staff"];

function InitialProfileForm() {
  const [form, setForm] = useState({
    name: '',
    roll: '',
    sex: '',
    age: '',
    phone: '',
    emergencyContactNo: '',
    patientCategory: '',
    consentAccepted: false,
  });
  const navigate = useNavigate();
  const apiBaseUrl = useApi();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const normalizePhone = (value) => (value || '').replace(/\D/g, '');
    if (normalizePhone(form.phone) && normalizePhone(form.emergencyContactNo) && normalizePhone(form.phone) === normalizePhone(form.emergencyContactNo)) {
      alert('Emergency contact number cannot be the same as your phone number.');
      return;
    }

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
      alert(err.response?.data?.error || 'Failed to save profile');
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
              Emergency Contact No.:
              <input name="emergencyContactNo" value={form.emergencyContactNo} onChange={handleChange} placeholder="e.g. +91 XXXXX XXXXX" required />
            </label>
          </div>

          <div className="consent-card">
            <div className="consent-copy">
              <h3>Patient Consent</h3>
              <p> By agreeing to this consent, you acknowledge that if you are granted a
      counseling or psycologist  appointment, you may directly approach the counselor or psycologist  without
      having to sign any registers at the Health Center. You are voluntarily
      seeking counseling and consent to the booking of a counseling appointment.
      Your booking request is seen only by the counselor or psycologist . All communications are
      confidential.</p>
            </div>
            <label className="consent-check">
              <input name="consentAccepted" type="checkbox" checked={form.consentAccepted} onChange={handleChange} />
              I Agree
            </label>
          </div>

          <button type="submit">Save &amp; Enter Dashboard</button>
        </form>
      </div>
    </div>
  );
}

export default InitialProfileForm;
