const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Test = require('../models/Test');
const multer = require('multer');
const { logActivity, getClientIp } = require('../utils/audit');
const { uploadAndCompressImage, uploadAndCompressDocumentImage, uploadDocument, compressImageToDataUri, bufferToDataUri, deleteImage, extractPublicId } = require('../utils/cloudinary');

// Configure multer for memory storage (we'll upload to Cloudinary)
const storage = multer.memoryStorage();
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

    const debugFiles = {
      filesReceived: Object.keys(req.files || {}).reduce((acc, k) => {
        const arr = req.files?.[k] || [];
        acc[k] = arr.map(f => ({
          originalname: f.originalname,
          mimetype: f.mimetype,
          size: f.size,
        }));
        return acc;
      }, {}),
      bodyHasKeys: Object.keys(req.body || {}).reduce((acc, k) => {
        acc[k] = typeof req.body[k] === 'string' ? true : req.body[k] !== undefined;
        return acc;
      }, {}),
    };

    // Log what multer actually received (helps debug '200 but nothing uploaded')
    console.log('[Upload Debug][/api/tests/save] debugFiles=', JSON.stringify(debugFiles));

    const certificateImage = req.files?.certificateImage?.[0];
    const labTestDocument = req.files?.labTestDocument?.[0];
    const cashlessFormDocument = req.files?.cashlessFormDocument?.[0];

    // The user can choose how small the stored document should be. Lab test
    // and cashless form documents default to 100KB max (like prescriptions);
    // certificates default to a higher 300KB max since they may contain
    // finer detail such as signatures or stamps.
    let documentTargetSizeKB = parseInt(req.body.targetSizeKB, 10);
    if (!Number.isFinite(documentTargetSizeKB)) documentTargetSizeKB = 100;
    documentTargetSizeKB = Math.min(Math.max(documentTargetSizeKB, 10), 100);

    let certificateTargetSizeKB = parseInt(req.body.certificateTargetSizeKB, 10);
    if (!Number.isFinite(certificateTargetSizeKB)) certificateTargetSizeKB = 300;
    certificateTargetSizeKB = Math.min(Math.max(certificateTargetSizeKB, 10), 300);

    // Upload files
    try {
      if (certificateImage) {
        // INTERIM: storing directly in MongoDB until Cloudinary/disk storage is
        // configured. To switch to Cloudinary later, replace this block with
        // the uploadAndCompressImage(...) call that is already imported above.
        certificate.imageUrl = await compressImageToDataUri(certificateImage.buffer, { targetSizeKB: certificateTargetSizeKB });
        certificate.publicId = '';
      } else if (req.body.existingImageUrl) {
        certificate.imageUrl = req.body.existingImageUrl;
        if (req.body.existingImagePublicId) {
          certificate.publicId = req.body.existingImagePublicId;
        }
      }

      if (labTestDocument) {
        // INTERIM: storing directly in MongoDB until Cloudinary/disk storage is configured.
        if (labTestDocument.mimetype.startsWith('image/')) {
          req.body.labTestDocumentUrl = await compressImageToDataUri(labTestDocument.buffer, { targetSizeKB: documentTargetSizeKB });
        } else {
          req.body.labTestDocumentUrl = bufferToDataUri(labTestDocument.buffer, labTestDocument.mimetype);
        }
        req.body.labTestDocumentPublicId = '';
      } else if (req.body.existingLabTestDocumentUrl) {
        req.body.labTestDocumentUrl = req.body.existingLabTestDocumentUrl;
        if (req.body.existingLabTestDocumentPublicId) {
          req.body.labTestDocumentPublicId = req.body.existingLabTestDocumentPublicId;
        }
      }

      if (cashlessFormDocument) {
        // INTERIM: storing directly in MongoDB until Cloudinary/disk storage is configured.
        if (cashlessFormDocument.mimetype.startsWith('image/')) {
          hospitalReferral.cashlessFormDocumentUrl = await compressImageToDataUri(cashlessFormDocument.buffer, { targetSizeKB: documentTargetSizeKB });
        } else {
          hospitalReferral.cashlessFormDocumentUrl = bufferToDataUri(cashlessFormDocument.buffer, cashlessFormDocument.mimetype);
        }
        hospitalReferral.cashlessFormDocumentPublicId = '';
      } else if (req.body.existingCashlessFormDocumentUrl) {
        hospitalReferral.cashlessFormDocumentUrl = req.body.existingCashlessFormDocumentUrl;
        if (req.body.existingCashlessFormDocumentPublicId) {
          hospitalReferral.cashlessFormDocumentPublicId = req.body.existingCashlessFormDocumentPublicId;
        }
      }
    } catch (uploadErr) {
      console.error('File storage error:', uploadErr.message);
      return res.status(500).json({ error: `File upload failed: ${uploadErr.message}` });
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

    res.json({ success: true, test: updatedTest, uploadDebug: debugFiles });
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