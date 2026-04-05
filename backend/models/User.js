const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  googleId: { type: String }, // Remove required: true to allow doctor-created patients
  name: String,
  email: { type: String, required: true }, // Make email required instead
  roll: String,
  picture: String,
  sex: { type: String, enum: ["Male", "Female", "Other"] },
  age: Number,
  phone: String,
  uhid: String,
  allergies: String,
  consentAccepted: { type: Boolean, default: false },
  role: { type: String, default: 'user' }, // Add role field
  isVerified: { type: Boolean, default: false }, // Add verification status

  googleAccessToken: { type: String },
  googleRefreshToken: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
