const express = require("express");
const router = express.Router();

const Admin = require("../models/Admin");
const authMiddleware = require("../middleware/auth");
const { requireAdmin } = require("../utils/audit");

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

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update admin profile" });
  }
});


module.exports = router;