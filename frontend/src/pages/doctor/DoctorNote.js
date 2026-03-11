import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import "../../styles/doctor/DoctorNote.css";

const API_BASE = 'http://localhost:5000/api';

function DoctorNote({ appointmentId }) {
  const [notes, setNotes] = useState([]);
  const [newText, setNewText] = useState('');
  const [pendingFiles, setPending] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState('');
  const [uploadingId, setUploadingId] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  const newImgRef = useRef(null);
  const addImgRef = useRef(null);
  const addImgNote = useRef(null);

  const token = localStorage.getItem('token');

  const fetchNotes = async () => {
    if (!appointmentId) return;
    setIsLoading(true); setError('');
    try {
      const r = await axios.get(`${API_BASE}/notes/${appointmentId}`, { params: { token } });
      setNotes(r.data.notes || []);
    } catch (e) {
      setError('Could not load notes. ' + (e.response?.data?.error || ''));
    } finally { setIsLoading(false); }
  };
  useEffect(() => { fetchNotes(); }, [appointmentId]);

  const onPickNewImages = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPending(prev => [...prev, ...files]);
    e.target.value = '';
  };
  const removePending = (i) => setPending(p => p.filter((_, idx) => idx !== i));

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newText.trim()) { setError('Note text is required.'); return; }
    setError(''); setIsSaving(true);
    try {
      const r = await axios.post(`${API_BASE}/notes/add`, { token, appointmentId, text: newText });
      if (!r.data.success) throw new Error('Add failed');
      let note = r.data.note;
      if (pendingFiles.length) {
        const fd = new FormData();
        fd.append('token', token);
        pendingFiles.forEach(f => fd.append('images', f));
        const ir = await axios.post(`${API_BASE}/notes/${note._id}/images`, fd,
          { headers: { 'Content-Type': 'multipart/form-data' } });
        if (ir.data.success) note = ir.data.note;
      }
      setNotes([note, ...notes]);
      setNewText(''); setPending([]);
    } catch (e) {
      setError('Failed to add note. ' + (e.response?.data?.error || e.message));
    } finally { setIsSaving(false); }
  };

  const startEdit = (n) => { setEditId(n._id); setEditText(n.text); };
  const cancelEdit = () => { setEditId(null); setEditText(''); };
  const saveEdit = async (id) => {
    if (!editText.trim()) { setError('Note cannot be empty.'); return; }
    setError('');
    try {
      const r = await axios.put(`${API_BASE}/notes/${id}`, { token, text: editText });
      if (r.data.success) { setNotes(notes.map(n => n._id === id ? r.data.note : n)); cancelEdit(); }
    } catch (e) { setError('Failed to update. ' + (e.response?.data?.error || '')); }
  };

  const delNote = async (id) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      const r = await axios.delete(`${API_BASE}/notes/${id}`, { params: { token } });
      if (r.data.success) setNotes(notes.filter(n => n._id !== id));
    } catch (e) { setError('Failed to delete.'); }
  };

  const openAddImg = (id) => { addImgNote.current = id; addImgRef.current?.click(); };
  const handleAddImg = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    const id = addImgNote.current;
    setUploadingId(id); setError('');
    try {
      const fd = new FormData();
      fd.append('token', token);
      for (let i = 0; i < files.length; i++) fd.append('images', files[i]);
      const r = await axios.post(`${API_BASE}/notes/${id}/images`, fd,
        { headers: { 'Content-Type': 'multipart/form-data' } });
      if (r.data.success) setNotes(notes.map(n => n._id === id ? r.data.note : n));
    } catch (e) { setError('Upload failed.'); }
    finally {
      setUploadingId(null); addImgNote.current = null;
      if (addImgRef.current) addImgRef.current.value = '';
    }
  };

  const delImg = async (noteId, idx) => {
    if (!window.confirm('Delete this image?')) return;
    try {
      const r = await axios.delete(`${API_BASE}/notes/${noteId}/images/${idx}`, { params: { token } });
      if (r.data.success) setNotes(notes.map(n => n._id === noteId ? r.data.note : n));
    } catch (e) { setError('Delete image failed.'); }
  };

  const fmt = (d) => new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="dn-root">
      <input type="file" ref={newImgRef} onChange={onPickNewImages} accept="image/*" multiple style={{ display: 'none' }} />
      <input type="file" ref={addImgRef} onChange={handleAddImg} accept="image/*" multiple style={{ display: 'none' }} />

      {lightbox && (
        <div className="dn-lightbox" onClick={() => setLightbox(null)}>
          <button className="dn-lb-close" onClick={() => setLightbox(null)}>✕</button>
          <img src={lightbox} alt="Full size" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {error && <div className="dn-error"><span>⚠</span> {error}</div>}

      {/* Composer */}
      <div className="dn-composer">
        <div className="dn-composer-top">
          <div className="dn-composer-title"><span>✏️</span><span>New Clinical Note</span></div>
          <span className="dn-composer-hint">Symptoms · Findings · Instructions</span>
        </div>
        <textarea className="dn-textarea" value={newText} onChange={e => setNewText(e.target.value)}
          placeholder="e.g. Patient presents with fever 101°F, complains of sore throat. Advised rest and hydration…" rows={3} />
        {pendingFiles.length > 0 && (
          <div className="dn-pending-strip">
            <span className="dn-pending-label">📎 Ready to attach ({pendingFiles.length}):</span>
            <div className="dn-pending-thumbs">
              {pendingFiles.map((f, i) => (
                <div key={i} className="dn-pending-item">
                  <img src={URL.createObjectURL(f)} alt={f.name} />
                  <button className="dn-pending-x" onClick={() => removePending(i)}>✕</button>
                  <span className="dn-pending-name">{f.name.length > 12 ? f.name.slice(0, 10) + '…' : f.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="dn-composer-bar">
          <button type="button" className="dn-attach-btn" onClick={() => newImgRef.current?.click()}>
            <span>📎</span><span>Attach Image{pendingFiles.length > 0 ? ` (${pendingFiles.length})` : ''}</span>
          </button>
          <button type="button" className="dn-add-btn" onClick={handleAdd} disabled={isSaving || !newText.trim()}>
            {isSaving ? '⏳ Saving…' : '+ Add Note'}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="dn-list">
        {isLoading ? (
          <div className="dn-state"><span>⏳</span><p>Loading notes…</p></div>
        ) : notes.length === 0 ? (
          <div className="dn-state"><span className="dn-state-icon">🗒️</span><p>No clinical notes yet.</p></div>
        ) : notes.map((note, ni) => (
          <div key={note._id} className={`dn-card${editId === note._id ? ' editing' : ''}`}>
            <div className="dn-card-stripe" />
            {editId === note._id ? (
              <div className="dn-edit-wrap">
                <textarea className="dn-edit-ta" value={editText} onChange={e => setEditText(e.target.value)} rows={4} />
                <div className="dn-edit-btns">
                  <button className="dn-btn-ok" onClick={() => saveEdit(note._id)}>✓ Save</button>
                  <button className="dn-btn-cx" onClick={cancelEdit}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="dn-card-head">
                  <span className="dn-note-badge">Note #{notes.length - ni}</span>
                  <span className="dn-note-time">🕐 {fmt(note.createdAt)}
                    {note.updatedAt !== note.createdAt && <span className="dn-edited"> · edited</span>}
                  </span>
                </div>
                <p className="dn-note-body">{note.text}</p>
                {note.images?.length > 0 && (
                  <div className="dn-imgs-wrap">
                    <div className="dn-imgs-label"><span>📎</span> Attachments ({note.images.length})</div>
                    <div className="dn-imgs-grid">
                      {note.images.map((img, idx) => (
                        <div key={idx} className="dn-img-card">
                          <img src={`http://localhost:5000${img.url}`} alt={img.caption || `Attachment ${idx + 1}`}
                            onClick={() => setLightbox(`http://localhost:5000${img.url}`)} />
                          <button className="dn-img-del" onClick={() => delImg(note._id, idx)} title="Remove">✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="dn-actions">
                  <button className="dn-act dn-act-edit" onClick={() => startEdit(note)}>✏️ Edit</button>
                  <button className="dn-act dn-act-img" onClick={() => openAddImg(note._id)} disabled={!!uploadingId}>
                    {uploadingId === note._id ? '⏳ Uploading…' : '📎 Add Image'}
                  </button>
                  <button className="dn-act dn-act-del" onClick={() => delNote(note._id)}>🗑 Delete</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default DoctorNote;