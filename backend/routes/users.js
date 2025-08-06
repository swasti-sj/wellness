const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

router.post('/profile', authMiddleware, async (req, res) => {
  const { name, age, sex, phone } = req.body;
  try {
    await User.updateOne({ roll: req.user.roll }, { name, age, sex, phone });
    res.send('Profile updated');
  } catch (err) {
    res.status(500).send('Error saving profile');
  }
});

router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ roll: req.user.roll }).select('-password');
    res.json(user);
  } catch {
    res.status(500).send('Error fetching profile');
  }
});

module.exports = router;
