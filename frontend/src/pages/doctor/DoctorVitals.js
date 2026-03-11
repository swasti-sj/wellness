import React, { useState, useEffect } from "react";
import axios from "axios";
import "../../styles/doctor/DoctorVitals.css";

const DoctorVitals = ({ appointmentId, patientId, apiBaseUrl }) => {
  const token = localStorage.getItem("token");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [existingVitalId, setExistingVitalId] = useState(null);
  const [openSection, setOpenSection] = useState(null);

  const [formData, setFormData] = useState({
    department: "",
    uhid: "",
    tokenNumber: "",
    bloodGroup: "",
    time: "",
    pastMedicalHistory: "",
    medicalAllergy: "",
    chiefComplaints: "",
    systemicExamination: "",
    generalPhysicalExamination: "",
    investigations: "",
    treatmentAdvice: "",
    followUpDate: "",
    bloodPressureSystolic: "",
    bloodPressureDiastolic: "",
    weight: "",
    height: "",
    temperature: "",
    pulse: "",
    respiratoryRate: "",
    spO2: "",
    notes: "",
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleSection = (key) =>
    setOpenSection((prev) => (prev === key ? null : key));

  useEffect(() => {
    const fetchVitals = async () => {
      if (!apiBaseUrl || !appointmentId) return;
      try {
        const res = await axios.get(`${apiBaseUrl}/vitals/${appointmentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.vital) {
          const v = res.data.vital;
          setExistingVitalId(v._id);
          setFormData({
            department: v.department || "",
            uhid: v.uhid || "",
            tokenNumber: v.tokenNumber || "",
            bloodGroup: v.bloodGroup || "",
            time: v.time || "",
            pastMedicalHistory: v.pastMedicalHistory || "",
            medicalAllergy: v.medicalAllergy || "",
            chiefComplaints: v.chiefComplaints || "",
            systemicExamination: v.systemicExamination || "",
            generalPhysicalExamination: v.generalPhysicalExamination || "",
            investigations: v.investigations || "",
            treatmentAdvice: v.treatmentAdvice || "",
            followUpDate: v.followUpDate ? v.followUpDate.split("T")[0] : "",
            bloodPressureSystolic: v.bloodPressureSystolic || "",
            bloodPressureDiastolic: v.bloodPressureDiastolic || "",
            weight: v.weight || "",
            height: v.height || "",
            temperature: v.temperature || "",
            pulse: v.pulse || "",
            respiratoryRate: v.respiratoryRate || "",
            spO2: v.spO2 || "",
            notes: v.notes || "",
          });
        }
      } catch (err) {
        console.log("No previous vitals found.");
      }
    };
    if (appointmentId) fetchVitals();
  }, [appointmentId, token, apiBaseUrl]);

  const handleSaveVitals = async () => {
    try {
      setLoading(true);
      setMessage("");
      const res = await axios.post(
        `${apiBaseUrl}/vitals/save`,
        { appointmentId, patientId, ...formData },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setMessage("✅ Case sheet saved successfully!");
        setExistingVitalId(res.data.vital?._id || existingVitalId);
      }
      setLoading(false);
    } catch (err) {
      setMessage(err.response?.data?.error || "❌ Failed to save case sheet.");
      setLoading(false);
    }
  };

  const calculateBMI = () => {
    const weight = parseFloat(formData.weight);
    const height = parseFloat(formData.height);
    if (weight && height) {
      const h = height / 100;
      return (weight / (h * h)).toFixed(1);
    }
    return "—";
  };

  // Reusable accordion section wrapper
  const AccSection = ({ id, icon, title, subtitle, children }) => {
    const isOpen = openSection === id;
    return (
      <div className="acc-section">
        <button
          type="button"
          className={`acc-toggle${isOpen ? " open" : ""}`}
          onClick={() => toggleSection(id)}
        >
          <div className="acc-toggle-left">
            <span className="acc-icon">{icon}</span>
            <div>
              <div className="acc-title">{title}</div>
              {subtitle && <div className="acc-subtitle">{subtitle}</div>}
            </div>
          </div>
          <span className="acc-chevron">▼</span>
        </button>
        <div className={`acc-body${isOpen ? " open" : ""}`}>
          {children}
        </div>
      </div>
    );
  };

  return (
    <div className="doctor-vitals">
      {/* ── Case Sheet Title ── */}
      <div className="case-sheet-title">
        CASE SHEET
        {existingVitalId && <span className="saved-badge">✓ Saved</span>}
      </div>

      {/* ── 1. Basic Details ── */}
      <AccSection id="basic" icon="📋" title="Basic Details" subtitle="Department, UHID, blood group, time">
        <div className="fg2">
          <div className="ff">
            <label>Department <span className="req">*</span></label>
            <input type="text" name="department" value={formData.department} onChange={handleInputChange} placeholder="Enter department" />
          </div>
          <div className="ff">
            <label>UHID</label>
            <input type="text" name="uhid" value={formData.uhid} onChange={handleInputChange} placeholder="Unique Hospital ID" />
          </div>
          <div className="ff">
            <label>Token Number</label>
            <input type="text" name="tokenNumber" value={formData.tokenNumber} onChange={handleInputChange} placeholder="Token No" />
          </div>
          <div className="ff">
            <label>Blood Group</label>
            <select name="bloodGroup" value={formData.bloodGroup} onChange={handleInputChange}>
              <option value="">Select Blood Group</option>
              <option>A+</option><option>A-</option>
              <option>B+</option><option>B-</option>
              <option>AB+</option><option>AB-</option>
              <option>O+</option><option>O-</option>
            </select>
          </div>
          <div className="ff">
            <label>Time</label>
            <input type="time" name="time" value={formData.time} onChange={handleInputChange} />
          </div>
        </div>
      </AccSection>

      {/* ── 2. Medical History ── */}
      <AccSection id="history" icon="🏥" title="Medical History" subtitle="Past illnesses, allergies, chief complaints">
        <div className="fg1">
          <div className="ff">
            <label>Past Medical History</label>
            <textarea name="pastMedicalHistory" value={formData.pastMedicalHistory} onChange={handleInputChange} placeholder="Any chronic illnesses, surgeries, etc." rows={2} />
          </div>
          <div className="ff">
            <label>Medical Allergy</label>
            <textarea name="medicalAllergy" value={formData.medicalAllergy} onChange={handleInputChange} placeholder="Drug allergies (Yes/No, If Yes specify)" rows={2} />
          </div>
          <div className="ff">
            <label>Chief Complaints with Duration <span className="req">*</span></label>
            <textarea name="chiefComplaints" value={formData.chiefComplaints} onChange={handleInputChange} placeholder="Main symptoms and how long" rows={2} />
          </div>
          <div className="ff">
            <label>Systemic Examination</label>
            <textarea name="systemicExamination" value={formData.systemicExamination} onChange={handleInputChange} placeholder="Cardiovascular, Respiratory, Abdomen, etc." rows={2} />
          </div>
          <div className="ff">
            <label>General Physical Examination</label>
            <textarea name="generalPhysicalExamination" value={formData.generalPhysicalExamination} onChange={handleInputChange} placeholder="General appearance, pallor, jaundice, lymph nodes, etc." rows={2} />
          </div>
        </div>
      </AccSection>

      {/* ── 3. Vital Signs ── */}
      <AccSection id="vitals" icon="💓" title="Vital Signs" subtitle="BP, pulse, temperature, SpO₂, weight, height">
        <div className="fg3">
          <div className="ff">
            <label>BP Systolic</label>
            <div className="input-addon"><input type="number" name="bloodPressureSystolic" value={formData.bloodPressureSystolic} onChange={handleInputChange} placeholder="120" /><span>mmHg</span></div>
          </div>
          <div className="ff">
            <label>BP Diastolic</label>
            <div className="input-addon"><input type="number" name="bloodPressureDiastolic" value={formData.bloodPressureDiastolic} onChange={handleInputChange} placeholder="80" /><span>mmHg</span></div>
          </div>
          <div className="ff">
            <label>Pulse Rate</label>
            <div className="input-addon"><input type="number" name="pulse" value={formData.pulse} onChange={handleInputChange} placeholder="72" /><span>bpm</span></div>
          </div>
          <div className="ff">
            <label>Temperature</label>
            <div className="input-addon"><input type="number" step="0.1" name="temperature" value={formData.temperature} onChange={handleInputChange} placeholder="98.6" /><span>°F</span></div>
          </div>
          <div className="ff">
            <label>Respiratory Rate</label>
            <div className="input-addon"><input type="number" name="respiratoryRate" value={formData.respiratoryRate} onChange={handleInputChange} placeholder="16" /><span>/min</span></div>
          </div>
          <div className="ff">
            <label>SpO₂</label>
            <div className="input-addon"><input type="number" name="spO2" value={formData.spO2} onChange={handleInputChange} placeholder="98" /><span>%</span></div>
          </div>
          <div className="ff">
            <label>Weight</label>
            <div className="input-addon"><input type="number" step="0.1" name="weight" value={formData.weight} onChange={handleInputChange} placeholder="70" /><span>kg</span></div>
          </div>
          <div className="ff">
            <label>Height</label>
            <div className="input-addon"><input type="number" name="height" value={formData.height} onChange={handleInputChange} placeholder="170" /><span>cm</span></div>
          </div>
          <div className="ff">
            <label>BMI (auto)</label>
            <div className="input-addon readonly"><input type="text" value={calculateBMI()} readOnly placeholder="—" /><span>kg/m²</span></div>
          </div>
        </div>
      </AccSection>

      {/* ── 4. Investigations & Treatment ── */}
      <AccSection id="investigations" icon="🔬" title="Investigations & Treatment" subtitle="Lab tests, treatment advice, follow-up date">
        <div className="fg1">
          <div className="ff">
            <label>Investigations</label>
            <textarea name="investigations" value={formData.investigations} onChange={handleInputChange} placeholder="Lab tests, X-rays, scans recommended" rows={2} />
          </div>
          <div className="ff">
            <label>Treatment / Advice</label>
            <textarea name="treatmentAdvice" value={formData.treatmentAdvice} onChange={handleInputChange} placeholder="Medications, diet, rest, follow-up instructions" rows={2} />
          </div>
          <div className="ff follow-date">
            <label>Follow-up Date</label>
            <input type="date" name="followUpDate" value={formData.followUpDate} onChange={handleInputChange} />
          </div>
        </div>
      </AccSection>

      {/* ── 5. Additional Notes ── */}
      <AccSection id="notes" icon="📝" title="Additional Notes" subtitle="Any extra observations or instructions">
        <div className="ff">
          <textarea name="notes" value={formData.notes} onChange={handleInputChange} placeholder="Any additional observations or instructions" rows={3} />
        </div>
      </AccSection>

      {/* ── Save Button ── */}
      <div className="vitals-save-row">
        <button className="save-case-btn" onClick={handleSaveVitals} disabled={loading}>
          {loading ? "Saving…" : existingVitalId ? "🔄 Update Case Sheet" : "💾 Save Case Sheet"}
        </button>
        {message && (
          <p className={message.startsWith("✅") ? "msg-success" : "msg-error"}>{message}</p>
        )}
      </div>
    </div>
  );
};

export default DoctorVitals;