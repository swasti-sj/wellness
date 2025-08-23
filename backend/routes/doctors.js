const express = require('express');
const router = express.Router();
const Doctor = require('../models/Doctor');
const moment = require('moment');

// Get doctors with available weekly slots for the next 7 days
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
      }).filter(s => s !== null);

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

module.exports = router;
