const express = require("express");
const router = express.Router();

const Admin = require("../models/Admin");
const authMiddleware = require("../middleware/auth");
const { requireAdmin, logActivity, getClientIp } = require("../utils/audit");

// GET profile
router.get("/profile", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id)
      .select("-googleAccessToken -googleRefreshToken");

    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    res.json(admin);
  } catch (err) {
    res.status(500).json({ error: "Error fetching admin profile" });
  }
});

// UPDATE profile
router.put("/profile", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { name, phone, department, designation } = req.body;

    const before = await Admin.findById(req.user.id).lean();

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (department !== undefined) updates.department = department;
    if (designation !== undefined) updates.designation = designation;

    const updated = await Admin.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-googleAccessToken -googleRefreshToken");

    try {
      const changes = {};
      if (before) {
        if (before.name !== updated.name) changes.name = { before: before.name, after: updated.name };
        if (before.phone !== updated.phone) changes.phone = { before: before.phone, after: updated.phone };
        if (before.department !== updated.department) changes.department = { before: before.department, after: updated.department };
        if (before.designation !== updated.designation) changes.designation = { before: before.designation, after: updated.designation };
      }

      const changeKeys = Object.keys(changes || {});
      if (changeKeys.length > 0) {
        await logActivity({
          userId: updated._id,
          userName: updated.name || updated.email || 'Admin',
          userEmail: updated.email || '',
          role: 'admin',
          sessionId: req.user.sessionId || null,
          module: 'Admin',
          action: 'UPDATE_PROFILE',
          description: 'Admin profile updated',
          severity: 'AUDIT',
          ipAddress: getClientIp(req),
          details: { changes }
        });
      }
    } catch (auditErr) {
      console.warn('Admin profile audit log failed:', auditErr.message);
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update admin profile" });
  }
});


module.exports = router;