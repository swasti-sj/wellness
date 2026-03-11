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
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    caption: {
      type: String,
      default: ''
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, { timestamps: true });

module.exports = mongoose.model("Note", NoteSchema);
