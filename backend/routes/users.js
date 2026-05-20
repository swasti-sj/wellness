const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { logActivity, getClientIp } = require('../utils/audit');

router.post('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, roll, sex, age, phone, allergies, consentAccepted, uhid } = req.body;

    const before = await User.findById(req.user.id).lean();

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, roll, sex, age, phone, allergies, consentAccepted, uhid },
      { new: true }
    );

    // Audit: user profile updated (only record meaningful differences)
    try {
      const changes = {};
      if (before) {
        if (before.phone !== user.phone) changes.phone = { before: before.phone, after: user.phone };
        if (before.name !== user.name) changes.name = { before: before.name, after: user.name };
        if (before.age !== user.age) changes.age = { before: before.age, after: user.age };
      }
      if (Object.keys(changes).length > 0) {
        await logActivity({
          userId: user._id,
          userName: user.name || user.email,
          userEmail: user.email || '',
          role: 'patient',
          sessionId: req.user.sessionId || null,
          module: 'Patient',
          action: 'UPDATE_PROFILE',
          description: `Updated profile for ${user.name}`,
          severity: 'AUDIT',
          ipAddress: getClientIp(req),
          details: { changes }
        });
      }
    } catch (auditErr) {
      console.warn('Failed to write profile update audit log:', auditErr.message);
    }

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
