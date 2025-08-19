import { useEffect, useState } from 'react';
import axios from 'axios';
import '../../styles/ProfilePage.css';

function ProfilePage() {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    axios
      .get('http://localhost:5000/api/users/profile', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      })
      .then((res) => setProfile(res.data))
      .catch(() => setProfile(null));
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  if (!profile) return <div>Loading profile...</div>;

  return (
    <div className="profile-container">
      <h2>My Profile</h2>
      <img
        src={profile.picture}
        alt="Profile"
        className="profile-picture"
      />
      <p><strong>Name:</strong> {profile.name}</p>
      <p><strong>Email:</strong> {profile.email}</p>
      <p><strong>Age:</strong> {profile.age || 'Not set'}</p>
      <p><strong>Sex:</strong> {profile.sex || 'Not set'}</p>
      <p><strong>Phone:</strong> {profile.phone || 'Not set'}</p>
      <p><strong>Roll:</strong> {profile.roll || 'Not set'}</p>

      <button className="signout-btn" onClick={handleSignOut}>
        Sign Out
      </button>
    </div>
  );
}

export default ProfilePage;
