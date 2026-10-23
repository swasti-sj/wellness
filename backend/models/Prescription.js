const mongoose = require('mongoose');
const { encryptField, decryptField } = require('../utils/fieldEncryption');
const Schema = mongoose.Schema;

const PrescriptionItemSchema = new Schema({
  medication: { type: String, required: true }, // Fallback free-text
  medicine: { 
    type: Schema.Types.ObjectId, 
    ref: 'Medicine' 
  },
  quantity: { 
    type: Number, 
    required: true,
    min: 1,
    default: 1
  },
  dosage: { type: String, required: true },
  frequency: { type: String, required: true },
  notes: { type: String },
  status: { 
    type: String, 
    enum: ['new', 'continued'], 
    default: 'new' 
  },
  // INHOUSE = dispense from college stock (deducts quantity)
  // EXTERNAL = patient buys from outside pharmacy (logged only, no stock deduction)
  source: {
    type: String,
    enum: ['INHOUSE', 'EXTERNAL'],
    default: 'INHOUSE'
  }
});

const PrescriptionSchema = new Schema({
  appointment: { 
    type: Schema.Types.ObjectId, 
    ref: 'Appointment', 
    required: true,
    unique: true // Each appointment can only have one prescription document
  },
  patient: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  doctor: { 
    type: Schema.Types.ObjectId, 
    ref: 'Doctor', 
    required: true 
  },
  prescriptions: [PrescriptionItemSchema],
  documentUrl: { type: String, default: '' },
  documentPublicId: { type: String, default: '' },
  bookNo: { type: String, default: '' },
  prescriptionNo: { type: String, default: '' }
}, { timestamps: true });

// Only the free-text medical fields get encrypted — medication name,
// dosage, frequency, notes. `medicine` (stock reference), `quantity`,
// `status`, and `source` are deliberately left alone: they're either
// read by stock-deduction/enum validation logic elsewhere in the app,
// which would break against ciphertext.
const SENSITIVE_ITEM_FIELDS = ['medication', 'dosage', 'frequency', 'notes'];

PrescriptionSchema.pre('save', function (next) {
  if (this.isModified('prescriptions') && Array.isArray(this.prescriptions)) {
    this.prescriptions.forEach((item) => {
      SENSITIVE_ITEM_FIELDS.forEach((field) => {
        if (item[field]) item[field] = encryptField(item[field]);
      });
    });
  }
  next();
});

function decryptPrescriptionDoc(doc) {
  if (!doc || !Array.isArray(doc.prescriptions)) return;
  doc.prescriptions.forEach((item) => {
    SENSITIVE_ITEM_FIELDS.forEach((field) => {
      if (item[field]) item[field] = decryptField(item[field]);
    });
  });
}

PrescriptionSchema.post(['find'], function (docs) {
  (docs || []).forEach(decryptPrescriptionDoc);
});

PrescriptionSchema.post(['findOne', 'findOneAndUpdate'], function (doc) {
  decryptPrescriptionDoc(doc);
});

// Also decrypt immediately after prescription.save() — same reasoning as
// the other models: pre('save') scrambles the in-memory document, and a
// route returning that object directly would otherwise send ciphertext.
PrescriptionSchema.post('save', function (doc) {
  decryptPrescriptionDoc(doc);
});

module.exports = mongoose.model('Prescription', PrescriptionSchema);