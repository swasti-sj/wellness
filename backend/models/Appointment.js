const mongoose = require('mongoose');
const AppointmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
  doctorName: String,
  date: String,
  time: String,
});
module.exports = mongoose.model('Appointment', AppointmentSchema);
