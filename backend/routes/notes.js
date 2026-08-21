const express = require('express');
const router = express.Router();
const jwt = require("jsonwebtoken");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");
const Note = require("../models/Note");
const multer = require('multer');
const { logActivity, getClientIp } = require('../utils/audit');
const { deleteImage, extractPublicId } = require('../utils/cloudinary');
const { saveCompressedImageToDisk, deleteFileFromDisk } = require('../utils/diskStorage');

// Configure multer for memory storage (we'll upload to Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Only image files (JPG, PNG, GIF, WEBP) are allowed!'));
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
      console.log(`[Notes] Compressing and storing ${req.files.length} file(s)...`);
      console.log('[Notes] Files:', req.files.map(f => ({ name: f.originalname, size: f.size })));
      try {
        // Compressed and written to the institute-allocated disk storage;
        // only the returned URL is saved in MongoDB (not the image itself).
        const saved = await Promise.all(
          req.files.map((f) => saveCompressedImageToDisk(f.buffer, 'wellness/notes', f.originalname))
        );

        const newImages = saved.map(({ url }) => ({
          url,
          publicId: '',
          caption: req.body.caption || '',
          uploadedAt: new Date(),
          format: 'webp'
        }));

        note.images = [...(note.images || []), ...newImages];
        await note.save();

        // Audit: Images added to note
        try {
          await logActivity({
            userId: decoded.id,
            userName: decoded.name || decoded.email || '',
            userEmail: decoded.email || '',
            role: decoded.role,
            sessionId: decoded.sessionId || null,
            module: 'Note',
            action: 'ADD_IMAGES_TO_NOTE',
            description: `Added ${newImages.length} image(s) to note ${noteId}`,
            severity: 'AUDIT',
            ipAddress: getClientIp(req),
            details: { noteId, appointmentId: appointment._id, imageCount: newImages.length }
          });
        } catch (auditErr) {
          console.warn('Failed to write image audit log:', auditErr.message);
        }

        res.json({ success: true, note, message: `${newImages.length} image(s) uploaded and compressed successfully` });
      } catch (uploadErr) {
        console.error('[Notes] Image storage error:', uploadErr.message);
        console.error('[Notes] Error stack:', uploadErr.stack);
        res.status(500).json({ error: `Failed to store images: ${uploadErr.message}` });
      }
    } else {
      res.status(400).json({ error: "No images provided" });
    }
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
      const imageToDelete = note.images[index];
      
      // Delete the underlying file: disk-stored images (url starts with
      // /uploads/) or, for older records, Cloudinary ones (have a publicId).
      if (imageToDelete.url && imageToDelete.url.startsWith('/uploads/')) {
        await deleteFileFromDisk(imageToDelete.url);
      } else if (imageToDelete.publicId) {
        try {
          await deleteImage(imageToDelete.publicId);
          console.log('Image deleted from Cloudinary:', imageToDelete.publicId);
        } catch (deleteErr) {
          console.warn('Failed to delete from Cloudinary:', deleteErr.message);
          // Continue anyway - database removal will still happen
        }
      }

      note.images.splice(index, 1);
      await note.save();

      // Audit: Image deleted
      try {
        await logActivity({
          userId: decoded.id,
          userName: decoded.name || decoded.email || '',
          userEmail: decoded.email || '',
          role: decoded.role,
          sessionId: decoded.sessionId || null,
          module: 'Note',
          action: 'DELETE_IMAGE_FROM_NOTE',
          description: `Deleted image from note ${noteId}`,
          severity: 'AUDIT',
          ipAddress: getClientIp(req),
          details: { noteId, appointmentId: appointment._id }
        });
      } catch (auditErr) {
        console.warn('Failed to write image deletion audit log:', auditErr.message);
      }
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

    // Delete associated image files: disk-stored (url starts with /uploads/)
    // or, for older records, Cloudinary ones (have a publicId).
    if (note.images && note.images.length > 0) {
      const deletePromises = note.images.map(image => {
        if (image.url && image.url.startsWith('/uploads/')) {
          return deleteFileFromDisk(image.url);
        } else if (image.publicId) {
          return deleteImage(image.publicId).catch(err => {
            console.warn('Failed to delete image from Cloudinary:', err.message);
          });
        }
      });
      try {
        await Promise.all(deletePromises);
      } catch (deleteErr) {
        console.warn('Error deleting note image files:', deleteErr.message);
        // Continue anyway - database deletion will still happen
      }
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

    res.json({ success: true, message: "Note and associated images deleted successfully" });
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