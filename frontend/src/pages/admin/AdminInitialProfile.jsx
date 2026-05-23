import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../context/ApiContext";

export default function AdminInitialProfile() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    department: "",
    designation: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const apiBaseUrl = useApi();

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  useEffect(() => {
    const loadProfile = async () => {
      try {
        if (!apiBaseUrl || !token) return;
        const res = await axios.get(`${apiBaseUrl}/api/admin/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setForm({
          name: res.data?.name || "",
          phone: res.data?.phone || "",
          department: res.data?.department || "",
          designation: res.data?.designation || "",
        });
      } catch (err) {
        // Profile might not exist yet; allow user to fill it.
        console.warn("Admin profile fetch failed:", err?.response?.data || err.message);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [apiBaseUrl, token]);

  const handleSubmit = async () => {
    try {
      setSaving(true);
      setError("");

      await axios.put(`${apiBaseUrl}/api/admin/profile`, form, {
        headers: { Authorization: `Bearer ${token}` },
      });

      navigate("/admin-dashboard/audit", { replace: true });
    } catch (err) {
      console.error("Admin profile update failed:", err);
      setError(err?.response?.data?.error || "Failed to update admin profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="profile-container">
      <div className="patient-profile-page">
        <div className="patient-profile-shell">
          <div className="profile-hero">
            <div>
              <div className="profile-kicker">Welcome to Wellness</div>
              <h1>Complete Your Admin Profile</h1>
              <p className="profile-subtitle">Admin onboarding setup for audit access.</p>
            </div>
            <div className="profile-badge">Admin</div>
          </div>

          <form
            className="profile-form profile-form-modern"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            {error ? <p style={{ color: "red", marginTop: 0 }}>{error}</p> : null}

            <div className="profile-grid">
              <label className="profile-span-2">
                Full Name
                <input
                  name="name"
                  placeholder="As per official records"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Phone Number
                <input
                  name="phone"
                  placeholder="e.g. +91 XXXXX XXXXX"
                  value={form.phone}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Department
                <input
                  name="department"
                  placeholder="e.g. Admin / Operations"
                  value={form.department}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Designation
                <input
                  name="designation"
                  placeholder="e.g. Superintendent"
                  value={form.designation}
                  onChange={handleChange}
                  required
                />
              </label>

              <div className="profile-span-2">
                <button type="submit" disabled={saving} style={{ width: "100%" }}>
                  {saving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

