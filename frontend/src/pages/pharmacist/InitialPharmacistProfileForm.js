import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../../styles/pharmacist/PharmacistProfile.css'; // Reusing the same premium styles
import { useApi } from '../../context/ApiContext';
export default function InitialPharmacistProfileForm() {
  const [form, setForm] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
const apiBaseUrl = useApi();
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await axios.post(`${apiBaseUrl}/api/pharmacist/profile`, form, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      navigate('/pharmacist-dashboard');
    } catch (err) {
      console.error(err);
      setError('Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pharm-profile-container">
      <div className="pharm-profile-card">
        <div className="pharm-profile-header">
          <h2>Welcome to Pharmacy</h2>
          <p>Please complete your initial profile setup</p>
          
          <div className="pharm-profile-avatar-wrapper">
             <div className="pharm-profile-avatar">PH</div>
          </div>
        </div>

        <div className="pharm-profile-body">
          {error && <div className="pharm-profile-error">{error}</div>}

          <form onSubmit={handleSubmit} className="pharm-profile-form">
            <div className="pharm-profile-section-title">Professional Identity</div>
            
            <div className="pharm-form-group">
              <label htmlFor="name">Full Name</label>
              <input 
                id="name"
                name="name" 
                value={form.name} 
                onChange={handleChange} 
                placeholder="Enter your full name"
                required 
              />
            </div>

            <div className="pharm-form-group">
              <label htmlFor="phone">Phone Number</label>
              <input 
                id="phone"
                name="phone" 
                value={form.phone} 
                onChange={handleChange} 
                placeholder="e.g. +91 98765 43210"
                required 
              />
            </div>


            <div className="pharm-profile-actions">
              <button 
                type="submit" 
                className="pharm-profile-btn pharm-profile-btn-primary"
                disabled={loading}
              >
                {loading ? 'Saving Profile...' : 'Complete Setup & Enter Dashboard'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
