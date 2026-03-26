const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Pharmacist = require('../models/Pharmacist');
const Medicine = require('../models/Medicine');

// Middleware to verify user token (allows all roles to READ medicines)
const verifyUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Store decoded token (id, email, role)
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware to verify pharmacist token (for WRITE operations)
const verifyPharmacist = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'pharmacist') return res.status(403).json({ error: 'Only pharmacists can modify medicines' });

    const pharmacist = await Pharmacist.findById(decoded.id);
    if (!pharmacist) return res.status(404).json({ error: 'Pharmacist not found' });

    req.pharmacist = pharmacist;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// GET /api/medicines - List all (in-stock first, sort by expiry) - accessible to all authenticated users
router.get('/', verifyUser, async (req, res) => {
  try {
    const { inStock } = req.query; // ?inStock=true for dropdown
    let query = {};
    if (inStock === 'true') {
      query.stockCount = { $gt: 0 };
    }
    
    const medicines = await Medicine.find(query)
      .sort({ stockCount: -1, expiryDate: 1 }) // in-stock first, then soonest expiry
      .lean();
    
    // Enhance with days to expiry
    const today = new Date();
    const enhanced = medicines.map(m => ({
      ...m,
      daysToExpiry: Math.max(0, Math.ceil((m.expiryDate - today) / (1000 * 60 * 60 * 24)))
    }));

    res.json({ medicines: enhanced });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching medicines' });
  }
});

// POST /api/medicines - Add new medicine
router.post('/', verifyPharmacist, async (req, res) => {
  try {
    const { name, stockCount, expiryDate, batchNumber, manufacturer } = req.body;
    
    if (!name || !stockCount || !expiryDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newMedicine = new Medicine({
      name,
      stockCount: parseInt(stockCount),
      expiryDate: new Date(expiryDate),
      batchNumber,
      manufacturer
    });

    await newMedicine.save();
    res.status(201).json({ success: true, medicine: newMedicine });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Medicine name must be unique' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error creating medicine' });
  }
});

// PUT /api/medicines/:id - Update (stock/fields)
router.put('/:id', verifyPharmacist, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    if (updates.stockCount !== undefined) {
      updates.stockCount = parseInt(updates.stockCount);
      if (updates.stockCount < 0) return res.status(400).json({ error: 'Stock cannot be negative' });
    }
    if (updates.expiryDate) updates.expiryDate = new Date(updates.expiryDate);

    const updated = await Medicine.findByIdAndUpdate(id, updates, { new: true });
    if (!updated) return res.status(404).json({ error: 'Medicine not found' });

    res.json({ success: true, medicine: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error updating medicine' });
  }
});

// DELETE /api/medicines/:id
router.delete('/:id', verifyPharmacist, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Medicine.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'Medicine not found' });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error deleting medicine' });
  }
});

module.exports = router;

