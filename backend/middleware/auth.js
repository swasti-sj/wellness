const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role }
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

module.exports = authMiddleware;
module.exports.requireDoctor = requireDoctor;
module.exports.requirePatient = requirePatient;
