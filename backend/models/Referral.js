// models/Referral.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const referralSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  fromDoctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
  toDoctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
  appointment: { type: Schema.Types.ObjectId, ref: 'Appointment', default: null },
  reason: { type: String },
  status: { type: String, default: 'pending' }, // pending / viewed / completed
  read: { type: Boolean, default: false },      // NEW FIELD
  viewedAt: { type: Date, default: null },      // When the doctor viewed it
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Referral', referralSchema);
