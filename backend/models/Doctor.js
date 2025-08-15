const mongoose = require('mongoose');

const DoctorSchema = new mongoose.Schema({
  name: String,
  specialization: String,
  availableSlots: [
    {
      date: String, // '2025-08-07'
      times: [
        {
          time: String, // '14:30'
          status: {
            type: String,
            enum: ['available', 'booked', 'attended', 'no show', 'cancelled by user', 'cancelled by doctor', 'walk in'],
            default: 'available'
          },
          appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null }
        }
      ]
    }
  ]
});

module.exports = mongoose.model('Doctor', DoctorSchema);
