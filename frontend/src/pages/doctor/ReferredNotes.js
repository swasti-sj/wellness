import React, { useState, useEffect } from 'react';
import axios from 'axios';

function ReferredNotes({ apiBaseUrl }) {
  const [notes, setNotes] = useState([]);
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const res = await axios.get(`${apiBaseUrl}/referrals/all`, { params: { token } });
        setNotes(res.data.notes || []);
      } catch (err) {
        console.error("Error fetching referral notes:", err.response?.data || err.message);
      }
    };
    fetchNotes();
  }, [apiBaseUrl, token]);

  return (
    <div className="referred-notes">
      <h4>All Referrals Sent to You</h4>
      {notes.length > 0 ? (
        notes.map(note => (
          <div key={note._id} style={{ borderBottom: "1px solid #ccc", marginBottom: "10px", paddingBottom: "5px" }}>
            <p><strong>Patient:</strong> {note.patient.name} ({note.patient.email})</p>
            <p>{note.text}</p>
            <small>
              Referred by: {note.doctor.name} ({note.doctor.email}) <br />
              {new Date(note.createdAt).toLocaleString()}
            </small>
          </div>
        ))
      ) : (
        <p>No referral notes yet.</p>
      )}
    </div>
  );
}

export default ReferredNotes;
