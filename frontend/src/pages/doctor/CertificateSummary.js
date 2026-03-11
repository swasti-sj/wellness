import React from "react";
import "../../styles/doctor/DoctorAppointment.css";
import { Navigate } from "react-big-calendar";

// Label for the "go to today" button changes based on current view
const todayLabel = (view) => {
  switch (view) {
    case "week": return "This Week";
    case "day": return "Today";
    case "agenda": return "Today";
    default: return "This Month";
  }
};

const VIEW_LABELS = {
  month: "Month",
  week: "Week",
  day: "Day",
  agenda: "Agenda",
};

const STATUS_LEGEND = [
  { label: "Booked", color: "#E5A020" },
  { label: "Attended", color: "#1E8A55" },
  { label: "Cancelled", color: "#B8243A" },
  { label: "No Show", color: "#7A6890" },
  { label: "Walk In", color: "#4A1060" },
];

export default function CustomToolbar({ label, onNavigate, onView, views, view }) {
  return (
    <>
      <div className="custom-toolbar">
        {/* Left: navigation */}
        <div className="toolbar-left">
          <button
            onClick={() => onNavigate(Navigate.TODAY)}
            className="toolbar-btn today-btn"
          >
            {todayLabel(view)}
          </button>
          <button onClick={() => onNavigate(Navigate.PREVIOUS)} className="toolbar-btn">
            ‹ Back
          </button>
          <button onClick={() => onNavigate(Navigate.NEXT)} className="toolbar-btn">
            Next ›
          </button>
        </div>

        {/* Center: period label */}
        <div className="toolbar-center">{label}</div>

        {/* Right: view switcher */}
        <div className="toolbar-right">
          {views.map((v) => (
            <button
              key={v}
              onClick={() => onView(v)}
              className={`toolbar-btn view-btn${view === v ? " active-view" : ""}`}
            >
              {VIEW_LABELS[v] || v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Legend strip — shown on month/week/agenda */}
      {view !== "day" && (
        <div className="cal-legend">
          {STATUS_LEGEND.map(({ label: l, color }) => (
            <span key={l} className="cal-legend-item">
              <span className="cal-legend-dot" style={{ background: color }} />
              {l}
            </span>
          ))}
        </div>
      )}
    </>
  );
}