import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../../styles/pharmacist/PharmacistDashboard.css';

export default function PharmacistMedicineStock() {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', stockCount: '', expiryDate: '', batchNumber: '', manufacturer: '' });
  const [editingMed, setEditingMed] = useState(null);
  const [updateForm, setUpdateForm] = useState({ stockCount: '' });
  const token = localStorage.getItem('token');

  const apiBaseUrl = 'http://localhost:5000/api';

  useEffect(() => {
    loadMedicines();
  }, []);

  const loadMedicines = async () => {
    setLoading(true);
    setError('');
    try {
      const medRes = await axios.get(`${apiBaseUrl}/medicines`, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setMedicines(medRes.data.medicines || []);
    } catch (e) {
      setError('Failed to load medicines. Check backend server and your login.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddChange = (e) => {
    const { name, value } = e.target;
    setAddForm({ ...addForm, [name]: value });
  };

  const handleAdd = async () => {
    try {
      await axios.post(`${apiBaseUrl}/medicines`, addForm, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowAddForm(false);
      setAddForm({ name: '', stockCount: '', expiryDate: '', batchNumber: '', manufacturer: '' });
      loadMedicines();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to add medicine');
    }
  };

  const handleUpdateStock = async (id) => {
    try {
      await axios.put(`${apiBaseUrl}/medicines/${id}`, updateForm, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      setEditingMed(null);
      setUpdateForm({ stockCount: '' });
      loadMedicines();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to update stock');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this medicine?')) return;
    try {
      await axios.delete(`${apiBaseUrl}/medicines/${id}`, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      loadMedicines();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to delete');
    }
  };

  if (loading) return <div className="pharm-loading">⏳ Loading medicines...</div>;
  if (error) return <div className="pharm-error">⚠ {error} <button onClick={loadMedicines}>Retry</button></div>;

  const isExpiringSoon = (days) => days <= 28;

return (
    <div className="pharm-layout">
      <div className="pharm-root">
      <div className="pharm-header">
        <h1 className="pharm-title"> Medicine Stock</h1>
        <button className="pharm-btn pharm-btn-primary" onClick={loadMedicines}>
          🔄 Refresh
        </button>
      </div>

      {/* Medicine Stock Section */}
      <div className="pharm-stock-section pharm-section">
        <div className="pharm-section-header">
          <span>📦 Medicine Inventory</span>
          <span>({medicines.length})</span>
          <button className="pharm-btn pharm-btn-primary" onClick={() => setShowAddForm(true)}>
            + Add New
          </button>
        </div>
        
        {showAddForm && (
          <div className="pharm-form-group">
            <input name="name" value={addForm.name} onChange={handleAddChange} placeholder="Medicine name" required />
            <input name="stockCount" type="number" value={addForm.stockCount} onChange={handleAddChange} placeholder="Initial stock" required />
            <input name="expiryDate" type="date" value={addForm.expiryDate} onChange={handleAddChange} required />
            <input name="batchNumber" value={addForm.batchNumber} onChange={handleAddChange} placeholder="Batch #" />
            <input name="manufacturer" value={addForm.manufacturer} onChange={handleAddChange} placeholder="Manufacturer" />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="pharm-btn pharm-btn-success" onClick={handleAdd}>Add Medicine</button>
              <button className="pharm-btn pharm-btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="pharm-table-container">
          <table className="pharm-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Stock</th>
              <th>Expiry</th>
              <th>Batch</th>
              <th>Manufacturer</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {medicines.map((med) => (
              <tr key={med._id} className={med.stockCount === 0 ? 'pharm-low-stock' : ''}>
                <td>{med.name}</td>
                <td><strong>{med.stockCount}</strong></td>
                <td className={isExpiringSoon(med.daysToExpiry) ? 'pharm-expiry-soon' : ''}>
                  {med.daysToExpiry} days
                </td>
                <td>{med.batchNumber || '-'}</td>
                <td>{med.manufacturer || '-'}</td>
                <td>
                  <button 
                    className="pharm-btn pharm-btn-primary" 
                    onClick={() => {
                      setEditingMed(med._id);
                      setUpdateForm({ stockCount: med.stockCount });
                    }}
                  >
                    Edit
                  </button>
                  <button className="pharm-btn pharm-btn-danger" onClick={() => handleDelete(med._id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>

      {editingMed && (
        <div className="pharm-section">
          <div className="pharm-section-header">
            <span>📝 Edit Stock</span>
          </div>
          <div className="pharm-form-group">
            <input 
              type="number" 
              value={updateForm.stockCount} 
              onChange={(e) => setUpdateForm({ stockCount: parseInt(e.target.value) || 0 })}
              placeholder="New stock count"
            />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="pharm-btn pharm-btn-success" onClick={() => handleUpdateStock(editingMed)}>Update</button>
              <button className="pharm-btn pharm-btn-secondary" onClick={() => setEditingMed(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);
}
