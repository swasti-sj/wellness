const mongoose = require('mongoose');

const DoctorSchema = new mongoose.Schema({
  name: String,
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
            ],
            default: 'available'
          },
          appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null }
        }
      ]
    }
  ]
});

module.exports = mongoose.model('Doctor', DoctorSchema);
