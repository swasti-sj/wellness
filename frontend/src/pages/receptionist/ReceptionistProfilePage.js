import { useEffect, useState } from "react";
import axios from "axios";
import "../../styles/doctor/ProfilePage.css";
import ReceptionistNavbar from "./ReceptionistNavbar";
import { useApi } from "../../context/ApiContext";

function ReceptionistProfilePage() {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const apiBaseUrl = useApi();


  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setError("No authentication token found. Please log in.");
          return;
        }

        const response = await axios.get(`${apiBaseUrl}/api/receptionist/profile`, {
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
        <div className="profile-container error-message" style={{ marginTop: '100px' }}>{error}</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div>
        <ReceptionistNavbar />
        <div className="profile-container" style={{ marginTop: '100px' }}>Loading profile...</div>
      </div>
    );
  }

  return (
    <div>
      <ReceptionistNavbar />
      <div className="profile-wrapper" style={{ marginTop: '100px' }}>
        <div className="profile-container">

          {/* LEFT PANEL */}
          <div className="profile-left">
            <h2>Receptionist Profile</h2>
            {profile.picture && (
              <img src={profile.picture} alt="Profile" className="profile-picture" />
            )}

            <div className="profile-fields">
              <div className="profile-field">
                <label>Name</label>
                <p>{profile.name || "Not set"}</p>
              </div>

              <div className="profile-field">
                <label>Email</label>
                <p>{profile.email || "Not set"}</p>
              </div>

              <div className="profile-field">
                <label>Phone</label>
                <p>{profile.phone || "Not set"}</p>
              </div>

              <div className="profile-field">
                <label>Role</label>
                <p>Receptionist</p>
              </div>
            </div>

            <div className="profile-buttons">
              <button className="signout-btn" onClick={handleSignOut}>
                Sign Out
              </button>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="profile-right">
            <h4>Receptionist Information</h4>
            <p>As a receptionist, you can add manual appointment entries, look up patients, and manage the day-to-day front-desk workflow.</p>
          </div>

        </div>
      </div>
    </div>
  );
}

export default ReceptionistProfilePage;
