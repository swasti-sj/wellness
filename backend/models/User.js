const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  roll: { type: String, required: true, unique: true }, // renamed from username
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'doctor', 'admin'], default: 'student' },
  name: String,
  age: Number,
  sex: String,
  phone: String
});

module.exports = mongoose.model('User', UserSchema);
