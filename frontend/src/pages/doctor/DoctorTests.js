import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../../styles/doctor/DoctorTests.css';
import { useApi } from '../../context/ApiContext';
const TEST_CATEGORIES = [
  {
    icon: '🩸',
    name: 'Routine Investigations in Blood',
    tests: [
      'ADA (Adenosine Deaminase)', 'Alkaline Phosphatase', 'Albumin', 'Ammonia', 'Amylase',
      'AG Ratio', 'Bicarbonate', 'Bilirubin Total', 'Bilirubin Direct',
      'Blood Gas Analysis Arterial (ABG)', 'Blood Gas Analysis Venous (VBG)',
      'Calcium Total', 'Calcium (Ionised)', 'Chloride', 'Cholesterol Total',
      'Cholesterol (HDL)', 'Cholesterol (LDL)', 'Creatinine', 'CK (CPK)', 'CK-MB',
      'GFR', 'Electrolytes (Na, K, CO2)', 'GGT (Gamma Glutamyl Transferase)',
      'Globulin', 'Glucose Fasting', 'Glucose PP (Post Prandial)', 'Glucose Random',
      'GTT (Glucose Tolerance Test)', 'Glycosylated Hb (HbA1C)',
      'High sensitive CRP (hsCRP)', 'Homocysteine', 'Iron', 'Lactate (Lactic Acid)',
      'LDH (Lactate Dehydrogenase)', 'Lipase', 'Magnesium', 'Osmolality (Serum)',
      'Phosphorus', 'Total Protein', 'Pseudocholinesterase', 'SGOT (AST)', 'SGPT (ALT)',
      'Sodium', 'TIBC', 'Urea', 'Uric Acid',
    ]
  },
  {
    icon: '🔬',
    name: 'Immunoassay',
    tests: [
      'AFP (Alfa Feto Protein)', 'AMH (Anti Mullerian Hormone)', 'ANCA CCP',
      'Anti TPO antibodies', 'Beta HCG (Total)', 'CA-125', 'CA 19-9', 'CEA',
      'Cortisol', 'Estradiol (E2)/Estrogen', 'Ferritin', 'Folate (Folic acid)',
      'Free T3', 'Free T4', 'FSH', 'PTH (intact)', 'LH', 'Procalcitonin',
      'Progesterone (P4)', 'Prolactin', 'PSA Total', 'Testosterone',
      'Troponin-t hs (high sensitive Trop T)', 'TSH',
      'Vitamin D (Total 250H Vitamin D3)', 'Vitamin B12',
    ]
  },
  {
    icon: '🧪',
    name: 'Routine Investigations in Urine & Body Fluids',
    tests: [
      'Random/Spot Urine', '24hrs Urine', 'Urine Fhedss', 'Fluid Protein',
      'Urine Microalbumin', 'Urine Sodium', 'CSF Sugar', 'CSF Protein',
      'Fluid Albumin', 'Urine Potassium', 'Urine Uric acid', 'Fluid Amylase',
      'Urine Osmolality', 'Urine Albumin', 'Urine Calcium', 'Urine Protein',
      'CSF Chloride', 'Fluid Lipase', 'Urine Phosphorus', 'CSF ADA', 'CSF Lactate',
      'Creatinine Ratio (ACR)', 'Urine Creatinine', 'Fluid Creatinine', 'Urine Chloride',
    ]
  },
  {
    icon: '⚗',
    name: 'Special Tests',
    tests: [
      'Hemoglobin Variant screening by HPLC method', 'Osmotic Fragility test',
      'Protein Electrophoresis', 'Urinary Bence Jones Protein', 'Urine Screening for EM',
      'Stone Analysis', 'Urine Protein', 'Urine Urea', 'CSF Albumin', 'Fluid Ursa',
      'Protein Creatinine Ratio (PCR)', 'CSF LDH', 'Fluid Triglycerides',
      'Fluid CA19-9', 'Fluid AFP',
    ]
  },
  {
    icon: '📊',
    name: 'Profiles',
    tests: [
      'Diabetic Profile', 'Lipid Profile', 'Renal Profile', 'Liver Profile',
      'Acute Cardiac Profile', 'Hypertension Profile', 'CVD Risk assessment profile',
      'PIH Profile', 'Pre-chemo workup', 'Iron Profile', 'Prostatic Profile',
      'Thyroid Profile', 'Fertility Profile',
    ]
  },
];

// Normalise category data: each test is { name, selected }
const buildCategories = () =>
  TEST_CATEGORIES.map(cat => ({
    ...cat,
    tests: cat.tests.map(name => ({ name, selected: false })),
    open: false,
  }));

function DoctorTests({ appointmentId, patientId }) {
  const [categories, setCategories] = useState(buildCategories());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const apiBaseUrl = useApi();
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
          setCategories(prev =>
            prev.map(cat => ({
              ...cat,
              tests: cat.tests.map(test => ({
                ...test,
                selected: savedTests.some(s => s.testName === test.name && s.selected),
              })),
            }))
          );
        }
      } catch (err) {
        console.error('Error fetching test data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTestData();
  }, [appointmentId, token]);

  const toggleCategory = (catIdx) => {
    setCategories(prev => prev.map((cat, i) =>
      i === catIdx ? { ...cat, open: !cat.open } : cat
    ));
  };

  const handleTestToggle = (catIdx, testIdx) => {
    setCategories(prev => {
      const next = [...prev];
      next[catIdx] = {
        ...next[catIdx],
        tests: next[catIdx].tests.map((t, i) =>
          i === testIdx ? { ...t, selected: !t.selected } : t
        ),
      };
      return next;
    });
    setSaved(false);
  };

  const handleSelectAll = (catIdx, val) => {
    setCategories(prev => {
      const next = [...prev];
      next[catIdx] = {
        ...next[catIdx],
        tests: next[catIdx].tests.map(t => ({ ...t, selected: val })),
      };
      return next;
    });
    setSaved(false);
  };

  const totalSelected = categories.reduce(
    (n, cat) => n + cat.tests.filter(t => t.selected).length, 0
  );

  const catSelectedCount = (cat) => cat.tests.filter(t => t.selected).length;

  const handleSaveTests = async () => {
    setError('');
    setSaving(true);
    try {
      const selectedTests = [];
      categories.forEach(cat => {
        cat.tests.forEach(test => {
          if (test.selected) {
            selectedTests.push({ testName: test.name, category: cat.name, selected: true });
          }
        });
      });
      const response = await axios.post(`${apiBaseUrl}/api/tests/save`, {
        token, appointmentId, tests: selectedTests
      });
      if (response.data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      setError('Failed to save tests. ' + (err.response?.data?.error || ''));
    } finally {
      setSaving(false);
    }
  };

  const filteredCategories = search.trim()
    ? categories.map(cat => ({
      ...cat,
      open: true,
      tests: cat.tests.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase())
      ),
    })).filter(cat => cat.tests.length > 0)
    : categories;

  if (isLoading) return <p className="dt-loading">Loading tests…</p>;

  return (
    <div className="dt-root">
      {error && <div className="dt-error">⚠ {error}</div>}

      {/* ── Header row ── */}
      <div className="dt-header">
        <div className="dt-header-left">
          <span className="dt-header-icon">🧪</span>
          <span className="dt-header-title">Test Request Form</span>
        </div>
        {totalSelected > 0 && (
          <span className="dt-total-badge">{totalSelected} selected</span>
        )}
      </div>

      {/* ── Search ── */}
      <div className="dt-search-wrap">
        <span className="dt-search-icon">🔍</span>
        <input
          className="dt-search"
          type="text"
          placeholder="Search tests across all categories…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button className="dt-search-clear" onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      {/* ── Category accordions ── */}
      <div className="dt-categories">
        {filteredCategories.map((cat, catIdx) => {
          const selCount = catSelectedCount(cat);
          return (
            <div key={cat.name} className={`dt-cat${cat.open ? ' open' : ''}`}>

              {/* Category toggle */}
              <button
                className={`dt-cat-toggle${cat.open ? ' open' : ''}`}
                onClick={() => !search && toggleCategory(
                  categories.findIndex(c => c.name === cat.name)
                )}
              >
                <div className="dt-cat-left">
                  <span className="dt-cat-icon">{cat.icon}</span>
                  <div className="dt-cat-info">
                    <span className="dt-cat-name">{cat.name}</span>
                    <span className="dt-cat-meta">
                      {cat.tests.length} tests
                      {selCount > 0 && ` · ${selCount} selected`}
                    </span>
                  </div>
                </div>
                <div className="dt-cat-right">
                  {selCount > 0 && (
                    <span className="dt-cat-count">{selCount}</span>
                  )}
                  {!search && <span className="dt-cat-chevron">{cat.open ? '▲' : '▼'}</span>}
                </div>
              </button>

              {/* Tests panel */}
              {(cat.open || search) && (
                <div className="dt-cat-body">
                  {/* Quick actions */}
                  <div className="dt-quick-row">
                    <button
                      className="dt-quick-btn dt-sel-all"
                      onClick={() => handleSelectAll(
                        categories.findIndex(c => c.name === cat.name), true
                      )}
                    >
                      ✓ Select All
                    </button>
                    <button
                      className="dt-quick-btn dt-clear-all"
                      onClick={() => handleSelectAll(
                        categories.findIndex(c => c.name === cat.name), false
                      )}
                    >
                      ✕ Clear
                    </button>
                  </div>

                  {/* Test grid */}
                  <div className="dt-test-grid">
                    {cat.tests.map((test, testIdx) => {
                      const realCatIdx = categories.findIndex(c => c.name === cat.name);
                      const realTestIdx = categories[realCatIdx].tests.findIndex(t => t.name === test.name);
                      return (
                        <label
                          key={test.name}
                          className={`dt-test-item${test.selected ? ' selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={test.selected || false}
                            onChange={() => handleTestToggle(realCatIdx, realTestIdx)}
                          />
                          <span className="dt-test-name">{test.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div className="dt-footer">
        <button
          className="dt-save-btn"
          onClick={handleSaveTests}
          disabled={saving || totalSelected === 0}
        >
          {saving ? '⏳ Saving…' : `💾 Save Tests (${totalSelected})`}
        </button>
        {saved && <span className="dt-saved-badge">✓ Saved</span>}
      </div>
    </div>
  );
}

export default DoctorTests;