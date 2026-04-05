import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../../styles/pharmacist/PharmacistNavbar.css';

const API_BASE = 'http://localhost:5000/api';

const NAV_LINKS = [
  { to: '/pharmacist-dashboard',                    label: 'Dashboard' },
  { to: '/pharmacist-dashboard/stock',              label: 'Stock' },
  { to: '/pharmacist-dashboard/records',            label: 'Records' },
  { to: '/pharmacist-dashboard/analytics',          label: 'Analytics' },
  { to: '/pharmacist-dashboard/medicine-analytics', label: 'Med. Analytics' },
  { to: '/pharmacist-dashboard/advanced-analytics', label: 'Adv. Analytics' },
  { to: '/pharmacist-dashboard/stock-history',      label: 'History' },
];

export default function PharmacistNavbar() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const profileRef = useRef(null);
  const navRef = useRef(null);
  const navigate = useNavigate();
  const [pharmacist, setPharmacist] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) return;
    axios.get(`${API_BASE}/pharmacist/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => setPharmacist(r.data))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setMenuOpen(false);
        setIsMobileMenuOpen(false);
      } else if (profileRef.current && !profileRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = pharmacist?.name
    ? pharmacist.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'PH';

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  // Active link: exact match for dashboard, startsWith for nested
  const isActive = (to) => {
    if (to === '/pharmacist-dashboard') return location.pathname === to;
    return location.pathname.startsWith(to);
  };

  return (
    <nav className="pharm-navbar" ref={navRef}>
      <div className="pharm-navbar-content">
        <Link to="/pharmacist-dashboard" className="pharm-navbar-logo" style={{ textDecoration: 'none' }}>
          <img src="/college-logo.png" alt="Logo" className="pharm-nav-logo" />
          <h1 className="pharm-navbar-title">IIT Dharwad (Pharmacist)</h1>
        </Link>


        {/* Desktop & Mobile Nav */}
        <div className={`pharm-navbar-links ${isMobileMenuOpen ? 'show' : ''}`}>
          {NAV_LINKS.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`pharm-navbar-btn ${isActive(link.to) ? 'active' : ''}`}
              style={{ textDecoration: 'none' }}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {/* Mobile-only: Profile & Logout */}
          <div className="pharm-mobile-divider" />
          <Link
            to="/pharmacist-dashboard/profile"
            className="pharm-navbar-btn"
            style={{ textDecoration: 'none' }}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Profile
          </Link>
          <button
            className="pharm-navbar-btn pharm-mobile-logout"
            onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
          >
            Logout
          </button>
        </div>

        <div className="pharm-navbar-right-section">
          <div className="relative" ref={profileRef}>
            <button 
              className="profile-btn" 
              onClick={() => setMenuOpen(!menuOpen)}
              title={pharmacist?.name || 'Profile'}
            >
              <div className="profile-icon">{initials}</div>
            </button>
            
            <div className={`profile-menu ${menuOpen ? 'show' : ''}`}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700, color: 'var(--plum)', fontSize: '0.85rem', lineHeight: 1.2 }}>
                  {pharmacist?.name || 'Pharmacist'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {pharmacist?.email || 'Logged In'}
                </div>
              </div>
              
              <Link 
                to="/pharmacist-dashboard/profile" 
                className="profile-menu-btn" 
                style={{ textDecoration: 'none' }}
                onClick={() => setMenuOpen(false)}
              >
                View Profile
              </Link>
              
              <button 
                className="profile-menu-btn" 
                onClick={() => {
                  setMenuOpen(false);
                  handleLogout();
                }}
              >
                Logout
              </button>
            </div>
          </div>
          {/* Mobile Toggle */}
          <button 
            className="pharm-hamburger-btn" 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>
    </nav>
  );
}