const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  googleId: String,
  email: String,
  name: String,
  picture: String,
  phone: String,
  department: String,
  designation: String,   // ✅ ADD THIS
  googleAccessToken: String,
  googleRefreshToken: String,
  role: { type: String, default: "admin" }
}, { timestamps: true });

module.exports = mongoose.model("Admin", adminSchema);