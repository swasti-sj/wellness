import React, { useState, useEffect } from 'react';
import axios from 'axios';

function SelectedTestsSummary({ appointmentId, onEditClick }) {
  const [tests, setTests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchTests = async () => {
      if (!appointmentId) return;
      
      try {
        const res = await axios.get(`http://localhost:5000/api/tests/${appointmentId}`, {
          params: { token }
        });
        
        if (res.data.tests) {
          setTests(res.data.tests.filter(t => t.selected));
        }
      } catch (err) {
        console.error('Error fetching tests:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTests();
  }, [appointmentId, token]);

  if (isLoading) return null;

  return (
    <div className="selected-tests-summary">
      <div className="summary-header">
        <h4>Tests ({tests.length})</h4>
        <button className="edit-btn" onClick={onEditClick}>
          {tests.length > 0 ? 'Edit Tests' : 'Add Tests'}
        </button>
      </div>
      
      {tests.length > 0 && (
        <div className="tests-list">
          {tests.map((test, index) => (
            <span key={index} className="test-tag">{test.testName}</span>
          ))}
        </div>
      )}
      
      {tests.length === 0 && (
        <p className="no-data">No tests selected</p>
      )}
    </div>
  );
}

export default SelectedTestsSummary;
