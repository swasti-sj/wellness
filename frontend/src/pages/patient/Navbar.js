import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaUserCircle } from "react-icons/fa";

import "../../styles/Navbar.css";

export default function Navbar({ onNavSelect }) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [active, setActive] = useState("Dashboard");

  const navigate = useNavigate();

  const handleNavClick = (path, label) => {
    setActive(label);
    navigate(path);
  };

  const handleProfile = () => {
    setShowProfileMenu(false);
    navigate("/patdashboard/profile"); // go to profile page
  };

  const handleLogout = () => {
    setShowProfileMenu(false);
    localStorage.removeItem("token"); // remove token
    navigate("/"); // redirect to login
  };

  return (
    <nav className="navbar">
      <div className="navbar-content">
        {/* Left: Logo and Name */}
        <div className="navbar-logo">
          <img
            src="/college-logo.png"
            alt="College Logo"
            className="login-logo"
          />
          <span className="navbar-title">IIT Dharwad</span>
        </div>

        {/* Center nav buttons */}
        <div className="navbar-links">
          {[
            { label: "Dashboard", path: "/patdashboard" },
            { label: "Appointment", path: "/patdashboard/book" },
            { label: "History", path: "/patdashboard/history" },
            { label: "Profile", path: "/patdashboard/profile" },
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

        {/* Right: Student icon with dropdown */}
        <div
          className="relative"
          onMouseEnter={() => setShowProfileMenu(true)}
          onMouseLeave={() => setShowProfileMenu(false)}
        >
          <button
            onClick={() => setShowProfileMenu((prev) => !prev)}
            aria-label="Student profile"
            title="Profile"
            className="profile-btn"
          >
            <FaUserCircle className="profile-icon" />
          </button>
          <div className={`profile-menu${showProfileMenu ? " show" : ""}`} aria-hidden={!showProfileMenu}>
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
