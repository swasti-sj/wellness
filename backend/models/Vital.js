const mongoose = require('mongoose');
const { encryptField, decryptField } = require('../utils/fieldEncryption');
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
  notes: String,
  caseSheetDocumentUrl: { type: String, default: "" },
  caseSheetDocumentUrls: { type: [String], default: [] }

}, { timestamps: true });

// Encrypt the free-text clinical case sheet fields before writing to
// MongoDB. The actual measurements (blood pressure, weight, pulse, etc.)
// stay as plain numbers — only the written-out clinical content is
// sensitive enough to need scrambling.
const SENSITIVE_VITAL_FIELDS = [
  'pastMedicalHistory',
  'medicalAllergy',
  'chiefComplaints',
  'systemicExamination',
  'generalPhysicalExamination',
  'investigations',
  'treatmentAdvice',
  'notes',
];

VitalSchema.pre('save', function (next) {
  SENSITIVE_VITAL_FIELDS.forEach((field) => {
    if (this.isModified(field) && this[field]) {
      this[field] = encryptField(this[field]);
    }
  });
  next();
});

function decryptVitalDoc(doc) {
  if (!doc) return;
  SENSITIVE_VITAL_FIELDS.forEach((field) => {
    if (doc[field]) doc[field] = decryptField(doc[field]);
  });
}

VitalSchema.post(['find'], function (docs) {
  (docs || []).forEach(decryptVitalDoc);
});

VitalSchema.post(['findOne', 'findOneAndUpdate'], function (doc) {
  decryptVitalDoc(doc);
});

// Also decrypt immediately after vital.save() — vitals.js saves directly
// via .save() (not findOneAndUpdate), so without this the just-saved
// in-memory document would still hold ciphertext when sent in the response.
VitalSchema.post('save', function (doc) {
  decryptVitalDoc(doc);
});

module.exports = mongoose.model('Vital', VitalSchema);
