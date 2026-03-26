import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../../styles/pharmacist/PharmacistProfile.css';

export default function PharmacistProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  useEffect(() => {
    const storedRole = localStorage.getItem('role');
    console.log('PharmacistProfile: Component mounted - token exists:', !!token, 'stored role:', storedRole);

    if (token) {
      loadProfile();
    } else {
      console.log('PharmacistProfile: No token found in localStorage');
      setError('No authentication token found. Please log in.');
      setLoading(false);
    }
  }, [token]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await axios.get('http://localhost:5000/api/pharmacist/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(res.data);
    } catch (err) {
      console.error('Profile load error:', err);
      if (err.response?.status === 401) {
        setError('Authentication failed. Please log in again.');
      } else if (err.response?.status === 403) {
        setError('Access denied. You do not have permission to view this profile.');
      } else {
        setError('Failed to load profile. ' + (err.response?.data?.error || err.message));
      }
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
      const res = await axios.post('http://localhost:5000/api/pharmacist/profile', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success || res.data.message) {
        setEditMode(false);
        await loadProfile();
        alert('Profile updated successfully!');
      }
    } catch (err) {
      console.error('Save error:', err.response || err);
      setError('Failed to save profile. ' + (err.response?.data?.error || err.message));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  if (loading) return <div className="pharm-profile-loading">⏳ Loading profile...</div>;

  return (
    <div className="pharm-profile-container">
      <div className="pharm-profile-card">
        <div className="pharm-profile-header">
          <h2>👤 Pharmacist Profile</h2>
          <p>{profile?.email || 'IIT Dharwad Pharmacy'}</p>
        </div>

        <div className="pharm-profile-body">
          {error && <div className="pharm-profile-error">⚠️ {error}</div>}

          <form className="pharm-profile-form" onSubmit={handleSave}>
            <div className="pharm-form-group">
              <label htmlFor="name">📛 Name</label>
              {editMode ? (
                <input
                  id="name"
                  name="name"
                  value={profile?.name || ''}
                  onChange={handleChange}
                  placeholder="Enter your name"
                  required
                />
              ) : (
                <div className="pharm-profile-value">{profile?.name || 'Not provided'}</div>
              )}
            </div>

            <div className="pharm-form-group">
              <label htmlFor="phone">📞 Phone</label>
              {editMode ? (
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={profile?.phone || ''}
                  onChange={handleChange}
                  placeholder="Enter your phone number"
                />
              ) : (
                <div className="pharm-profile-value">{profile?.phone || 'Not provided'}</div>
              )}
            </div>

            <div className="pharm-form-group">
              <label htmlFor="email">📧 Email</label>
              <div className="pharm-profile-value">{profile?.email || 'N/A'}</div>
              <small style={{ color: '#7A6890', marginTop: '-8px' }}>Email cannot be changed</small>
            </div>

            <div className="pharm-form-group">
              <label htmlFor="role">💼 Role</label>
              <div className="pharm-profile-value" style={{ textTransform: 'capitalize' }}>
                {profile?.role || 'pharmacist'}
              </div>
            </div>

            <div className="pharm-profile-actions">
              {editMode ? (
                <>
                  <button type="submit" className="pharm-profile-btn pharm-profile-btn-primary">
                    ✅ Save Changes
                  </button>
                  <button
                    type="button"
                    className="pharm-profile-btn pharm-profile-btn-secondary"
                    onClick={() => {
                      setEditMode(false);
                      loadProfile(); // Reload to discard changes
                    }}
                  >
                    ❌ Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="pharm-profile-btn pharm-profile-btn-primary"
                    onClick={() => setEditMode(true)}
                  >
                    ✏️ Edit Profile
                  </button>
                  <button
                    type="button"
                    className="pharm-profile-btn pharm-profile-btn-danger"
                    onClick={handleLogout}
                  >
                    🚪 Logout
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

