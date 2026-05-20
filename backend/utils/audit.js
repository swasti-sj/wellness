const ActivityLog = require('../models/ActivityLog');
const SessionLog = require('../models/SessionLog');
const { v4: uuidv4 } = require('uuid');

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    null
  );
}

function parseUserAgent(agent) {
  const userAgent = agent || '';
  const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera|OPR|Trident|MSIE)\/?\s*([\d\.]+)/i);
  const osMatch = userAgent.match(/(Windows NT|Macintosh|Mac OS X|Android|iPhone|iPad|Linux|CrOS)\s*([\d_.]*)/i);
  const browserInfo = browserMatch ? `${browserMatch[1]} ${browserMatch[2]}` : userAgent;
  const deviceInfo = osMatch ? `${osMatch[1]} ${osMatch[2] || ''}`.trim() : 'Unknown Device';
  return { browserInfo, deviceInfo };
}

async function createSession({ userId, userName, userEmail, role, sessionId, loginTime, ipAddress, deviceInfo, browserInfo }) {
  const existing = await SessionLog.findOne({ sessionId });
  if (existing) {
    return existing;
  }

  return SessionLog.create({
    sessionId,
    userId,
    userName,
    userEmail,
    role,
    loginTime: loginTime || new Date(),
    ipAddress,
    deviceInfo,
    browserInfo,
    lastActive: loginTime || new Date(),
    isActive: true
  });
}

async function endSession(sessionId) {
  if (!sessionId) return null;
  const session = await SessionLog.findOne({ sessionId });
  if (!session) return null;

  if (!session.logoutTime) {
    const logoutTime = new Date();
    const durationSeconds = Math.round((logoutTime - session.loginTime) / 1000);
    session.logoutTime = logoutTime;
    session.sessionDuration = durationSeconds;
    session.isActive = false;
    await session.save();
  }

  return session;
}

async function updateSessionActivity(sessionId, lastActive = new Date()) {
  if (!sessionId) return null;
  const session = await SessionLog.findOne({ sessionId });
  if (!session) return null;
  session.lastActive = lastActive;
  if (!session.logoutTime) {
    session.isActive = true;
    session.sessionDuration = Math.round((lastActive - session.loginTime) / 1000);
  }
  await session.save();
  return session;
}

async function logActivity({
  userId,
  userName,
  userEmail,
  role,
  sessionId,
  module,
  action,
  description,
  severity = 'INFO',
  ipAddress,
  deviceInfo,
  browserInfo,
  details
}) {
  const session = sessionId ? await SessionLog.findOne({ sessionId }) : null;
  const sessionDuration = session
    ? Math.round(((session.logoutTime || new Date()) - session.loginTime) / 1000)
    : undefined;

  return ActivityLog.create({
    userId,
    userName,
    userEmail,
    role,
    sessionId,
    module,
    action,
    description,
    severity,
    ipAddress,
    deviceInfo,
    browserInfo,
    sessionDuration,
    details
  });
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access only' });
  }
  next();
}

module.exports = {
  getClientIp,
  parseUserAgent,
  createSession,
  endSession,
  updateSessionActivity,
  logActivity,
  requireAdmin,
  uuidv4
};
