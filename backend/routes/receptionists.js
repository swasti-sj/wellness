const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');
const Receptionist = require('../models/Receptionist');

// Get receptionist profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const receptionist = await Receptionist.findById(req.user.id).select('-googleAccessToken -googleRefreshToken');
    if (!receptionist) return res.status(404).json({ error: 'Receptionist not found' });
    res.json(receptionist);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching receptionist profile' });
  }
});

// Update receptionist profile
router.post('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, phone, age, sex } = req.body;
    
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (age !== undefined) updates.age = age;
    if (sex !== undefined) updates.sex = sex;

    const receptionist = await Receptionist.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-googleAccessToken -googleRefreshToken');

    if (!receptionist) return res.status(404).json({ error: 'Receptionist not found' });
    res.json(receptionist);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update receptionist profile' });
  }
});

module.exports = router;
