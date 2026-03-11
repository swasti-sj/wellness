import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../../styles/doctor/SelectedTestsSummary.css';


function SelectedTestsSummary({ appointmentId, onEditClick }) {
  const [tests, setTests] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    const load = async () => {
      if (!appointmentId) return;
      try {
        const r = await axios.get(`http://localhost:5000/api/tests/${appointmentId}`, { params: { token } });
        if (r.data.tests) setTests(r.data.tests.filter(t => t.selected));
      } catch (e) {
        console.error('Error fetching tests:', e);
      } finally { setLoading(false); }
    };
    load();
  }, [appointmentId, token]);

  if (isLoading) return <div className="sts-loading">⏳ Loading tests…</div>;

  return (
    <div className="sts-root">
      {/* Header row */}
      <div className="sts-header">
        <div className="sts-title-group">
          <span className="sts-icon">🧪</span>
          <span className="sts-title">Ordered Investigations</span>
          {tests.length > 0 && (
            <span className="sts-count">{tests.length} test{tests.length > 1 ? 's' : ''}</span>
          )}
        </div>
        <button className="sts-edit-btn" onClick={onEditClick}>
          {tests.length > 0 ? '✏️ Edit Tests' : '+ Order Tests'}
        </button>
      </div>

      {tests.length === 0 ? (
        <div className="sts-empty">
          <span className="sts-empty-icon">🔬</span>
          <p>No lab tests ordered yet.</p>
          <button className="sts-empty-btn" onClick={onEditClick}>+ Order Tests</button>
        </div>
      ) : (
        <div className="sts-tags-wrap">
          {tests.map((t, i) => (
            <span key={i} className="sts-tag">
              <span className="sts-tag-dot" />
              {t.testName}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default SelectedTestsSummary;