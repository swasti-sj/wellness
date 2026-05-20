const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    sessionId: { type: String, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    userName: { type: String, index: true },
    userEmail: { type: String, index: true },
    role: { type: String, index: true },
    module: { type: String, index: true },
    action: { type: String, index: true },
    description: String,
    severity: {
      type: String,
      enum: ['INFO', 'WARNING', 'ERROR', 'CRITICAL', 'AUDIT'],
      default: 'INFO'
    },
    ipAddress: String,
    deviceInfo: String,
    browserInfo: String,
    sessionDuration: Number,
    details: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ role: 1, module: 1, severity: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
