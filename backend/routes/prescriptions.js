const express = require('express');
const router = express.Router();
const jwt = require("jsonwebtoken");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");
const Prescription = require("../models/Prescription");
const Medicine = require("../models/Medicine");
const MedicineIssuance = require("../models/MedicineIssuance");
const multer = require("multer");
const { logActivity, getClientIp } = require('../utils/audit');
const { uploadDocument, uploadAndCompressDocumentImage, compressImageToDataUri, bufferToDataUri, deleteImage } = require('../utils/cloudinary');

// Configure multer for memory storage (we'll upload to Cloudinary)
const prescriptionStorage = multer.memoryStorage();

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

    // Stock management: only deduct if source === 'INHOUSE'. EXTERNAL = logged only.
    for (const p of prescriptions) {
      if (p.medicine) {
        const source = p.source || 'INHOUSE'; // default to INHOUSE for backward compat
        const med = await Medicine.findById(p.medicine);
        if (!med) {
          return res.status(400).json({ error: `Medicine not found: ${p.medication}` });
        }

        if (source === 'INHOUSE') {
          // Check stock availability
          if (med.stockCount < p.quantity) {
            return res.status(400).json({
              error: `Insufficient stock for ${med.name}. Available: ${med.stockCount}, required: ${p.quantity}`
            });
          }
          // Deduct stock
          med.stockCount -= p.quantity;
          await med.save();
        }
        // EXTERNAL: no stock check, no deduction

        // Always log issuance for audit (source field distinguishes INHOUSE vs EXTERNAL)
        await new MedicineIssuance({
          patient: appointment.user,
          medicine: p.medicine,
          quantityIssued: p.quantity,
          doctor: decoded.role === 'doctor' ? decoded.id : appointment.doctor,
          source: source,
          notes: source === 'EXTERNAL'
            ? `[EXTERNAL] Prescribed — patient obtains from external pharmacy`
            : `[INHOUSE] Dispensed from college stock via prescription`
        }).save();

        // Audit log
        try {
          const medName = med.name || p.medication || 'Medicine';
          await logActivity({
            userId: decoded.id,
            userName: decoded.name || decoded.email || '',
            userEmail: decoded.email || '',
            role: decoded.role,
            sessionId: decoded.sessionId || null,
            module: 'Medicine',
            action: 'ISSUE_MEDICINE',
            description: `[${source}] Issued ${p.quantity} × ${medName} to patient (Appointment: ${appointment._id})`,
            severity: 'AUDIT',
            ipAddress: getClientIp(req),
            details: { medicineId: p.medicine, patientId: appointment.user, quantity: p.quantity, source }
          });
        } catch (auditErr) {
          console.warn('Failed to write medicine issuance audit log:', auditErr.message);
        }
      }
    }

    // Use findOneAndUpdate with 'upsert' to create a new prescription or update if it exists
    let documentUrl = existingDocumentUrl;
    let documentPublicId = null;

    if (req.file) {
      try {
        // The user can choose how small the stored file should be (10-100 KB).
        // A lower target means smaller storage footprint but may reduce
        // readability of fine handwriting; a higher target keeps more detail.
        let targetSizeKB = parseInt(req.body.targetSizeKB, 10);
        if (!Number.isFinite(targetSizeKB)) targetSizeKB = 100;
        targetSizeKB = Math.min(Math.max(targetSizeKB, 10), 100);

        // INTERIM: storing directly in MongoDB until Cloudinary/disk storage is configured.
        // To switch to Cloudinary/disk storage later, swap these two lines for
        // uploadAndCompressDocumentImage / uploadDocument (already defined
        // and imported above, ready to use).
        if (req.file.mimetype.startsWith('image/')) {
          documentUrl = await compressImageToDataUri(req.file.buffer, { targetSizeKB });
        } else {
          documentUrl = bufferToDataUri(req.file.buffer, req.file.mimetype);
        }
        documentPublicId = '';
      } catch (uploadErr) {
        console.error('Document storage error:', uploadErr.message);
        return res.status(500).json({ error: `File storage failed: ${uploadErr.message}` });
      }
    }

    // Sanitize: an empty string in the `medicine` ObjectId field causes a
    // Mongoose CastError. This happens when a medication name was typed but
    // never selected from the dropdown (so no Medicine _id was attached).
    // The prescription text itself (name, dosage, frequency, notes) is still
    // saved — only the stock-linked `medicine` reference is omitted.
    const sanitizedPrescriptions = prescriptions.map((p) => {
      const item = { ...p };
      if (!item.medicine) {
        delete item.medicine;
      }
      return item;
    });

    const updatedPrescription = await Prescription.findOneAndUpdate(
      { appointment: appointmentId },
      {
        appointment: appointmentId,
        patient: appointment.user,
        doctor: decoded.role === "doctor" ? decoded.id : appointment.doctor,
        prescriptions: sanitizedPrescriptions,
        bookNo,
        prescriptionNo,
        documentUrl: documentUrl,
        documentPublicId: documentPublicId
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, prescription: updatedPrescription });
    // Audit: Prescription created/updated
    try {
      await logActivity({
        userId: decoded.id,
        userName: decoded.name || decoded.email || '',
        userEmail: decoded.email || '',
        role: decoded.role,
        sessionId: decoded.sessionId || null,
        module: 'Prescription',
        action: 'CREATE_OR_UPDATE_PRESCRIPTION',
        description: `Created/Updated prescription for patient (Appointment ID: ${appointmentId})`,
        severity: 'AUDIT',
        ipAddress: getClientIp(req),
        details: { appointmentId, prescriptionId: updatedPrescription._id }
      });
    } catch (auditErr) {
      console.warn('Failed to write prescription audit log:', auditErr.message);
    }
  } catch (err) {
    console.error("Prescription save error:", err.message, err.stack);
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