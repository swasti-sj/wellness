import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import axios from "axios";
import "../../styles/Navbar.css";
import { useApi } from '../../context/ApiContext';

export default function NurseNavbar() {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [nurse, setNurse] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const profileRef = useRef(null);
  const token = localStorage.getItem("token");
  const apiBaseUrl = useApi();
    const API_BASE = `${apiBaseUrl}/api`;


  // Fetch nurse profile for name/email in dropdown
  useEffect(() => {
    if (!token) return;
    axios
      .get(`${API_BASE}/nurse/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => setNurse(r.data))
      .catch(() => {});
  }, [token]);

  // Removed outside click handler to ensure dropdown click works reliably.
  // The user will just click the profile icon again to close it.

  const activeTab = (() => {
    if (location.pathname === "/nurse-dashboard") return "Dashboard";
    if (location.pathname.startsWith("/nurse-dashboard/appointments")) return "Appointments";
    if (location.pathname.startsWith("/nurse-dashboard/patient-history")) return "Patient History";
    return "";
  })();

  const handleNavClick = (path) => navigate(path);

  const handleProfile = () => {
    setShowProfileMenu(false);
    navigate("/nurse-dashboard/nurse-profile");
  };

  const handleLogout = () => {
    setShowProfileMenu(false);
    localStorage.removeItem("token");
    navigate("/");
  };

  const initials = nurse?.name
    ? nurse.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "NU";

  const toggleMenu = () => {
    const navLinks = document.querySelector(".navbar-links");
    if (navLinks) navLinks.classList.toggle("show");
  };

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <div className="navbar-logo">
          <img src="/WebIcon.plain.svg" alt="College Logo" className="login-logo" />
          <span className="navbar-title">IIT Dharwad (Nurse)</span>
          <button className="hamburger-btn" onClick={toggleMenu}>☰</button>
        </div>

        <div className="navbar-links">
          {[
            { label: "Dashboard", path: "/nurse-dashboard" },
            { label: "Appointments", path: "/nurse-dashboard/appointments" },
            { label: "Patient History", path: "/nurse-dashboard/patient-history" },
          ].map((item) => (
            <button
              key={item.label}
              className={`navbar-btn${activeTab === item.label ? " active" : ""}`}
              onClick={() => handleNavClick(item.path)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Profile avatar button + dropdown (desktop) */}
        <div
          className="relative"
          ref={profileRef}
          onMouseEnter={() => setShowProfileMenu(true)}
          onMouseLeave={() => setShowProfileMenu(false)}
        >
          <button
            onClick={() => setShowProfileMenu((prev) => !prev)}
            aria-label="Nurse profile"
            title={nurse?.name || "Profile"}
            className="profile-btn"
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "2px solid rgba(255,255,255,0.4)",
              color: "#fff",
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1rem",
              fontWeight: 700,
              letterSpacing: "0.5px",
            }}
          >
            {initials}
          </button>

          <div
            className={`profile-menu${showProfileMenu ? " show" : ""}`}
            style={{ minWidth: '180px', right: '0' }}
            aria-hidden={!showProfileMenu}
          >
            <button className="profile-menu-btn" onClick={handleProfile}>
              Profile
            </button>
            <button className="profile-menu-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
