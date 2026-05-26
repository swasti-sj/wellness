const mongoose = require('mongoose');
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
  bookNo: { type: String, default: '' },
  prescriptionNo: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Prescription', PrescriptionSchema);
