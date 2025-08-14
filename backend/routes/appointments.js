const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const authMiddleware = require('../middleware/auth');
const Doctor = require('../models/Doctor');

router.post('/book', authMiddleware, async (req, res) => {
  const { doctorId, date, time, notes } = req.body;

  try {
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

    const dateSlot = doctor.availableSlots.find(slot => slot.date === date);
    if (!dateSlot || !dateSlot.times.includes(time)) {
      return res.status(400).json({ error: 'Selected time not available' });
    }

    const appointment = new Appointment({
      doctorId,
      doctorName: doctor.name,
      userId: req.user.id,
      date,
      time,
      notes: notes || '',
    });

    await appointment.save();

    dateSlot.times = dateSlot.times.filter(t => t !== time);
    if (dateSlot.times.length === 0) {
      doctor.availableSlots = doctor.availableSlots.filter(s => s.date !== date);
    }

    await doctor.save();

    res.status(201).json({ message: 'Appointment booked successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/my-appointments', authMiddleware, async (req, res) => {
  try {
    const appointments = await Appointment.find({ userId: req.user.id });

    // Convert to full Date objects for proper sorting
    const sorted = appointments.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateA - dateB;
    });

    const now = new Date();

    // Find the nearest upcoming appointment
    const upcoming = sorted.find(appt => {
      return new Date(`${appt.date}T${appt.time}`) > now;
    }) || null;

    // Find the most recent past appointment
    const pastAppointments = sorted.filter(appt => {
      return new Date(`${appt.date}T${appt.time}`) <= now;
    });
    const lastVisit = pastAppointments.length > 0
      ? pastAppointments[pastAppointments.length - 1]
      : null;

    res.json({ upcoming, lastVisit });
  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


router.get('/history', authMiddleware, async (req, res) => {
  try {
    const appointments = await Appointment.find({ userId: req.user.id })
      .populate({
        path: 'doctorId',
        select: 'name specialization',
        match: { specialization: 'Psychiatrist' },
      })
      .sort({ date: -1, time: -1 });

    const filtered = appointments.filter(appt => appt.doctorId);
    const formatted = filtered.map(appt => ({
      doctor: appt.doctorId.name,
      specialization: appt.doctorId.specialization,
      date: appt.date,
      time: appt.time,
      notes: appt.notes || '',
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error fetching history');
  }
});

module.exports = router;
