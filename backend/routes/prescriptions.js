const express = require('express');
const router = express.Router();
const jwt = require("jsonwebtoken");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");
const Prescription = require("../models/Prescription");
const Medicine = require("../models/Medicine");
const MedicineIssuance = require("../models/MedicineIssuance");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const prescriptionStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join("backend", "uploads", "prescriptions");
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
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf"
];

const upload = multer({
  storage: prescriptionStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error("Only JPG, PNG, WEBP, and PDF files are allowed."));
  }
});

// Add or update a prescription for an appointment
router.post("/save", upload.single("prescriptionDocument"), async (req, res) => {
  try {
    const { token, appointmentId, bookNo = "", prescriptionNo = "", existingDocumentUrl = "" } = req.body;
    const prescriptions = req.body.prescriptions
      ? (typeof req.body.prescriptions === "string" ? JSON.parse(req.body.prescriptions) : req.body.prescriptions)
      : null;

    if (!token || !appointmentId || !Array.isArray(prescriptions)) {
      return res.status(400).json({ error: "Missing required fields or invalid data format." });
    }

    // Verify user is either doctor or nurse
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "doctor" && decoded.role !== "nurse") {
      return res.status(403).json({ error: "Only doctors and nurses can save prescriptions" });
    }

    // Find the appointment
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(403).json({ error: "Appointment not found." });
    }

    // If doctor is adding prescription, verify they own the appointment
    if (decoded.role === "doctor" && !appointment.doctor.equals(decoded.id)) {
      return res.status(403).json({ error: "You do not have permission to add prescription for this appointment." });
    }

    // New stock management logic for medicines with medicine ID
    for (const p of prescriptions) {
      if (p.medicine) {
        const med = await Medicine.findById(p.medicine);
        if (!med) {
          return res.status(400).json({ error: `Medicine not found: ${p.medication}` });
        }
        if (med.stockCount < p.quantity) {
          return res.status(400).json({ error: `Insufficient stock for ${med.name}. Available: ${med.stockCount}, required: ${p.quantity}` });
        }
        // Deduct stock
        med.stockCount -= p.quantity;
        await med.save();

        // Log issuance
        await new MedicineIssuance({
          patient: appointment.user,
          medicine: p.medicine,
          quantityIssued: p.quantity,
          doctor: decoded.role === "doctor" ? decoded.id : appointment.doctor
        }).save();
      }
    }

    // Use findOneAndUpdate with 'upsert' to create a new prescription or update if it exists
    const updatedPrescription = await Prescription.findOneAndUpdate(
      { appointment: appointmentId },
      {
        appointment: appointmentId,
        patient: appointment.user,
        doctor: decoded.role === "doctor" ? decoded.id : appointment.doctor,
        prescriptions: prescriptions,
        bookNo,
        prescriptionNo,
        documentUrl: req.file
          ? `/uploads/prescriptions/${req.file.filename}`
          : existingDocumentUrl
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, prescription: updatedPrescription });
  } catch (err) {
    console.error("❌ Prescription save error:", err.message, err.stack);
    res.status(500).json({ error: `Server error: ${err.message}` });
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

    res.json({
      prescriptions: prescription.prescriptions,
      documentUrl: prescription.documentUrl || "",
      bookNo: prescription.bookNo || "",
      prescriptionNo: prescription.prescriptionNo || ""
    });
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
    if (decoded.role !== 'doctor' && decoded.role !== 'nurse') return res.status(403).json({ error: "Unauthorized access. Only doctors and nurses can access prescriptions." });

    const latestPrescription = await Prescription.findOne({ patient: patientId })
      .sort({ createdAt: -1 }); // Get the most recent one

    if (!latestPrescription) {
      return res.json({ prescriptions: [] }); // No previous prescriptions found
    }

    res.json({
      prescriptions: latestPrescription.prescriptions,
      documentUrl: latestPrescription.documentUrl || "",
      bookNo: latestPrescription.bookNo || "",
      prescriptionNo: latestPrescription.prescriptionNo || ""
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error while fetching latest prescription." });
  }
});

module.exports = router;
