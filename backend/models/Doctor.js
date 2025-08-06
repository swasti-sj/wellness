const mongoose = require('mongoose');

const DoctorSchema = new mongoose.Schema({
  name: String,
  specialization: String,
  availableSlots: [
    {
      date: String, // e.g. '2025-08-07'
      times: [String], // e.g. ['14:30', '15:30']
    },
  ],
});

module.exports = mongoose.model('Doctor', DoctorSchema);
