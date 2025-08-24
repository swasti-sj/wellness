const mongoose = require('mongoose');

const DoctorSchema = new mongoose.Schema({
  googleId: { type: String },
  name: String,
  email: String,
  picture: String,
  specialization: String,
  weeklySlots: [
    {
      day: {
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        required: true
      },
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
              'walk in'
            ],
            default: 'available'
          },
          appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null }
        }
      ]
    }
  ],

  googleAccessToken: String,

  googleRefreshToken: String,

}, { timestamps: true });

module.exports = mongoose.model('Doctor', DoctorSchema);
