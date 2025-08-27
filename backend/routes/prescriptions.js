const express = require('express');
const router = express.Router();
const jwt = require("jsonwebtoken");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");
const Prescription = require("../models/Prescription");

// Add or update a prescription for an appointment
router.post("/save", async (req, res) => {
  try {
    const { token, appointmentId, prescriptions } = req.body;
    if (!token || !appointmentId || !Array.isArray(prescriptions)) {
      return res.status(400).json({ error: "Missing required fields or invalid data format." });
    }

    // Verify doctor's token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const doctor = await Doctor.findById(decoded.id);
    if (!doctor) return res.status(404).json({ error: "Doctor not found." });

    // Find the appointment to link the prescription to
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment || !appointment.doctor.equals(doctor._id)) {
      return res.status(403).json({ error: "Appointment not found or you do not have permission." });
    }

    // Use findOneAndUpdate with 'upsert' to create a new prescription or update if it exists
    const updatedPrescription = await Prescription.findOneAndUpdate(
      { appointment: appointmentId },
      { 
        appointment: appointmentId,
        patient: appointment.user,
        doctor: doctor._id,
        prescriptions: prescriptions 
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, prescription: updatedPrescription });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error while saving prescription." });
  }
});

// Get prescriptions for a specific appointment
router.get("/:appointmentId", async (req, res) => {
  try {
    const { token } = req.query;
    const { appointmentId } = req.params;
    if (!token) return res.status(400).json({ error: "Missing token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // You can add logic here to verify if the user or doctor has access

    const prescription = await Prescription.findOne({ appointment: appointmentId });
    if (!prescription) {
      // Return an empty array if no prescription exists yet for this appointment
      return res.json({ prescriptions: [] });
    }

    res.json({ prescriptions: prescription.prescriptions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error while fetching prescriptions." });
  }
});

// Get the most recent prescription for a patient to carry over
router.get("/latest/:patientId", async (req, res) => {
  try {
    const { token } = req.query;
    const { patientId } = req.params;
    if (!token) return res.status(400).json({ error: "Missing token" });

    // Verify token (doctor should be able to access this)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'doctor') return res.status(403).json({ error: "Unauthorized access." });

    const latestPrescription = await Prescription.findOne({ patient: patientId })
      .sort({ createdAt: -1 }); // Get the most recent one

    if (!latestPrescription) {
      return res.json({ prescriptions: [] }); // No previous prescriptions found
    }

    res.json({ prescriptions: latestPrescription.prescriptions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error while fetching latest prescription." });
  }
});

module.exports = router;
