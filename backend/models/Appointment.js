const mongoose = require("mongoose");

const AppointmentSchema = new mongoose.Schema({
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  calendarEventId: { type: String }, // Google Calendar eventId
  startDateTime: { type: Date, required: true },
  endDateTime: { type: Date, required: true },
  slotDay: { type: String },
  slotTime: { type: String },
  status: {
    type: String,
    enum: [
      "booked",
      "attended",
      "no show",
      "cancelled by user",
      "cancelled by doctor",
      "walk in"
    ],
    default: "booked"
  }
}, { timestamps: true });

module.exports = mongoose.model("Appointment", AppointmentSchema);
