const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Vital = require('../models/Vital');
const Doctor = require('../models/Doctor');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const createStorage = (folder) => multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join('backend', 'uploads', folder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}${path.extname(file.originalname)}`);
  }
});

const allowedMimeTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf'
];

const upload = multer({
  storage: createStorage('case-sheets'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Only JPG, PNG, WEBP, and PDF files are allowed.'));
  }
});

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
router.post("/save", upload.single("caseSheetDocument"), async (req, res) => {
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

    const { appointmentId, patientId, existingCaseSheetDocumentUrl, ...caseData } = req.body;

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

    if (req.file) {
      vital.caseSheetDocumentUrl = `/uploads/case-sheets/${req.file.filename}`;
    } else if (typeof existingCaseSheetDocumentUrl === "string") {
      vital.caseSheetDocumentUrl = existingCaseSheetDocumentUrl;
    }

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
