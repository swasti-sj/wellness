const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Pharmacist = require('../models/Pharmacist');
const MedicineIssuance = require('../models/MedicineIssuance');

// Pharmacist auth middleware
const verifyPharmacist = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const pharmacist = await Pharmacist.findById(decoded.id);
    if (!pharmacist) return res.status(404).json({ error: 'Pharmacist not found' });

    req.pharmacist = pharmacist;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// GET /api/issuances - List issuance records
router.get('/', verifyPharmacist, async (req, res) => {
  try {
    const issuances = await MedicineIssuance.find()
.populate('patient', 'name email')
      .populate('doctor', 'name email')
      .populate('medicine', 'name stockCount expiryDate')
      .sort({ issuedDate: -1 })
      .limit(50)
      .lean();

    res.json({ issuances });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching issuances' });
  }
});

module.exports = router;

