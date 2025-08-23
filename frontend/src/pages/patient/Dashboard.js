import React from 'react';
import { Link, Outlet } from 'react-router-dom';

export default function Dashboard() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar / Tabs */}
      <div style={{ width: '200px', background: '#f0f0f0', padding: '20px' }}>
        <h3>Dashboard</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ marginBottom: '10px' }}>
            <Link to="book">Book Appointment</Link>
          </li>
          <li style={{ marginBottom: '10px' }}>
            <Link to="profile">Profile</Link>
          </li>
          {/* Add more tabs later */}
        </ul>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '20px' }}>
        <Outlet /> 
      </div>
    </div>
  );
}
