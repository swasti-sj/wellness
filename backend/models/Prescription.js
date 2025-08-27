const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PrescriptionItemSchema = new Schema({
  medication: { type: String, required: true },
  dosage: { type: String, required: true },
  frequency: { type: String, required: true },
  notes: { type: String },
  status: { 
    type: String, 
    enum: ['new', 'continued'], 
    default: 'new' 
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
  prescriptions: [PrescriptionItemSchema]
}, { timestamps: true });

module.exports = mongoose.model('Prescription', PrescriptionSchema);
