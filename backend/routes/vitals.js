const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Vital = require('../models/Vital');
const Doctor = require('../models/Doctor');

// =============================
// GET VITALS BY APPOINTMENT
// =============================
router.get("/:appointmentId", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.JWT_SECRET);

    const { appointmentId } = req.params;

    const vital = await Vital.findOne({ appointment: appointmentId });

    if (!vital) {
      return res.status(404).json({ error: "No vitals found" });
    }

    res.json({ success: true, vital });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// =============================
// CREATE / UPDATE VITALS
// =============================
router.post("/save", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const doctor = await Doctor.findById(decoded.id);
    if (!doctor) {
      return res.status(401).json({ error: "Unauthorized doctor" });
    }

    const { appointmentId, patientId, ...caseData } = req.body;

    if (!appointmentId || !patientId) {
      return res.status(400).json({ error: "Missing appointment or patient" });
    }

    let vital = await Vital.findOne({ appointment: appointmentId });

    if (!vital) {
      vital = new Vital({
        appointment: appointmentId,
        patient: patientId,
      });
    }

    Object.assign(vital, caseData);

    // Auto BMI calculation
    if (vital.weight && vital.height) {
      const heightInMeters = vital.height / 100;
      vital.bmi = (
        vital.weight /
        (heightInMeters * heightInMeters)
      ).toFixed(2);
    }

    await vital.save();

    res.json({ success: true, vital });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;