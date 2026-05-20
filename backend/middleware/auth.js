const jwt = require('jsonwebtoken');
const { logActivity } = require('../utils/audit');

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role, sessionId }
    // IMPORTANT: Removed auto-request audit logging here. Audits must be created
    // explicitly within business controllers using `logActivity()` to ensure
    // only meaningful business events are recorded (not every API request).
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Optional: Middleware to require doctor role
function requireDoctor(req, res, next) {
  if (req.user?.role !== 'doctor') {
    return res.status(403).json({ error: 'Doctor access only' });
  }
  next();
}

// Optional: Middleware to require patient role
function requirePatient(req, res, next) {
  if (req.user?.role !== 'patient') {
    return res.status(403).json({ error: 'Patient access only' });
  }
  next();
}

// Optional: Middleware to require receptionist role
function requireReceptionist(req, res, next) {
  if (req.user?.role !== 'receptionist') {
    return res.status(403).json({ error: 'Receptionist access only' });
  }
  next();
}

// Optional: Middleware to require nurse role
function requireNurse(req, res, next) {
  if (req.user?.role !== 'nurse') {
    return res.status(403).json({ error: 'Nurse access only' });
  }
  next();
}

// Optional: Middleware to require pharmacist role
function requirePharmacist(req, res, next) {
  if (req.user?.role !== 'pharmacist') {
    return res.status(403).json({ error: 'Pharmacist access only' });
  }
  next();
}

module.exports = authMiddleware;
module.exports.requireDoctor = requireDoctor;
module.exports.requirePatient = requirePatient;
module.exports.requireReceptionist = requireReceptionist;
module.exports.requireNurse = requireNurse;
module.exports.requirePharmacist = requirePharmacist;
