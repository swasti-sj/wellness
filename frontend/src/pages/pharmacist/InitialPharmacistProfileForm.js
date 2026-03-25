import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../../styles/InitialProfileForm.css';

export default function InitialPharmacistProfileForm() {
  const [form, setForm] = useState({ name: '', phone: '', age: '', sex: '' });
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/pharmacist/profile', form, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      alert('Pharmacist profile saved');
      navigate('/pharmacist-dashboard');
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
        Phone:
        <input name="phone" value={form.phone} onChange={handleChange} required />
      </label>
      <label>
        Age:
        <input name="age" type="number" value={form.age} onChange={handleChange} required />
      </label>
      <label>
        Sex:
        <select name="sex" value={form.sex} onChange={handleChange} required>
          <option value="">Select</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
      </label>
      <button type="submit">Save</button>
    </form>
  );
}
