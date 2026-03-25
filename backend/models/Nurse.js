const mongoose = require("mongoose");

const nurseSchema = new mongoose.Schema({
  googleId: { type: String, required: true },
  name: String,
  email: { type: String, required: true, unique: true },
  phone: String,
  age: Number,
  sex: String,
  role: { type: String, default: 'nurse' },
  googleAccessToken: { type: String },
  googleRefreshToken: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("Nurse", nurseSchema);
