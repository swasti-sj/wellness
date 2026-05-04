// models/Doctor.js
const mongoose = require('mongoose');

const daySlotSchema = new mongoose.Schema({
  day: String,
  times: [
    {
      time: String,
      status: {
        type: String,
        enum: [
          'available',
          'booked',
          'attended',
          'no show',
          'cancelled by user',
          'cancelled by doctor',
          'cancelled by nurse',
          'cancelled by receptionist',
          'walk in'
        ],
        default: 'available'
      }
    }
  ]
});

const doctorSchema = new mongoose.Schema(
  {
    googleId: { type: String, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    picture: { type: String },
    specialization: { type: String, default: '' },
    phone: { type: String, default: '' },
    weeklySlots: [daySlotSchema],
    googleAccessToken: { type: String },
    googleRefreshToken: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Doctor', doctorSchema);
