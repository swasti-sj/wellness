import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../../styles/doctor/DoctorAppointment.css';
import DoctorNote from './DoctorNote';

function DoctorAppointment() {
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Authentication error. Please log in again.');
          setIsLoading(false);
          return;
        }

        const response = await axios.get('http://localhost:5000/api/appointments/doctor-appointments', {
          params: { token }
        });
        
        setAppointments(response.data.appointments);
      } catch (err) {
        console.error("Error fetching appointments:", err);
        setError('Failed to load appointments. ' + (err.response?.data?.error || ''));
      } finally {
        setIsLoading(false);
      }
    };

    fetchAppointments();
  }, []);

  const handleToggleNotes = (appointmentId) => {
    if (selectedAppointmentId === appointmentId) {
      setSelectedAppointmentId(null); // Hide if already showing
    } else {
      setSelectedAppointmentId(appointmentId); // Show notes for this appointment
    }
  };

  if (isLoading) {
    return <div className="appointments-container">Loading appointments...</div>;
  }

  if (error) {
    return <div className="appointments-container error-message">{error}</div>;
  }

  return (
    <div className="appointments-container">
      <h2>My Appointments</h2>
      {appointments.length > 0 ? (
        <ul className="appointment-list">
          {appointments.map(appt => (
            <li key={appt._id} className={`appointment-item status-${appt.status}`}>
              <div className="appointment-header">
                <div className="appointment-details">
                  <p><strong>Patient:</strong> {appt.user?.name || 'N/A'}</p>
                  <p><strong>Contact:</strong> {appt.user?.email || appt.user?.phone || 'N/A'}</p>
                  <p><strong>Date:</strong> {new Date(appt.startDateTime).toLocaleDateString()}</p>
                  <p><strong>Time:</strong> {new Date(appt.startDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="appointment-actions">
                  <span className="appointment-status">{appt.status}</span>
                  <button onClick={() => handleToggleNotes(appt._id)} className="notes-toggle-btn">
                    {selectedAppointmentId === appt._id ? 'Hide Notes' : 'View/Add Notes'}
                  </button>
                </div>
              </div>

              {/* Conditionally render the notes component */}
              {selectedAppointmentId === appt._id && (
                <div className="notes-section">
                  <DoctorNote appointmentId={appt._id} />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>You have no upcoming appointments.</p>
      )}
    </div>
  );
}

export default DoctorAppointment;