const express = require('express');
const router = express.Router();
const jwt = require("jsonwebtoken");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");
const Note = require("../models/Note");
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { logActivity, getClientIp } = require('../utils/audit');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'backend/uploads/notes';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

// Add a note to an appointment
router.post("/add", async (req, res) => {
  try {
    const { token, appointmentId, text } = req.body;
    if (!token) return res.status(400).json({ error: "Missing token" });
    if (!appointmentId || !text) return res.status(400).json({ error: "Missing appointmentId or note text" });

    // Verify user is either doctor or nurse (just check role, not DB lookup)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "doctor" && decoded.role !== "nurse") {
      return res.status(403).json({ error: "Only doctors and nurses can add notes" });
    }

    // Verify appointment exists
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    // Save note
    const note = new Note({
      appointment: appointment._id,
      text
    });
    await note.save();

    // Audit: Note created
    try {
      await logActivity({
        userId: decoded.id,
        userName: decoded.name || decoded.email || '',
        userEmail: decoded.email || '',
        role: decoded.role,
        sessionId: decoded.sessionId || null,
        module: 'Note',
        action: 'CREATE_NOTE',
        description: `Created clinical note for appointment ${appointment._id}`,
        severity: 'AUDIT',
        ipAddress: getClientIp(req),
        details: { noteId: note._id, appointmentId: appointment._id }
      });
    } catch (auditErr) {
      console.warn('Failed to write note creation audit log:', auditErr.message);
    }

    res.json({ success: true, note });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Update an existing note
router.put("/:noteId", async (req, res) => {
  try {
    const { token, text } = req.body;
    const { noteId } = req.params;

    if (!token) return res.status(400).json({ error: "Missing token" });
    if (!text) return res.status(400).json({ error: "Note text is required" });

    // Verify user is either doctor or nurse
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "doctor" && decoded.role !== "nurse") {
      return res.status(403).json({ error: "Only doctors and nurses can update notes" });
    }

    // Find the note
    const note = await Note.findById(noteId);
    if (!note) return res.status(404).json({ error: "Note not found" });

    // Verify appointment exists (both doctor and nurse can edit)
    const appointment = await Appointment.findById(note.appointment);
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    // Update the note
    const beforeText = note.text;
    note.text = text;
    await note.save();

    // Audit: Note updated (only if text actually changed)
    if (beforeText !== text) {
      try {
        await logActivity({
          userId: decoded.id,
          userName: decoded.name || decoded.email || '',
          userEmail: decoded.email || '',
          role: decoded.role,
          sessionId: decoded.sessionId || null,
          module: 'Note',
          action: 'UPDATE_NOTE',
          description: `Updated clinical note for appointment ${appointment._id}`,
          severity: 'AUDIT',
          ipAddress: getClientIp(req),
          details: { noteId: note._id, appointmentId: appointment._id, beforeText: beforeText ? beforeText.substring(0, 200) : '', afterText: text ? text.substring(0, 200) : '' }
        });
      } catch (auditErr) {
        console.warn('Failed to write note update audit log:', auditErr.message);
      }
    }

    res.json({ success: true, note });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Add images to an existing note
router.post("/:noteId/images", upload.array('images', 5), async (req, res) => {
  try {
    const { token } = req.body;
    const { noteId } = req.params;

    if (!token) return res.status(400).json({ error: "Missing token" });

    // Verify user is either doctor or nurse
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "doctor" && decoded.role !== "nurse") {
      return res.status(403).json({ error: "Only doctors and nurses can add images to notes" });
    }

    // Find the note
    const note = await Note.findById(noteId);
    if (!note) return res.status(404).json({ error: "Note not found" });

    // Verify appointment exists (both doctor and nurse can edit)
    const appointment = await Appointment.findById(note.appointment);
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    // Process uploaded images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => ({
        url: `/uploads/notes/${file.filename}`,
        caption: req.body.caption || '',
        uploadedAt: new Date()
      }));

      note.images = [...(note.images || []), ...newImages];
      await note.save();
    }

    res.json({ success: true, note });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Delete an image from a note
router.delete("/:noteId/images/:imageIndex", async (req, res) => {
  try {
    const { token } = req.query;
    const { noteId, imageIndex } = req.params;

    if (!token) return res.status(400).json({ error: "Missing token" });

    // Verify user is either doctor or nurse
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "doctor" && decoded.role !== "nurse") {
      return res.status(403).json({ error: "Only doctors and nurses can delete images from notes" });
    }

    // Find the note
    const note = await Note.findById(noteId);
    if (!note) return res.status(404).json({ error: "Note not found" });

    // Verify appointment exists (both doctor and nurse can edit)
    const appointment = await Appointment.findById(note.appointment);
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    // Remove the image
    const index = parseInt(imageIndex);
    if (note.images && note.images[index]) {
      // Optionally delete the file from disk
      const imagePath = path.join(__dirname, '..', note.images[index].url);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
      note.images.splice(index, 1);
      await note.save();
    }

    res.json({ success: true, note });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a note
router.delete("/:noteId", async (req, res) => {
  try {
    const { token } = req.query;
    const { noteId } = req.params;

    if (!token) return res.status(400).json({ error: "Missing token" });

    // Verify user is either doctor or nurse
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "doctor" && decoded.role !== "nurse") {
      return res.status(403).json({ error: "Only doctors and nurses can delete notes" });
    }

    // Find the note
    const note = await Note.findById(noteId);
    if (!note) return res.status(404).json({ error: "Note not found" });

    // Verify appointment exists (both doctor and nurse can edit)
    const appointment = await Appointment.findById(note.appointment);
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    // Delete associated images from disk
    if (note.images && note.images.length > 0) {
      note.images.forEach(image => {
        const imagePath = path.join(__dirname, '..', image.url);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      });
    }

    await Note.findByIdAndDelete(noteId);

    // Audit: Note deleted
    try {
      await logActivity({
        userId: decoded.id,
        userName: decoded.name || decoded.email || '',
        userEmail: decoded.email || '',
        role: decoded.role,
        sessionId: decoded.sessionId || null,
        module: 'Note',
        action: 'DELETE_NOTE',
        description: `Deleted clinical note ${noteId} for appointment ${appointment._id}`,
        severity: 'AUDIT',
        ipAddress: getClientIp(req),
        details: { noteId, appointmentId: appointment._id }
      });
    } catch (auditErr) {
      console.warn('Failed to write note deletion audit log:', auditErr.message);
    }

    res.json({ success: true, message: "Note deleted successfully" });
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

    // Verify user is either doctor or nurse
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "doctor" && decoded.role !== "nurse") {
      return res.status(403).json({ error: "Only doctors and nurses can access notes" });
    }

    // For doctors, verify appointment belongs to them
    if (decoded.role === "doctor") {
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) return res.status(404).json({ error: "Appointment not found" });
      if (!appointment.doctor.equals(decoded.id)) {
        return res.status(403).json({ error: "Appointment does not belong to this doctor" });
      }
    } else if (decoded.role === "nurse") {
      // For nurses, just verify appointment exists
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) return res.status(404).json({ error: "Appointment not found" });
    }

    // Get notes
    const notes = await Note.find({ appointment: appointmentId }).sort({ createdAt: -1 });
    res.json({ notes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notes/patient/:patientId - MUST COME BEFORE THE GENERIC /:appointmentId ROUTE
router.get('/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const token = req.query.token;
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'doctor' && decoded.role !== 'nurse') return res.status(403).json({ error: 'Access denied. Only doctors and nurses can access notes.' });

    const notes = await Note.find({ appointment: { $in: await Appointment.find({ user: patientId }).select('_id') } })
      .populate('appointment', 'startDateTime endDateTime');

    res.json({ success: true, notes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;