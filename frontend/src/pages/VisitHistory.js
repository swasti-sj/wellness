import React, { useEffect, useState } from 'react';
import axios from 'axios';

function VisitHistory() {
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/appointments/history', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        setAppointments(res.data);
      } catch (err) {
        console.error('Error fetching visit history:', err);
      }
    };

    fetchHistory();
  }, []);

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
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((appt) => (
            <tr key={appt._id}>
              <td>{appt.doctor || '-'}</td>
              <td>{appt.specialization || '-'}</td> {/* Add this field in backend if needed */}
              <td>{new Date(appt.date).toLocaleDateString()}</td>
              <td>{appt.time}</td>
              <td>{appt.notes || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default VisitHistory;
