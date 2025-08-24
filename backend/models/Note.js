const mongoose = require("mongoose");

const NoteSchema = new mongoose.Schema({
  appointment: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Appointment", 
    required: true 
  },
  text: { 
    type: String, 
    required: true 
  }
}, { timestamps: true });

module.exports = mongoose.model("Note", NoteSchema);
