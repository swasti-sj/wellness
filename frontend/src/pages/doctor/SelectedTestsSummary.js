import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../../styles/doctor/SelectedTestsSummary.css';
import DocumentUpload from './documentUpload';
import { useApi } from '../../context/ApiContext';
function SelectedTestsSummary({ appointmentId, onEditClick }) {
  const [tests, setTests] = useState([]);
  const [labTestDocumentUrl, setLabTestDocumentUrl] = useState('');
  const [labTestDocument, setLabTestDocument] = useState(null);
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const token = localStorage.getItem('token');
  const apiBaseUrl = useApi();
  useEffect(() => {
    const load = async () => {
      if (!appointmentId) return;
      try {
        const r = await axios.get(`${apiBaseUrl}/api/tests/${appointmentId}`, { params: { token } });
        setTests((r.data.tests || []).filter((t) => t.selected));
        setLabTestDocumentUrl(r.data.labTestDocumentUrl || '');
      } catch (e) {
        console.error('Error fetching tests:', e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [appointmentId, token]);

  const handleSaveDocument = async () => {
    setError('');
    setIsSaving(true);
    try {
      const existing = await axios.get(`${apiBaseUrl}/api/tests/${appointmentId}`, { params: { token } });
      const formData = new FormData();
      formData.append('token', token);
      formData.append('appointmentId', appointmentId);
      formData.append('tests', JSON.stringify(existing.data.tests || []));
      formData.append('hospitalReferral', JSON.stringify(existing.data.hospitalReferral || { refer: false }));
      formData.append('certificate', JSON.stringify(existing.data.certificate || { issued: false }));

      if (labTestDocument) {
        formData.append('labTestDocument', labTestDocument);
      } else if (labTestDocumentUrl) {
        formData.append('existingLabTestDocumentUrl', labTestDocumentUrl);
      }

      const response = await axios.post(`${apiBaseUrl}/api/tests/save`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        setLabTestDocument(null);
        setLabTestDocumentUrl(response.data.test?.labTestDocumentUrl || '');
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      setError('Failed to save lab test document.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="sts-loading">Loading tests...</div>;

  return (
    <div className="sts-root">
      <div className="sts-header">
        <div className="sts-title-group">
          <span className="sts-title">Ordered Investigations</span>
          {tests.length > 0 && <span className="sts-count">{tests.length} test{tests.length > 1 ? 's' : ''}</span>}
        </div>
        <button className="sts-edit-btn" onClick={onEditClick}>
          {tests.length > 0 ? 'Edit Tests' : 'Order Tests'}
        </button>
      </div>

      {tests.length === 0 ? (
        <div className="sts-empty">
          <p>No lab tests ordered yet.</p>
          <button className="sts-empty-btn" onClick={onEditClick}>Order Tests</button>
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

      <div style={{ marginTop: '1rem' }}>
        <DocumentUpload
          label="Upload Lab Test Document"
          previewUrl={labTestDocumentUrl}
          selectedFile={labTestDocument}
          onFileChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setLabTestDocument(file);
            setLabTestDocumentUrl(URL.createObjectURL(file));
            setSaved(false);
          }}
          onRemove={() => {
            setLabTestDocument(null);
            setLabTestDocumentUrl('');
            setSaved(false);
          }}
          uploading={isSaving}
          isEditing
        />
      </div>

      {error && <div className="rx-error" style={{ marginTop: '0.75rem' }}>{error}</div>}

      <div className="rx-footer" style={{ marginTop: '1rem' }}>
        <div className="rx-save-group">
          {saved && <span className="rx-saved">Saved</span>}
          <button className="rx-save-btn" onClick={handleSaveDocument} disabled={isSaving || !labTestDocumentUrl}>
            {isSaving ? 'Saving...' : 'Save Lab Test Document'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SelectedTestsSummary;
