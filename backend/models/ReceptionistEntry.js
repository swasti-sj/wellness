const mongoose = require("mongoose");

const ReceptionistEntrySchema = new mongoose.Schema({
  patientName: {
    type: String,
    required: true
  },
  roll: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['Student', 'Staff', 'Faculty'],
    default: 'Student'
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true
  },
  doctorName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    default: "-"
  },
  phone: {
    type: String,
    default: "-"
  },
  appointmentDate: {
    type: Date
  },
  appointmentTime: {
    type: String
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment",
    default: null,
    index: true
  },
  status: {
    type: String,
    enum: ['Added', 'booked', 'attended', 'no show', 'cancelled by user', 'cancelled by doctor', 'cancelled by nurse', 'cancelled by receptionist', 'walk in'],
    default: 'Added'
  },
  isWalkIn: {
    type: Boolean,
    default: false
  },
  remarks: {
    type: String,
    enum: ['None', 'Outsourced Staff', 'Dependant'],
    default: 'None'
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Receptionist"
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model("ReceptionistEntry", ReceptionistEntrySchema);
