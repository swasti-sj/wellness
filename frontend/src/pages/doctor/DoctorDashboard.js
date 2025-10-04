// DoctorDashboard.js
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import "../../styles/doctor/DoctorDashboard.css";
import DoctorNavbar from "./DoctorNavbar";

export default function DoctorDashboard() {
  return (
    <div className="doctor-dashboard-content">
      <h2>Welcome to Doctor Dashboard</h2>
      <p>Select an option from the top navigation to continue.</p>
    </div>
  );
}
