const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { logActivity, getClientIp } = require('../utils/audit');

const DEPENDANT_ALLOWED_CATEGORIES = ["Faculty", "Staff", "Outsourced Staff"];
const PATIENT_CATEGORIES = ["Student", "Faculty", "Staff", "Outsourced Staff"];

// GET /api/users/next-uhid — returns next sequential UHID like "0001", "0002" etc.
router.get('/next-uhid', authMiddleware, async (req, res) => {
  try {
    const count = await User.countDocuments({ uhid: { $exists: true, $ne: null, $ne: '' } });
    const nextNum = count + 1;
    const uhid = String(nextNum).padStart(4, '0');
    res.json({ uhid });
  } catch (err) {
    console.error('Error generating UHID:', err);
    res.status(500).json({ error: 'Failed to generate UHID' });
  }
});

// GET /api/users/patient-uhid/:patientId — allows doctors/nurses to fetch a patient's UHID by ID
// Auto-assigns UHID if the patient doesn't have one yet
router.get('/patient-uhid/:patientId', authMiddleware, async (req, res) => {
  try {
    const { patientId } = req.params;
    let patient = await User.findById(patientId).select('uhid name');
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // If patient has no UHID, generate and save one now
    if (!patient.uhid) {
      const count = await User.countDocuments({ uhid: { $exists: true, $ne: null, $ne: '' } });
      const newUhid = String(count + 1).padStart(4, '0');
      console.log(`[UHID] Auto-assigning UHID ${newUhid} to patient ${patient.name}`);
      patient = await User.findByIdAndUpdate(
        patientId,
        { uhid: newUhid },
        { new: true }
      ).select('uhid name');
    }

    res.json({ uhid: patient.uhid || '', name: patient.name || '' });
  } catch (err) {
    console.error('Error fetching patient UHID:', err);
    res.status(500).json({ error: 'Failed to fetch patient UHID' });
  }
});

router.post('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, roll, sex, age, phone, allergies, consentAccepted, patientCategory } = req.body;

    const before = await User.findById(req.user.id).lean();

    const updates = { name, roll, sex, age, phone, allergies, consentAccepted };
    if (patientCategory) {
      if (!PATIENT_CATEGORIES.includes(patientCategory)) {
        return res.status(400).json({ error: 'Invalid patient category' });
      }
      updates.patientCategory = patientCategory;
    }

    // Auto-assign UHID if the user doesn't already have one
    if (!before || !before.uhid) {
      const count = await User.countDocuments({ uhid: { $exists: true, $ne: null, $ne: '' } });
      updates.uhid = String(count + 1).padStart(4, '0');
    }

    // Mark profile as complete so user is not re-directed to initial-profile on next login
    updates.profileComplete = true;

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
    let user = await User.findById(req.user.id).select('-password');

    // If user has no UHID yet, generate and assign one now
    if (user && !user.uhid) {
      const count = await User.countDocuments({ uhid: { $exists: true, $ne: null, $ne: '' } });
      const newUhid = String(count + 1).padStart(4, '0');
      console.log(`[UHID] Auto-assigning UHID ${newUhid} to user ${user.email}`);
      // Use findByIdAndUpdate to avoid stale-select issues with .save()
      user = await User.findByIdAndUpdate(
        req.user.id,
        { uhid: newUhid },
        { new: true }
      ).select('-password');
    }

    res.json(user);
  } catch (err) {
    console.error('Error fetching profile:', err);
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

// GET /api/users/patient-dependants?email=... — allows doctors/nurses to select a patient's dependant
router.get('/patient-dependants', authMiddleware, async (req, res) => {
  try {
    if (!['doctor', 'nurse'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Only doctors and nurses can access patient dependants' });
    }

    const email = req.query.email?.trim();
    if (!email) return res.status(400).json({ error: 'Patient email is required' });

    const user = await User.findOne({ email }).select('patientCategory dependants');
    if (!user) return res.status(404).json({ error: 'Patient not found' });

    res.json({ patientCategory: user.patientCategory, dependants: user.dependants || [] });
  } catch (err) {
    console.error('Error fetching patient dependants:', err);
    res.status(500).json({ error: 'Failed to fetch patient dependants' });
  }
});

router.post('/dependants', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!DEPENDANT_ALLOWED_CATEGORIES.includes(user.patientCategory)) {
      return res.status(403).json({ error: 'Dependants are only allowed for faculty/staff accounts' });
    }

    const { name, age, sex, relationship, bloodGroup, phone, allergies } = req.body;
    if (!name) return res.status(400).json({ error: 'Dependant name is required' });

    // Generate a unique UHID from the shared global counter
    // Count ALL assigned UHIDs: main patients + all dependants across all users
    const mainPatientCount = await User.countDocuments({ uhid: { $exists: true, $ne: null, $ne: '' } });
    const allUsers = await User.find({ 'dependants.uhid': { $exists: true, $ne: null, $ne: '' } }, 'dependants.uhid');
    const dependantUhidCount = allUsers.reduce((total, u) => {
      return total + (u.dependants || []).filter(d => d.uhid && d.uhid !== '').length;
    }, 0);
    const nextUhid = String(mainPatientCount + dependantUhidCount + 1).padStart(4, '0');

    const newDependant = {
      _id: new mongoose.Types.ObjectId(),
      name,
      age,
      sex,
      relationship,
      bloodGroup,
      phone,
      allergies,
      uhid: nextUhid,
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
          { name: { $regex: s, $options: 'i' } },
          { email: { $regex: s, $options: 'i' } },
          { roll: { $regex: s, $options: 'i' } },
          { uhid: { $regex: s, $options: 'i' } },
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
