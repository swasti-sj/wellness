import { useEffect, useState } from 'react';
import axios from 'axios';
import '../../styles/doctor/ProfilePage.css';

function DoctorProfilePage({ apiBaseUrl }) {
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

        const res = await axios.get(`${apiBaseUrl}/api/doctors/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProfile(res.data);
      } catch (err) {
        console.error('Error fetching doctor profile:', err);
        setError(
          'Failed to load profile. ' +
          (err.response?.data?.error || 'Please try again later.')
        );
        setProfile(null);
      }
    };

    fetchProfile();
  }, [apiBaseUrl]);

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSlotChange = (dayIndex, timeIndex, field, value) => {
    const updatedSlots = profile.weeklySlots.map((slot, idx) => {
      if (idx !== dayIndex) return slot;
      return {
        ...slot,
        times: slot.times.map((t, tIdx) =>
          tIdx !== timeIndex ? t : { ...t, [field]: value }
        ),
      };
    });
    setProfile({ ...profile, weeklySlots: updatedSlots });
  };

  const addTimeSlot = (dayIndex) => {
    const updatedSlots = profile.weeklySlots.map((slot, idx) => {
      if (idx !== dayIndex) return slot;
      return {
        ...slot,
        times: [...slot.times, { time: '', status: 'available' }],
      };
    });
    setProfile({ ...profile, weeklySlots: updatedSlots });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      await axios.put(`${apiBaseUrl}/api/doctors/profile`, profile, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert('Profile updated successfully!');
      setEditMode(false);
    } catch (err) {
      console.error('Error saving profile:', err);
      alert('Failed to save changes');
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
          <h2>Doctor Profile</h2>
          <img
            src={profile.picture || 'default-profile.png'}
            alt="Profile"
            className="profile-picture"
          />

          <div className="profile-fields">
            <div className="profile-field">
              <label>Name</label>
              {editMode ? (
                <input
                  name="name"
                  value={profile.name || ''}
                  onChange={handleChange}
                />
              ) : (
                <p>{profile.name || 'Not set'}</p>
              )}
            </div>

            <div className="profile-field">
              <label>Email</label>
              {editMode ? (
                <input
                  name="email"
                  type="email"
                  value={profile.email || ''}
                  onChange={handleChange}
                />
              ) : (
                <p>{profile.email || 'Not set'}</p>
              )}
            </div>

            <div className="profile-field">
              <label>Specialization</label>
              {editMode ? (
                <input
                  name="specialization"
                  value={profile.specialization || ''}
                  onChange={handleChange}
                />
              ) : (
                <p>{profile.specialization || 'Not set'}</p>
              )}
            </div>

            <div className="profile-field">
              <label>Phone</label>
              {editMode ? (
                <input
                  name="phone"
                  value={profile.phone || ''}
                  onChange={handleChange}
                />
              ) : (
                <p>{profile.phone || 'Not set'}</p>
              )}
            </div>
          </div>

          <div className="profile-buttons">
            {!editMode ? (
              <button className="edit-btn" onClick={() => setEditMode(true)}>
                ✏️ Edit Profile
              </button>
            ) : (
              <button
                className="save-btn"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : '💾 Save Changes'}
              </button>
            )}
            <button className="signout-btn" onClick={handleSignOut}>
              🚪 Sign Out
            </button>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="profile-right">
          <h4>Weekly Availability</h4>
          <div className="weekly-slots">
            {profile.weeklySlots && profile.weeklySlots.length > 0 ? (
              profile.weeklySlots.map((slot, dayIdx) => (
                <div key={slot.day} className="slot-day">
                  <strong>{slot.day}:</strong>
                  {editMode ? (
                    <>
                      {slot.times.map((t, timeIdx) => (
                        <span key={timeIdx} style={{ marginLeft: 10 }}>
                          <input
                            type="time"
                            value={t.time}
                            onChange={(e) =>
                              handleSlotChange(
                                dayIdx,
                                timeIdx,
                                'time',
                                e.target.value
                              )
                            }
                            className="time-input"
                          />
                          <select
                            value={t.status}
                            onChange={(e) =>
                              handleSlotChange(
                                dayIdx,
                                timeIdx,
                                'status',
                                e.target.value
                              )
                            }
                            className="status-select"
                          >
                            <option value="available">Available</option>
                            <option value="booked">Booked</option>
                            <option value="attended">Attended</option>
                            <option value="no show">No Show</option>
                            <option value="cancelled by user">
                              Cancelled by User
                            </option>
                            <option value="cancelled by doctor">
                              Cancelled by Doctor
                            </option>
                            <option value="walk in">Walk In</option>
                          </select>
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() => addTimeSlot(dayIdx)}
                        className="add-slot-btn"
                      >
                        + Add Time
                      </button>
                    </>
                  ) : (
                    <span>
                      {slot.times && slot.times.length > 0
                        ? slot.times.map((t) => t.time).join(', ')
                        : 'No available times'}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p>No weekly slots defined.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DoctorProfilePage;
