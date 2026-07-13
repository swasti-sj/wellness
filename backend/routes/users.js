const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { logActivity, getClientIp } = require('../utils/audit');

const DEPENDANT_ALLOWED_CATEGORIES = ["Faculty", "Staff", "Outsourced Staff"];
const PATIENT_CATEGORIES = ["Student", "Faculty", "Staff", "Outsourced Staff"];

router.post('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, roll, sex, age, phone, allergies, consentAccepted, uhid, patientCategory } = req.body;

    const before = await User.findById(req.user.id).lean();

    const updates = { name, roll, sex, age, phone, allergies, consentAccepted, uhid };
    if (patientCategory) {
      if (!PATIENT_CATEGORIES.includes(patientCategory)) {
        return res.status(400).json({ error: 'Invalid patient category' });
      }
      updates.patientCategory = patientCategory;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
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

router.get('/dependants', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('patientCategory dependants');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ patientCategory: user.patientCategory, dependants: user.dependants || [] });
  } catch (err) {
    console.error('Error fetching dependants:', err);
    res.status(500).json({ error: 'Failed to fetch dependants' });
  }
});

router.post('/dependants', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!DEPENDANT_ALLOWED_CATEGORIES.includes(user.patientCategory)) {
      return res.status(403).json({ error: 'Dependants are only allowed for faculty/staff accounts' });
    }

    const { name, age, sex, relationship, bloodGroup, phone, allergies, uhid } = req.body;
    if (!name) return res.status(400).json({ error: 'Dependant name is required' });

    const newDependant = {
      _id: new mongoose.Types.ObjectId(),
      name,
      age,
      sex,
      relationship,
      bloodGroup,
      phone,
      allergies,
      uhid,
    };

    user.dependants = user.dependants || [];
    user.dependants.push(newDependant);
    await user.save();

    res.json(newDependant);
  } catch (err) {
    console.error('Error creating dependant:', err);
    res.status(500).json({ error: 'Failed to create dependant' });
  }
});

router.put('/dependants/:dependantId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!DEPENDANT_ALLOWED_CATEGORIES.includes(user.patientCategory)) {
      return res.status(403).json({ error: 'Dependants are only allowed for faculty/staff accounts' });
    }

    const dependantId = req.params.dependantId;
    const dependant = user.dependants?.find((d) => d._id.toString() === dependantId);
    if (!dependant) return res.status(404).json({ error: 'Dependant not found' });

    const { name, age, sex, relationship, bloodGroup, phone, allergies, uhid } = req.body;
    if (name !== undefined) dependant.name = name;
    if (age !== undefined) dependant.age = age;
    if (sex !== undefined) dependant.sex = sex;
    if (relationship !== undefined) dependant.relationship = relationship;
    if (bloodGroup !== undefined) dependant.bloodGroup = bloodGroup;
    if (phone !== undefined) dependant.phone = phone;
    if (allergies !== undefined) dependant.allergies = allergies;
    if (uhid !== undefined) dependant.uhid = uhid;

    await user.save();
    res.json(dependant);
  } catch (err) {
    console.error('Error updating dependant:', err);
    res.status(500).json({ error: 'Failed to update dependant' });
  }
});

router.delete('/dependants/:dependantId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!DEPENDANT_ALLOWED_CATEGORIES.includes(user.patientCategory)) {
      return res.status(403).json({ error: 'Dependants are only allowed for faculty/staff accounts' });
    }

    const dependantId = req.params.dependantId;
    const beforeLength = user.dependants?.length || 0;
    user.dependants = (user.dependants || []).filter((d) => d._id.toString() !== dependantId);

    if (user.dependants.length === beforeLength) {
      return res.status(404).json({ error: 'Dependant not found' });
    }

    await user.save();
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting dependant:', err);
    res.status(500).json({ error: 'Failed to delete dependant' });
  }
});

// GET /api/users/patients — list all registered patients (for pharmacist issue form)
router.get('/patients', authMiddleware, async (req, res) => {
  try {
    const { search, limit = 100 } = req.query;
    let query = {};
    if (search && search.trim()) {
      const s = search.trim();
      query = {
        $or: [
          { name:  { $regex: s, $options: 'i' } },
          { email: { $regex: s, $options: 'i' } },
          { roll:  { $regex: s, $options: 'i' } },
          { uhid:  { $regex: s, $options: 'i' } },
        ]
      };
    }
    const patients = await User.find(query)
      .select('name email roll phone uhid sex age')
      .sort({ name: 1 })
      .limit(parseInt(limit))
      .lean();
    res.json(patients);
  } catch (err) {
    console.error('Error fetching patients:', err);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

module.exports = router;
