const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const VitalSchema = new mongoose.Schema({
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment",
    required: true,
    unique: true
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  // -----------------
  // CASE SHEET FIELDS
  // -----------------
  department: String,
  uhid: String,
  tokenNumber: String,
  bloodGroup: String,
  time: String,
  pastMedicalHistory: String,
  medicalAllergy: String,
  chiefComplaints: String,
  systemicExamination: String,
  generalPhysicalExamination: String,
  investigations: String,
  treatmentAdvice: String,
  followUpDate: Date,

  // -----------------
  // VITALS
  // -----------------
  bloodPressureSystolic: Number,
  bloodPressureDiastolic: Number,
  weight: Number,
  height: Number,
  temperature: Number,
  pulse: Number,
  respiratoryRate: Number,
  spO2: Number,
  bmi: Number,
  notes: String

}, { timestamps: true });

module.exports = mongoose.model('Vital', VitalSchema);