const express = require('express');
const router = express.Router();
const Doctor = require('../models/Doctor');
const moment = require('moment');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');

// 🔹 List all doctors (basic info)
router.get('/list', async (req, res) => {
  console.log("Fetching doctors...");
  try {
    const doctors = await Doctor.find().select("name specialization email picture").lean();
    res.set('Cache-Control', 'no-store'); // prevent caching
    res.json(doctors.map(d => ({ ...d, _id: d._id.toString() })));
  } catch (err) {
    console.error("Error fetching doctors:", err);
    res.status(500).json({ error: "Error fetching doctors" });
  }
});

// 🔹 Get doctors with available weekly slots for next 7 days
router.get('/available', async (req, res) => {
  try {
    const doctors = await Doctor.find();

    const next7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return {
        date: d.toISOString().split('T')[0],
        day: d.toLocaleDateString('en-US', { weekday: 'long' })
      };
    });

    const availableDoctors = doctors.map(doc => {
      const weeklySlots = doc.weeklySlots || [];
      const slots = next7Days.map(d => {
        const slot = weeklySlots.find(s => s.day === d.day);
        if (!slot) return null;

        const times = (slot.times || []).filter(t => t.status === 'available');
        if (times.length === 0) return null;

        return {
          date: d.date,
          day: d.day,
          times
        };
      }).filter(Boolean);

      return {
        _id: doc._id,
        name: doc.name,
        specialization: doc.specialization,
        availableSlots: slots
      };
    }).filter(d => d.availableSlots.length > 0);

    res.json(availableDoctors);
  } catch (err) {
    console.error('Error fetching available slots:', err);
    res.status(500).send('Error fetching available slots');
  }
});


// ==============================
// 🧠 Doctor Profile Endpoints
// ==============================

// 🔹 Get logged-in doctor profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.user.id)
      .select('-googleAccessToken -googleRefreshToken'); // hide sensitive data

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    res.json(doctor);
  } catch (err) {
    console.error('Error fetching doctor profile:', err);
    res.status(500).json({ error: 'Error fetching doctor profile' });
  }
});

// 🔹 Update doctor profile (editable fields)
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, email, phone, specialization, weeklySlots } = req.body;

    // Allow partial updates — only update provided fields
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (specialization !== undefined) updates.specialization = specialization;
    if (weeklySlots !== undefined) updates.weeklySlots = weeklySlots;

    const updatedDoctor = await Doctor.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-googleAccessToken -googleRefreshToken');

    if (!updatedDoctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    res.json(updatedDoctor);
  } catch (err) {
    console.error('Error updating doctor profile:', err);
    res.status(500).json({ error: 'Failed to update doctor profile' });
  }
});

module.exports = router;
