const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MedicineIssuanceSchema = new Schema({
  patient: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  medicine: {
    type: Schema.Types.ObjectId,
    ref: 'Medicine',
    required: true
  },
  quantityIssued: {
    type: Number,
    required: true,
    min: 1
  },
  doctor: {
    type: Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  issuedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Pharmacist'
  },
  issuedDate: {
    type: Date,
    default: Date.now
  },
  // Prescription reference
  prescription: {
    type: Schema.Types.ObjectId,
    ref: 'Prescription'
  },
  // Source of medicine: in-house college stock or external pharmacy
  source: {
    type: String,
    enum: ['INHOUSE', 'EXTERNAL'],
    default: 'INHOUSE'
  },
  // Notes
  notes: {
    type: String,
    trim: true
  },
  // Stock snapshot at time of issuance for audit
  stockBefore: {
    type: Number
  },
  stockAfter: {
    type: Number
  }
}, {
  timestamps: true
});

MedicineIssuanceSchema.index({ issuedDate: -1 });
MedicineIssuanceSchema.index({ patient: 1, issuedDate: -1 });
MedicineIssuanceSchema.index({ medicine: 1, issuedDate: -1 });

module.exports = mongoose.model('MedicineIssuance', MedicineIssuanceSchema);