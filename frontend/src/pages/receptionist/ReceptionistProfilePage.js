import { useEffect, useState } from "react";
import axios from "axios";
import "../../styles/PatientProfile.css";
import ReceptionistNavbar from "./ReceptionistNavbar";

function ReceptionistProfilePage() {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setError("No authentication token found. Please log in.");
          return;
        }

        const response = await axios.get("http://localhost:5000/api/receptionist/profile", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setProfile(response.data);
      } catch (err) {
        console.error("Error fetching receptionist profile:", err);
        setError(
          err.response?.data?.error || "Failed to load profile. Please try again later."
        );
        setProfile(null);
      }
    };

    fetchProfile();
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  if (error) {
    return (
      <div>
        <ReceptionistNavbar />
        <div className="patient-container">
          <div className="patient-card error-message">{error}</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ paddingTop: '80px' }}>
        <ReceptionistNavbar />
        <div className="patient-container">
          <div className="patient-card">Loading profile...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: '80px' }}>
      <ReceptionistNavbar />
      <div className="patient-container">
        <div className="patient-card">
          <h2>My Profile</h2>
          {profile.picture && (
            <img src={profile.picture} alt="Profile" className="patient-picture" />
          )}

          <p>
            <strong>Name:</strong> {profile.name || "Not set"}
          </p>
          <p>
            <strong>Email:</strong> {profile.email || "Not set"}
          </p>
          <p>
            <strong>Phone:</strong> {profile.phone || "Not set"}
          </p>
          <p>
            <strong>Role:</strong> Receptionist
          </p>

          <button className="patient-signout-btn" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReceptionistProfilePage;
