import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../context/ApiContext";
import "../../styles/doctor/ProfilePage.css";

export default function AdminProfilePage() {
  const apiBaseUrl = useApi();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem("token");

  const loadProfile = async () => {
    try {
      if (!apiBaseUrl || !token) return;
      setLoading(true);
      setError("");

      const res = await axios.get(`${apiBaseUrl}/api/admin/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setProfile({
        name: res.data?.name || "",
        phone: res.data?.phone || "",
        department: res.data?.department || "",
        designation: res.data?.designation || "",
      });
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to load admin profile.");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");

      await axios.put(
        `${apiBaseUrl}/api/admin/profile`,
        {
          name: profile?.name,
          phone: profile?.phone,
          department: profile?.department,
          designation: profile?.designation,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setEditMode(false);
      await loadProfile();
      alert("Profile updated successfully!");
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to save admin profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  if (error) {
    return <div className="profile-container error-message">{error}</div>;
  }

  if (loading || !profile) {
    return <div className="profile-container">Loading profile...</div>;
  }

  return (
    <div className="profile-wrapper">
      <div className="profile-container">
        <div className="profile-left">
          <h2>Admin Profile</h2>

          <div className="profile-fields">
            <div className="profile-field">
              <label>Name</label>
              {editMode ? (
                <input
                  name="name"
                  value={profile.name || ""}
                  onChange={handleChange}
                />
              ) : (
                <p>{profile.name || "Not set"}</p>
              )}
            </div>

            <div className="profile-field">
              <label>Phone</label>
              {editMode ? (
                <input
                  name="phone"
                  value={profile.phone || ""}
                  onChange={handleChange}
                />
              ) : (
                <p>{profile.phone || "Not set"}</p>
              )}
            </div>

            <div className="profile-field">
              <label>Department</label>
              {editMode ? (
                <input
                  name="department"
                  value={profile.department || ""}
                  onChange={handleChange}
                />
              ) : (
                <p>{profile.department || "Not set"}</p>
              )}
            </div>

            <div className="profile-field">
              <label>Designation</label>
              {editMode ? (
                <input
                  name="designation"
                  value={profile.designation || ""}
                  onChange={handleChange}
                />
              ) : (
                <p>{profile.designation || "Not set"}</p>
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
                {saving ? "Saving..." : "💾 Save Changes"}
              </button>
            )}
            <button className="signout-btn" onClick={handleLogout}>
              🚪 Sign Out
            </button>
          </div>
        </div>

        <div className="profile-right">
          <h4>Account Access</h4>
          <p>
            This page shows the admin profile details used for audit access.
          </p>
          <p style={{ fontSize: 13, opacity: 0.85 }}>
            Fields: Name, Phone, Department, Designation.
          </p>
        </div>
      </div>
    </div>
  );
}

