const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { endSession, logActivity } = require('../utils/audit');

router.post('/logout', authMiddleware, async (req, res) => {
  try {
    if (req.user && req.user.sessionId) {
      await endSession(req.user.sessionId);
      await logActivity({
        userId: req.user.id,
        userName: req.user.name || '',
        userEmail: req.user.email || '',
        role: req.user.role,
        sessionId: req.user.sessionId,
        module: 'Auth',
        action: 'Logout',
        description: 'User logged out',
        severity: 'INFO',
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent'] || '',
        browserInfo: req.headers['user-agent'] || ''
      });
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Failed to log out', details: err.message });
  }
});

module.exports = router;
