import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import "../../styles/Navbar.css";
import { useApi } from '../../context/ApiContext';

export default function ReceptionistNavbar() {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 992);
  const [receptionist, setReceptionist] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const profileRef = useRef(null);
  const navRef = useRef(null);
  const token = localStorage.getItem("token");
  const apiBaseUrl = useApi();
  const API_BASE = `${apiBaseUrl}/api`;

  useEffect(() => {
    if (!token) return;
    axios
      .get(`${API_BASE}/receptionist/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => setReceptionist(r.data))
      .catch(() => { });
  }, [token, apiBaseUrl, API_BASE]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 992);
    const handleClickOutside = (event) => {
      if (menuOpen && navRef.current && !navRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const activeTab = location.pathname === "/receptionist-dashboard" ? "Dashboard" : "";

  const handleNavClick = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  const handleProfile = () => {
    setShowProfileMenu(false);
    setMenuOpen(false);
    navigate("/receptionist-dashboard/profile");
  };

  const handleLogoClick = () => {
    setMenuOpen(false);
    navigate("/receptionist-dashboard");
  };

  const handleLogout = () => {
    setShowProfileMenu(false);
    setMenuOpen(false);
    localStorage.removeItem("token");
    navigate("/");
  };

  const initials = receptionist?.name
    ? receptionist.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "RC";

  return (
    <>
      <nav className="navbar" ref={navRef}>
        <div className="navbar-content">
          <div className="navbar-logo">
            <img src="/college-logo.png" alt="College Logo" className="login-logo" onClick={handleLogoClick} style={{ cursor: 'pointer' }} />
            <span className="navbar-title" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
              IIT Dharwad
            </span>
            <button className="hamburger-btn" onClick={() => setMenuOpen((prev) => !prev)}>
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>

          <div className={`navbar-links${menuOpen ? " show" : ""}`}>
            <button
              className={`navbar-btn${activeTab === "Dashboard" ? " active" : ""}`}
              onClick={() => handleNavClick("/receptionist-dashboard")}
            >
              Dashboard
            </button>
            {isMobile && (
              <>
                <div className="navbar-mobile-divider" />
                <button className="navbar-btn" onClick={handleProfile}>
                  Profile
                </button>
                <button className="navbar-btn" onClick={handleLogout}>
                  Logout
                </button>
              </>
            )}
          </div>

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
      {menuOpen && <div className="navbar-overlay" />}
    </>
  );
}
