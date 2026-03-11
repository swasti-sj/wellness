import React, { useState, useEffect } from "react";
import axios from "axios";
import "../../styles/doctor/DoctorVitals.css";

const DoctorVitals = ({ appointmentId, patientId, apiBaseUrl }) => {
  const token = localStorage.getItem("token");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [existingVitalId, setExistingVitalId] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);

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

  // ----------------------------
  // HANDLE INPUT CHANGE
  // ----------------------------
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // ----------------------------
  // FETCH EXISTING VITALS
  // ----------------------------
  useEffect(() => {
    const fetchVitals = async () => {
      if (!apiBaseUrl || !appointmentId) return;
      
      try {
        const res = await axios.get(
          `${apiBaseUrl}/vitals/${appointmentId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (res.data.vital) {
          const vital = res.data.vital;
          setExistingVitalId(vital._id);

          setFormData({
            department: vital.department || "",
            uhid: vital.uhid || "",
            tokenNumber: vital.tokenNumber || "",
            bloodGroup: vital.bloodGroup || "",
            time: vital.time || "",
            pastMedicalHistory: vital.pastMedicalHistory || "",
            medicalAllergy: vital.medicalAllergy || "",
            chiefComplaints: vital.chiefComplaints || "",
            systemicExamination: vital.systemicExamination || "",
            generalPhysicalExamination: vital.generalPhysicalExamination || "",
            investigations: vital.investigations || "",
            treatmentAdvice: vital.treatmentAdvice || "",
            followUpDate: vital.followUpDate
              ? vital.followUpDate.split("T")[0]
              : "",

            bloodPressureSystolic: vital.bloodPressureSystolic || "",
            bloodPressureDiastolic: vital.bloodPressureDiastolic || "",
            weight: vital.weight || "",
            height: vital.height || "",
            temperature: vital.temperature || "",
            pulse: vital.pulse || "",
            respiratoryRate: vital.respiratoryRate || "",
            spO2: vital.spO2 || "",
            notes: vital.notes || "",
          });
          
          // If there's existing data, show view mode
          setIsViewMode(true);
        }
      } catch (err) {
        console.log("No previous vitals found.");
        setIsViewMode(false);
      }
    };

    if (appointmentId) {
      fetchVitals();
    }
  }, [appointmentId, token, apiBaseUrl]);

  // ----------------------------
  // SAVE VITALS
  // ----------------------------
  const handleSaveVitals = async () => {
    try {
      setLoading(true);
      setMessage("");

      const payload = {
        appointmentId,
        patientId,
        ...formData,
      };

      const res = await axios.post(
        `${apiBaseUrl}/vitals/save`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.data.success) {
        setMessage("✅ Case sheet saved successfully!");
        setIsViewMode(true);
      }

      setLoading(false);
    } catch (err) {
      console.error(err.response?.data || err.message);
      setMessage(
        err.response?.data?.error || "❌ Failed to save case sheet."
      );
      setLoading(false);
    }
  };

  // ----------------------------
  // CALCULATE BMI
  // ----------------------------
  const calculateBMI = () => {
    const weight = parseFloat(formData.weight);
    const height = parseFloat(formData.height);
    if (weight && height) {
      const heightInMeters = height / 100;
      const bmi = (weight / (heightInMeters * heightInMeters)).toFixed(2);
      return bmi;
    }
    return "--";
  };

  return (
    <div className="doctor-vitals">
      {/* Header */}
      <div className="case-header">
        <h2>CASE SHEET</h2>
        {existingVitalId && <span className="badge">Saved</span>}
      </div>

      {/* BASIC DETAILS SECTION */}
      <div className="section">
        <h4>📋 Basic Details</h4>
        <div className="form-grid">
          <div className="form-group">
            <label>Department *</label>
            <input
              type="text"
              name="department"
              value={formData.department}
              onChange={handleInputChange}
              placeholder="Enter department"
            />
          </div>
          <div className="form-group">
            <label>UHID</label>
            <input
              type="text"
              name="uhid"
              value={formData.uhid}
              onChange={handleInputChange}
              placeholder="Unique Hospital ID"
            />
          </div>
          <div className="form-group">
            <label>Token Number</label>
            <input
              type="text"
              name="tokenNumber"
              value={formData.tokenNumber}
              onChange={handleInputChange}
              placeholder="Token No"
            />
          </div>
          <div className="form-group">
            <label>Blood Group</label>
            <select
              name="bloodGroup"
              value={formData.bloodGroup}
              onChange={handleInputChange}
            >
              <option value="">Select Blood Group</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>
          <div className="form-group">
            <label>Time</label>
            <input
              type="time"
              name="time"
              value={formData.time}
              onChange={handleInputChange}
            />
          </div>
        </div>
      </div>

      {/* MEDICAL HISTORY SECTION */}
      <div className="section">
        <h4>🏥 Medical History</h4>
        <div className="form-grid">
          <div className="form-group" style={{ gridColumn: "span 2" }}>
            <label>Past Medical History</label>
            <textarea
              name="pastMedicalHistory"
              value={formData.pastMedicalHistory}
              onChange={handleInputChange}
              placeholder="Any chronic illnesses, surgeries, etc."
              rows="2"
            />
          </div>
          <div className="form-group" style={{ gridColumn: "span 2" }}>
            <label>Medical Allergy</label>
            <textarea
              name="medicalAllergy"
              value={formData.medicalAllergy}
              onChange={handleInputChange}
              placeholder="Drug allergies (Yes/No, If Yes specify)"
              rows="2"
            />
          </div>
          <div className="form-group" style={{ gridColumn: "span 2" }}>
            <label>Chief Complaints with Duration *</label>
            <textarea
              name="chiefComplaints"
              value={formData.chiefComplaints}
              onChange={handleInputChange}
              placeholder="Main symptoms and how long"
              rows="2"
            />
          </div>
          <div className="form-group" style={{ gridColumn: "span 2" }}>
            <label>Systemic Examination</label>
            <textarea
              name="systemicExamination"
              value={formData.systemicExamination}
              onChange={handleInputChange}
              placeholder="Cardiovascular, Respiratory, Abdomen, etc."
              rows="2"
            />
          </div>
          <div className="form-group" style={{ gridColumn: "span 2" }}>
            <label>General Physical Examination</label>
            <textarea
              name="generalPhysicalExamination"
              value={formData.generalPhysicalExamination}
              onChange={handleInputChange}
              placeholder="General appearance, pallor, jaundice, lymph nodes, etc."
              rows="2"
            />
          </div>
        </div>
      </div>

      {/* VITALS SECTION */}
      <div className="section">
        <h4>💓 Vital Signs</h4>
        <div className="vitals-input-grid">
          <div className="form-group">
            <label>BP Systolic (mmHg)</label>
            <input
              type="number"
              name="bloodPressureSystolic"
              value={formData.bloodPressureSystolic}
              onChange={handleInputChange}
              placeholder="120"
            />
          </div>
          <div className="form-group">
            <label>BP Diastolic (mmHg)</label>
            <input
              type="number"
              name="bloodPressureDiastolic"
              value={formData.bloodPressureDiastolic}
              onChange={handleInputChange}
              placeholder="80"
            />
          </div>
          <div className="form-group">
            <label>Pulse Rate (bpm)</label>
            <input
              type="number"
              name="pulse"
              value={formData.pulse}
              onChange={handleInputChange}
              placeholder="72"
            />
          </div>
          <div className="form-group">
            <label>Temperature (°F)</label>
            <input
              type="number"
              step="0.1"
              name="temperature"
              value={formData.temperature}
              onChange={handleInputChange}
              placeholder="98.6"
            />
          </div>
          <div className="form-group">
            <label>Respiratory Rate (/min)</label>
            <input
              type="number"
              name="respiratoryRate"
              value={formData.respiratoryRate}
              onChange={handleInputChange}
              placeholder="16"
            />
          </div>
          <div className="form-group">
            <label>SpO2 (%)</label>
            <input
              type="number"
              name="spO2"
              value={formData.spO2}
              onChange={handleInputChange}
              placeholder="98"
            />
          </div>
          <div className="form-group">
            <label>Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              name="weight"
              value={formData.weight}
              onChange={handleInputChange}
              placeholder="70"
            />
          </div>
          <div className="form-group">
            <label>Height (cm)</label>
            <input
              type="number"
              name="height"
              value={formData.height}
              onChange={handleInputChange}
              placeholder="170"
            />
          </div>
          <div className="form-group">
            <label>BMI (Auto-calculated)</label>
            <input
              type="text"
              value={calculateBMI()}
              readOnly
              placeholder="--"
              style={{ backgroundColor: "#f8f9fa" }}
            />
          </div>
        </div>
      </div>

      {/* INVESTIGATION & TREATMENT SECTION */}
      <div className="section">
        <h4>🔬 Investigations & Treatment</h4>
        <div className="form-grid">
          <div className="form-group" style={{ gridColumn: "span 2" }}>
            <label>Investigations</label>
            <textarea
              name="investigations"
              value={formData.investigations}
              onChange={handleInputChange}
              placeholder="Lab tests, X-rays, scans recommended"
              rows="2"
            />
          </div>
          <div className="form-group" style={{ gridColumn: "span 2" }}>
            <label>Treatment / Advice</label>
            <textarea
              name="treatmentAdvice"
              value={formData.treatmentAdvice}
              onChange={handleInputChange}
              placeholder="Medications, diet, rest, follow-up instructions"
              rows="2"
            />
          </div>
          <div className="form-group">
            <label>Follow-up Date</label>
            <input
              type="date"
              name="followUpDate"
              value={formData.followUpDate}
              onChange={handleInputChange}
            />
          </div>
        </div>
      </div>

      {/* NOTES SECTION */}
      <div className="section">
        <h4>📝 Additional Notes</h4>
        <div className="form-group">
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            placeholder="Any additional observations or instructions"
            rows="2"
          />
        </div>
      </div>

      {/* SAVE BUTTON */}
      <div className="section" style={{ marginTop: "20px" }}>
        <button
          className="save-btn"
          onClick={handleSaveVitals}
          disabled={loading}
        >
          {loading ? "Saving..." : existingVitalId ? "🔄 Update Case Sheet" : "💾 Save Case Sheet"}
        </button>

        {message && (
          <p style={{ marginTop: "10px", fontWeight: "500" }}>{message}</p>
        )}
      </div>
    </div>
  );
};

export default DoctorVitals;
