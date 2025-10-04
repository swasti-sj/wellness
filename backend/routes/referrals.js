const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Referral = require('../models/Referral');
const User = require('../models/User');
const Doctor = require('../models/Doctor');

// ------------------------------
// Middleware to verify doctor token
// ------------------------------
const verifyDoctor = (req, res, next) => {
  const token =
    req.headers.authorization?.split(" ")[1] || // Bearer token
    req.body?.token ||
    req.query?.token;

  if (!token) return res.status(400).json({ error: "Missing token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "doctor") return res.status(403).json({ error: "Access denied" });
    req.doctorId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};


// ------------------------------
// Create a referral
// ------------------------------
router.post('/', verifyDoctor, async (req, res) => {
  try {
    const { patientEmail, referredDoctorId, appointmentId, reason } = req.body;

    const patient = await User.findOne({ email: patientEmail.toLowerCase() });
    const referredDoctor = await Doctor.findById(referredDoctorId);

    if (!patient || !referredDoctor) {
      return res.status(404).json({ error: 'Patient or doctor not found' });
    }

    const referral = new Referral({
      patient: patient._id,
      fromDoctor: req.doctorId,
      toDoctor: referredDoctorId,
      appointment: appointmentId || null,
      reason
    });

    await referral.save();
    res.json({ success: true, referral });
  } catch (err) {
    console.error('Referral creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------
// Get referrals for logged-in doctor (all patients)
// ------------------------------
router.get('/all', verifyDoctor, async (req, res) => {
  try {
    const referrals = await Referral.find({ toDoctor: req.doctorId })
      .populate('patient', 'name email')
      .populate('fromDoctor', 'name email')
      .sort({ createdAt: -1 });

    const notes = referrals.map(r => ({
      _id: r._id,
      patient: r.patient ? { name: r.patient.name, email: r.patient.email } : { name: "Unknown", email: "" },
      text: r.reason || "No reason provided",
      doctor: r.fromDoctor ? { name: r.fromDoctor.name, email: r.fromDoctor.email } : { name: "Unknown", email: "" },
      createdAt: r.createdAt
    }));

    res.json({ success: true, notes });
  } catch (err) {
    console.error("Fetch all referral notes error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------
// Get referrals for a single patient (optional)
// ------------------------------
router.get('/patient/email/:patientEmail', verifyDoctor, async (req, res) => {
  try {
    const patientEmail = req.params.patientEmail.toLowerCase();

    const patient = await User.findOne({ email: patientEmail });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const referrals = await Referral.find({ patient: patient._id })
      .populate('fromDoctor', 'name email')
      .sort({ createdAt: -1 });

    const notes = referrals.map(r => ({
      _id: r._id,
      text: r.reason || "No reason provided",
      doctor: r.fromDoctor ? { name: r.fromDoctor.name, email: r.fromDoctor.email } : { name: "Unknown", email: "" },
      createdAt: r.createdAt
    }));

    res.json({ success: true, notes });
  } catch (err) {
    console.error("Fetch referral notes error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
