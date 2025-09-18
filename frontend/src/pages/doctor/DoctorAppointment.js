import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../../styles/doctor/DoctorAppointment.css';
import DoctorNote from './DoctorNote';
import DoctorPrescription from './DoctorPrescription';

function DoctorAppointment({apiBaseUrl}) {
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedNotesApptId, setSelectedNotesApptId] = useState(null);
  const [selectedRxApptId, setSelectedRxApptId] = useState(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingData, setBookingData] = useState({
    patientEmail: '',
    patientPhone: '',
    date: '',
    time: '',
    duration: 30
  });
  const [availableSlots, setAvailableSlots] = useState([]);
  const token = localStorage.getItem('token');
  useEffect(() => {
    if (!apiBaseUrl) return; // wait until loaded
    if (token) {
      fetchAppointments();
      fetchAvailableSlots();
      const interval = setInterval(fetchAppointments, 60000);
      return () => clearInterval(interval);
    }
  }, [token]);


  const fetchAppointments = async () => {
    try {
      
      if (!token) {
        setError('Authentication error. Please log in again.');
        setIsLoading(false);
        return;
      }

      const response = await axios.get(`${apiBaseUrl}/appointments/doctor-appointments`, {
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

  const fetchAvailableSlots = async () => {
    try {
      
      const response = await axios.get(`${apiBaseUrl}/appointments/my-slots`, {
        params: { token }
      });
      setAvailableSlots(response.data.slots);
    } catch (err) {
      console.error("Error fetching slots:", err);
    }
  };

  const handleToggleNotes = (appointmentId) => {
    setSelectedNotesApptId(prevId => (prevId === appointmentId ? null : appointmentId));
    setSelectedRxApptId(null);
  };

  const handleTogglePrescriptions = (appointmentId) => {
    setSelectedRxApptId(prevId => (prevId === appointmentId ? null : appointmentId));
    setSelectedNotesApptId(null);
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    try {
      
      
      // Create start and end datetime
      const startDateTime = new Date(`${bookingData.date}T${bookingData.time}:00`).toISOString();
      const endDateTime = new Date(new Date(startDateTime).getTime() + bookingData.duration * 60000).toISOString();

      const response = await axios.post(`${apiBaseUrl}/appointments/doctor-book`, {
        token,
        patientEmail: bookingData.patientEmail,
        patientPhone: bookingData.patientPhone,
        startDateTime,
        endDateTime,
        slotDay: new Date(bookingData.date).toLocaleDateString('en-US', { weekday: 'long' }),
        slotTime: bookingData.time
      });

      if (response.data.success) {
        setShowBookingForm(false);
        setBookingData({ patientEmail: '', patientPhone: '', date: '', time: '', duration: 30 });
        fetchAppointments();
        fetchAvailableSlots();
        alert('Appointment booked successfully!');
      }
    } catch (err) {
      console.error("Error booking appointment:", err);
      alert('Failed to book appointment: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCancelAppointment = async (appointmentId, appointment) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) {
      return;
    }

    try {
      
      const response = await axios.delete(`${apiBaseUrl}/appointments/${appointmentId}/doctor-cancel`, {
        data: { 
          token,
          slotDay: appointment.slotDay,
          slotTime: appointment.slotTime
        }
      });

      if (response.data.success) {
        fetchAppointments();
        fetchAvailableSlots();
        alert('Appointment cancelled successfully');
      }
    } catch (err) {
      console.error("Error cancelling appointment:", err);
      alert('Failed to cancel appointment: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleStatusUpdate = async (appointmentId, newStatus) => {
    try {
      
      const response = await axios.patch(`${apiBaseUrl}/appointments/${appointmentId}/status`, {
        token,
        status: newStatus
      });

      if (response.data.success) {
        fetchAppointments();
        alert(`Appointment marked as ${newStatus}`);
      }
    } catch (err) {
      console.error("Error updating status:", err);
      alert('Failed to update status: ' + (err.response?.data?.error || err.message));
    }
  };

  if (isLoading) return <div className="appointments-container">Loading appointments...</div>;
  if (error) return <div className="appointments-container error-message">{error}</div>;

  return (
    <div className="appointments-container">
      <div className="appointments-header">
        <h2>My Appointments</h2>
        <button 
          onClick={() => setShowBookingForm(!showBookingForm)}
          className="book-appointment-btn"
        >
          {showBookingForm ? 'Cancel Booking' : 'Book Appointment'}
        </button>
      </div>

      {showBookingForm && (
        <div className="booking-form-container">
          <h3>Book New Appointment</h3>
          <form onSubmit={handleBookAppointment} className="booking-form">
            <div className="form-group">
              <label>Patient Email:</label>
              <input
                type="email"
                value={bookingData.patientEmail}
                onChange={(e) => setBookingData({...bookingData, patientEmail: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>Patient Phone (optional):</label>
              <input
                type="tel"
                value={bookingData.patientPhone}
                onChange={(e) => setBookingData({...bookingData, patientPhone: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Date:</label>
              <input
                type="date"
                value={bookingData.date}
                onChange={(e) => setBookingData({...bookingData, date: e.target.value})}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>
            <div className="form-group">
              <label>Time:</label>
              <input
                type="time"
                value={bookingData.time}
                onChange={(e) => setBookingData({...bookingData, time: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>Duration (minutes):</label>
              <select
                value={bookingData.duration}
                onChange={(e) => setBookingData({...bookingData, duration: parseInt(e.target.value)})}
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>
            <div className="form-actions">
              <button type="submit" className="submit-btn">Book Appointment</button>
              <button type="button" onClick={() => setShowBookingForm(false)} className="cancel-btn">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {appointments.length > 0 ? (
        <ul className="appointment-list">
          {appointments.map(appt => (
            <li key={appt._id} className={`appointment-item status-${appt.status.replace(/\s+/g, '-')}`}>
              <div className="appointment-header">
                <div className="appointment-details">
                  <p><strong>Patient:</strong> {appt.user?.name || 'N/A'}</p>
                  <p><strong>Contact:</strong> {appt.user?.email || appt.user?.phone || 'N/A'}</p>
                  <p><strong>Date:</strong> {new Date(appt.startDateTime).toLocaleDateString()}</p>
                  <p><strong>Time:</strong> {new Date(appt.startDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(appt.endDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="appointment-actions">
                  <div className="status-section">
                    <span className={`appointment-status status-${appt.status.replace(/\s+/g, '-')}`}>
                      {appt.status}
                    </span>
                    {appt.status === 'booked' && (
                      <select 
                        onChange={(e) => handleStatusUpdate(appt._id, e.target.value)}
                        className="status-dropdown"
                        defaultValue=""
                      >
                        <option value="" disabled>Update Status</option>
                        <option value="attended">Mark Completed</option>
                        <option value="no show">Mark No-Show</option>
                        <option value="walk in">Mark Walk In</option>
                      </select>
                    )}
                  </div>
                  <div className="action-buttons">
                    <button onClick={() => handleToggleNotes(appt._id)} className="action-btn">
                      {selectedNotesApptId === appt._id ? 'Hide Notes' : 'Notes'}
                    </button>
                    <button onClick={() => handleTogglePrescriptions(appt._id)} className="action-btn">
                      {selectedRxApptId === appt._id ? 'Hide Rx' : 'Prescription'}
                    </button>
                    {(appt.status === 'booked' || appt.status === 'in-progress') && (
                      <button 
                        onClick={() => handleCancelAppointment(appt._id, appt)} 
                        className="action-btn cancel-btn"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {selectedNotesApptId === appt._id && (
                <div className="content-section">
                  <DoctorNote appointmentId={appt._id} />
                </div>
              )}

              {selectedRxApptId === appt._id && (
                <div className="content-section">
                  <DoctorPrescription appointmentId={appt._id} patientId={appt.user._id} />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>You have no appointments.</p>
      )}
    </div>
  );
}

export default DoctorAppointment;
