import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaUserCircle, FaBars, FaTimes } from "react-icons/fa";
import "../../styles/Navbar.css";

export default function AdminNavbar() {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef(null);

  const handleLogout = () => {
    closeMobileMenu();
    localStorage.clear();
    navigate("/");
  };

  const handleLogoClick = () => {
    closeMobileMenu();
    navigate("/admin-dashboard/audit");
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const toggleMenu = () => setMobileMenuOpen((prev) => !prev);

  useEffect(() => {
    if (!mobileMenuOpen && !showProfileMenu) return;

    const handleClickOutside = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
        setShowProfileMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileMenuOpen, showProfileMenu]);

  return (
    <nav className="navbar admin-navbar" ref={navRef}>
      <div className="navbar-content">

        {/* LEFT */}
        <div className="navbar-logo">
          <img src="/college-logo.png" alt="logo" className="login-logo" onClick={handleLogoClick} style={{ cursor: 'pointer' }} />
          <span className="navbar-title" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
            Admin Panel - IIT Dharwad
          </span>
          <button
            className="hamburger-btn"
            type="button"
            aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
            onClick={toggleMenu}
          >
            {mobileMenuOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>

        {/* CENTER NAV */}
        <div className={`navbar-links${mobileMenuOpen ? " show" : ""}`}>

          <button
            className={`navbar-btn${location.pathname === "/admin-dashboard/audit" ? " active" : ""}`}
            type="button"
            onClick={() => {
              closeMobileMenu();
              navigate("/admin-dashboard/audit");
            }}
          >
            Audit Logs
          </button>

          <button
            className="navbar-btn mobile-menu-item"
            type="button"
            onClick={() => {
              closeMobileMenu();
              navigate("/admin-dashboard/profile");
            }}
          >
            Profile
          </button>

          <button
            className="navbar-btn mobile-menu-item"
            type="button"
            onClick={handleLogout}
          >
            Logout
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