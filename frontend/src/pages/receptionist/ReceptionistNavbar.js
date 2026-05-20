import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import axios from "axios";
import "../../styles/Navbar.css";
import { useApi } from '../../context/ApiContext';


export default function ReceptionistNavbar() {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [receptionist, setReceptionist] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const profileRef = useRef(null);
  const token = localStorage.getItem("token");
const apiBaseUrl = useApi();
const API_BASE = `${apiBaseUrl}/api`;
  // Fetch receptionist profile for name/email in dropdown
  useEffect(() => {
    if (!token) return;
    axios
      .get(`${API_BASE}/receptionist/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => setReceptionist(r.data))
      .catch(() => {});
  }, [token]);

  // Removed outside click handler to ensure dropdown click works reliably.
  // The user will just click the profile icon again to close it.

  const activeTab = (() => {
    if (location.pathname === "/receptionist-dashboard") return "Dashboard";
    return "";
  })();

  const handleNavClick = (path) => navigate(path);

  const handleProfile = () => {
    setShowProfileMenu(false);
    navigate("/receptionist-dashboard/profile");
  };

  const handleLogout = () => {
    setShowProfileMenu(false);
    localStorage.removeItem("token");
    navigate("/");
  };

  const initials = receptionist?.name
    ? receptionist.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "RC";

  const toggleMenu = () => {
    const navLinks = document.querySelector(".navbar-links");
    if (navLinks) navLinks.classList.toggle("show");
  };

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <div className="navbar-logo">
          <img src="/WebIcon.plain.svg" alt="College Logo" className="login-logo" />
          <span className="navbar-title">IIT Dharwad (Receptionist)</span>
          <button className="hamburger-btn" onClick={toggleMenu}>☰</button>
        </div>

        <div className="navbar-links">
          {[
            { label: "Dashboard", path: "/receptionist-dashboard" },
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

        {/* Profile avatar button + dropdown */}
        <div
          className="relative"
          ref={profileRef}
          onMouseEnter={() => setShowProfileMenu(true)}
          onMouseLeave={() => setShowProfileMenu(false)}
        >
          <button
            onClick={() => setShowProfileMenu((prev) => !prev)}
            aria-label="Receptionist profile"
            title={receptionist?.name || "Profile"}
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
