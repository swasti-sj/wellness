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
    req.headers.authorization?.split(" ")[1] ||
    req.body?.token ||
    req.query?.token;

  if (!token) return res.status(400).json({ error: "Missing token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "doctor" && decoded.role !== "nurse") return res.status(403).json({ error: "Access denied. Only doctors and nurses can access referrals." });
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
      reason,
      status: 'pending' // NEW: default status
    });

    await referral.save();
    res.json({ success: true, referral });
  } catch (err) {
    console.error('Referral creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------
// Get referrals for a single patient
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

// ------------------------------
// Get all incoming referrals (toDoctor)
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
      createdAt: r.createdAt,
      read: r.read || false,
      status: r.status || 'pending',           // NEW
      responseNote: r.responseNote || ''        // NEW
    }));

    res.json({ success: true, notes });
  } catch (err) {
    console.error("Fetch incoming referral notes error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------
// Get all sent referrals (fromDoctor)
// ------------------------------
router.get('/mine', verifyDoctor, async (req, res) => {
  try {
    const referrals = await Referral.find({ fromDoctor: req.doctorId })
      .populate('patient', 'name email')
      .populate('toDoctor', 'name email specialization')
      .sort({ createdAt: -1 });

    const notes = referrals.map(r => ({
      _id: r._id,
      patient: r.patient ? { name: r.patient.name, email: r.patient.email } : { name: "Unknown", email: "" },
      referredTo: r.toDoctor ? { name: r.toDoctor.name, specialization: r.toDoctor.specialization } : { name: "Unknown", specialization: "" },
      text: r.reason || "No reason provided",
      createdAt: r.createdAt,
      status: r.status || 'pending',           // NEW
      responseNote: r.responseNote || ''        // NEW
    }));

    res.json({ success: true, notes });
  } catch (err) {
    console.error("Fetch own referral notes error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------
// Mark referral as read (existing)
// ------------------------------
router.patch('/:id/read', verifyDoctor, async (req, res) => {
  try {
    const { id } = req.params;
    const referral = await Referral.findById(id);

    if (!referral) return res.status(404).json({ error: 'Referral not found' });
    if (referral.toDoctor.toString() !== req.doctorId)
      return res.status(403).json({ error: 'Access denied' });

    referral.read = true;
    referral.status = referral.status === 'pending' ? 'viewed' : referral.status;
    referral.viewedAt = new Date();
    await referral.save();

    res.json({ success: true, message: 'Referral marked as read' });
  } catch (err) {
    console.error("Error marking referral as read:", err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------
// NEW: Accept a referral
// ------------------------------
router.patch('/:id/accept', verifyDoctor, async (req, res) => {
  try {
    const { id } = req.params;
    const { responseNote } = req.body;

    const referral = await Referral.findById(id);
    if (!referral) return res.status(404).json({ error: 'Referral not found' });
    if (referral.toDoctor.toString() !== req.doctorId)
      return res.status(403).json({ error: 'Access denied' });

    referral.status = 'accepted';
    referral.read = true;
    referral.responseNote = responseNote || '';
    referral.respondedAt = new Date();
    await referral.save();

    res.json({ success: true, message: 'Referral accepted' });
  } catch (err) {
    console.error("Error accepting referral:", err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------
// NEW: Reject a referral
// ------------------------------
router.patch('/:id/reject', verifyDoctor, async (req, res) => {
  try {
    const { id } = req.params;
    const { responseNote } = req.body;

    const referral = await Referral.findById(id);
    if (!referral) return res.status(404).json({ error: 'Referral not found' });
    if (referral.toDoctor.toString() !== req.doctorId)
      return res.status(403).json({ error: 'Access denied' });

    referral.status = 'rejected';
    referral.read = true;
    referral.responseNote = responseNote || '';
    referral.respondedAt = new Date();
    await referral.save();

    res.json({ success: true, message: 'Referral rejected' });
  } catch (err) {
    console.error("Error rejecting referral:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;