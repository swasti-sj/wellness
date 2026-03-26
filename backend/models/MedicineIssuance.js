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
  issuedDate: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  timestamps: true 
});

// Indexes for queries
MedicineIssuanceSchema.index({ issuedDate: -1 });
MedicineIssuanceSchema.index({ patient: 1, issuedDate: -1 });

module.exports = mongoose.model('MedicineIssuance', MedicineIssuanceSchema);

