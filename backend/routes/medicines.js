const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Pharmacist = require('../models/Pharmacist');
const Medicine = require('../models/Medicine');
const StockTransaction = require('../models/StockTransaction');
const MedicineIssuance = require('../models/MedicineIssuance');
const { logActivity, getClientIp } = require('../utils/audit');

// Middleware: any authenticated user can READ
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

// Middleware: only pharmacist can WRITE
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

// GET /api/medicines — list all medicines with computed fields
router.get('/', verifyUser, async (req, res) => {
  try {
    const { inStock, search, category, expiringSoon, sortBy, sortOrder } = req.query;
    let query = { isActive: { $ne: false } };

    if (inStock === 'true') query.stockCount = { $gt: 0 };
    if (category) query.category = category;
    if (search) query.$text = { $search: search };

    let sortOption = {};
    if (sortBy === 'name') sortOption.name = sortOrder === 'desc' ? -1 : 1;
    else if (sortBy === 'stock') sortOption.stockCount = sortOrder === 'desc' ? -1 : 1;
    else if (sortBy === 'expiry') sortOption.expiryDate = sortOrder === 'desc' ? -1 : 1;
    else sortOption = { stockCount: -1, expiryDate: 1 };

    const medicines = await Medicine.find(query)
      .sort(sortOption)
      .lean();

    const today = new Date();
    const enhanced = medicines.map(m => {
      const daysToExpiry = m.expiryDate ? Math.max(0, Math.ceil((new Date(m.expiryDate) - today) / (1000 * 60 * 60 * 24))) : 0;
      return { ...m, daysToExpiry };
    });

    const filtered = expiringSoon === 'true'
      ? enhanced.filter(m => m.daysToExpiry <= 90)
      : enhanced;

    res.json({ medicines: filtered });
  } catch (err) {
    console.error('Error in GET /medicines:', err);
    res.status(500).json({ error: 'Server error fetching medicines', details: err.message });
  }
});

// GET /api/medicines/categories — distinct categories
router.get('/categories', verifyUser, async (req, res) => {
  try {
    const cats = await Medicine.distinct('category');
    res.json({ categories: cats.filter(Boolean) });
  } catch (err) {
    console.error('Error in GET /categories:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/medicines/stats — enhanced dashboard stats
router.get('/stats', verifyUser, async (req, res) => {
  try {
    const today = new Date();
    const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in90Days = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfWeek = new Date(today - 7 * 24 * 60 * 60 * 1000);
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const [totalMeds, outOfStock, expiring30, expiring90, totalStock, lowStock, 
           addedThisMonth, addedThisWeek, addedToday, 
           issuedThisMonth, issuedThisWeek, issuedToday] = await Promise.all([
      Medicine.countDocuments({ isActive: { $ne: false } }),
      Medicine.countDocuments({ stockCount: 0, isActive: { $ne: false } }),
      Medicine.countDocuments({ expiryDate: { $lte: in30Days, $gte: today }, isActive: { $ne: false } }),
      Medicine.countDocuments({ expiryDate: { $lte: in90Days, $gte: today }, isActive: { $ne: false } }),
      Medicine.aggregate([{ $group: { _id: null, total: { $sum: '$stockCount' } } }]),
      Medicine.countDocuments({
        $expr: { $lt: ['$stockCount', '$reorderLevel'] },
        stockCount: { $gt: 0 },
        isActive: { $ne: false }
      }),
      StockTransaction.aggregate([
        { $match: { transactionType: 'ADDITION', createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$quantityChanged' } } }
      ]),
      StockTransaction.aggregate([
        { $match: { transactionType: 'ADDITION', createdAt: { $gte: startOfWeek } } },
        { $group: { _id: null, total: { $sum: '$quantityChanged' } } }
      ]),
      StockTransaction.aggregate([
        { $match: { transactionType: 'ADDITION', createdAt: { $gte: startOfDay } } },
        { $group: { _id: null, total: { $sum: '$quantityChanged' } } }
      ]),
      MedicineIssuance.aggregate([
        { $match: { issuedDate: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$quantityIssued' } } }
      ]),
      MedicineIssuance.aggregate([
        { $match: { issuedDate: { $gte: startOfWeek } } },
        { $group: { _id: null, total: { $sum: '$quantityIssued' } } }
      ]),
      MedicineIssuance.aggregate([
        { $match: { issuedDate: { $gte: startOfDay } } },
        { $group: { _id: null, total: { $sum: '$quantityIssued' } } }
      ])
    ]);

    res.json({
      totalMedicines: totalMeds,
      outOfStock,
      lowStock,
      expiring30Days: expiring30,
      expiring90Days: expiring90,
      totalUnitsInStock: totalStock[0]?.total || 0,
      stockMovement: {
        added: {
          today: addedToday[0]?.total || 0,
          week: addedThisWeek[0]?.total || 0,
          month: addedThisMonth[0]?.total || 0
        },
        issued: {
          today: issuedToday[0]?.total || 0,
          week: issuedThisWeek[0]?.total || 0,
          month: issuedThisMonth[0]?.total || 0
        }
      }
    });
  } catch (err) {
    console.error('Error in GET /stats:', err);
    res.status(500).json({ error: 'Server error fetching stats', details: err.message });
  }
});

// POST /api/medicines — add new medicine
router.post('/', verifyPharmacist, async (req, res) => {
  try {
    const { 
      name, brandName, stockCount, expiryDate, oldStockExpiryDate, batchNumber, manufacturer,
      category, reorderLevel, unit, pricePerUnit, notes, oldBalance, oldBalanceDate,
      supplier, invoiceNumber, receivedDate
    } = req.body;

    if (!name || stockCount === undefined || !expiryDate) {
      return res.status(400).json({ error: 'Missing required fields: name, stockCount, expiryDate' });
    }

    const newMedicine = new Medicine({
      name: name.trim(),
      brandName: brandName ? brandName.trim() : '',
      stockCount: parseInt(stockCount),
      expiryDate: new Date(expiryDate),
      oldStockExpiryDate: oldStockExpiryDate ? new Date(oldStockExpiryDate) : null,
      batchNumber: batchNumber ? batchNumber.trim() : '',
      manufacturer: manufacturer ? manufacturer.trim() : '',
      category: category ? category.trim() : 'General',
      reorderLevel: parseInt(reorderLevel) || 20,
      unit: unit || 'tablets',
      pricePerUnit: parseFloat(pricePerUnit) || 0,
      notes: notes ? notes.trim() : '',
      oldBalance: parseInt(oldBalance) || 0,
      oldBalanceDate: oldBalanceDate ? new Date(oldBalanceDate) : null
    });

    await newMedicine.save();

    // Record the opening balance transaction
    if (parseInt(stockCount) > 0) {
      await StockTransaction.create({
        medicine: newMedicine._id,
        transactionType: 'OPENING_BALANCE',
        quantityChanged: parseInt(stockCount),
        stockBefore: 0,
        stockAfter: parseInt(stockCount),
        batchNumber: batchNumber || '',
        newExpiryDate: new Date(expiryDate),
        manufacturer: manufacturer || '',
        performedBy: req.pharmacist._id,
        receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
        supplier: supplier || '',
        invoiceNumber: invoiceNumber || '',
        notes: notes || 'Initial stock entry'
      });
    }

    // Audit: New medicine added
    try {
      await logActivity({
        userId: req.pharmacist._id,
        userName: req.pharmacist.name || req.pharmacist.email,
        userEmail: req.pharmacist.email || '',
        role: 'pharmacist',
        sessionId: req.pharmacist.sessionId || null,
        module: 'Medicine',
        action: 'ADD_MEDICINE',
        description: `Added new medicine ${newMedicine.name} with opening stock ${newMedicine.stockCount}`,
        severity: 'AUDIT',
        ipAddress: getClientIp(req),
        details: { medicineId: newMedicine._id, stock: newMedicine.stockCount }
      });
    } catch (auditErr) {
      console.warn('Failed to write medicine add audit log:', auditErr.message);
    }

    res.status(201).json({ success: true, medicine: newMedicine });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Medicine name must be unique' });
    }
    console.error('Error in POST /medicines:', err);
    res.status(500).json({ error: 'Server error creating medicine', details: err.message });
  }
});

// PUT /api/medicines/:id — update medicine fields with proper error handling
router.put('/:id', verifyPharmacist, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Log the incoming request for debugging
    console.log('Updating medicine:', id);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const medicine = await Medicine.findById(id);
    if (!medicine) {
      console.log('Medicine not found:', id);
      return res.status(404).json({ error: 'Medicine not found' });
    }

    const prevStock = medicine.stockCount;
    const updates = {};

    // Handle addStock (adding new stock)
    if (req.body.addStock !== undefined && req.body.addStock !== null && req.body.addStock !== '') {
      const added = parseInt(req.body.addStock);
      if (isNaN(added)) {
        return res.status(400).json({ error: 'addStock must be a valid number' });
      }
      if (added < 0) {
        return res.status(400).json({ error: 'addStock cannot be negative' });
      }
      
      if (added > 0) {
        updates.stockCount = prevStock + added;

        // Record ADDITION transaction
        await StockTransaction.create({
          medicine: id,
          transactionType: 'ADDITION',
          quantityChanged: added,
          stockBefore: prevStock,
          stockAfter: prevStock + added,
          batchNumber: req.body.batchNumber || medicine.batchNumber,
          newExpiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : medicine.expiryDate,
          manufacturer: req.body.manufacturer || medicine.manufacturer,
          performedBy: req.pharmacist._id,
          receivedDate: req.body.receivedDate ? new Date(req.body.receivedDate) : new Date(),
          supplier: req.body.supplier || '',
          invoiceNumber: req.body.invoiceNumber || '',
          notes: `Stock addition: +${added} units. ${req.body.notes || ''}`
        });
      }
    }
    // Handle direct stock count adjustment
    else if (req.body.stockCount !== undefined && req.body.stockCount !== null && req.body.stockCount !== '') {
      const newCount = parseInt(req.body.stockCount);
      if (isNaN(newCount)) {
        return res.status(400).json({ error: 'stockCount must be a valid number' });
      }
      if (newCount < 0) {
        return res.status(400).json({ error: 'Stock cannot be negative' });
      }
      updates.stockCount = newCount;
      const diff = newCount - prevStock;

      if (diff !== 0) {
        await StockTransaction.create({
          medicine: id,
          transactionType: 'ADJUSTMENT',
          quantityChanged: diff,
          stockBefore: prevStock,
          stockAfter: newCount,
          performedBy: req.pharmacist._id,
          notes: req.body.adjustmentReason || `Manual stock adjustment: ${prevStock} → ${newCount}`
        });
      }
    }

    // Update other fields (only if they exist in the request)
    if (req.body.expiryDate !== undefined && req.body.expiryDate !== '') updates.expiryDate = new Date(req.body.expiryDate);
    if (req.body.oldStockExpiryDate !== undefined && req.body.oldStockExpiryDate !== '') updates.oldStockExpiryDate = new Date(req.body.oldStockExpiryDate);
    if (req.body.batchNumber !== undefined) updates.batchNumber = req.body.batchNumber;
    if (req.body.manufacturer !== undefined) updates.manufacturer = req.body.manufacturer;
    if (req.body.brandName !== undefined) updates.brandName = req.body.brandName;
    if (req.body.category !== undefined) updates.category = req.body.category;
    if (req.body.reorderLevel !== undefined && req.body.reorderLevel !== '') updates.reorderLevel = parseInt(req.body.reorderLevel);
    if (req.body.unit !== undefined) updates.unit = req.body.unit;
    if (req.body.pricePerUnit !== undefined && req.body.pricePerUnit !== '') updates.pricePerUnit = parseFloat(req.body.pricePerUnit);
    if (req.body.notes !== undefined) updates.notes = req.body.notes;

    // Only update if there are changes
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    console.log('Updates to apply:', updates);

    const updated = await Medicine.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    
    // Audit: Stock or medicine updated (record old/new for meaningful fields)
    try {
      const changedFields = {};
      if (updates.stockCount !== undefined) changedFields.stockCount = { before: prevStock, after: updates.stockCount };
      if (updates.expiryDate !== undefined) changedFields.expiryDate = { before: medicine.expiryDate, after: updates.expiryDate };
      await logActivity({
        userId: req.pharmacist._id,
        userName: req.pharmacist.name || req.pharmacist.email,
        userEmail: req.pharmacist.email || '',
        role: 'pharmacist',
        sessionId: req.pharmacist.sessionId || null,
        module: 'Medicine',
        action: 'UPDATE_MEDICINE',
        description: `Updated medicine ${medicine.name}` + (changedFields.stockCount ? `: stock ${changedFields.stockCount.before} → ${changedFields.stockCount.after}` : ''),
        severity: 'AUDIT',
        ipAddress: getClientIp(req),
        details: { medicineId: updated._id, changes: changedFields }
      });
    } catch (auditErr) {
      console.warn('Failed to write medicine update audit log:', auditErr.message);
    }

    console.log('Medicine updated successfully:', updated._id);
    res.json({ success: true, medicine: updated });
    
  } catch (err) {
    console.error('Error in PUT /medicines/:id:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ 
      error: 'Server error updating medicine', 
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});


// DELETE /api/medicines/:id — soft delete
router.delete('/:id', verifyPharmacist, async (req, res) => {
  try {
    const { id } = req.params;
    const medicine = await Medicine.findById(id);
    if (!medicine) return res.status(404).json({ error: 'Medicine not found' });

    await Medicine.findByIdAndUpdate(id, { isActive: false, stockCount: 0 });

    if (medicine.stockCount > 0) {
      await StockTransaction.create({
        medicine: id,
        transactionType: 'EXPIRY_REMOVAL',
        quantityChanged: -medicine.stockCount,
        stockBefore: medicine.stockCount,
        stockAfter: 0,
        performedBy: req.pharmacist._id,
        notes: 'Medicine removed/deactivated from inventory'
      });
    }

    // Audit: Medicine removed/deactivated
    try {
      await logActivity({
        userId: req.pharmacist._id,
        userName: req.pharmacist.name || req.pharmacist.email,
        userEmail: req.pharmacist.email || '',
        role: 'pharmacist',
        sessionId: req.pharmacist.sessionId || null,
        module: 'Medicine',
        action: 'DELETE_MEDICINE',
        description: `Deleted/Deactivated medicine ${medicine.name}`,
        severity: 'AUDIT',
        ipAddress: getClientIp(req),
        details: { medicineId: medicine._id }
      });
    } catch (auditErr) {
      console.warn('Failed to write medicine delete audit log:', auditErr.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error in DELETE /medicines/:id:', err);
    res.status(500).json({ error: 'Server error deleting medicine', details: err.message });
  }
});

// GET /api/medicines/:id/transactions — full stock history
router.get('/:id/transactions', verifyUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to, type, limit = 100, page = 1 } = req.query;
    let query = { medicine: id };

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
    }
    if (type) query.transactionType = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transactions, total] = await Promise.all([
      StockTransaction.find(query)
        .populate('performedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StockTransaction.countDocuments(query)
    ]);

    res.json({ transactions, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error('Error in GET /:id/transactions:', err);
    res.status(500).json({ error: 'Server error fetching transactions', details: err.message });
  }
});

// GET /api/medicines/analytics/usage — enhanced with period and date range
router.get('/analytics/usage', verifyUser, async (req, res) => {
  try {
    const { period, from, to, limit = 20 } = req.query;
    
    let startDate;
    let endDate;
    const now = new Date();
    
    if (from && to) {
      startDate = new Date(from);
      endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'day') {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    let matchStage = { issuedDate: { $gte: startDate } };
    if (endDate) {
      matchStage.issuedDate.$lte = endDate;
    }

    const usage = await MedicineIssuance.aggregate([
      { $match: matchStage },
      { $group: { _id: '$medicine', totalIssued: { $sum: '$quantityIssued' }, count: { $sum: 1 } } },
      { $sort: { totalIssued: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'medicines',
          localField: '_id',
          foreignField: '_id',
          as: 'medicineInfo'
        }
      },
      { $unwind: { path: '$medicineInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: { $ifNull: ['$medicineInfo.name', 'Deleted Medicine'] },
          brandName: { $ifNull: ['$medicineInfo.brandName', ''] },
          totalIssued: 1,
          count: 1,
          currentStock: { $ifNull: ['$medicineInfo.stockCount', 0] },
          category: { $ifNull: ['$medicineInfo.category', 'Unknown'] },
          unit: { $ifNull: ['$medicineInfo.unit', 'units'] }
        }
      }
    ]);

    res.json({ usage, period, startDate, totalRecords: usage.length });
  } catch (err) {
    console.error('Error in GET /analytics/usage:', err);
    res.status(500).json({ error: 'Server error fetching usage analytics', details: err.message });
  }
});

// GET /api/medicines/analytics/stock-movement — enhanced daily movement
router.get('/analytics/stock-movement', verifyUser, async (req, res) => {
  try {
    const { days = 30, from, to } = req.query;
    let startDate;
    let endDate;
    
    if (from && to) {
      startDate = new Date(from);
      endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    }

    // Daily issuances
    const dailyIssuances = await MedicineIssuance.aggregate([
      { $match: { issuedDate: { $gte: startDate, ...(endDate && { $lte: endDate }) } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$issuedDate' } },
          totalIssued: { $sum: '$quantityIssued' },
          transactionCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Daily additions (from StockTransaction)
    const dailyAdditions = await StockTransaction.aggregate([
      { $match: { transactionType: { $in: ['ADDITION', 'OPENING_BALANCE'] }, createdAt: { $gte: startDate, ...(endDate && { $lte: endDate }) } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalAdded: { $sum: '$quantityChanged' },
          additionCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Combine both datasets
    const movementMap = {};
    dailyIssuances.forEach(d => {
      movementMap[d._id] = { 
        date: d._id, 
        issued: d.totalIssued, 
        issuedTx: d.transactionCount,
        added: 0,
        addedTx: 0,
        net: -d.totalIssued
      };
    });
    dailyAdditions.forEach(d => {
      if (movementMap[d._id]) {
        movementMap[d._id].added = d.totalAdded;
        movementMap[d._id].addedTx = d.additionCount;
        movementMap[d._id].net = movementMap[d._id].net + d.totalAdded;
      } else {
        movementMap[d._id] = {
          date: d._id,
          issued: 0,
          issuedTx: 0,
          added: d.totalAdded,
          addedTx: d.additionCount,
          net: d.totalAdded
        };
      }
    });

    const movementData = Object.values(movementMap).sort((a, b) => a.date.localeCompare(b.date));

    res.json({ 
      dailyIssuances, 
      dailyAdditions,
      movementData,
      summary: {
        totalIssued: movementData.reduce((sum, d) => sum + d.issued, 0),
        totalAdded: movementData.reduce((sum, d) => sum + d.added, 0),
        netChange: movementData.reduce((sum, d) => sum + d.net, 0),
        daysWithMovement: movementData.length
      }
    });
  } catch (err) {
    console.error('Error in GET /analytics/stock-movement:', err);
    res.status(500).json({ error: 'Server error fetching stock movement', details: err.message });
  }
});
// ==================== MEDICINE-WISE ANALYTICS ENDPOINTS ====================

// GET /api/medicines/analytics/medicine-wise-issuance - Medicine-wise issuance data
router.get('/analytics/medicine-wise-issuance', verifyUser, async (req, res) => {
  try {
    const { from, to, medicineId } = req.query;
    
    let matchStage = {};
    if (from || to) {
      matchStage.issuedDate = {};
      if (from) matchStage.issuedDate.$gte = new Date(from);
      if (to) matchStage.issuedDate.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
    }
    if (medicineId) matchStage.medicine = new mongoose.Types.ObjectId(medicineId);
    
    // Daily movements per medicine
    const dailyMovements = await MedicineIssuance.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$issuedDate' } },
            medicineId: '$medicine'
          },
          totalIssued: { $sum: '$quantityIssued' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'medicines',
          localField: '_id.medicineId',
          foreignField: '_id',
          as: 'medicineInfo'
        }
      },
      { $unwind: { path: '$medicineInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          date: '$_id.date',
          medicineId: '$_id.medicineId',
          medicineName: { $ifNull: ['$medicineInfo.name', 'Deleted Medicine'] },
          medicineBrand: { $ifNull: ['$medicineInfo.brandName', ''] },
          totalIssued: 1,
          transactionCount: 1
        }
      },
      { $sort: { date: 1, medicineName: 1 } }
    ]);
    
    // Summary per medicine
    const medicineSummary = await MedicineIssuance.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$medicine',
          totalIssued: { $sum: '$quantityIssued' },
          issuanceCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'medicines',
          localField: '_id',
          foreignField: '_id',
          as: 'medicineInfo'
        }
      },
      { $unwind: { path: '$medicineInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: '$_id',
          name: { $ifNull: ['$medicineInfo.name', 'Deleted Medicine'] },
          brandName: { $ifNull: ['$medicineInfo.brandName', ''] },
          category: { $ifNull: ['$medicineInfo.category', 'General'] },
          totalIssued: 1,
          issuanceCount: 1,
          currentStock: { $ifNull: ['$medicineInfo.stockCount', 0] },
          unit: { $ifNull: ['$medicineInfo.unit', 'units'] }
        }
      },
      { $sort: { totalIssued: -1 } }
    ]);
    
    // Get addition data for each medicine to show net change
    let additionMatchStage = { transactionType: { $in: ['ADDITION', 'OPENING_BALANCE'] } };
    if (from || to) {
      additionMatchStage.createdAt = {};
      if (from) additionMatchStage.createdAt.$gte = new Date(from);
      if (to) additionMatchStage.createdAt.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
    }
    if (medicineId) additionMatchStage.medicine = new mongoose.Types.ObjectId(medicineId);
    
    const additionData = await StockTransaction.aggregate([
      { $match: additionMatchStage },
      {
        $group: {
          _id: '$medicine',
          totalAdded: { $sum: '$quantityChanged' },
          additionCount: { $sum: 1 }
        }
      }
    ]);
    
    // Merge addition data into medicine summary
    const additionMap = new Map();
    additionData.forEach(ad => {
      additionMap.set(ad._id.toString(), {
        totalAdded: ad.totalAdded,
        additionCount: ad.additionCount
      });
    });
    
    const enhancedSummary = medicineSummary.map(med => ({
      ...med,
      totalAdded: additionMap.get(med._id?.toString())?.totalAdded || 0,
      additionCount: additionMap.get(med._id?.toString())?.additionCount || 0,
      netChange: (additionMap.get(med._id?.toString())?.totalAdded || 0) - (med.totalIssued || 0)
    }));
    
    let selectedMedicine = null;
    if (medicineId) {
      const med = await Medicine.findById(medicineId);
      if (med) {
        const medSummary = enhancedSummary.find(m => m._id?.toString() === medicineId);
        selectedMedicine = {
          _id: med._id,
          name: med.name,
          brandName: med.brandName,
          category: med.category,
          currentStock: med.stockCount,
          unit: med.unit,
          totalIssued: medSummary?.totalIssued || 0,
          issuanceCount: medSummary?.issuanceCount || 0,
          totalAdded: medSummary?.totalAdded || 0,
          additionCount: medSummary?.additionCount || 0,
          netChange: (medSummary?.totalAdded || 0) - (medSummary?.totalIssued || 0)
        };
      }
    }
    
    res.json({ dailyMovements, medicineSummary: enhancedSummary, selectedMedicine });
  } catch (err) {
    console.error('Error in GET /analytics/medicine-wise-issuance:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// GET /api/medicines/analytics/medicine-wise-additions - Medicine-wise addition data
router.get('/analytics/medicine-wise-additions', verifyUser, async (req, res) => {
  try {
    const { from, to, medicineId } = req.query;
    
    let matchStage = { transactionType: { $in: ['ADDITION', 'OPENING_BALANCE'] } };
    if (from || to) {
      matchStage.createdAt = {};
      if (from) matchStage.createdAt.$gte = new Date(from);
      if (to) matchStage.createdAt.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
    }
    if (medicineId) matchStage.medicine = new mongoose.Types.ObjectId(medicineId);
    
    // Daily movements per medicine
    const dailyMovements = await StockTransaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            medicineId: '$medicine'
          },
          totalAdded: { $sum: '$quantityChanged' },
          additionCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'medicines',
          localField: '_id.medicineId',
          foreignField: '_id',
          as: 'medicineInfo'
        }
      },
      { $unwind: { path: '$medicineInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          date: '$_id.date',
          medicineId: '$_id.medicineId',
          medicineName: { $ifNull: ['$medicineInfo.name', 'Deleted Medicine'] },
          medicineBrand: { $ifNull: ['$medicineInfo.brandName', ''] },
          totalAdded: 1,
          additionCount: 1
        }
      },
      { $sort: { date: 1, medicineName: 1 } }
    ]);
    
    // Summary per medicine
    const medicineSummary = await StockTransaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$medicine',
          totalAdded: { $sum: '$quantityChanged' },
          additionCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'medicines',
          localField: '_id',
          foreignField: '_id',
          as: 'medicineInfo'
        }
      },
      { $unwind: { path: '$medicineInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: '$_id',
          name: { $ifNull: ['$medicineInfo.name', 'Deleted Medicine'] },
          brandName: { $ifNull: ['$medicineInfo.brandName', ''] },
          category: { $ifNull: ['$medicineInfo.category', 'General'] },
          totalAdded: 1,
          additionCount: 1,
          currentStock: { $ifNull: ['$medicineInfo.stockCount', 0] },
          unit: { $ifNull: ['$medicineInfo.unit', 'units'] }
        }
      },
      { $sort: { totalAdded: -1 } }
    ]);
    
    // Get issuance data for each medicine to show net change
    let issuanceMatchStage = {};
    if (from || to) {
      issuanceMatchStage.issuedDate = {};
      if (from) issuanceMatchStage.issuedDate.$gte = new Date(from);
      if (to) issuanceMatchStage.issuedDate.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
    }
    if (medicineId) issuanceMatchStage.medicine = new mongoose.Types.ObjectId(medicineId);
    
    const issuanceData = await MedicineIssuance.aggregate([
      { $match: issuanceMatchStage },
      {
        $group: {
          _id: '$medicine',
          totalIssued: { $sum: '$quantityIssued' },
          issuanceCount: { $sum: 1 }
        }
      }
    ]);
    
    // Merge issuance data into medicine summary
    const issuanceMap = new Map();
    issuanceData.forEach(iss => {
      issuanceMap.set(iss._id.toString(), {
        totalIssued: iss.totalIssued,
        issuanceCount: iss.issuanceCount
      });
    });
    
    const enhancedSummary = medicineSummary.map(med => ({
      ...med,
      totalIssued: issuanceMap.get(med._id?.toString())?.totalIssued || 0,
      issuanceCount: issuanceMap.get(med._id?.toString())?.issuanceCount || 0,
      netChange: (med.totalAdded || 0) - (issuanceMap.get(med._id?.toString())?.totalIssued || 0)
    }));
    
    let selectedMedicine = null;
    if (medicineId) {
      const med = await Medicine.findById(medicineId);
      if (med) {
        const medSummary = enhancedSummary.find(m => m._id?.toString() === medicineId);
        selectedMedicine = {
          _id: med._id,
          name: med.name,
          brandName: med.brandName,
          category: med.category,
          currentStock: med.stockCount,
          unit: med.unit,
          totalAdded: medSummary?.totalAdded || 0,
          additionCount: medSummary?.additionCount || 0,
          totalIssued: medSummary?.totalIssued || 0,
          issuanceCount: medSummary?.issuanceCount || 0,
          netChange: (medSummary?.totalAdded || 0) - (medSummary?.totalIssued || 0)
        };
      }
    }
    
    res.json({ dailyMovements, medicineSummary: enhancedSummary, selectedMedicine });
  } catch (err) {
    console.error('Error in GET /analytics/medicine-wise-additions:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// GET /api/medicines/analytics/complete-medicine-movement - Combined issuance + addition for all medicines
router.get('/analytics/complete-medicine-movement', verifyUser, async (req, res) => {
  try {
    const { from, to, medicineId } = req.query;
    
    // Build date filters
    let issuanceMatch = {};
    let additionMatch = { transactionType: { $in: ['ADDITION', 'OPENING_BALANCE'] } };
    
    if (from || to) {
      issuanceMatch.issuedDate = {};
      additionMatch.createdAt = {};
      
      if (from) {
        issuanceMatch.issuedDate.$gte = new Date(from);
        additionMatch.createdAt.$gte = new Date(from);
      }
      if (to) {
        issuanceMatch.issuedDate.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
        additionMatch.createdAt.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
      }
    }
    
    if (medicineId) {
      issuanceMatch.medicine = new mongoose.Types.ObjectId(medicineId);
      additionMatch.medicine = new mongoose.Types.ObjectId(medicineId);
    }
    
    // Get issuance data
    const issuanceData = await MedicineIssuance.aggregate([
      { $match: issuanceMatch },
      {
        $group: {
          _id: '$medicine',
          totalIssued: { $sum: '$quantityIssued' },
          issuanceCount: { $sum: 1 },
          firstIssuance: { $min: '$issuedDate' },
          lastIssuance: { $max: '$issuedDate' }
        }
      }
    ]);
    
    // Get addition data
    const additionData = await StockTransaction.aggregate([
      { $match: additionMatch },
      {
        $group: {
          _id: '$medicine',
          totalAdded: { $sum: '$quantityChanged' },
          additionCount: { $sum: 1 },
          firstAddition: { $min: '$createdAt' },
          lastAddition: { $max: '$createdAt' }
        }
      }
    ]);
    
    // Combine data
    const issuanceMap = new Map();
    issuanceData.forEach(i => issuanceMap.set(i._id.toString(), i));
    const additionMap = new Map();
    additionData.forEach(a => additionMap.set(a._id.toString(), a));
    
    const allMedicineIds = new Set([...issuanceMap.keys(), ...additionMap.keys()]);
    
    const medicines = await Medicine.find({ 
      _id: { $in: [...allMedicineIds] }, 
      isActive: { $ne: false } 
    });
    
    const combinedSummary = medicines.map(med => {
      const issuance = issuanceMap.get(med._id.toString()) || { 
        totalIssued: 0, 
        issuanceCount: 0,
        firstIssuance: null,
        lastIssuance: null
      };
      const addition = additionMap.get(med._id.toString()) || { 
        totalAdded: 0, 
        additionCount: 0,
        firstAddition: null,
        lastAddition: null
      };
      return {
        _id: med._id,
        name: med.name,
        brandName: med.brandName || '',
        category: med.category || 'General',
        unit: med.unit || 'units',
        currentStock: med.stockCount,
        totalIssued: issuance.totalIssued,
        issuanceCount: issuance.issuanceCount,
        totalAdded: addition.totalAdded,
        additionCount: addition.additionCount,
        netChange: addition.totalAdded - issuance.totalIssued,
        firstIssuance: issuance.firstIssuance,
        lastIssuance: issuance.lastIssuance,
        firstAddition: addition.firstAddition,
        lastAddition: addition.lastAddition
      };
    }).sort((a, b) => Math.abs(b.netChange) - Math.abs(a.netChange));
    
    res.json({ 
      medicineSummary: combinedSummary,
      totalMedicines: combinedSummary.length,
      totalIssuedOverall: combinedSummary.reduce((sum, m) => sum + m.totalIssued, 0),
      totalAddedOverall: combinedSummary.reduce((sum, m) => sum + m.totalAdded, 0)
    });
  } catch (err) {
    console.error('Error in GET /analytics/complete-medicine-movement:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// GET /api/medicines/analytics/medicine-daily-breakdown - Detailed daily breakdown for a specific medicine
router.get('/analytics/medicine-daily-breakdown', verifyUser, async (req, res) => {
  try {
    const { medicineId, from, to } = req.query;
    
    if (!medicineId) {
      return res.status(400).json({ error: 'medicineId is required' });
    }
    
    // Get daily issuance breakdown
    let issuanceMatch = { medicine: new mongoose.Types.ObjectId(medicineId) };
    let additionMatch = { medicine: new mongoose.Types.ObjectId(medicineId), transactionType: { $in: ['ADDITION', 'OPENING_BALANCE'] } };
    
    if (from || to) {
      issuanceMatch.issuedDate = {};
      additionMatch.createdAt = {};
      
      if (from) {
        issuanceMatch.issuedDate.$gte = new Date(from);
        additionMatch.createdAt.$gte = new Date(from);
      }
      if (to) {
        issuanceMatch.issuedDate.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
        additionMatch.createdAt.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
      }
    }
    
    const [dailyIssuance, dailyAddition, medicineInfo] = await Promise.all([
      MedicineIssuance.aggregate([
        { $match: issuanceMatch },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$issuedDate' } },
            totalIssued: { $sum: '$quantityIssued' },
            transactionCount: { $sum: 1 },
            prescriptions: { $push: { prescriptionId: '$prescription', patient: '$patient', quantity: '$quantityIssued' } }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      StockTransaction.aggregate([
        { $match: additionMatch },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            totalAdded: { $sum: '$quantityChanged' },
            additionCount: { $sum: 1 },
            suppliers: { $addToSet: '$supplier' },
            invoiceNumbers: { $addToSet: '$invoiceNumber' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Medicine.findById(medicineId).select('name brandName category stockCount unit reorderLevel')
    ]);
    
    // Combine daily data
    const issuanceMap = new Map();
    dailyIssuance.forEach(d => {
      issuanceMap.set(d._id, {
        issued: d.totalIssued,
        issuanceCount: d.transactionCount
      });
    });
    
    const additionMap = new Map();
    dailyAddition.forEach(d => {
      additionMap.set(d._id, {
        added: d.totalAdded,
        additionCount: d.additionCount
      });
    });
    
    const allDates = new Set([...issuanceMap.keys(), ...additionMap.keys()]);
    const dailyBreakdown = Array.from(allDates).sort().map(date => ({
      date,
      issued: issuanceMap.get(date)?.issued || 0,
      issuanceCount: issuanceMap.get(date)?.issuanceCount || 0,
      added: additionMap.get(date)?.added || 0,
      additionCount: additionMap.get(date)?.additionCount || 0,
      netChange: (additionMap.get(date)?.added || 0) - (issuanceMap.get(date)?.issued || 0)
    }));
    
    // Calculate cumulative
    let cumulative = 0;
    const dailyWithCumulative = dailyBreakdown.map(day => {
      cumulative += day.netChange;
      return { ...day, cumulativeChange: cumulative };
    });
    
    res.json({
      medicine: medicineInfo,
      dailyBreakdown: dailyWithCumulative,
      summary: {
        totalIssued: dailyBreakdown.reduce((sum, d) => sum + d.issued, 0),
        totalAdded: dailyBreakdown.reduce((sum, d) => sum + d.added, 0),
        netChange: dailyBreakdown.reduce((sum, d) => sum + d.netChange, 0),
        daysWithActivity: dailyBreakdown.length
      }
    });
  } catch (err) {
    console.error('Error in GET /analytics/medicine-daily-breakdown:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// GET /api/medicines/analytics/expiry-summary — expiry date distribution
router.get('/analytics/expiry-summary', verifyUser, async (req, res) => {
  try {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const in180Days = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
    const in365Days = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const [expired, expiring30, expiring60, expiring90, expiring180, expiring365, beyond365] = await Promise.all([
      Medicine.countDocuments({ expiryDate: { $lt: now }, isActive: { $ne: false } }),
      Medicine.countDocuments({ expiryDate: { $gte: now, $lte: in30Days }, isActive: { $ne: false } }),
      Medicine.countDocuments({ expiryDate: { $gt: in30Days, $lte: in60Days }, isActive: { $ne: false } }),
      Medicine.countDocuments({ expiryDate: { $gt: in60Days, $lte: in90Days }, isActive: { $ne: false } }),
      Medicine.countDocuments({ expiryDate: { $gt: in90Days, $lte: in180Days }, isActive: { $ne: false } }),
      Medicine.countDocuments({ expiryDate: { $gt: in180Days, $lte: in365Days }, isActive: { $ne: false } }),
      Medicine.countDocuments({ expiryDate: { $gt: in365Days }, isActive: { $ne: false } })
    ]);

    res.json({
      expired,
      expiring30,
      expiring60,
      expiring90,
      expiring180,
      expiring365,
      beyond365,
      totalAnalyzed: expired + expiring30 + expiring60 + expiring90 + expiring180 + expiring365 + beyond365
    });



    
  } catch (err) {
    console.error('Error in GET /analytics/expiry-summary:', err);
    res.status(500).json({ error: 'Server error fetching expiry summary', details: err.message });
  }
  
});

module.exports = router;