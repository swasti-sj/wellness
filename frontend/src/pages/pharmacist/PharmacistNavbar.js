import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaUserMd } from "react-icons/fa";
import "../../styles/Navbar.css";

export default function PharmacistNavbar() {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = (() => {
    if (location.pathname === "/pharmacist-dashboard" || location.pathname === "/pharm-dashboard") return "Dashboard";
    if (location.pathname.includes("/stock") || location.pathname.includes("/medicines")) return "Medicine Stock";
    if (location.pathname.includes("/records") || location.pathname.includes("/issuances")) return "Records";
    return "";
  })();

  const handleLogout = () => {
    setShowProfileMenu(false);
    localStorage.removeItem("token");
    navigate("/");
  };

  useEffect(() => {
    const handleScroll = () => {
      const navbar = document.querySelector(".navbar");
      if (window.scrollY > 60) navbar?.classList.add("shrink");
      else navbar?.classList.remove("shrink");
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
    navLinks?.classList.toggle("show");
  };

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <div className="navbar-logo">
          <img src="/WebIcon.plain.svg" alt="College Logo" className="login-logo" />
          <span className="navbar-title">IIT Dharwad (Pharmacy)</span>
          <button className="hamburger-btn" onClick={toggleMenu}>☰</button>
        </div>

        <div className="navbar-links">
          {[
            { label: "Dashboard", path: "/pharmacist-dashboard" },
            { label: "Medicine Stock", path: "/pharmacist-dashboard/stock" },
            { label: "Records", path: "/pharmacist-dashboard/records" },
          ].map((item) => (
            <button
              key={item.label}
              className={`navbar-btn${activeTab === item.label ? " active" : ""}`}
              onClick={() => {
                navigate(item.path);
                if (isMobile) toggleMenu();
              }}
            >
              {item.label}
            </button>
          ))}

          {/* Mobile Profile & Logout */}
          {isMobile && (
            <>
              <button
                className="navbar-btn"
                onClick={() => {
                  toggleMenu();
                  navigate("/pharmacist-dashboard/profile");
                }}
              >
                <FaUserMd style={{ marginRight: "8px" }} />
                Profile
              </button>
              <button
                className="navbar-btn"
                onClick={() => {
                  toggleMenu();
                  handleLogout();
                }}
              >
                🚪 Logout
              </button>
            </>
          )}
        </div>

        {/* Right: Profile icon with dropdown (desktop only) */}
        {!isMobile && (
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              aria-label="Pharmacist profile"
              title="Profile"
              className="profile-btn"
            >
              <FaUserMd className="profile-icon" />
            </button>
            {showProfileMenu && (
              <div className="profile-menu">
                <button className="profile-menu-btn" onClick={() => navigate("/pharmacist-dashboard/profile")}>
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

