import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../../styles/VisitHistory.css';

function VisitHistory() {
  const [appointments, setAppointments] = useState([]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/appointments/history', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      // Sort by appointment date/time (soonest first)
      const sorted = [...res.data].sort((a, b) => {
        const dateA = new Date(`${a.date} ${a.time}`);
        const dateB = new Date(`${b.date} ${b.time}`);
        return dateA - dateB;
      });

      setAppointments(sorted);
    } catch (err) {
      console.error('Error fetching visit history:', err);
    }
  };


  useEffect(() => {
    fetchHistory();
  }, []);

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;

    try {
      await axios.patch(`http://localhost:5000/api/appointments/${id}/cancel`, {}, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      alert('Appointment cancelled successfully');
      fetchHistory();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel appointment');
    }
  };

  return (
    <div>
      <h2>Visit History</h2>
      <table>
        <thead>
          <tr>
            <th>Doctor</th>
            <th>Specialization</th>
            <th>Date</th>
            <th>Time</th>
            <th>Status</th> {/* New */}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((appt) => (
            <tr key={appt._id}>
              <td data-label="Doctor">{appt.doctor || '-'}</td>
              <td data-label="Specialization">{appt.specialization || '-'}</td>
              <td data-label="Date">{new Date(appt.date).toLocaleDateString()}</td>
              <td data-label="Time">{appt.time}</td>
              <td data-label="Status">{appt.status}</td> {/* New */}
              <td data-label="Actions">
                {appt.status === 'booked' && (
                  <button onClick={() => handleCancel(appt._id)}>Cancel</button>
                )}
              </td>

            </tr>
          ))}
        </tbody>

      </table>
    </div>
  );
}

export default VisitHistory;
