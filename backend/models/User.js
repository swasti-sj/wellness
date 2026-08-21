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
  role: { type: String, default: 'patient' }, // Add role field
  isVerified: { type: Boolean, default: false }, // Add verification status
  profileComplete: { type: Boolean, default: false }, // true once initial profile form is submitted

  googleAccessToken: { type: String },
  googleRefreshToken: { type: String },
  patientCategory: {
    type: String,
    enum: ["Student", "Faculty", "Staff", "Outsourced Staff"],
  },
  dependants: [{
    _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
    name: { type: String, required: true },
    age: Number,
    sex: { type: String, enum: ["Male", "Female", "Other"] },
    relationship: String,
    bloodGroup: String,
    phone: String,
    allergies: String,
    uhid: String,
  }],
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
