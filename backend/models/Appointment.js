const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
  doctorName: String,
  date: String, // session date
  time: String, // session time
  bookedAt: { type: Date, default: Date.now }, // ⬅ added
  status: {
    type: String,
    enum: [
      'available',
      'booked',
      'attended',
      'no show',
      'cancelled by user',
      'cancelled by doctor',
      'walk in'
    ],
    default: 'booked'
  }
});


module.exports = mongoose.model('Appointment', AppointmentSchema);
