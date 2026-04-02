import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../../styles/pharmacist/PharmacistDashboard.css';

const API_BASE = 'http://localhost:5000/api';

const NAV_LINKS = [
  { to: '/pharmacist-dashboard',                    label: 'Dashboard',          icon: '🏥' },
  { to: '/pharmacist-dashboard/stock',              label: 'Medicine Stock',      icon: '💊' },
  { to: '/pharmacist-dashboard/records',            label: 'Issuance Records',    icon: '📋' },
  { to: '/pharmacist-dashboard/analytics',          label: 'Analytics',           icon: '📈' },
  { to: '/pharmacist-dashboard/medicine-analytics', label: 'Medicine Analytics',  icon: '🎯' },
  { to: '/pharmacist-dashboard/advanced-analytics', label: 'Advanced Analytics',  icon: '📊' },
  { to: '/pharmacist-dashboard/stock-history',      label: 'Stock History',       icon: '🗓️' },
  { to: '/pharmacist-dashboard/profile',            label: 'Profile',             icon: '👤' },
];

export default function PharmacistNavbar() {
  const location = useLocation();
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
    <nav className="pharm-navbar">
      <Link to="/pharmacist-dashboard" className="pharm-navbar-brand">
        <div className="logo-icon">⚕</div>
        <span>PharmaCare</span>
      </Link>

      {/* Desktop Nav */}
      <div className="pharm-nav-links">
        {NAV_LINKS.map(link => (
          <Link
            key={link.to}
            to={link.to}
            className={`pharm-nav-link ${isActive(link.to) ? 'active' : ''}`}
          >
            <span>{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </div>

      <div className="pharm-nav-right">
        <div className="pharm-nav-avatar" title={pharmacist?.name || 'Pharmacist'}>
          {initials}
        </div>
        {pharmacist?.name && (
          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pharmacist.name}
          </span>
        )}
        <button
          className="pharm-btn pharm-btn-ghost"
          style={{ color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}