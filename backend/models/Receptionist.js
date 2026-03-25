const mongoose = require("mongoose");

const receptionistSchema = new mongoose.Schema({
  googleId: { type: String, required: true },
  name: String,
  email: { type: String, required: true, unique: true },
  phone: String,
  age: Number,
  sex: String,
  role: { type: String, default: 'receptionist' },
  googleAccessToken: { type: String },
  googleRefreshToken: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("Receptionist", receptionistSchema);
