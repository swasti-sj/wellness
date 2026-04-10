import React, { useEffect, useState } from "react";
import axios from "axios";
import "../../styles/VisitHistory.css";

function VisitHistory() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchHistory = async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:5000/api/appointments/history", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const appointmentsData = Array.isArray(res.data) ? res.data : [];

      const enrichedAppointments = await Promise.all(
        appointmentsData.map(async (appt) => {
          const [prescResult, testResult] = await Promise.allSettled([
            axios.get(`http://localhost:5000/api/prescriptions/${appt._id}`, {
              params: { token },
            }),
            axios.get(`http://localhost:5000/api/tests/${appt._id}`, {
              params: { token },
            }),
          ]);

          return {
            ...appt,
            prescription:
              prescResult.status === "fulfilled" ? prescResult.value.data : null,
            certificate:
              testResult.status === "fulfilled"
                ? testResult.value.data.certificate
                : { issued: false },
          };
        })
      );

      const sorted = [...enrichedAppointments].sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA;
      });

      setAppointments(sorted);
    } catch (err) {
      console.error("Error fetching visit history:", err);
      setError("Unable to load visit history at the moment.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleCancel = async (id) => {
    if (!window.confirm("Are you sure you want to cancel this appointment?")) return;

    try {
      await axios.patch(
        `http://localhost:5000/api/appointments/${id}/cancel`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      alert("Appointment cancelled successfully");
      fetchHistory();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to cancel appointment");
    }
  };

  return (
    <div className="container">
      <div className="visit-history-container">
        <div className="history-header">
          <h2>Visit History</h2>
          <p>Review completed appointments, prescriptions, and issued medical certificates.</p>
        </div>

{loading && (
  <div className="loading-history">
    <p>Fetching your visit history...</p>
  </div>
)}
        {error && <p className="error-message">{error}</p>}

        <table>
          <thead>
            <tr>
              <th>Doctor</th>
              <th>Specialization</th>
              <th>Date</th>
              <th>Time</th>
              <th>Status</th>
              <th>Prescription</th>
              <th>Medical Certificate</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {appointments.length === 0 && !loading ? (
              <tr>
                <td colSpan="8" className="empty-message">
                  No visit history is available yet.
                </td>
              </tr>
            ) : (
              appointments.map((appt) => (
                <tr key={appt._id}>
                  <td data-label="Doctor">{appt.doctor?.name || "-"}</td>
                  <td data-label="Specialization">{appt.doctor?.specialization || "-"}</td>
                  <td data-label="Date">
                    {new Date(appt.date).toLocaleDateString()}
                  </td>
                  <td data-label="Time">{appt.time}</td>
                  <td data-label="Status">
                    <span className={`status-badge ${appt.status}`}>{appt.status}</span>
                  </td>
                  <td data-label="Prescription">
                    {appt.prescription?.prescriptions?.length > 0 ? (
                      <div className="prescription-details">
                        <div className="prescription-summary">
                          {appt.prescription.prescriptions.length} medication{appt.prescription.prescriptions.length > 1 ? 's' : ''}
                        </div>
                        <div className="prescription-list">
                          {appt.prescription.prescriptions.map((item, index) => (
                            <div key={index} className="prescription-item">
                              <div className="medication-name">
                                <strong>{item.medication || item.medicine?.name || 'Unknown'}</strong>
                              </div>
                              <div className="medication-details">
                                <span className="dosage">Dosage: {item.dosage}</span>
                                <span className="frequency">Frequency: {item.frequency}</span>
                                <span className="quantity">Quantity: {item.quantity}</span>
                                {item.notes && <span className="notes">Notes: {item.notes}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                        {appt.prescription.documentUrl && (
                          <div className="prescription-document">
                            <a
                              href={appt.prescription.documentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="document-link"
                            >
                              📄 View Prescription Document
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="history-empty">No prescription issued</span>
                    )}
                  </td>
                  <td data-label="Medical Certificate">
                    {appt.certificate?.issued ? (
                      <div className="history-detail-block">
                        <div>Issued</div>
                        {appt.certificate.imageUrl ? (
                          <a
                            href={appt.certificate.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View certificate
                          </a>
                        ) : null}
                      </div>
                    ) : (
                      <span className="history-empty">None</span>
                    )}
                  </td>
                  <td data-label="Actions">
                    {appt.status === "booked" ? (
                      <button onClick={() => handleCancel(appt._id)}>Cancel</button>
                    ) : (
                      <span className="history-small-text">No action</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default VisitHistory;
