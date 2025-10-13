import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaUserMd } from "react-icons/fa";
import "../../styles/Navbar.css"; // reuse same styles as patient navbar

export default function DoctorNavbar() {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation(); // get current URL

  // Determine active tab from current pathname
  const activeTab = (() => {
    if (location.pathname === "/docdashboard") return "Dashboard";
    if (location.pathname.startsWith("/docdashboard/doctor-appointment")) return "Appointments";
    if (location.pathname.startsWith("/docdashboard/referral")) return "Refer";
    
    if (location.pathname.startsWith("/docdashboard/history")) return "History";
    return "";
  })();

  const handleNavClick = (path) => {
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
        <div className="navbar-logo">
          <img src="/college-logo.png" alt="College Logo" className="login-logo" />
          <span className="navbar-title">IIT Dharwad (Doctor)</span>
        </div>

        <div className="navbar-links">
          {[
            { label: "Dashboard", path: "/docdashboard" },
            { label: "Appointments", path: "/docdashboard/doctor-appointment" },
            { label: "History", path: "/docdashboard/history" },
            { label: "Refer", path: "/docdashboard/referral" },
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
