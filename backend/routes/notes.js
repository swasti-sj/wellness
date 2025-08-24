const express = require('express');
const router = express.Router();
const jwt = require("jsonwebtoken");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");
const Note = require("../models/Note");

// Add a note to an appointment
router.post("/add", async (req, res) => {
  try {
    const { token, appointmentId, text } = req.body;
    if (!token) return res.status(400).json({ error: "Missing token" });
    if (!appointmentId || !text) return res.status(400).json({ error: "Missing appointmentId or note text" });

    // Verify doctor
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const doctor = await Doctor.findById(decoded.id);
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    // Verify appointment belongs to this doctor
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });
    if (!appointment.doctor.equals(doctor._id)) {
      return res.status(403).json({ error: "Appointment does not belong to this doctor" });
    }

    // Save note
    const note = new Note({
      appointment: appointment._id,
      text
    });
    await note.save();

    res.json({ success: true, note });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get notes for a specific appointment
router.get("/:appointmentId", async (req, res) => {
  try {
    const { token } = req.query;
    const { appointmentId } = req.params;
    if (!token) return res.status(400).json({ error: "Missing token" });

    // Verify doctor
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const doctor = await Doctor.findById(decoded.id);
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    // Verify appointment belongs to this doctor
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });
    if (!appointment.doctor.equals(doctor._id)) {
      return res.status(403).json({ error: "Appointment does not belong to this doctor" });
    }

    // Get notes
    const notes = await Note.find({ appointment: appointment._id }).sort({ createdAt: -1 });
    res.json({ notes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
