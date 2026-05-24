import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaUserCircle } from "react-icons/fa";

import "../../styles/Navbar.css";

export default function Navbar({ onNavSelect }) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [active, setActive] = useState("Dashboard");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 992);
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 992);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (menuOpen && navRef.current && !navRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [menuOpen]);

  const handleNavClick = (path, label) => {
    setActive(label);
    setMenuOpen(false);
    navigate(path);
  };

  const handleProfile = () => {
    setShowProfileMenu(false);
    setMenuOpen(false);
    navigate("/patdashboard/profile");
  };

  const handleLogoClick = () => {
    setMenuOpen(false);
    navigate("/patdashboard");
  };

  const handleLogout = () => {
    setShowProfileMenu(false);
    setMenuOpen(false);
    localStorage.removeItem("token");
    navigate("/");
  };

  const navItems = [
    { label: "Dashboard", path: "/patdashboard" },
    { label: "Appointment", path: "/patdashboard/book" },
    { label: "History", path: "/patdashboard/history" },
  ];

  if (isMobile) {
    navItems.push({ label: "Profile", path: "/patdashboard/profile" });
  }

  return (
    <>
      <nav className="navbar" ref={navRef}>
        <div className="navbar-content">
          <div className="navbar-logo">
            <img src="/college-logo.png" alt="College Logo" className="login-logo" onClick={handleLogoClick} style={{ cursor: 'pointer' }} />
            <span className="navbar-title" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
              IIT Dharwad
            </span>
            <button
              className="hamburger-btn"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
            >
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>

          <div className={`navbar-links${menuOpen ? " show" : ""}`}>
            {navItems.map((item) => (
              <button
                key={item.label}
                className={`navbar-btn${active === item.label ? " active" : ""}`}
                onClick={() => handleNavClick(item.path, item.label)}
              >
                {item.label}
              </button>
            ))}

            {isMobile && (
              <>
                <div className="navbar-mobile-divider" />
                <button className="navbar-btn" onClick={handleLogout}>
                  Logout
                </button>
              </>
            )}
          </div>

          {!isMobile && (
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
          )}
        </div>
      </nav>
      {menuOpen && <div className="navbar-overlay" />}
    </>
  );
}
