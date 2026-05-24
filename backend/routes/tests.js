const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Test = require('../models/Test');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { logActivity, getClientIp } = require('../utils/audit');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const fieldDirMap = {
      certificateImage: path.join('backend', 'uploads', 'certificates'),
      labTestDocument: path.join('backend', 'uploads', 'lab-tests'),
      cashlessFormDocument: path.join('backend', 'uploads', 'cashless-forms')
    };
    const uploadDir = fieldDirMap[file.fieldname] || path.join('backend', 'uploads', 'misc');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const allowedMimeTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf'
];

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Only JPG, PNG, GIF, WEBP, and PDF files are allowed!'));
  }
});

// Test categories and their tests (static data)
const TEST_CATEGORIES = {
  'Routine Investigations in Blood': [
    'ADA (Adenosine Deaminase)',
    'Alkaline Phosphatase',
    'Albumin',
    'Ammonia',
    'Amylase',
    'AG Ratio',
    'Bicarbonate',
    'Bilirubin Total',
    'Bilirubin Direct',
    'Blood Gas Analysis Arterial (ABG)',
    'Blood Gas Analysis Venous (VBG)',
    'Calcium Total',
    'Calcium (Ionised)',
    'Chloride',
    'Cholesterol Total',
    'Cholesterol (HDL)',
    'Cholesterol (LDL)',
    'Creatinine',
    'CK (CPK)',
    'CK-MB',
    'GFR',
    'Electrolytes (Na, K, CO2)',
    'GGT (Gamma Glutamyl Transferase)',
    'Globulin',
    'Glucose Fasting',
    'Glucose PP (Post Prandial)',
    'Glucose Random',
    'GTT (Glucose Tolerance Test)',
    'Glycosylated Hb (HbA1C)',
    'High sensitive CRP (hsCRP)',
    'Homocysteine',
    'Iron',
    'Lactate (Lactic Acid)',
    'LDH (Lactate Dehydrogenase)',
    'Lipase',
    'Magnesium',
    'Osmolality (Serum)',
    'Phosphorus',
    'Total Protein',
    'Pseudocholinesterase',
    'SGOT (AST)',
    'SGPT (ALT)',
    'Sodium',
    'TIBC',
    'Urea',
    'Uric Acid'
  ],
  'Immunoassay': [
    'AFP (Alfa Feto Protein)',
    'AMH (Anti Mullerian Hormone)',
    'ANCA CCP',
    'Anti TPO antibodies',
    'Beta HCG (Total)',
    'CA-125',
    'CA 19-9',
    'CEA',
    'Cortisol',
    'Estradiol (E2)/Estrogen',
    'Ferritin',
    'Folate (Folic acid)',
    'Free T3',
    'Free T4',
    'FSH',
    'PTH (intact)',
    'LH',
    'Procalcitonin',
    'Progesterone (P4)',
    'Prolactin',
    'PSA Total',
    'Testosterone',
    'Troponin-t hs (high sensitive Trop T)',
    'TSH',
    'Vitamin D (Total 250H Vitamin D3)',
    'Vitamin B12'
  ],
  'Routine Investigations in Urine and Other Body Fluids': [
    'Random/Spot Urine',
    '24hrs Urine',
    'Urine Fhedss',
    'Fluid Protein',
    'Urine Microalbumin',
    'Urine Sodium',
    'CSF Sugar',
    'CSF Protein',
    'Fluid Albumin',
    'Urine Potassium',
    'Urine Uric acid',
    'Fluid Amylase',
    'Urine Osmolality',
    'Urine Albumin',
    'Urine Calcium',
    'Urine Protein',
    'CSF Chloride',
    'Fluid Lipase',
    'Urine Phosphorus',
    'CSF ADA',
    'CSF Lactate',
    'Creatinine Ratio (ACR)',
    'Urine Creatinine',
    'Fluid Creatinine',
    'Urine Chloride',
    'Urine Liraa'
  ],
  'Special Tests': [
    'Hemoglobin Variant screening by HPLC method',
    'Osmotic Fragility test',
    'Protein Electrophoresis',
    'Urinary Bence Jones Protein',
    'Urine Screening for EM',
    'Stone Analysis',
    'Urine Protein',
    'Urine Urea',
    'CSF Albumin',
    'Fluid Ursa',
    'Protein Creatinine Ratio (PCR)',
    'Urine Uric acid',
    'CSF LDH',
    'Fluid Triglycerides',
    'Fluid CA19-9',
    'Fluid AFP'
  ],
  'Profiles': [
    'Diabetic Profile',
    'Lipid Profile',
    'Renal Profile',
    'Liver Profile',
    'Acute Cardiac Profile',
    'Hypertension Profile',
    'CVD Risk assessment profile',
    'PIH Profile',
    'Pre-chemo workup',
    'Iron Profile',
    'Prostatic Profile',
    'Thyroid Profile',
    'Fertility Profile'
  ]
};

// Get test categories (static data)
router.get('/categories', (req, res) => {
  const categories = Object.keys(TEST_CATEGORIES).map(category => ({
    name: category,
    tests: TEST_CATEGORIES[category].map(test => ({ name: test, selected: false }))
  }));
  res.json({ categories });
});

// Save or update tests for an appointment
router.post('/save', upload.fields([
  { name: 'certificateImage', maxCount: 1 },
  { name: 'labTestDocument', maxCount: 1 },
  { name: 'cashlessFormDocument', maxCount: 1 }
]), async (req, res) => {
  try {
    const { token, appointmentId } = req.body;

    let tests = [];
    if (req.body.tests) {
      tests = typeof req.body.tests === 'string' ? JSON.parse(req.body.tests) : req.body.tests;
    }

    let hospitalReferral = { refer: false };
    if (req.body.hospitalReferral) {
      hospitalReferral = typeof req.body.hospitalReferral === 'string' ? JSON.parse(req.body.hospitalReferral) : req.body.hospitalReferral;
    }

    let certificate = { issued: false };
    if (req.body.certificate) {
      const parsedCert = typeof req.body.certificate === 'string' ? JSON.parse(req.body.certificate) : req.body.certificate;
      certificate = { ...certificate, ...parsedCert };
    }

    const certificateImage = req.files?.certificateImage?.[0];
    const labTestDocument = req.files?.labTestDocument?.[0];
    const cashlessFormDocument = req.files?.cashlessFormDocument?.[0];

    if (certificateImage) {
      certificate.imageUrl = `/uploads/certificates/${certificateImage.filename}`;
    } else if (req.body.existingImageUrl) {
      certificate.imageUrl = req.body.existingImageUrl;
    }

    if (labTestDocument) {
      req.body.labTestDocumentUrl = `/uploads/lab-tests/${labTestDocument.filename}`;
    }

    if (cashlessFormDocument) {
      hospitalReferral.cashlessFormDocumentUrl = `/uploads/cashless-forms/${cashlessFormDocument.filename}`;
    } else if (req.body.existingCashlessFormDocumentUrl) {
      hospitalReferral.cashlessFormDocumentUrl = req.body.existingCashlessFormDocumentUrl;
    }

    if (typeof req.body.existingLabTestDocumentUrl === 'string' && !req.body.labTestDocumentUrl) {
      req.body.labTestDocumentUrl = req.body.existingLabTestDocumentUrl;
    }

    if (!token || !appointmentId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify doctor or nurse token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let doctorId = null;

    if (decoded.role === "doctor") {
      const doctor = await Doctor.findById(decoded.id);
      if (!doctor) return res.status(404).json({ error: "Doctor not found." });
      doctorId = doctor._id;
    } else if (decoded.role === "nurse") {
      const Nurse = require("../models/Nurse");
      const nurse = await Nurse.findById(decoded.id);
      if (!nurse) return res.status(404).json({ error: "Nurse not found." });
      // For nurse, get the doctor from the appointment
    } else {
      return res.status(403).json({ error: "Only doctors and nurses can save tests" });
    }

    // Find the appointment
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(403).json({ error: "Appointment not found." });
    }

    // If doctor is saving, verify they own the appointment
    if (decoded.role === "doctor" && !appointment.doctor.equals(doctorId)) {
      return res.status(403).json({ error: "You do not have permission to save tests for this appointment." });
    }

    // Use findOneAndUpdate with upsert
    const updatedTest = await Test.findOneAndUpdate(
      { appointment: appointmentId },
      {
        appointment: appointmentId,
        patient: appointment.user,
        doctor: doctorId || appointment.doctor,
        tests: tests || [],
        labTestDocumentUrl: req.body.labTestDocumentUrl || '',
        hospitalReferral: hospitalReferral || { refer: false },
        certificate: certificate || { issued: false }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Audit: Tests saved/updated (only if tests list has content)
    if ((tests || []).length > 0) {
      try {
        await logActivity({
          userId: decoded.id,
          userName: decoded.name || decoded.email || '',
          userEmail: decoded.email || '',
          role: decoded.role,
          sessionId: decoded.sessionId || null,
          module: 'Tests',
          action: 'SAVE_TESTS',
          description: `Saved/Updated tests for appointment ${appointmentId}`,
          severity: 'AUDIT',
          ipAddress: getClientIp(req),
          details: { appointmentId, testId: updatedTest._id, testsCount: (tests || []).length }
        });
      } catch (auditErr) {
        console.warn('Failed to write tests audit log:', auditErr.message);
      }
    }

    res.json({ success: true, test: updatedTest });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while saving tests.' });
  }
});

// Get tests for a specific appointment
router.get('/:appointmentId', async (req, res) => {
  try {
    const { token } = req.query;
    const { appointmentId } = req.params;
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const test = await Test.findOne({ appointment: appointmentId });
    if (!test) {
      return res.json({
        tests: [],
        hospitalReferral: { refer: false },
        certificate: { issued: false }
      });
    }

    res.json({
      tests: test.tests,
      labTestDocumentUrl: test.labTestDocumentUrl || '',
      hospitalReferral: test.hospitalReferral,
      certificate: test.certificate
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while fetching tests.' });
  }
});

module.exports = router;
module.exports.TEST_CATEGORIES = TEST_CATEGORIES;