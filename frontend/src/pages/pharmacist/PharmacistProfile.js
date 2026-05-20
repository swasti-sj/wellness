import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../../styles/pharmacist/PharmacistProfile.css';
import { useApi } from '../../context/ApiContext';
export default function PharmacistProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const apiBaseUrl = useApi();
  useEffect(() => {
    if (token) {
      loadProfile();
    } else {
      setError('No authentication token found. Please log in.');
      setLoading(false);
    }
  }, [token]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await axios.get(`${apiBaseUrl}/api/pharmacist/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(res.data);
    } catch (err) {
      setError('Failed to load profile details.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile({ ...profile, [name]: value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!profile?.name || !profile?.phone) {
      setError('Please fill in all required fields');
      return;
    }
    try {
      setError('');
      const payload = {
        name: profile.name,
        phone: profile.phone,
        email: profile.email
      };
      await axios.post(`${apiBaseUrl}/api/pharmacist/profile`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEditMode(false);
      await loadProfile();
      alert('Profile updated successfully!');
    } catch (err) {
      setError('Failed to save profile. ' + (err.response?.data?.error || err.message));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  if (loading) return <div className="pharm-profile-loading">Loading profile...</div>;

  const initials = profile?.name
    ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'PH';

  return (
    <div className="pharm-profile-container">
      <div className="pharm-profile-card">
        <div className="pharm-profile-header">
          <h2>Pharmacist Profile</h2>
          <p>IIT Dharwad Medical Department</p>
          
          <div className="pharm-profile-avatar-wrapper">
            <div className="pharm-profile-avatar">{initials}</div>
          </div>
        </div>

        <div className="pharm-profile-body">
          {error && <div className="pharm-profile-error">{error}</div>}

          <form className="pharm-profile-form" onSubmit={handleSave}>
            <div className="pharm-profile-section-title">Official Account</div>
            
            <div className="pharm-form-group">
              <label>Role</label>
              <div className="pharm-profile-value" style={{ textTransform: 'capitalize', fontWeight: 700, color: 'var(--plum)' }}>
                {profile?.role || 'Pharmacist'}
              </div>
            </div>

            <div className="pharm-form-group">
              <label>Email Address</label>
              <div className="pharm-profile-value">{profile?.email || 'N/A'}</div>
            </div>

            <div className="pharm-profile-section-title">Personal Information</div>

            <div className="pharm-form-group">
              <label htmlFor="name">Full Name</label>
              {editMode ? (
                <input
                  id="name"
                  name="name"
                  value={profile?.name || ''}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  required
                />
              ) : (
                <div className="pharm-profile-value">{profile?.name || 'Not provided'}</div>
              )}
            </div>

            <div className="pharm-form-group">
              <label htmlFor="phone">Phone Number</label>
              {editMode ? (
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={profile?.phone || ''}
                  onChange={handleChange}
                  placeholder="e.g. +91 98765 43210"
                  required
                />
              ) : (
                <div className="pharm-profile-value">{profile?.phone || 'Not provided'}</div>
              )}
            </div>

            <div className="pharm-profile-actions">
              {editMode ? (
                <>
                  <button type="submit" className="pharm-profile-btn pharm-profile-btn-primary">
                    Save Changes
                  </button>
                  <button
                    type="button"
                    className="pharm-profile-btn pharm-profile-btn-secondary"
                    onClick={() => {
                      setEditMode(false);
                      loadProfile();
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="pharm-profile-btn pharm-profile-btn-primary"
                    onClick={() => setEditMode(true)}
                  >
                    Edit Profile Details
                  </button>
                  <button
                    type="button"
                    className="pharm-profile-btn pharm-profile-btn-danger"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
