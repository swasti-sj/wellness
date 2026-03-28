const mongoose = require('mongoose');
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
    staffWent: { type: String, default: '' },
    remarks: { type: String, default: '' }
  },
  certificate: {
    issued: { type: Boolean, default: false },
    imageUrl: { type: String, default: '' },
    clinicalDetails: { type: String, default: '' }
  }
}, { timestamps: true });

module.exports = mongoose.model('Test', TestSchema);
