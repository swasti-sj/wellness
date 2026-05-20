const mongoose = require('mongoose');

const sessionLogSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    userName: String,
    userEmail: String,
    role: String,
    loginTime: { type: Date, default: Date.now, index: true },
    logoutTime: Date,
    sessionDuration: Number,
    ipAddress: String,
    deviceInfo: String,
    browserInfo: String,
    lastActive: Date,
    isActive: { type: Boolean, default: true }
  },
  { timestamps: false }
);

sessionLogSchema.index({ loginTime: -1 });

module.exports = mongoose.model('SessionLog', sessionLogSchema);
