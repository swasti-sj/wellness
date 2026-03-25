const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');
const Pharmacist = require('../models/Pharmacist');

// Get pharmacist profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const pharmacist = await Pharmacist.findById(req.user.id).select('-googleAccessToken -googleRefreshToken');
    if (!pharmacist) return res.status(404).json({ error: 'Pharmacist not found' });
    res.json(pharmacist);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching pharmacist profile' });
  }
});

// Update pharmacist profile
router.post('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, phone, age, sex } = req.body;
    
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (age !== undefined) updates.age = age;
    if (sex !== undefined) updates.sex = sex;

    const pharmacist = await Pharmacist.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-googleAccessToken -googleRefreshToken');

    if (!pharmacist) return res.status(404).json({ error: 'Pharmacist not found' });
    res.json(pharmacist);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update pharmacist profile' });
  }
});

module.exports = router;
