import { useEffect, useState } from 'react';
import axios from 'axios';
import '../../styles/ProfilePage.css'; // Reusing the same styles as the user profile

function DoctorProfilePage({apiBaseUrl}) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!apiBaseUrl) return; // wait until loaded
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('No authentication token found. Please log in.');
          return;
        }
        
        const res = await axios.get(`${apiBaseUrl}/doctors/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setProfile(res.data);
      } catch (err) {
        console.error('Error fetching doctor profile:', err);
        setError('Failed to load profile. ' + (err.response?.data?.error || 'Please try again later.'));
        setProfile(null);
      }
    };

    fetchProfile();
  }, []);

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
        <h2>Doctor Profile</h2>
        <img
          src={profile.picture || 'default-profile.png'} // Fallback image
          alt="Profile"
          className="profile-picture"
        />
        <p><strong>Name:</strong> {profile.name || 'Not set'}</p>
        <p><strong>Email:</strong> {profile.email || 'Not set'}</p>
        <p><strong>Specialization:</strong> {profile.specialization || 'Not set'}</p>
        <p><strong>Phone:</strong> {profile.phone || 'Not set'}</p>
        
        {/* Optional: Display Weekly Slots */}
        <div className="weekly-slots">
          <h4>Availability</h4>
          {profile.weeklySlots && profile.weeklySlots.length > 0 ? (
            profile.weeklySlots.map(slot => (
              <div key={slot.day} className="slot-day">
                <strong>{slot.day}:</strong>
                <span>
                  {slot.times && slot.times.length > 0
                    ? slot.times.map(t => t.time).join(', ')
                    : 'No available times'}
                </span>
              </div>
            ))
          ) : (
            <p>No weekly slots defined.</p>
          )}
        </div>

        <button className="signout-btn" onClick={handleSignOut}>
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default DoctorProfilePage;
