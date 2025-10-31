import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaUserMd } from "react-icons/fa";
import "../../styles/Navbar.css";

export default function DoctorNavbar() {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = (() => {
    if (location.pathname === "/docdashboard") return "Dashboard";
    if (location.pathname.startsWith("/docdashboard/doctor-appointment")) return "Appointments";
    if (location.pathname.startsWith("/docdashboard/referral")) return "Refer";
    return "";
  })();

  const handleNavClick = (path) => navigate(path);

  const handleProfile = () => {
    setShowProfileMenu(false);
    navigate("/docdashboard/doctor-profile");
  };

  const handleLogout = () => {
    setShowProfileMenu(false);
    localStorage.removeItem("token");
    navigate("/");
  };

  useEffect(() => {
    const handleScroll = () => {
      const navbar = document.querySelector(".navbar");
      if (window.scrollY > 60) navbar.classList.add("shrink");
      else navbar.classList.remove("shrink");
    };
    const handleResize = () => setIsMobile(window.innerWidth <= 768);

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const toggleMenu = () => {
    const navLinks = document.querySelector(".navbar-links");
    navLinks.classList.toggle("show");
  };

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <div className="navbar-logo">
          <img src="/WebIcon.plain.svg" alt="College Logo" className="login-logo" />
          <span className="navbar-title">IIT Dharwad (Doctor)</span>

          <button className="hamburger-btn" onClick={toggleMenu}>☰</button>
        </div>

        <div className="navbar-links">
          {[
            { label: "Dashboard", path: "/docdashboard" },
            { label: "Appointments", path: "/docdashboard/doctor-appointment" },
            { label: "Refer", path: "/docdashboard/referral" },
            { label: "History", path: "/docdashboard/history" },
          ].map((item) => (
            <button
              key={item.label}
              className={`navbar-btn${activeTab === item.label ? " active" : ""}`}
              onClick={() => handleNavClick(item.path)}
            >
              {item.label}
            </button>
          ))}

          {/* Profile inside hamburger (mobile view only) */}
          {isMobile && (
            <button
              className="navbar-btn"
              onClick={() => {
                toggleMenu();
                handleProfile();
              }}
            >
              <FaUserMd style={{ marginRight: "8px" }} />
              Profile
            </button>
          )}
          {isMobile && (
            <button
              className="navbar-btn"
              onClick={() => {
                toggleMenu();
                handleLogout();
              }}
            >
              Logout
            </button>
          )}
        </div>

        {/* Profile icon (desktop view only) */}
        {!isMobile && (
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
        )}
      </div>
    </nav>
  );
}
