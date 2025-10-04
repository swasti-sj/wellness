import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../../styles/doctor/DoctorPrescription.css';

function DoctorPrescription({ appointmentId, patientId }) {
  const [currentPrescriptions, setCurrentPrescriptions] = useState([]);
  const [previousPrescriptions, setPreviousPrescriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchPrescriptionData = async () => {
      if (!appointmentId || !patientId) return;

      setIsLoading(true);
      setError('');
      try {
        // Fetch existing prescription for this appointment
        const currentRes = await axios.get(`http://localhost:5000/api/prescriptions/${appointmentId}`, {
          params: { token }
        });
        setCurrentPrescriptions(currentRes.data.prescriptions || []);

        // Fetch the latest prescription for this patient to show previous meds
        const previousRes = await axios.get(`http://localhost:5000/api/prescriptions/latest/${patientId}`, {
          params: { token }
        });
        setPreviousPrescriptions(previousRes.data.prescriptions || []);
        
      } catch (err) {
        console.error('Error fetching prescription data:', err);
        setError('Could not fetch prescription data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrescriptionData();
  }, [appointmentId, patientId, token]);

  const handleInputChange = (index, event) => {
    const values = [...currentPrescriptions];
    values[index][event.target.name] = event.target.value;
    setCurrentPrescriptions(values);
  };

  const handleAddRow = () => {
    setCurrentPrescriptions([
      ...currentPrescriptions,
      { medication: '', dosage: '', frequency: '', notes: '', status: 'new' }
    ]);
  };

  const handleRemoveRow = (index) => {
    const values = [...currentPrescriptions];
    values.splice(index, 1);
    setCurrentPrescriptions(values);
  };
  
  const handleContinuePrevious = (prevRx, isChecked) => {
    if (isChecked) {
      // Add the medication if it's not already in the list
      if (!currentPrescriptions.some(p => p.medication === prevRx.medication)) {
        setCurrentPrescriptions([...currentPrescriptions, { ...prevRx, status: 'continued' }]);
      }
    } else {
      // Remove the medication if it was unchecked
      setCurrentPrescriptions(currentPrescriptions.filter(p => p.medication !== prevRx.medication));
    }
  };

  const handleSavePrescription = async () => {
    setError('');
    try {
      const response = await axios.post('http://localhost:5000/api/prescriptions/save', {
        token,
        appointmentId,
        prescriptions: currentPrescriptions,
      });
      if (response.data.success) {
        alert('Prescription saved successfully!');
        setCurrentPrescriptions(response.data.prescription.prescriptions);
      }
    } catch (err) {
      console.error('Error saving prescription:', err);
      setError('Failed to save prescription. ' + (err.response?.data?.error || ''));
    }
  };

  if (isLoading) return <p>Loading prescriptions...</p>;

  return (
    <div className="doctor-prescription">
  <h3>Manage Prescription</h3>

  {previousPrescriptions.length > 0 && (
    <div className="previous-prescriptions">
      <h4>Continue Previous Medications?</h4>
      {previousPrescriptions.map((rx, idx) => (
        <label key={idx} className="checkbox-item">
          <input type="checkbox" onChange={(e)=>handleContinuePrevious(rx, e.target.checked)} />
          {rx.medication} ({rx.dosage}, {rx.frequency})
        </label>
      ))}
    </div>
  )}

  <div className="prescription-form">
    {currentPrescriptions.map((rx, idx) => (
      <div key={idx} className="prescription-row">
        <input name="medication" placeholder="Medication" value={rx.medication} />
        <input name="dosage" placeholder="Dosage" value={rx.dosage} />
        <input name="frequency" placeholder="Frequency" value={rx.frequency} />
        <input name="notes" placeholder="Notes" value={rx.notes} />
        <button className="remove-btn" onClick={() => handleRemoveRow(idx)}>✖</button>
      </div>
    ))}
    <button className="add-btn" onClick={handleAddRow}>+ Add</button>
  </div>

  <button className="save-btn" onClick={handleSavePrescription}>Save Prescription</button>
</div>

  );
}

export default DoctorPrescription;
