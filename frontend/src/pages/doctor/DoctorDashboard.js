import React from 'react';
import { Link, Outlet } from 'react-router-dom';

export default function DoctorDashboard() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar / Tabs */}
      <div style={{ width: '200px', background: '#f0f0f0', padding: '20px' }}>
        <h3>Dashboard</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {/* <li style={{ marginBottom: '10px' }}>
            <Link to="notes">Doctor Note</Link>
          </li> */}
          <li style={{ marginBottom: '10px' }}>
            <Link to="doctor-profile">Profile</Link>
          </li>
          <li style={{ marginBottom: '10px' }}>
            <Link to="doctor-appointment">Doctor appointment</Link>
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
