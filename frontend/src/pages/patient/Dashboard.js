import React from "react";
import { Link, Outlet } from 'react-router-dom';
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from "axios";
import { useRef, useEffect } from "react";
import "../../styles/Dashboard.css";

export default function Dashboard({
  upcomingAppointment = {},
  lastVisit = {},
  contacts = [],
}) {
  const navigate = useNavigate();
  const [active, setActive] = useState("Dashboard");
  const [expandedDoctorId, setExpandedDoctorId] = useState(null);
  const containerRefs = useRef({});
  const [doctors, setDoctors] = useState([]);
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/doctors/list"); // proxy or absolute URL
        setDoctors(res.data);
      } catch (err) {
        console.error("Error fetching doctors:", err);
      }
    };
    fetchDoctors();
  }, []);

  const toggleExpand = (id) => {
    setExpandedDoctorId((prev) => (prev === id ? null : id));
  };
console.log(doctors);
  return (
    <div className="dashboard-container">
      <section>
        <h2 className="visiting-doctors-title">Visiting Doctors</h2>
        <div className="visiting-doctors-list">
          {doctors.map((d) => {
            const expanded = expandedDoctorId === d._id;

            return (
              <div
                key={d._id}
                ref={(el) => (containerRefs.current[d._id] = el)}
                onClick={() => toggleExpand(d._id)}
                onMouseEnter={() => setExpandedDoctorId(d._id)}
                onMouseLeave={() => setExpandedDoctorId(null)}
                className={`doctor-card${expanded ? " expanded" : ""}`}
                style={{ maxHeight: expanded ? "500px" : "250px" }}
              >
                <h3 className="doctor-card-title">{d.name}</h3>
                <p>{d.specialization}</p>
                {expanded && (
                  <div className="mt-4">
                    <p>
                      <strong>Experience:</strong> {d.experience || "N/A"} years
                    </p>
                    <p>
                      <strong>Contact:</strong> {d.contact || "N/A"}
                    </p>
                   <Link
                      to="/patdashboard/book"
                      className="doctor-card-btn"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Book Now
                    </Link>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <section className="upcoming-section">
        <h2 className="upcoming-title">Upcoming Appointment</h2>
        <p>
          <strong>Doctor:</strong> {upcomingAppointment.doctor || "N/A"}
        </p>
        <p>
          <strong>Date:</strong> {upcomingAppointment.date || "N/A"}
        </p>
        <p>
          <strong>Time:</strong> {upcomingAppointment.time || "N/A"}
        </p>
      </section>
      <section className="lastvisit-section">
        <h2 className="lastvisit-title">Last Visit Summary</h2>
        <p>
          <strong>Doctor:</strong> {lastVisit.doctor || "N/A"}
        </p>
        <p>
          <strong>Date:</strong> {lastVisit.date || "N/A"}
        </p>
        <p>
          <strong>Notes:</strong> {lastVisit.notes || "No notes available"}
        </p>
      </section>
      <section>
        <h2 className="faculty-title">Faculty Contacts</h2>
        <div className="faculty-list">
          {contacts.length > 0 ? (
            contacts.map((c) => (
              <div key={c.email} className="faculty-card">
                <h3 className="faculty-card-title">{c.name}</h3>
                <p>{c.role}</p>
                <a href={`mailto:${c.email}`} className="faculty-card-email">
                  {c.email}
                </a>
              </div>
            ))
          ) : (
            <p>No contacts found</p>
          )}
        </div>
      </section>
    </div>
  );
}
