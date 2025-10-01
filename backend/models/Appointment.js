const mongoose = require("mongoose");

const AppointmentSchema = new mongoose.Schema({
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  doctorCalendarEventId: { type: String, default: null }, // doctor’s Google event id
  patientCalendarEventId: { type: String, default: null }, // patient’s Google event id
  startDateTime: { type: Date, required: true },
  endDateTime: { type: Date, required: true },
  slotDay: { type: String },
  slotTime: { type: String },
  bookedBy: { 
    type: String, 
    enum: ['user', 'doctor'], 
    default: 'user' 
  }, // Track who made the booking
  status: {
    type: String,
    enum: [
      "booked",
      "attended", 
      "no show",
      "cancelled by user",
      "cancelled by doctor",
      "walk in",
      "available"
    ],
    default: "booked" // Change default to "booked" since "available" doesn't make sense for appointments
  }
}, { timestamps: true });

module.exports = mongoose.model("Appointment", AppointmentSchema);
