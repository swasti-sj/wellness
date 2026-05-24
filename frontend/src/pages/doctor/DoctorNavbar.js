import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaUserMd } from "react-icons/fa";
import "../../styles/Navbar.css";

export default function DoctorNavbar() {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 992);
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = (() => {
    if (location.pathname === "/docdashboard") return "Dashboard";
    if (location.pathname.startsWith("/docdashboard/doctor-appointment")) return "Appointments";
    if (location.pathname.startsWith("/docdashboard/referral")) return "Refer";
    if (location.pathname.startsWith("/docdashboard/history")) return "History";
    if (location.pathname.startsWith("/docdashboard/doctor-profile")) return "Profile";
    return "";
  })();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 992);

    const handleScroll = () => {
      const navbar = document.querySelector(".navbar");
      if (!navbar) return;
      if (window.scrollY > 60) navbar.classList.add("shrink");
      else navbar.classList.remove("shrink");
    };

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
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

  const handleNavClick = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  const handleProfile = () => {
    setShowProfileMenu(false);
    setMenuOpen(false);
    navigate("/docdashboard/doctor-profile");
  };

  const handleLogoClick = () => {
    setMenuOpen(false);
    navigate("/docdashboard");
  };

  const handleLogout = () => {
    setShowProfileMenu(false);
    setMenuOpen(false);
    localStorage.removeItem("token");
    navigate("/");
  };

  const navItems = [
    { label: "Dashboard", path: "/docdashboard" },
    { label: "Appointments", path: "/docdashboard/doctor-appointment" },
    { label: "Refer", path: "/docdashboard/referral" },
    { label: "History", path: "/docdashboard/history" },
  ];

  if (isMobile) {
    navItems.push({ label: "Profile", path: "/docdashboard/doctor-profile" });
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
                className={`navbar-btn${activeTab === item.label ? " active" : ""}`}
                onClick={() => handleNavClick(item.path)}
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
                aria-label="Doctor profile"
                title="Profile"
                className="profile-btn"
              >
                <FaUserMd className="profile-icon" />
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
