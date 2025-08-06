import { useEffect, useState } from 'react';
import axios from 'axios';

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

  if (!profile) return <div>Loading profile...</div>;

  return (
    <div>
      <h2>My Profile</h2>
      <p><strong>Name:</strong> {profile.name}</p>
      <p><strong>Age:</strong> {profile.age}</p>
      <p><strong>Sex:</strong> {profile.sex}</p>
      <p><strong>Phone:</strong> {profile.phone}</p>
      <p><strong>Roll:</strong> {profile.roll}</p>
    </div>
  );
}

export default ProfilePage;
