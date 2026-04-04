import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import Fuse from 'fuse.js';
import ReceptionistNavbar from './ReceptionistNavbar';
import '../../styles/receptionist/ReceptionistDashboard.css';

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
    date: new Date().toISOString().split('T')[0] // Default to today
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editingStatusId, setEditingStatusId] = useState(null);
  const [editingRowId, setEditingRowId] = useState(null);
  const [editedValues, setEditedValues] = useState({});

  // Get token from localStorage
  const token = localStorage.getItem('token');
  const apiBaseUrl = 'http://localhost:5000/api';

  // Fetch all appointments on mount
  useEffect(() => {
    fetchAppointments();
    fetchManualEntries();
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const response = await axios.get(`${apiBaseUrl}/doctors/list`);
      setDoctors(response.data || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${apiBaseUrl}/appointments/all-appointments`);

      // Format appointments properly from backend
      const formatted = (response.data.appointments || []).map(appt => ({
        _id: appt._id,
        patientName: appt.user?.name || "Unknown",
        roll: appt.user?.roll || "-",
        doctorName: appt.doctor?.name || "Unknown",
        doctorId: appt.doctor?._id || "",
        email: appt.user?.email || "-",
        phone: appt.user?.phone || "-",
        date: appt.startDateTime,
        time: appt.slotTime || "-",
        status: appt.status || "booked",
        source: 'system'
      }));

      setAppointments(formatted);
      setMessage('');
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setMessage('Error loading appointments');
    } finally {
      setLoading(false);
    }
  };

  const fetchManualEntries = async () => {
    try {
      const response = await axios.get(`${apiBaseUrl}/receptionist/entries`);
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

  // Handle form input changes
  const handleFormChange = (e) => {
    const { name, value } = e.target;

    if (name === 'doctorId') {
      // Find the doctor name from doctors list
      const selectedDoctor = doctors.find(d => d._id === value);
      setFormData(prev => ({
        ...prev,
        doctorId: value,
        doctorName: selectedDoctor ? selectedDoctor.name : ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Handle status change
  const handleStatusChange = async (itemId, newStatus) => {
    // Check if it's a manual entry
    const manualEntry = manualEntries.find(e => e._id === itemId);

    if (manualEntry) {
      // Save to database if it's a manual entry
      try {
        await axios.patch(`${apiBaseUrl}/receptionist/entries/${itemId}/status`, {
          status: newStatus
        });
      } catch (error) {
        console.error('Error updating entry status:', error);
        setMessage('Error updating status');
        setTimeout(() => setMessage(''), 3000);
        return;
      }
    }

    // Update appointments if it exists there
    setAppointments(prev =>
      prev.map(appt =>
        appt._id === itemId ? { ...appt, status: newStatus } : appt
      )
    );

    // Update manual entries if it exists there
    setManualEntries(prev =>
      prev.map(entry =>
        entry._id === itemId ? { ...entry, status: newStatus } : entry
      )
    );

    setEditingStatusId(null);
    setMessage('Status updated');
    setTimeout(() => setMessage(''), 3000);
  };

  // Handle edit row
  const handleEditRow = (item) => {
    setEditingRowId(item._id);
    setEditedValues({
      patientName: item.patientName,
      roll: item.roll,
      doctorName: item.doctorName,
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : ''
    });
  };

  // Handle field change while editing
  const handleEditFieldChange = (fieldName, value) => {
    setEditedValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  // Handle save changes
  const handleSaveChanges = async (itemId) => {
    // Check if it's a manual entry
    const manualEntry = manualEntries.find(e => e._id === itemId);

    if (manualEntry) {
      // Save to database if it's a manual entry
      try {
        await axios.patch(`${apiBaseUrl}/receptionist/entries/${itemId}`, {
          patientName: editedValues.patientName,
          roll: editedValues.roll,
          doctorName: editedValues.doctorName,
          appointmentDate: editedValues.date || null
        });
      } catch (error) {
        console.error('Error saving entry changes:', error);
        setMessage('Error saving changes');
        setTimeout(() => setMessage(''), 3000);
        setEditingRowId(null);
        setEditedValues({});
        return;
      }
    }

    // Update appointments if it exists there
    setAppointments(prev =>
      prev.map(appt =>
        appt._id === itemId
          ? {
              ...appt,
              patientName: editedValues.patientName,
              roll: editedValues.roll,
              doctorName: editedValues.doctorName,
              date: editedValues.date ? new Date(editedValues.date).toISOString() : appt.date
            }
          : appt
      )
    );

    // Update manual entries if it exists there
    setManualEntries(prev =>
      prev.map(entry =>
        entry._id === itemId
          ? {
              ...entry,
              patientName: editedValues.patientName,
              roll: editedValues.roll,
              doctorName: editedValues.doctorName,
              date: editedValues.date ? new Date(editedValues.date).toISOString() : entry.date
            }
          : entry
      )
    );

    setEditingRowId(null);
    setEditedValues({});
    setMessage('Changes saved successfully');
    setTimeout(() => setMessage(''), 3000);
  };

  // Handle add entry
  const handleAddEntry = async (e) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.rollNo.trim()) {
      setMessage('Please fill all fields');
      return;
    }

    if (!formData.doctorId) {
      setMessage('Please select a doctor');
      return;
    }

    try {
      const appointmentDateTime = formData.date
        ? new Date(`${formData.date}T00:00:00`).toISOString()
        : null;

      const response = await axios.post(`${apiBaseUrl}/receptionist/entries`, {
        patientName: formData.name,
        roll: formData.rollNo,
        role: formData.role,
        doctorId: formData.doctorId,
        doctorName: formData.doctorName,
        appointmentDate: appointmentDateTime,
        appointmentTime: null,
        email: "-",
        phone: "-"
      });

      if (response.data.success) {
        const newEntry = {
          _id: response.data.entry._id,
          patientName: response.data.entry.patientName,
          roll: response.data.entry.roll,
          role: response.data.entry.role,
          doctorName: response.data.entry.doctorName,
          doctorId: response.data.entry.doctorId,
          email: response.data.entry.email,
          phone: response.data.entry.phone,
          date: response.data.entry.appointmentDate,
          time: response.data.entry.appointmentTime || '-',
          status: response.data.entry.status,
          source: 'manual'
        };

        setManualEntries(prev => [newEntry, ...prev]);
        setFormData({
          name: '',
          rollNo: '',
          role: 'Student',
          doctorId: '',
          doctorName: '',
          date: new Date().toISOString().split('T')[0]
        });
        setMessage('Entry added successfully and saved to database');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error adding entry:', error);
      setMessage(error.response?.data?.error || 'Error adding entry');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // Combine appointments and manual entries
  const allData = [...appointments, ...manualEntries];

  // Fuzzy search logic
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return allData;

    const fuse = new Fuse(allData, {
      keys: ['patientName', 'roll', 'doctorName', 'date', 'status', 'email'],
      threshold: 0.3,
      includeScore: true
    });

    return fuse.search(searchQuery).map(result => result.item);
  }, [allData, searchQuery]);

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'booked':
        return '#FFF7E6';
      case 'attended':
        return '#E8F6EF';
      case 'no show':
        return '#F0F0F4';
      case 'cancelled by user':
      case 'cancelled by doctor':
        return '#FCECEF';
      case 'walk in':
        return '#F4E9F9';
      case 'Added':
        return '#E8F4F8';
      default:
        return '#F5F5F5';
    }
  };

  return (
    <div>
      <ReceptionistNavbar />
      <div className="receptionist-dashboard">
      <h1>Receptionist Dashboard</h1>

      {/* Search Bar */}
      <div className="search-bar-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search by name, roll no, doctor, date, status, email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <span className="search-icon">🔍</span>
        {searchQuery && (
          <button className="search-clear" onClick={() => setSearchQuery('')}>
            ✕
          </button>
        )}
        {searchQuery && (
          <span className="search-results-count">
            {filteredData.length} result{filteredData.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="dashboard-container">
        {/* Left Panel - Form */}
        <div className="form-panel">
          <h2>Add Entry</h2>
          <form onSubmit={handleAddEntry}>
            <div className="form-group">
              <label>Patient Name <span className="required">*</span></label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                placeholder="Enter full name"
                required
              />
            </div>

            <div className="form-group">
              <label>Roll No / Emp Id</label>
              <input
                type="text"
                name="rollNo"
                value={formData.rollNo}
                onChange={handleFormChange}
                placeholder="e.g., 23001 or EMP-001"
              />
            </div>

            <div className="form-group">
              <label>Category</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleFormChange}
              >
                <option value="Student">👨‍🎓 Student</option>
                <option value="Staff">👥 Staff</option>
                <option value="Faculty">👨‍🏫 Faculty</option>
              </select>
            </div>

            <div className="form-group">
              <label>Doctor <span className="required">*</span></label>
              <select
                name="doctorId"
                value={formData.doctorId}
                onChange={handleFormChange}
                required
              >
                <option value="">-- Select Doctor --</option>
                {doctors.map((doctor) => (
                  <option key={doctor._id} value={doctor._id}>
                    {doctor.name} {doctor.specialization ? `(${doctor.specialization})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Appointment Date</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleFormChange}
              />
            </div>

            <button type="submit" className="btn-add">
              + Add Entry
            </button>

            {message && <div className="message">{message}</div>}
          </form>
        </div>

        {/* Right Panel - Table */}
        <div className="table-panel">
          <h2>Appointments</h2>

          {loading ? (
            <div className="loading">Loading appointments...</div>
          ) : filteredData.length === 0 ? (
            <div className="empty-state">
              {searchQuery
                ? `No results found for "${searchQuery}". Try searching differently!`
                : 'No appointments yet. Add a new entry to get started!'}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="appointments-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Date</th>
                    <th>Patient Name</th>
                    <th>Roll No/Emp Id</th>
                    <th>Doctor</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item, index) => (
                    <tr key={item._id} className={editingRowId === item._id ? 'editing' : ''}>
                      <td data-label="S.No">{index + 1}</td>
                      <td data-label="Date">
                        {editingRowId === item._id ? (
                          <input
                            type="date"
                            className="edit-input"
                            value={editedValues.date}
                            onChange={(e) => handleEditFieldChange('date', e.target.value)}
                          />
                        ) : (
                          formatDate(item.date)
                        )}
                      </td>
                      <td data-label="Patient Name">
                        {editingRowId === item._id ? (
                          <input
                            type="text"
                            className="edit-input"
                            value={editedValues.patientName}
                            onChange={(e) => handleEditFieldChange('patientName', e.target.value)}
                          />
                        ) : (
                          item.patientName
                        )}
                      </td>
                      <td data-label="Roll No/Emp Id">
                        {editingRowId === item._id ? (
                          <input
                            type="text"
                            className="edit-input"
                            value={editedValues.roll}
                            onChange={(e) => handleEditFieldChange('roll', e.target.value)}
                          />
                        ) : (
                          item.roll
                        )}
                      </td>
                      <td data-label="Doctor">
                        {editingRowId === item._id ? (
                          <input
                            type="text"
                            className="edit-input"
                            value={editedValues.doctorName}
                            onChange={(e) => handleEditFieldChange('doctorName', e.target.value)}
                          />
                        ) : (
                          item.doctorName
                        )}
                      </td>
                      <td data-label="Status">
                        {editingRowId === item._id ? (
                          <select
                            className="status-dropdown"
                            value={item.status}
                            onChange={(e) => handleStatusChange(item._id, e.target.value)}
                          >
                            <option value="booked">Booked</option>
                            <option value="attended">Attended</option>
                            <option value="no show">No Show</option>
                            <option value="cancelled by user">Cancelled by User</option>
                            <option value="cancelled by doctor">Cancelled by Doctor</option>
                            <option value="walk in">Walk In</option>
                            <option value="Available">Available</option>
                            <option value="Added">Added</option>
                          </select>
                        ) : (
                          <span
                            className="status-badge"
                            style={{ backgroundColor: getStatusColor(item.status) }}
                          >
                            {item.status}
                          </span>
                        )}
                      </td>
                      <td data-label="Actions" className="actions-cell">
                        {editingRowId === item._id ? (
                          <>
                            <button
                              className="btn-save"
                              onClick={() => handleSaveChanges(item._id)}
                            >
                              Save
                            </button>
                            <button
                              className="btn-cancel-row"
                              onClick={() => {
                                setEditingRowId(null);
                                setEditedValues({});
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn-edit"
                            onClick={() => handleEditRow(item)}
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
