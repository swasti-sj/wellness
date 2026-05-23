import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import Fuse from 'fuse.js';
import ReceptionistNavbar from './ReceptionistNavbar';
import '../../styles/receptionist/ReceptionistDashboard.css';
import { useApi } from '../../context/ApiContext';

export default function ReceptionistDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [manualEntries, setManualEntries] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    rollNo: '',
    role: 'Student',
    doctorId: '',
    doctorName: '',
    date: new Date().toISOString().split('T')[0],
    time: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success'); // 'success' | 'error'
  const [editingRowId, setEditingRowId] = useState(null);
  const [editedValues, setEditedValues] = useState({});
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'name'
  const [filterDoctor, setFilterDoctor] = useState(''); // Filter by doctor

  const token = localStorage.getItem('token');
  const apiBaseUrl = useApi();

  useEffect(() => {
    const loadData = () => {
      fetchAppointments();
      fetchManualEntries();
      fetchDoctors();
    };
    
    loadData();
    const intervalId = setInterval(loadData, 60000); // Auto-refresh every 60s
    return () => clearInterval(intervalId);
  }, []);

  const fetchDoctors = async () => {
    try {
      const response = await axios.get(`${apiBaseUrl}/api/doctors/list`);
      setDoctors(response.data || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${apiBaseUrl}/api/appointments/all-appointments`);
      const formatted = (response.data.appointments || []).map(appt => ({
        _id: appt._id,
        patientName: appt.user?.name || 'Unknown',
        roll: appt.user?.roll || '-',
        doctorName: appt.doctor?.name || 'Unknown',
        doctorId: appt.doctor?._id || '',
        email: appt.user?.email || '-',
        phone: appt.user?.phone || '-',
        date: appt.startDateTime,
        time: appt.slotTime || '-',
        status: appt.status || 'booked',
        source: 'system'
      }));
      setAppointments(formatted);
      setMessage('');
    } catch (error) {
      console.error('Error fetching appointments:', error);
      showMessage('Error loading appointments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchManualEntries = async () => {
    try {
      const response = await axios.get(`${apiBaseUrl}/api/receptionist/entries`);
      const entries = (response.data.entries || []).map(entry => ({
        _id: entry._id,
        patientName: entry.patientName,
        roll: entry.roll,
        role: entry.role,
        doctorName: entry.doctorName || '-',
        date: entry.appointmentDate,
        time: entry.appointmentTime || '-',
        status: entry.status,
        source: 'manual'
      }));
      setManualEntries(entries);
    } catch (error) {
      console.error('Error fetching manual entries:', error);
    }
  };

  const showMessage = (text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3500);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    if (name === 'doctorId') {
      const selectedDoctor = doctors.find(d => d._id === value);
      setFormData(prev => ({
        ...prev,
        doctorId: value,
        doctorName: selectedDoctor ? selectedDoctor.name : ''
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleStatusChange = async (itemId, newStatus) => {
    const manualEntry = manualEntries.find(e => e._id === itemId);
    const appointmentEntry = appointments.find(a => a._id === itemId);

    try {
      if (manualEntry) {
        await axios.patch(`${apiBaseUrl}/api/receptionist/entries/${itemId}/status`, { status: newStatus });
      } else if (appointmentEntry) {
        const token = localStorage.getItem('token');
        await axios.patch(`${apiBaseUrl}/api/appointments/${itemId}/status`, { status: newStatus, token });
      }
    } catch (error) {
      const errMsg = error.response?.data?.error || error.message || 'Error updating status';
      showMessage(`Error: ${errMsg}`, 'error');
      return;
    }

    setAppointments(prev => prev.map(a => a._id === itemId ? { ...a, status: newStatus } : a));
    setManualEntries(prev => prev.map(e => e._id === itemId ? { ...e, status: newStatus } : e));
    showMessage('Status updated successfully');
  };

  const handleEditRow = (item) => {
    setEditingRowId(item._id);
    setEditedValues({
      patientName: item.patientName,
      roll: item.roll,
      doctorName: item.doctorName,
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : '',
      time: item.time || ''
    });
  };

  const handleEditFieldChange = (fieldName, value) => {
    setEditedValues(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleSaveChanges = async (itemId) => {
    const manualEntry = manualEntries.find(e => e._id === itemId);
    const appointmentEntry = appointments.find(a => a._id === itemId);

    try {
      if (manualEntry) {
        await axios.patch(`${apiBaseUrl}/api/receptionist/entries/${itemId}`, {
        patientName: editedValues.patientName,
        roll: editedValues.roll,
        doctorName: editedValues.doctorName,
        appointmentDate: editedValues.date || null,
        appointmentTime: editedValues.time || null
      });

        // Update status if changed during edit
        if (editedValues.status && editedValues.status !== manualEntry.status) {
          await axios.patch(`${apiBaseUrl}/api/receptionist/entries/${itemId}/status`, { status: editedValues.status });
        }
      } else if (appointmentEntry) {
        // For standard appointments, only update status if it was modified
        if (editedValues.status && editedValues.status !== appointmentEntry.status) {
          const token = localStorage.getItem('token');
          await axios.patch(`${apiBaseUrl}/api/appointments/${itemId}/status`, { status: editedValues.status, token });
        }
      }

      setAppointments(prev => prev.map(a =>
        a._id === itemId ? { ...a, ...editedValues, date: editedValues.date ? new Date(editedValues.date).toISOString() : a.date } : a
      ));
      setManualEntries(prev => prev.map(e =>
        e._id === itemId ? { ...e, ...editedValues, date: editedValues.date ? new Date(editedValues.date).toISOString() : e.date } : e
      ));
      setEditingRowId(null);
      setEditedValues({});
      showMessage('Changes saved successfully');

    } catch (error) {
      const errMsg = error.response?.data?.error || error.message || 'Error saving changes';
      showMessage(`Error: ${errMsg}`, 'error');
      setEditingRowId(null);
      setEditedValues({});
    }
  };

  const handleAddEntry = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.rollNo.trim()) {
      showMessage('Please fill in all required fields', 'error');
      return;
    }
    if (!formData.doctorId) {
      showMessage('Please select a doctor', 'error');
      return;
    }
    try {
      const appointmentDateTime = formData.date
        ? new Date(`${formData.date}T00:00:00`).toISOString()
        : null;
      // If receptionist didn't enter time, set it to current time.
      const timeToSend = formData.time || new Date().toTimeString().slice(0, 5);

      const response = await axios.post(`${apiBaseUrl}/api/receptionist/entries`, {
        patientName: formData.name,
        roll: formData.rollNo,
        role: formData.role,
        doctorId: formData.doctorId,
        doctorName: formData.doctorName,
        appointmentDate: appointmentDateTime,
        appointmentTime: timeToSend || null,
        email: '-',
        phone: '-'
      });
      if (response.data.success) {
        const newEntry = {
          _id: response.data.entry._id,
          patientName: response.data.entry.patientName,
          roll: response.data.entry.roll,
          role: response.data.entry.role,
          doctorName: response.data.entry.doctorName,
          date: response.data.entry.appointmentDate,
          time: response.data.entry.appointmentTime || '-',
          status: response.data.entry.status,
          source: 'manual'
        };
        setManualEntries(prev => [newEntry, ...prev]);
        setFormData({
          name: '', rollNo: '', role: 'Student', doctorId: '', doctorName: '',
          date: new Date().toISOString().split('T')[0]
        });
        showMessage('Entry added successfully');
      }
    } catch (error) {
      showMessage(error.response?.data?.error || 'Error adding entry', 'error');
    }
  };

  const allData = [...appointments, ...manualEntries];

  const filteredData = useMemo(() => {
    let result = allData;
    
    // Filter by doctor if selected
    if (filterDoctor) {
      result = result.filter(item => item.doctorId === filterDoctor);
    }
    
    if (searchQuery.trim()) {
      const fuse = new Fuse(result, {
        keys: ['patientName', 'roll', 'doctorName', 'date', 'time', 'status', 'email'],
        threshold: 0.3,
        includeScore: true
      });
      result = fuse.search(searchQuery).map(r => r.item);
    }

    // Apply Sorting
    return [...result].sort((a, b) => {
      if (sortBy === 'name') {
        return (a.patientName || '').localeCompare(b.patientName || '');
      } else if (sortBy === 'newest') {
        return new Date(b.date || 0) - new Date(a.date || 0);
      } else if (sortBy === 'oldest') {
        return new Date(a.date || 0) - new Date(b.date || 0);
      }
      return 0;
    });
  }, [allData, searchQuery, sortBy, filterDoctor]);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStatusMeta = (status) => {
    switch (status) {
      case 'attended': return { bg: '#E8F6EF', color: '#1E8A55', label: 'Attended' };
      case 'booked': return { bg: '#FFF3E0', color: '#C8860A', label: 'Booked' };
      case 'no show': return { bg: '#F5F5F5', color: '#666', label: 'No Show' };
      case 'cancelled by user': return { bg: '#FDECEA', color: '#B8243A', label: 'Cancelled (User)' };
      case 'cancelled by doctor': return { bg: '#FDECEA', color: '#B8243A', label: 'Cancelled (Doctor)' };
      case 'walk in': return { bg: '#EDE7F6', color: '#4A1060', label: 'Walk-in' };
      case 'Added': return { bg: '#E3F2FD', color: '#1565C0', label: 'Added' };
      default: return { bg: '#F5F5F5', color: '#555', label: status };
    }
  };

  return (
    <div>
      <ReceptionistNavbar />
      <div className="receptionist-dashboard">

        <h1 className="rd-page-title">Receptionist Dashboard</h1>

        {/* Search Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <div className="rd-search-bar" style={{ flex: 1, marginBottom: 0, minWidth: '250px' }}>
          <svg className="rd-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            className="rd-search-input"
            placeholder="Search by name, roll no, doctor, date, status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="rd-search-clear" onClick={() => setSearchQuery('')} title="Clear search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
          {searchQuery && (
            <span className="rd-search-count">{filteredData.length} result{filteredData.length !== 1 ? 's' : ''}</span>
          )}
        </div>
          <select 
            value={filterDoctor} 
            onChange={(e) => setFilterDoctor(e.target.value)}
            className="rd-doctor-filter"
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid #ddd',
              background: '#fff',
              fontSize: '0.95rem',
              fontWeight: '600',
              color: '#4A1060',
              cursor: 'pointer',
              outline: 'none',
              minWidth: '200px',
              height: '48px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              transition: 'all 0.2s'
            }}
          >
            <option value="">All Doctors</option>
            {doctors.map(d => (
              <option key={d._id} value={d._id}>
                {d.name}{d.specialization ? ` (${d.specialization})` : ''}
              </option>
            ))}
          </select>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="rd-sort-select"
            style={{
              padding: '12px 20px',
              borderRadius: '12px',
              border: '1px solid #ddd',
              background: '#fff',
              fontSize: '0.95rem',
              fontWeight: '600',
              color: '#4A1060',
              cursor: 'pointer',
              outline: 'none',
              minWidth: '180px',
              height: '48px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}
          >
            <option value="newest">Latest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Patient Name (A-Z)</option>
          </select>
        </div>

        {/* Add Entry Form — Horizontal */}
        <div className="rd-form-card">
          <div className="rd-form-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <h2>Add Entry</h2>
          </div>
          <form onSubmit={handleAddEntry} className="rd-form-grid">
            <div className="rd-form-group">
              <label>Patient Name <span className="rd-required">*</span></label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                placeholder="Enter full name"
                required
              />
            </div>
            <div className="rd-form-group">
              <label>Roll No / Emp ID</label>
              <input
                type="text"
                name="rollNo"
                value={formData.rollNo}
                onChange={handleFormChange}
                placeholder="e.g., 23001 or EMP-001"
              />
            </div>
            <div className="rd-form-group">
              <label>Category</label>
              <select name="role" value={formData.role} onChange={handleFormChange}>
                <option value="Student">Student</option>
                <option value="Staff">Staff</option>
                <option value="Faculty">Faculty</option>
              </select>
            </div>
            <div className="rd-form-group">
              <label>Doctor <span className="rd-required">*</span></label>
              <select name="doctorId" value={formData.doctorId} onChange={handleFormChange} required>
                <option value="">— Select Doctor —</option>
                {doctors.map(d => (
                  <option key={d._id} value={d._id}>
                    {d.name}{d.specialization ? ` (${d.specialization})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="rd-form-group">
              <label>Appointment Date</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleFormChange}
              />
            </div>
            <div className="rd-form-group">
              <label>Appointment Time</label>
              <input
                type="time"
                name="time"
                value={formData.time}
                onChange={handleFormChange}
              />
            </div>
            <div className="rd-form-group rd-form-submit-col">
              <label>&nbsp;</label>
              <button type="submit" className="rd-btn-add">Add Entry</button>
            </div>
          </form>
          {message && (
            <div className={`rd-message rd-message--${messageType}`}>
              {messageType === 'success'
                ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><path d="M20 6 9 17l-5-5" /></svg>
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
              }
              {message}
            </div>
          )}
        </div>

        {/* Appointments Table */}
        <div className="rd-table-card">
          <div className="rd-table-header">
            <div className="rd-table-title-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <h2>Appointments</h2>
              <span className="rd-total-count">{filteredData.length} record{filteredData.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {loading ? (
            <div className="rd-loading">
              <div className="rd-spinner"></div>
              <p>Loading appointments...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="rd-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
              </svg>
              <p>{searchQuery ? `No results found for "${searchQuery}"` : 'No appointments yet. Add a new entry to get started.'}</p>
            </div>
          ) : (
            <div className="rd-table-wrapper">
              <table className="rd-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Patient Name</th>
                    <th>Roll No / Emp ID</th>
                    <th>Doctor</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item, index) => {
                    const statusMeta = getStatusMeta(item.status);
                    const isEditing = editingRowId === item._id;
                    return (
                      <tr key={item._id} className={isEditing ? 'rd-row-editing' : ''}>
                        <td data-label="S.No">{index + 1}</td>
                        <td data-label="Date">
                          {isEditing ? (
                            <input
                              type="date"
                              className="rd-edit-input"
                              value={editedValues.date}
                              onChange={(e) => handleEditFieldChange('date', e.target.value)}
                            />
                          ) : formatDate(item.date)}
                        </td>
                        <td data-label="Time">
                          {isEditing ? (
                            <input
                              type="time"
                              className="rd-edit-input"
                              value={editedValues.time || ''}
                              onChange={(e) => handleEditFieldChange('time', e.target.value)}
                            />
                          ) : (item.time || '-')}
                        </td>
                        <td data-label="Patient Name">
                          {isEditing ? (
                            <input
                              type="text"
                              className="rd-edit-input"
                              value={editedValues.patientName}
                              onChange={(e) => handleEditFieldChange('patientName', e.target.value)}
                            />
                          ) : item.patientName}
                        </td>
                        <td data-label="Roll No/Emp ID">
                          {isEditing ? (
                            <input
                              type="text"
                              className="rd-edit-input"
                              value={editedValues.roll}
                              onChange={(e) => handleEditFieldChange('roll', e.target.value)}
                            />
                          ) : item.roll}
                        </td>
                        <td data-label="Doctor">
                          {isEditing ? (
                            <input
                              type="text"
                              className="rd-edit-input"
                              value={editedValues.doctorName}
                              onChange={(e) => handleEditFieldChange('doctorName', e.target.value)}
                            />
                          ) : item.doctorName}
                        </td>
                        <td data-label="Status">
                          {isEditing ? (
                            <select
                              className="rd-status-select"
                              value={editedValues.status || item.status}
                              onChange={(e) => handleEditFieldChange('status', e.target.value)}
                            >
                              <option value="booked">Booked</option>
                              <option value="attended">Attended</option>
                              <option value="no show">No Show</option>
                              <option value="cancelled by user">Cancelled by User</option>
                              <option value="cancelled by doctor">Cancelled by Doctor</option>
                              <option value="walk in">Walk In</option>
                              <option value="Added">Added</option>
                            </select>
                          ) : (
                            <span
                              className="rd-status-badge"
                              style={{ background: statusMeta.bg, color: statusMeta.color }}
                            >
                              {statusMeta.label}
                            </span>
                          )}
                        </td>
                        <td data-label="Actions" className="rd-actions-cell">
                          {isEditing ? (
                            <>
                              <button className="rd-btn-save" onClick={() => handleSaveChanges(item._id)}>Save</button>
                              <button className="rd-btn-cancel" onClick={() => { setEditingRowId(null); setEditedValues({}); }}>Cancel</button>
                            </>
                          ) : (
                            <button className="rd-btn-edit" onClick={() => handleEditRow(item)}>Edit</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}