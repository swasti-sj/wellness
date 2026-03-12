const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Test = require('../models/Test');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'backend/uploads/certificates';
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
router.post('/save', upload.single('certificateImage'), async (req, res) => {
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
    
    if (req.file) {
      certificate.imageUrl = `/uploads/certificates/${req.file.filename}`;
    } else if (req.body.existingImageUrl) {
      certificate.imageUrl = req.body.existingImageUrl;
    }

    if (!token || !appointmentId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify doctor's token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const doctor = await Doctor.findById(decoded.id);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found.' });

    // Find the appointment
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment || !appointment.doctor.equals(doctor._id)) {
      return res.status(403).json({ error: 'Appointment not found or you do not have permission.' });
    }

    // Use findOneAndUpdate with upsert
    const updatedTest = await Test.findOneAndUpdate(
      { appointment: appointmentId },
      {
        appointment: appointmentId,
        patient: appointment.user,
        doctor: doctor._id,
        tests: tests || [],
        hospitalReferral: hospitalReferral || { refer: false },
        certificate: certificate || { issued: false }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

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
