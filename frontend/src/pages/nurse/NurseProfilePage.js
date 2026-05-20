import { useEffect, useState } from 'react';
import axios from 'axios';
import '../../styles/doctor/ProfilePage.css';

function NurseProfilePage({ apiBaseUrl }) {
  const [profile, setProfile] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!apiBaseUrl) return;
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('No authentication token found. Please log in.');
          return;
        }
        const res = await axios.get(`${apiBaseUrl}/api/nurse/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProfile(res.data);
      } catch (err) {
        console.error('Error fetching nurse profile:', err);
        setError('Failed to load profile. ' + (err.response?.data?.error || 'Please try again later.'));
        setProfile(null);
      }
    };
    fetchProfile();
  }, [apiBaseUrl]);

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      await axios.put(`${apiBaseUrl}/api/nurse/profile`, profile, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert('Profile updated successfully.');
      setEditMode(false);
    } catch (err) {
      console.error('Error saving profile:', err);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  if (error) {
    return <div className="profile-container error-message">{error}</div>;
  }

  if (!profile) {
    return <div className="profile-container">Loading profile...</div>;
  }

  return (
    <div className="profile-wrapper">
      <div className="profile-container">

        {/* LEFT PANEL */}
        <div className="profile-left">
          <h2>Nurse Profile</h2>
          <img
            src={profile.picture || 'default-profile.png'}
            alt="Profile"
            className="profile-picture"
          />

          <div className="profile-fields">
            <div className="profile-field">
              <label>Name</label>
              {editMode ? (
                <input name="name" value={profile.name || ''} onChange={handleChange} />
              ) : (
                <p>{profile.name || 'Not set'}</p>
              )}
            </div>

            <div className="profile-field">
              <label>Email</label>
              {editMode ? (
                <input name="email" type="email" value={profile.email || ''} onChange={handleChange} />
              ) : (
                <p>{profile.email || 'Not set'}</p>
              )}
            </div>

            <div className="profile-field">
              <label>Phone</label>
              {editMode ? (
                <input name="phone" value={profile.phone || ''} onChange={handleChange} />
              ) : (
                <p>{profile.phone || 'Not set'}</p>
              )}
            </div>
          </div>

          <div className="profile-buttons">
            {!editMode ? (
              <button className="edit-btn" onClick={() => setEditMode(true)}>
                Edit Profile
              </button>
            ) : (
              <button className="save-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
            <button className="signout-btn" onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="profile-right">
          <h4>Nurse Information</h4>
          <p>As a nurse, you have access to all appointments and patient records in the system.</p>
          <p>You can manage appointments, update patient vitals, and maintain clinical records across all departments.</p>
        </div>

      </div>
    </div>
  );
}

export default NurseProfilePage;