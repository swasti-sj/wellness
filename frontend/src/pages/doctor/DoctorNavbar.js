// DoctorNavbar.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaUserMd } from "react-icons/fa";
import "../../styles/Navbar.css"; // reuse same styles as patient navbar

export default function DoctorNavbar() {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [active, setActive] = useState("Appointments");
  const navigate = useNavigate();

  const handleNavClick = (path, label) => {
    setActive(label);
    navigate(path);
  };

  const handleProfile = () => {
    setShowProfileMenu(false);
    navigate("/docdashboard/doctor-profile");
  };

  const handleLogout = () => {
    setShowProfileMenu(false);
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <nav className="navbar">
      <div className="navbar-content">
        {/* Left: Logo + Title */}
        <div className="navbar-logo">
          <img src="/college-logo.png" alt="College Logo" className="login-logo" />
          <span className="navbar-title">IIT Dharwad (Doctor)</span>
        </div>

        {/* Center Tabs */}
        <div className="navbar-links">
          {[
            { label: "Dashboard", path: "/docdashboard" },
            { label: "Appointments", path: "/docdashboard/doctor-appointment" },
            { label: "Refer", path: "/docdashboard/referral" },
          ].map((item) => (
            <button
              key={item.label}
              className={`navbar-btn${active === item.label ? " active" : ""}`}
              onClick={() => handleNavClick(item.path, item.label)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Right: Doctor Icon with Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu((prev) => !prev)}
            aria-label="Doctor profile"
            title="Profile"
            className="profile-btn"
          >
            <FaUserMd className="profile-icon" />
          </button>
          {showProfileMenu && (
            <div className="profile-menu">
              <button className="profile-menu-btn" onClick={handleProfile}>
                Profile
              </button>
              <button className="profile-menu-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
