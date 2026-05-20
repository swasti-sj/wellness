import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import '../../styles/doctor/DoctorTests.css';

const TEST_CATEGORIES = [
  {
    name: 'Routine Investigations in Blood',
    tests: [
      { name: 'ADA (Adenosine Deaminase)', selected: false },
      { name: 'Alkaline Phosphatase', selected: false },
      { name: 'Albumin', selected: false },
      { name: 'Ammonia', selected: false },
      { name: 'Amylase', selected: false },
      { name: 'AG Ratio', selected: false },
      { name: 'Bicarbonate', selected: false },
      { name: 'Bilirubin Total', selected: false },
      { name: 'Bilirubin Direct', selected: false },
      { name: 'Blood Gas Analysis Arterial (ABG)', selected: false },
      { name: 'Blood Gas Analysis Venous (VBG)', selected: false },
      { name: 'Calcium Total', selected: false },
      { name: 'Calcium (Ionised)', selected: false },
      { name: 'Chloride', selected: false },
      { name: 'Cholesterol Total', selected: false },
      { name: 'Cholesterol (HDL)', selected: false },
      { name: 'Cholesterol (LDL)', selected: false },
      { name: 'Creatinine', selected: false },
      { name: 'CK (CPK)', selected: false },
      { name: 'CK-MB', selected: false },
      { name: 'GFR', selected: false },
      { name: 'Electrolytes (Na, K, CO2)', selected: false },
      { name: 'GGT (Gamma Glutamyl Transferase)', selected: false },
      { name: 'Globulin', selected: false },
      { name: 'Glucose Fasting', selected: false },
      { name: 'Glucose PP (Post Prandial)', selected: false },
      { name: 'Glucose Random', selected: false },
      { name: 'GTT (Glucose Tolerance Test)', selected: false },
      { name: 'Glycosylated Hb (HbA1C)', selected: false },
      { name: 'High sensitive CRP (hsCRP)', selected: false },
      { name: 'Homocysteine', selected: false },
      { name: 'Iron', selected: false },
      { name: 'Lactate (Lactic Acid)', selected: false },
      { name: 'LDH (Lactate Dehydrogenase)', selected: false },
      { name: 'Lipase', selected: false },
      { name: 'Magnesium', selected: false },
      { name: 'Osmolality (Serum)', selected: false },
      { name: 'Phosphorus', selected: false },
      { name: 'Total Protein', selected: false },
      { name: 'Pseudocholinesterase', selected: false },
      { name: 'SGOT (AST)', selected: false },
      { name: 'SGPT (ALT)', selected: false },
      { name: 'Sodium', selected: false },
      { name: 'TIBC', selected: false },
      { name: 'Urea', selected: false },
      { name: 'Uric Acid', selected: false }
    ]
  },
  {
    name: 'Immunoassay',
    tests: [
      { name: 'AFP (Alfa Feto Protein)', selected: false },
      { name: 'AMH (Anti Mullerian Hormone)', selected: false },
      { name: 'ANCA CCP', selected: false },
      { name: 'Anti TPO antibodies', selected: false },
      { name: 'Beta HCG (Total)', selected: false },
      { name: 'CA-125', selected: false },
      { name: 'CA 19-9', selected: false },
      { name: 'CEA', selected: false },
      { name: 'Cortisol', selected: false },
      { name: 'Estradiol (E2)/Estrogen', selected: false },
      { name: 'Ferritin', selected: false },
      { name: 'Folate (Folic acid)', selected: false },
      { name: 'Free T3', selected: false },
      { name: 'Free T4', selected: false },
      { name: 'FSH', selected: false },
      { name: 'PTH (intact)', selected: false },
      { name: 'LH', selected: false },
      { name: 'Procalcitonin', selected: false },
      { name: 'Progesterone (P4)', selected: false },
      { name: 'Prolactin', selected: false },
      { name: 'PSA Total', selected: false },
      { name: 'Testosterone', selected: false },
      { name: 'Troponin-t hs (high sensitive Trop T)', selected: false },
      { name: 'TSH', selected: false },
      { name: 'Vitamin D (Total 250H Vitamin D3)', selected: false },
      { name: 'Vitamin B12', selected: false }
    ]
  },
  {
    name: 'Routine Investigations in Urine and Other Body Fluids',
    tests: [
      { name: 'Random/Spot Urine', selected: false },
      { name: '24hrs Urine', selected: false },
      { name: 'Urine Fhedss', selected: false },
      { name: 'Fluid Protein', selected: false },
      { name: 'Urine Microalbumin', selected: false },
      { name: 'Urine Sodium', selected: false },
      { name: 'CSF Sugar', selected: false },
      { name: 'CSF Protein', selected: false },
      { name: 'Fluid Albumin', selected: false },
      { name: 'Urine Potassium', selected: false },
      { name: 'Urine Uric acid', selected: false },
      { name: 'Fluid Amylase', selected: false },
      { name: 'Urine Osmolality', selected: false },
      { name: 'Urine Albumin', selected: false },
      { name: 'Urine Calcium', selected: false },
      { name: 'Urine Protein', selected: false },
      { name: 'CSF Chloride', selected: false },
      { name: 'Fluid Lipase', selected: false },
      { name: 'Urine Phosphorus', selected: false },
      { name: 'CSF ADA', selected: false },
      { name: 'CSF Lactate', selected: false },
      { name: 'Creatinine Ratio (ACR)', selected: false },
      { name: 'Urine Creatinine', selected: false },
      { name: 'Fluid Creatinine', selected: false },
      { name: 'Urine Chloride', selected: false },
      { name: 'Urine Liraa', selected: false }
    ]
  },
  {
    name: 'Special Tests',
    tests: [
      { name: 'Hemoglobin Variant screening by HPLC method', selected: false },
      { name: 'Osmotic Fragility test', selected: false },
      { name: 'Protein Electrophoresis', selected: false },
      { name: 'Urinary Bence Jones Protein', selected: false },
      { name: 'Urine Screening for EM', selected: false },
      { name: 'Stone Analysis', selected: false },
      { name: 'Urine Protein', selected: false },
      { name: 'Urine Urea', selected: false },
      { name: 'CSF Albumin', selected: false },
      { name: 'Fluid Ursa', selected: false },
      { name: 'Protein Creatinine Ratio (PCR)', selected: false },
      { name: 'Urine Uric acid', selected: false },
      { name: 'CSF LDH', selected: false },
      { name: 'Fluid Triglycerides', selected: false },
      { name: 'Fluid CA19-9', selected: false },
      { name: 'Fluid AFP', selected: false }
    ]
  },
  {
    name: 'Profiles',
    tests: [
      { name: 'Diabetic Profile', selected: false },
      { name: 'Lipid Profile', selected: false },
      { name: 'Renal Profile', selected: false },
      { name: 'Liver Profile', selected: false },
      { name: 'Acute Cardiac Profile', selected: false },
      { name: 'Hypertension Profile', selected: false },
      { name: 'CVD Risk assessment profile', selected: false },
      { name: 'PIH Profile', selected: false },
      { name: 'Pre-chemo workup', selected: false },
      { name: 'Iron Profile', selected: false },
      { name: 'Prostatic Profile', selected: false },
      { name: 'Thyroid Profile', selected: false },
      { name: 'Fertility Profile', selected: false }
    ]
  }
];

function TestPage({ apiBaseUrl }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const appointmentId = searchParams.get('appointmentId');
  const patientId = searchParams.get('patientId');
  // Prefer state-based returnUrl (set by DoctorAppointment), fall back to query param
  const navState = location.state || {};
  const returnUrl = navState.returnUrl || searchParams.get('returnUrl');
  const openAppointmentId = navState.openAppointmentId || appointmentId;
  const openSection = navState.openSection || 'tests';

  const [categories, setCategories] = useState(TEST_CATEGORIES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [labTestDocument, setLabTestDocument] = useState(null);
  const [labTestDocumentUrl, setLabTestDocumentUrl] = useState('');

  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchTestData = async () => {
      if (!appointmentId) return;

      setIsLoading(true);
      setError('');
      try {
        const res = await axios.get(`${apiBaseUrl}/api/tests/${appointmentId}`, {
          params: { token }
        });

        if (res.data.tests && res.data.tests.length > 0) {
          const savedTests = res.data.tests;

          // Update categories with saved selections
          const updatedCategories = TEST_CATEGORIES.map(cat => ({
            ...cat,
            tests: cat.tests.map(test => ({
              name: test.name,
              selected: savedTests.some(s => s.testName === test.name && s.selected)
            }))
          }));
          setCategories(updatedCategories);
        }
        setLabTestDocumentUrl(res.data.labTestDocumentUrl || '');
      } catch (err) {
        console.error('Error fetching test data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTestData();
  }, [appointmentId, token]);

  const handleTestToggle = (categoryIndex, testIndex) => {
    const updated = [...categories];
    updated[categoryIndex].tests[testIndex].selected = !updated[categoryIndex].tests[testIndex].selected;
    setCategories(updated);
    setSaved(false);
  };

  const handleSelectAllInCategory = (categoryIndex, selected) => {
    const updated = [...categories];
    updated[categoryIndex].tests = updated[categoryIndex].tests.map(t => ({
      ...t,
      selected: selected
    }));
    setCategories(updated);
    setSaved(false);
  };

  const getSelectedTestsCount = () => {
    return categories.reduce((count, cat) =>
      count + cat.tests.filter(t => t.selected).length, 0
    );
  };

  // Fetch existing hospital referral and certificate data to preserve when saving
  const fetchExistingData = async () => {
    try {
      const res = await axios.get(`${apiBaseUrl}/api/tests/${appointmentId}`, {
        params: { token }
      });
      return {
        hospitalReferral: res.data.hospitalReferral || { refer: false },
        certificate: res.data.certificate || { issued: false }
      };
    } catch (err) {
      console.error('Error fetching existing data:', err);
      return { hospitalReferral: { refer: false }, certificate: { issued: false } };
    }
  };

  const handleSaveAll = async () => {
    setError('');
    try {
      // First fetch existing data to preserve hospital referral and certificate
      const existingData = await fetchExistingData();

      // Flatten all selected tests
      const selectedTests = [];
      categories.forEach(cat => {
        cat.tests.forEach(test => {
          if (test.selected) {
            selectedTests.push({
              testName: test.name,
              category: cat.name,
              selected: true
            });
          }
        });
      });

      const formData = new FormData();
      formData.append('token', token);
      formData.append('appointmentId', appointmentId);
      formData.append('patientId', patientId);
      formData.append('tests', JSON.stringify(selectedTests));
      formData.append('hospitalReferral', JSON.stringify(existingData.hospitalReferral));
      formData.append('certificate', JSON.stringify(existingData.certificate));
      if (labTestDocument) {
        formData.append('labTestDocument', labTestDocument);
      } else if (labTestDocumentUrl) {
        formData.append('existingLabTestDocumentUrl', labTestDocumentUrl);
      }

      const response = await axios.post(`${apiBaseUrl}/api/tests/save`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        setSaved(true);
        setLabTestDocument(null);
        setLabTestDocumentUrl(response.data.test?.labTestDocumentUrl || labTestDocumentUrl);
        // Navigate back and signal DoctorAppointment to open the Lab Tests section
        if (returnUrl) {
          navigate(returnUrl, {
            state: {
              openAppointmentId,
              openSection,
            }
          });
        }
      }
    } catch (err) {
      console.error('Error saving tests:', err);
      setError('Failed to save tests. ' + (err.response?.data?.error || ''));
    }
  };

  const handleBack = () => {
    if (returnUrl) {
      navigate(returnUrl, {
        state: { openAppointmentId, openSection }
      });
    } else {
      navigate(-1);
    }
  };

  if (isLoading) return <p className="loading">Loading tests...</p>;

  const CAT_ICONS = ['🩸', '🔬', '🧪', '⚗', '📊'];

  return (
    <div className="test-page-container">
      <div className="test-page-header">
        <h2>🧪 Test Request Form</h2>
        <button className="back-btn" onClick={handleBack}>← Back to Appointment</button>
      </div>

      {error && <p className="error-message">{error}</p>}

      <div className="selected-count">
        📋 Selected Tests: <strong>{getSelectedTestsCount()}</strong>
      </div>

      <div className="dt-categories" style={{ marginBottom: '1rem' }}>
        {categories.map((category, catIndex) => {
          const selCount = category.tests.filter(t => t.selected).length;
          const isOpen = category.open === true;
          return (
            <div key={catIndex} className={`dt-cat${isOpen ? ' open' : ''}`}>
              <button
                className={`dt-cat-toggle${isOpen ? ' open' : ''}`}
                onClick={() => {
                  const updated = [...categories];
                  updated[catIndex] = { ...updated[catIndex], open: !updated[catIndex].open };
                  setCategories(updated);
                }}
              >
                <div className="dt-cat-left">
                  <span className="dt-cat-icon">{CAT_ICONS[catIndex] || '🔬'}</span>
                  <div className="dt-cat-info">
                    <span className="dt-cat-name">{category.name}</span>
                    <span className="dt-cat-meta">
                      {category.tests.length} tests{selCount > 0 && ` · ${selCount} selected`}
                    </span>
                  </div>
                </div>
                <div className="dt-cat-right">
                  {selCount > 0 && <span className="dt-cat-count">{selCount}</span>}
                  <span className="dt-cat-chevron">{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {isOpen && (
                <div className="dt-cat-body">
                  <div className="dt-quick-row">
                    <button className="dt-quick-btn dt-sel-all"
                      onClick={() => handleSelectAllInCategory(catIndex, true)}>
                      ✓ Select All
                    </button>
                    <button className="dt-quick-btn dt-clear-all"
                      onClick={() => handleSelectAllInCategory(catIndex, false)}>
                      ✕ Clear
                    </button>
                  </div>
                  <div className="dt-test-grid">
                    {category.tests.map((test, testIndex) => (
                      <label
                        key={testIndex}
                        className={`dt-test-item${test.selected ? ' selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={test.selected || false}
                          onChange={() => handleTestToggle(catIndex, testIndex)}
                        />
                        <span className="dt-test-name">{test.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="save-section">
        <button
          className="save-tests-btn"
          onClick={handleSaveAll}
          disabled={getSelectedTestsCount() === 0 && !labTestDocumentUrl}
        >
          💾 Save Tests ({getSelectedTestsCount()})
        </button>
        {saved && <span className="save-confirmation">✓ Saved</span>}
      </div>
    </div>
  );
}

export default TestPage;
