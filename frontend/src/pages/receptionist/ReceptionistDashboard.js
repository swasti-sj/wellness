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
    time: '',
    entryType: 'appointment', // 'appointment' | 'walkin'
    remarks: 'None'
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success'); // 'success' | 'error'
  const [editingRowId, setEditingRowId] = useState(null);
  const [editedValues, setEditedValues] = useState({});
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'name'
  const [filterDoctor, setFilterDoctor] = useState(''); // Filter by doctor
  const [showAddEntryMobile, setShowAddEntryMobile] = useState(true);
  const [expandedAppointmentId, setExpandedAppointmentId] = useState(null);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 760);

  // Date range filter (default: today → today + 7 days)
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const plus7 = new Date(today);
  plus7.setDate(plus7.getDate() + 7);
  const plus7Str = plus7.toISOString().split('T')[0];

  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(plus7Str);
  const [showCalendarRange, setShowCalendarRange] = useState(false);


  const token = localStorage.getItem('token');
  const apiBaseUrl = useApi();

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth <= 760);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      const formatted = (response.data.appointments || []).map(appt => {
        const patient = appt.user || appt.fullData?.user;
        const dependant = appt.dependant || appt.fullData?.dependant || null;
        const patientName = patient?.name || patient?.email || patient?.roll || 'Unknown';
        const dependantLabel = dependant?.name
          ? `${dependant.name} (${dependant.relationship || 'Dependant'})`
          : null;
        return {
          _id: appt._id,
          patientName: dependantLabel ? `${dependantLabel} — ${patientName}` : patientName,
          roll: appt.user?.roll || '-',
          doctorName: appt.doctor?.name || 'Unknown',
          doctorId: appt.doctor?._id || '',
          email: appt.user?.email || '-',
          phone: appt.user?.phone || '-',
          date: appt.startDateTime,
          time: appt.slotTime || '-',
          status: appt.status || 'booked',
          source: 'system',
          remarks: 'None',
          isWalkIn: false
        };
      });
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
        source: 'manual',
        remarks: entry.remarks || 'None',
        isWalkIn: entry.isWalkIn || false
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
      date: toLocalDateInput(item.date),
      time: item.time || '',
      remarks: item.remarks || 'None'
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
          appointmentTime: editedValues.time || null,
          remarks: editedValues.remarks || 'None'
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
      const isWalkIn = formData.entryType === 'walkin';
      // Send the raw date string (YYYY-MM-DD) so the backend builds a local Date
      // without a UTC/timezone shift.
      const appointmentDateRaw = formData.date || null;
      // If receptionist didn't enter time, set it to current time.
      const timeToSend = formData.time || new Date().toTimeString().slice(0, 5);

      const response = await axios.post(`${apiBaseUrl}/api/receptionist/entries`, {
        patientName: formData.name,
        roll: formData.rollNo,
        role: formData.role,
        doctorId: formData.doctorId,
        doctorName: formData.doctorName,
        appointmentDate: appointmentDateRaw,
        appointmentTime: timeToSend || null,
        email: '-',
        phone: '-',
        isWalkIn,
        remarks: formData.remarks || 'None'
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
          source: 'manual',
          remarks: response.data.entry.remarks || 'None',
          isWalkIn: response.data.entry.isWalkIn || isWalkIn
        };
        setManualEntries(prev => [newEntry, ...prev]);
        setFormData({
          name: '', rollNo: '', role: 'Student', doctorId: '', doctorName: '',
          date: new Date().toISOString().split('T')[0],
          time: '',
          entryType: 'appointment',
          remarks: 'None'
        });
        showMessage(isWalkIn ? 'Walk-in entry added successfully (record only)' : 'Entry added successfully');
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
        keys: ['patientName', 'roll', 'doctorName', 'date', 'time', 'status', 'email', 'remarks'],
        threshold: 0.3,
        includeScore: true
      });
      result = fuse.search(searchQuery).map(r => r.item);
    }

    // Apply date range filter (default today)
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const to = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;
    if (from && to) {
      result = result.filter(item => {
        const t = item.date ? new Date(item.date).getTime() : null;
        if (!t) return false;
        return t >= from && t <= to;
      });
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
  }, [allData, searchQuery, sortBy, filterDoctor, fromDate, toDate]);


const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Convert a stored date into a local YYYY-MM-DD string WITHOUT UTC shift,
  // so editing shows the exact date the receptionist selected.
  const toLocalDateInput = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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

        {/* Search Bar + Calendar Range Filter (single icon) */}
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
          {/* Calendar Range Picker (icon → expands) */}
          <div className="rd-calendar-range-wrap">
            <button
              type="button"
              className="rd-calendar-range-btn"
              onClick={() => setShowCalendarRange(v => !v)}
              title="Filter by appointment date range"
              aria-expanded={showCalendarRange}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <span>Range</span>
            </button>

            {showCalendarRange && (
              <div className="rd-calendar-range-panel">
                <div className="rd-calendar-range-row">
                  <div className="rd-calendar-range-field">
                    <label>From</label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </div>
                  <div className="rd-calendar-range-field">
                    <label>To</label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="rd-calendar-range-actions">
                  <button
                    type="button"
                    className="rd-calendar-range-apply"
                    onClick={() => setShowCalendarRange(false)}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    className="rd-calendar-range-reset"
                    onClick={() => {
                      setFromDate(todayStr);
                      setToDate(plus7Str);
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>
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
            {isMobileView && (
              <button
                type="button"
                className="rd-section-toggle"
                onClick={() => setShowAddEntryMobile((prev) => !prev)}
                aria-expanded={showAddEntryMobile}
              >
                {showAddEntryMobile ? 'Hide form' : 'Show form'}
              </button>
            )}
          </div>
          {(!isMobileView || showAddEntryMobile) && (
            <>
              <form onSubmit={handleAddEntry} className="rd-form-grid rd-form-grid-ext">
                <div className="rd-form-group">
                  <label>Entry Type <span className="rd-required">*</span></label>
                  <select name="entryType" value={formData.entryType} onChange={handleFormChange} required>
                    <option value="appointment">Appointment</option>
                    <option value="walkin">Walk-in</option>
                  </select>
                </div>
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
                  <label>Remarks</label>
                  <select name="remarks" value={formData.remarks} onChange={handleFormChange}>
                    <option value="None">None</option>
                    <option value="Outsourced Staff">Outsourced Staff</option>
                    <option value="Dependant">Dependant</option>
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
                {formData.entryType === 'appointment' && (
                  <>
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
                  </>
                )}
                <div className="rd-form-group rd-form-submit-col">
                  <label>&nbsp;</label>
                  <button type="submit" className="rd-btn-add">
                    {formData.entryType === 'walkin' ? 'Add Walk-in Entry' : 'Add Entry'}
                  </button>
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
            </>
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
          ) : isMobileView ? (
            <div className="rd-mobile-appointments">
              {filteredData.map((item, index) => {
                const statusMeta = getStatusMeta(item.status);
                const isEditing = editingRowId === item._id;
                const isExpanded = expandedAppointmentId === item._id;
                return (
                  <article key={item._id} className={`rd-mobile-card${isExpanded ? ' open' : ''}`}>
                    <div className="rd-mobile-card-header">
                      <div>
                        <div className="rd-mobile-card-title">{item.patientName}</div>
                        <div className="rd-mobile-card-meta">{formatDate(item.date)} · {item.time || '-'}</div>
                      </div>
                      <button
                        type="button"
                        className="rd-mobile-toggle-btn"
                        onClick={() => setExpandedAppointmentId((prev) => prev === item._id ? null : item._id)}
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? 'Hide' : 'Details'}
                      </button>
                    </div>
                    <div className="rd-mobile-card-badge" style={{ background: statusMeta.bg, color: statusMeta.color }}>
                      {statusMeta.label}
                    </div>
                    {isExpanded && (
                      <div className="rd-mobile-card-body">
                        <div className="rd-mobile-card-row"><span>Roll No / Emp ID</span><strong>{item.roll}</strong></div>
                        <div className="rd-mobile-card-row"><span>Doctor</span><strong>{item.doctorName}</strong></div>
                        <div className="rd-mobile-card-row"><span>Email</span><strong>{item.email}</strong></div>
                        <div className="rd-mobile-card-row"><span>Source</span><strong>{item.source}</strong></div>
                        <div className="rd-mobile-card-row"><span>Remarks</span><strong>{item.remarks || 'None'}</strong></div>
                        {isEditing ? (
                          <>
                            <div className="rd-mobile-card-row">
                              <span>Patient Name</span>
                              <input
                                type="text"
                                className="rd-edit-input"
                                value={editedValues.patientName}
                                onChange={(e) => handleEditFieldChange('patientName', e.target.value)}
                              />
                            </div>
                            <div className="rd-mobile-card-row">
                              <span>Roll No / Emp ID</span>
                              <input
                                type="text"
                                className="rd-edit-input"
                                value={editedValues.roll}
                                onChange={(e) => handleEditFieldChange('roll', e.target.value)}
                              />
                            </div>
                            <div className="rd-mobile-card-row">
                              <span>Doctor</span>
                              <input
                                type="text"
                                className="rd-edit-input"
                                value={editedValues.doctorName}
                                onChange={(e) => handleEditFieldChange('doctorName', e.target.value)}
                              />
                            </div>
                            <div className="rd-mobile-card-row">
                              <span>Remarks</span>
                              <select
                                className="rd-status-select"
                                value={editedValues.remarks || 'None'}
                                onChange={(e) => handleEditFieldChange('remarks', e.target.value)}
                              >
                                <option value="None">None</option>
                                <option value="Outsourced Staff">Outsourced Staff</option>
                                <option value="Dependant">Dependant</option>
                              </select>
                            </div>
                            <div className="rd-mobile-card-row">
                              <span>Date</span>
                              <input
                                type="date"
                                className="rd-edit-input"
                                value={editedValues.date}
                                onChange={(e) => handleEditFieldChange('date', e.target.value)}
                              />
                            </div>
                            <div className="rd-mobile-card-row">
                              <span>Time</span>
                              <input
                                type="time"
                                className="rd-edit-input"
                                value={editedValues.time || ''}
                                onChange={(e) => handleEditFieldChange('time', e.target.value)}
                              />
                            </div>
                            <div className="rd-mobile-card-actions">
                              <button className="rd-btn-save" onClick={() => handleSaveChanges(item._id)}>Save</button>
                              <button className="rd-btn-cancel" onClick={() => { setEditingRowId(null); setEditedValues({}); }}>Cancel</button>
                            </div>
                          </>
                        ) : (
                          <div className="rd-mobile-card-actions">
                            <button className="rd-btn-edit" onClick={() => { handleEditRow(item); setExpandedAppointmentId(item._id); }}>
                              Edit
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
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
                    <th>Remarks</th>
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
                        <td data-label="Remarks">
                          {isEditing ? (
                            <select
                              className="rd-status-select"
                              value={editedValues.remarks || 'None'}
                              onChange={(e) => handleEditFieldChange('remarks', e.target.value)}
                            >
                              <option value="None">None</option>
                              <option value="Outsourced Staff">Outsourced Staff</option>
                              <option value="Dependant">Dependant</option>
                            </select>
                          ) : (item.remarks || 'None')}
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
    </div >
  );
}
