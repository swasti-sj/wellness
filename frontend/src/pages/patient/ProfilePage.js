import { useEffect, useState } from "react";
import axios from "axios";
import "../../styles/PatientProfile.css";

function PatientProfile() {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/users/profile", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })
      .then((res) => setProfile(res.data))
      .catch(() => setProfile(null));
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  if (!profile) return <div>Loading profile...</div>;

  return (
    <div className="patient-container">
      <div className="patient-card">
        <h2>My Profile</h2>
        <img src={profile.picture} alt="Profile" className="patient-picture" />

        <p>
          <strong>Name:</strong> {profile.name}
        </p>
        <p>
          <strong>Email:</strong> {profile.email}
        </p>
        <p>
          <strong>Age:</strong> {profile.age || "Not set"}
        </p>
        <p>
          <strong>Sex:</strong> {profile.sex || "Not set"}
        </p>
        <p>
          <strong>Phone:</strong> {profile.phone || "Not set"}
        </p>
        <p>
          <strong>Role:</strong> {profile.roll || "Not set"}
        </p>

        <button className="patient-signout-btn" onClick={handleSignOut}>
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default PatientProfile;
