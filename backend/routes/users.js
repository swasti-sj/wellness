const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
router.post('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, roll, sex, age, phone, allergies, consentAccepted } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, roll, sex, age, phone, allergies, consentAccepted },
      { new: true }
    );
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});



router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    res.json(user);
  } catch {
    res.status(500).send('Error fetching profile');
  }
});

module.exports = router;
