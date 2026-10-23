const mongoose = require('mongoose');
const { encryptField, decryptField } = require('../utils/fieldEncryption');
const Schema = mongoose.Schema;

const TestItemSchema = new Schema({
  testName: { type: String, required: true },
  category: { type: String, required: true },
  selected: { type: Boolean, default: false }
});

const TestSchema = new Schema({
  appointment: { 
    type: Schema.Types.ObjectId, 
    ref: 'Appointment', 
    required: true,
    unique: true
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
  tests: [TestItemSchema],
  labTestDocumentUrl: { type: String, default: '' },
  hospitalReferral: {
    refer: { type: Boolean, default: false },
    hospitalName: { type: String, default: '' },
    ambulanceUsed: { type: Boolean, default: false },
    cashlessFormUsed: { type: Boolean, default: false },
    cashlessFormDocumentUrl: { type: String, default: '' },
    referralFormUsed: { type: Boolean, default: false },
    referralFormDocumentUrl: { type: String, default: '' },
    staffWent: { type: String, default: '' },
    remarks: { type: String, default: '' }
  },
  certificate: {
    issued: { type: Boolean, default: false },
    imageUrl: { type: String, default: '' },
    clinicalDetails: { type: String, default: '' }
  }
}, { timestamps: true });

// Encrypt the two free-text clinical fields before writing to MongoDB —
// hospitalReferral.remarks and certificate.clinicalDetails. Everything
// else on this document (test names, booleans, document URLs) stays
// readable, since only these two actually hold sensitive written content.
TestSchema.pre('save', function (next) {
  if (this.isModified('hospitalReferral.remarks') && this.hospitalReferral) {
    this.hospitalReferral.remarks = encryptField(this.hospitalReferral.remarks);
  }
  if (this.isModified('certificate.clinicalDetails') && this.certificate) {
    this.certificate.clinicalDetails = encryptField(this.certificate.clinicalDetails);
  }
  next();
});

// Decrypt both fields back for legitimate app requests. Plain-text values
// saved before this existed pass through unchanged.
function decryptTestDoc(doc) {
  if (!doc) return;
  if (doc.hospitalReferral) {
    doc.hospitalReferral.remarks = decryptField(doc.hospitalReferral.remarks);
  }
  if (doc.certificate) {
    doc.certificate.clinicalDetails = decryptField(doc.certificate.clinicalDetails);
  }
}

TestSchema.post(['find'], function (docs) {
  (docs || []).forEach(decryptTestDoc);
});

TestSchema.post(['findOne', 'findOneAndUpdate'], function (doc) {
  decryptTestDoc(doc);
});

// Also decrypt immediately after test.save() — pre('save') scrambles
// these fields on that same in-memory document, and a route that responds
// with the just-saved object directly would otherwise send ciphertext
// straight back to the frontend.
TestSchema.post('save', function (doc) {
  decryptTestDoc(doc);
});

module.exports = mongoose.model('Test', TestSchema);
