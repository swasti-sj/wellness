import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import "../../styles/doctor/DoctorNote.css";

function DoctorNote({ appointmentId }) {
  const [notes, setNotes] = useState([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editText, setEditText] = useState('');
  const [uploadingImages, setUploadingImages] = useState(false);
  const [selectedNoteForImages, setSelectedNoteForImages] = useState(null);
  const fileInputRef = useRef(null);

  const API_BASE_URL = 'http://localhost:5000/api';

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
      
      const response = await axios.get(`${API_BASE_URL}/notes/${appointmentId}`, {
        params: { token }
      });

      setNotes(response.data.notes || []);
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
      const response = await axios.post(`${API_BASE_URL}/notes/add`, {
        token,
        appointmentId,
        text: newNoteText,
      });

      if (response.data.success) {
        setNotes([response.data.note, ...notes]);
        setNewNoteText('');
      }
    } catch (err) {
      console.error('Error adding note:', err);
      setError('Failed to add note. ' + (err.response?.data?.error || ''));
    }
  };

  // Start editing a note
  const startEditing = (note) => {
    setEditingNoteId(note._id);
    setEditText(note.text);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingNoteId(null);
    setEditText('');
  };

  // Save edited note
  const saveEdit = async (noteId) => {
    if (!editText.trim()) {
      setError('Note cannot be empty.');
      return;
    }

    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(`${API_BASE_URL}/notes/${noteId}`, {
        token,
        text: editText,
      });

      if (response.data.success) {
        setNotes(notes.map(n => n._id === noteId ? response.data.note : n));
        setEditingNoteId(null);
        setEditText('');
      }
    } catch (err) {
      console.error('Error updating note:', err);
      setError('Failed to update note. ' + (err.response?.data?.error || ''));
    }
  };

  // Delete a note
  const deleteNote = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;

    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`${API_BASE_URL}/notes/${noteId}`, {
        params: { token }
      });

      if (response.data.success) {
        setNotes(notes.filter(n => n._id !== noteId));
      }
    } catch (err) {
      console.error('Error deleting note:', err);
      setError('Failed to delete note. ' + (err.response?.data?.error || ''));
    }
  };

  // Handle image upload button click
  const handleImageUploadClick = (noteId) => {
    setSelectedNoteForImages(noteId);
    fileInputRef.current?.click();
  };

  // Handle file selection and upload
  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImages(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('token', token);
      
      for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
      }

      const response = await axios.post(
        `${API_BASE_URL}/notes/${selectedNoteForImages}/images`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.success) {
        setNotes(notes.map(n => n._id === selectedNoteForImages ? response.data.note : n));
        setSelectedNoteForImages(null);
      }
    } catch (err) {
      console.error('Error uploading images:', err);
      setError('Failed to upload images. ' + (err.response?.data?.error || ''));
    } finally {
      setUploadingImages(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Delete an image from a note
  const deleteImage = async (noteId, imageIndex) => {
    if (!window.confirm('Are you sure you want to delete this image?')) return;

    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(
        `${API_BASE_URL}/notes/${noteId}/images/${imageIndex}`,
        { params: { token } }
      );

      if (response.data.success) {
        setNotes(notes.map(n => n._id === noteId ? response.data.note : n));
      }
    } catch (err) {
      console.error('Error deleting image:', err);
      setError('Failed to delete image. ' + (err.response?.data?.error || ''));
    }
  };

  return (
    <div className="doctor-notes">
      <h3>Clinical Notes</h3>
      
      {error && <p className="error-message">{error}</p>}

      {/* Add new note form */}
      <form onSubmit={handleAddNote} className="note-form">
        <textarea
          value={newNoteText}
          onChange={(e) => setNewNoteText(e.target.value)}
          placeholder="Write a new clinical note..."
          rows={3}
        />
        <button type="submit" className="add-note-btn">
          Add Note
        </button>
      </form>

      {/* Hidden file input for image uploads */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        multiple
        style={{ display: 'none' }}
      />

      {/* Notes list */}
      <div className="notes-list">
        {isLoading ? (
          <p className="loading">Loading notes...</p>
        ) : notes.length > 0 ? (
          notes.map(note => (
            <div key={note._id} className="note-card">
              {/* Editing mode */}
              {editingNoteId === note._id ? (
                <div className="note-edit-mode">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={4}
                    className="edit-textarea"
                  />
                  <div className="edit-actions">
                    <button 
                      onClick={() => saveEdit(note._id)}
                      className="save-btn"
                    >
                      Save
                    </button>
                    <button 
                      onClick={cancelEditing}
                      className="cancel-btn"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <>
                  <div className="note-content">
                    <p className="note-text">{note.text}</p>
                    <small className="note-date">
                      {new Date(note.createdAt).toLocaleString()}
                      {note.updatedAt && note.updatedAt !== note.createdAt && (
                        <span className="edited-label"> (edited)</span>
                      )}
                    </small>
                  </div>

                  {/* Images section */}
                  {note.images && note.images.length > 0 && (
                    <div className="note-images">
                      <h5>Attached Images</h5>
                      <div className="images-grid">
                        {note.images.map((image, index) => (
                          <div key={index} className="image-item">
                            <img 
                              src={`http://localhost:5000${image.url}`} 
                              alt={image.caption || `Image ${index + 1}`}
                              onClick={() => window.open(`http://localhost:5000${image.url}`, '_blank')}
                            />
                            <button 
                              className="delete-image-btn"
                              onClick={() => deleteImage(note._id, index)}
                              title="Delete image"
                            >
                              ×
                            </button>
                            {image.caption && (
                              <span className="image-caption">{image.caption}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Note actions */}
                  <div className="note-actions">
                    <button 
                      onClick={() => startEditing(note)}
                      className="edit-note-btn"
                      title="Edit note"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleImageUploadClick(note._id)}
                      className="add-image-btn"
                      title="Add images"
                      disabled={uploadingImages}
                    >
                      {uploadingImages ? 'Uploading...' : 'Add Images'}
                    </button>
                    <button 
                      onClick={() => deleteNote(note._id)}
                      className="delete-note-btn"
                      title="Delete note"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        ) : (
          <p className="no-notes">No clinical notes yet.</p>
        )}
      </div>
    </div>
  );
}

export default DoctorNote;

