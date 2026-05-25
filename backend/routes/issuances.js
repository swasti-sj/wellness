const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Pharmacist = require('../models/Pharmacist');
const MedicineIssuance = require('../models/MedicineIssuance');
const Medicine = require('../models/Medicine');
const StockTransaction = require('../models/StockTransaction');

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

const verifyUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    if (!token) return res.status(401).json({ error: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// GET /api/issuances — list with enhanced filters
router.get('/', verifyUser, async (req, res) => {
  try {
    const { from, to, patient, medicine, doctor, source, page = 1, limit = 50, sortBy = 'issuedDate', sortOrder = 'desc' } = req.query;

    let query = {};

    if (from || to) {
      query.issuedDate = {};
      if (from) query.issuedDate.$gte = new Date(from);
      if (to) query.issuedDate.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
    }
    if (medicine) query.medicine = medicine;
    if (patient) query.patient = patient;
    if (doctor) query.doctor = doctor;
    if (source && ['INHOUSE', 'EXTERNAL'].includes(source)) query.source = source;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let sortOption = {};
    sortOption[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [issuances, total] = await Promise.all([
      MedicineIssuance.find(query)
        .populate('patient', 'name email phone')
        .populate('doctor', 'name email')
        .populate('medicine', 'name brandName stockCount expiryDate unit category reorderLevel')
        .populate('issuedBy', 'name')
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      MedicineIssuance.countDocuments(query)
    ]);

    // Calculate total quantity for summary
    const summary = await MedicineIssuance.aggregate([
      { $match: query },
      { $group: { _id: null, totalQuantity: { $sum: '$quantityIssued' }, totalTransactions: { $sum: 1 } } }
    ]);

    res.json({
      issuances,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      summary: {
        totalQuantity: summary[0]?.totalQuantity || 0,
        totalTransactions: summary[0]?.totalTransactions || 0
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching issuances' });
  }
});

// GET /api/issuances/export — export ALL filtered records (no pagination)
router.get('/export', verifyUser, async (req, res) => {
  try {
    const { from, to, patient, medicine, doctor, source } = req.query;
    let query = {};

    if (from || to) {
      query.issuedDate = {};
      if (from) query.issuedDate.$gte = new Date(from);
      if (to) query.issuedDate.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
    }
    if (medicine) query.medicine = medicine;
    if (patient) query.patient = patient;
    if (doctor) query.doctor = doctor;
    if (source && ['INHOUSE', 'EXTERNAL'].includes(source)) query.source = source;

    const issuances = await MedicineIssuance.find(query)
      .populate('patient', 'name email uhid')
      .populate('doctor', 'name email')
      .populate('medicine', 'name brandName unit category')
      .populate('issuedBy', 'name')
      .sort({ issuedDate: -1 })
      .lean();

    res.json({ issuances, total: issuances.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error exporting issuances' });
  }
});

// POST /api/issuances — issue medicine
// Stock is only deducted when source === 'INHOUSE'. EXTERNAL issuances are logged but don't affect in-house stock.
router.post('/', verifyPharmacist, async (req, res) => {
  try {
    const { patient, medicine, quantityIssued, doctor, notes, prescription, source = 'INHOUSE' } = req.body;

    if (!patient || !medicine || !quantityIssued || !doctor) {
      return res.status(400).json({ error: 'patient, medicine, quantityIssued, doctor are required' });
    }

    const med = await Medicine.findById(medicine);
    if (!med) return res.status(404).json({ error: 'Medicine not found' });

    const isInhouse = source === 'INHOUSE';

    // Only check stock sufficiency for INHOUSE issuances
    if (isInhouse && med.stockCount < parseInt(quantityIssued)) {
      return res.status(400).json({ error: `Insufficient in-house stock. Available: ${med.stockCount}` });
    }

    const stockBefore = med.stockCount;
    const stockAfter = isInhouse ? stockBefore - parseInt(quantityIssued) : stockBefore;

    // Create issuance record
    const issuance = new MedicineIssuance({
      patient,
      medicine,
      quantityIssued: parseInt(quantityIssued),
      doctor,
      issuedBy: req.pharmacist._id,
      notes,
      prescription,
      source,
      stockBefore,
      stockAfter
    });
    await issuance.save();

    // Only deduct from stock if INHOUSE
    if (isInhouse) {
      await Medicine.findByIdAndUpdate(medicine, { stockCount: stockAfter });

      // Record stock transaction as ADJUSTMENT (negative = outgoing issuance)
      // Note: 'ISSUANCE' type requires a server restart to register in enum.
      // Using 'ADJUSTMENT' with negative quantity achieves the same result.
      await StockTransaction.create({
        medicine,
        transactionType: 'ADJUSTMENT',
        quantityChanged: -parseInt(quantityIssued),
        stockBefore,
        stockAfter,
        performedBy: req.pharmacist._id,
        notes: `[ISSUANCE] Issued to patient (${quantityIssued} units). ${notes || ''}`
      });
    }
    // For EXTERNAL: just log the issuance record, no stock deduction

    const populated = await MedicineIssuance.findById(issuance._id)
      .populate('patient', 'name email')
      .populate('doctor', 'name email')
      .populate('medicine', 'name brandName stockCount unit')
      .lean();

    res.status(201).json({ success: true, issuance: populated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error issuing medicine' });
  }
});

// GET /api/issuances/stats/summary — enhanced with daily/weekly/monthly/yearly
router.get('/stats/summary', verifyUser, async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [today, week, month, year, allTime] = await Promise.all([
      MedicineIssuance.aggregate([
        { $match: { issuedDate: { $gte: startOfDay } } },
        { $group: { _id: null, totalQty: { $sum: '$quantityIssued' }, count: { $sum: 1 } } }
      ]),
      MedicineIssuance.aggregate([
        { $match: { issuedDate: { $gte: startOfWeek } } },
        { $group: { _id: null, totalQty: { $sum: '$quantityIssued' }, count: { $sum: 1 } } }
      ]),
      MedicineIssuance.aggregate([
        { $match: { issuedDate: { $gte: startOfMonth } } },
        { $group: { _id: null, totalQty: { $sum: '$quantityIssued' }, count: { $sum: 1 } } }
      ]),
      MedicineIssuance.aggregate([
        { $match: { issuedDate: { $gte: startOfYear } } },
        { $group: { _id: null, totalQty: { $sum: '$quantityIssued' }, count: { $sum: 1 } } }
      ]),
      MedicineIssuance.aggregate([
        { $group: { _id: null, totalQty: { $sum: '$quantityIssued' }, count: { $sum: 1 } } }
      ])
    ]);

    res.json({
      today: { qty: today[0]?.totalQty || 0, transactions: today[0]?.count || 0 },
      week: { qty: week[0]?.totalQty || 0, transactions: week[0]?.count || 0 },
      month: { qty: month[0]?.totalQty || 0, transactions: month[0]?.count || 0 },
      year: { qty: year[0]?.totalQty || 0, transactions: year[0]?.count || 0 },
      allTime: { qty: allTime[0]?.totalQty || 0, transactions: allTime[0]?.count || 0 }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;