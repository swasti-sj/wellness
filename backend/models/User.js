const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true },
  name: String,
  email: { type: String },
  roll: String,
  picture: String,
  sex: { type: String, enum: ["Male", "Female", "Other"] },
  age: Number,
  phone: String,

  googleAccessToken: { type: String },
  googleRefreshToken: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
