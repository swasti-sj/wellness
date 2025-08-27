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
      <h4>Manage Prescription</h4>
      {error && <p className="error-message">{error}</p>}

      {/* Section to continue previous medications */}
      {previousPrescriptions.length > 0 && (
        <div className="previous-prescriptions">
          <h5>Continue Previous Medications?</h5>
          {previousPrescriptions.map((prevRx, index) => (
            <div key={index} className="checkbox-item">
              <input
                type="checkbox"
                id={`prevRx-${index}`}
                checked={currentPrescriptions.some(p => p.medication === prevRx.medication)}
                onChange={(e) => handleContinuePrevious(prevRx, e.target.checked)}
              />
              <label htmlFor={`prevRx-${index}`}>
                {prevRx.medication} ({prevRx.dosage}, {prevRx.frequency})
              </label>
            </div>
          ))}
        </div>
      )}

      {/* Form for current prescriptions */}
      <div className="prescription-form">
        {currentPrescriptions.map((rx, index) => (
          <div key={index} className="prescription-row">
            <input name="medication" placeholder="Medication" value={rx.medication} onChange={e => handleInputChange(index, e)} />
            <input name="dosage" placeholder="Dosage (e.g., 500mg)" value={rx.dosage} onChange={e => handleInputChange(index, e)} />
            <input name="frequency" placeholder="Frequency (e.g., Twice a day)" value={rx.frequency} onChange={e => handleInputChange(index, e)} />
            <input name="notes" placeholder="Notes (e.g., After food)" value={rx.notes} onChange={e => handleInputChange(index, e)} />
            <button className="remove-btn" onClick={() => handleRemoveRow(index)}>X</button>
          </div>
        ))}
        <button className="add-btn" onClick={handleAddRow}>+ Add Medication</button>
      </div>

      <button className="save-btn" onClick={handleSavePrescription}>Save Prescription</button>
    </div>
  );
}

export default DoctorPrescription;
