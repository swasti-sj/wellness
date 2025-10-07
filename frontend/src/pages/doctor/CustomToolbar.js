import React from "react";
import "../../styles/doctor/DoctorAppointment.css";
import { Navigate } from "react-big-calendar";

export default function CustomToolbar({ label, onNavigate, onView, views, view }) {
  return (
    <div className="custom-toolbar">
      {/* Left side navigation buttons */}
      <div className="toolbar-left">
        <button onClick={() => onNavigate(Navigate.TODAY)} className="toolbar-btn">
          Today
        </button>
        <button onClick={() => onNavigate(Navigate.PREVIOUS)} className="toolbar-btn">
          &lt; Back
        </button>
        <button onClick={() => onNavigate(Navigate.NEXT)} className="toolbar-btn">
          Next &gt;
        </button>
      </div>

      {/* Center label */}
      <div className="toolbar-center">{label}</div>

      {/* Right side view switch buttons */}
      <div className="toolbar-right">
        {views.map((v) => (
          <button
            key={v}
            onClick={() => onView(v)}
            className={`toolbar-btn ${view === v ? "active-view" : ""}`}
          >
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
