const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

router.post('/signup', async (req, res) => {
  const { roll, password, role } = req.body;
  try {
    const existingUser = await User.findOne({ roll });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ roll, password: hashedPassword, role }); // store role
    await user.save();

    const token = jwt.sign(
      { roll, id: user._id, role: user.role },
      'secret',
      { expiresIn: '1d' }
    );
    res.json({ token, role: user.role }); // send role to frontend
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Login
router.post('/login', async (req, res) => {
  const { roll, password } = req.body;
  try {
    const user = await User.findOne({ roll });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { roll, id: user._id, role: user.role },
      'secret',
      { expiresIn: '1d' }
    );
    res.json({ token, role: user.role }); // send role to frontend
  } catch (err) {
    res.status(500).send('Server error');
  }
});

module.exports = router;
