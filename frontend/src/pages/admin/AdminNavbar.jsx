import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaUserCircle } from "react-icons/fa";
import "../../styles/Navbar.css";

export default function AdminNavbar() {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  return (
    <nav className="navbar">
      <div className="navbar-content">

        {/* LEFT */}
        <div className="navbar-logo">
          <img src="/college-logo.png" alt="logo" className="login-logo" />
          <span className="navbar-title">Admin Panel - IIT Dharwad</span>
        </div>

        {/* CENTER NAV */}
        <div className="navbar-links">

          <button className="navbar-btn" onClick={() => navigate("/admin-dashboard/audit")}>
            Audit Logs
          </button>

          {/* <button className="navbar-btn" onClick={() => navigate("/admin-dashboard")}>
            Dashboard
          </button> */}

          {/* <button className="navbar-btn" onClick={() => navigate("/admin-dashboard/audit")}>
            Users
          </button> */}

        </div>

        {/* RIGHT PROFILE */}
        <div
          className="relative"
          onMouseEnter={() => setShowProfileMenu(true)}
          onMouseLeave={() => setShowProfileMenu(false)}
        >
          <button className="profile-btn">
            <FaUserCircle className="profile-icon" />
          </button>

          <div className={`profile-menu${showProfileMenu ? " show" : ""}`}>
            <button
              className="profile-menu-btn"
              onClick={() => navigate("/admin-dashboard/profile")}
            >
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