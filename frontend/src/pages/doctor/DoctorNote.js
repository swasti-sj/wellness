import React, { useState, useEffect } from 'react';
import axios from 'axios';
import "../../styles/doctor/DoctorNote.css";


function DoctorNote({ appointmentId }) {
  const [notes, setNotes] = useState([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Function to fetch notes for the given appointment
  const fetchNotes = async () => {
    if (!appointmentId) return;

    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication error. Please log in again.');
        return;
      }
      
      const response = await axios.get(`http://localhost:5000/api/notes/${appointmentId}`, {
        params: { token }
      });

      setNotes(response.data.notes);
    } catch (err) {
      console.error('Error fetching notes:', err);
      setError('Could not fetch notes. ' + (err.response?.data?.error || ''));
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch notes when the component mounts or the appointmentId changes
  useEffect(() => {
    fetchNotes();
  }, [appointmentId]);

  // Handler for submitting a new note
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim()) {
      setError('Note cannot be empty.');
      return;
    }

    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/notes/add', {
        token,
        appointmentId,
        text: newNoteText,
      });

      if (response.data.success) {
        setNotes([response.data.note, ...notes]); // Add new note to the top of the list
        setNewNoteText(''); // Clear the textarea
      }
    } catch (err) {
      console.error('Error adding note:', err);
      setError('Failed to add note. ' + (err.response?.data?.error || ''));
    }
  };

  return (
    <div className="doctor-notes">
  <h3>Clinical Notes</h3>
  <form onSubmit={handleAddNote} className="note-form">
    <textarea
      value={newNoteText}
      onChange={(e) => setNewNoteText(e.target.value)}
      placeholder="Write a note..."
    />
    <button type="submit">Add Note</button>
  </form>

  <div className="notes-list">
    {notes.length > 0 ? notes.map(note => (
      <div key={note._id} className="note-card">
        <p>{note.text}</p>
        <small>{new Date(note.createdAt).toLocaleString()}</small>
      </div>
    )) : <p>No notes yet.</p>}
  </div>
</div>

  );
}

export default DoctorNote;