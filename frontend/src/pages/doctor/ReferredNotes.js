import React, { useEffect, useState } from "react";
import axios from "axios";

export default function ReferredNotes({ apiBaseUrl, endpoint }) {
  const [notes, setNotes] = useState([]);
  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const res = await axios.get(`${apiBaseUrl}${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setNotes(res.data.notes || []);
      } catch (err) {
        console.error("Error fetching referral notes:", err);
      }
    };
    fetchNotes();
  }, [apiBaseUrl, endpoint, token]);

  return (
    <div>
      {notes.length === 0 ? (
        <p className="text-gray-500 italic text-center py-4">No referrals found.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note._id}
              className="p-4 bg-gray-50 border rounded-xl hover:shadow transition"
            >
              <p className="text-sm text-gray-700 mb-1">
                <strong>Patient:</strong> {note.patient?.name} ({note.patient?.email})
              </p>
              {note.doctor && (
                <p className="text-sm text-gray-700 mb-1">
                  <strong>Doctor:</strong> {note.doctor.name} ({note.doctor.email})
                </p>
              )}
              {note.referredTo && (
                <p className="text-sm text-gray-700 mb-1">
                  <strong>Referred To:</strong> {note.referredTo.name} ({note.referredTo.specialization})
                </p>
              )}
              <p className="text-gray-600 mt-1">{note.text}</p>
              <p className="text-xs text-gray-400 mt-2">
                {new Date(note.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
