const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');
const Nurse = require('../models/Nurse');

// Get nurse profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const nurse = await Nurse.findById(req.user.id).select('-googleAccessToken -googleRefreshToken');
    if (!nurse) return res.status(404).json({ error: 'Nurse not found' });
    res.json(nurse);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching nurse profile' });
  }
});

// Update nurse profile
router.post('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, phone, age, sex } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (age !== undefined) updates.age = age;
    if (sex !== undefined) updates.sex = sex;

    const nurse = await Nurse.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-googleAccessToken -googleRefreshToken');

    if (!nurse) return res.status(404).json({ error: 'Nurse not found' });
    res.json(nurse);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update nurse profile' });
  }
});

// Update nurse profile (PUT)
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;

    const nurse = await Nurse.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-googleAccessToken -googleRefreshToken');

    if (!nurse) return res.status(404).json({ error: 'Nurse not found' });
    res.json(nurse);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update nurse profile' });
  }
});

module.exports = router;
