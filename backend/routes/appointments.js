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
    if (!dateSlot) return res.status(400).json({ error: 'Selected date not available' });

    const timeSlot = dateSlot.times.find(t => t.time === time);
    if (!timeSlot || timeSlot.status !== 'available') {
      return res.status(400).json({ error: 'Selected time not available' });
    }

    const moment = require('moment-timezone');

    const appointment = new Appointment({
      doctorId,
      doctorName: doctor.name,
      userId: req.user.id,
      date,
      time,
      bookedAt: moment().tz('Asia/Kolkata').toDate(), // store IST time
      status: 'booked'
    });

    await appointment.save();

    // Update doctor slot status
    timeSlot.status = 'booked';
    timeSlot.appointmentId = appointment._id;

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

    // Sort by actual scheduled date/time
    const sorted = appointments.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateA - dateB;
    });

    const now = new Date();

    // Find nearest upcoming (future) appointment
    const upcoming = sorted.find(appt => {
      return new Date(`${appt.date}T${appt.time}`) > now;
    }) || null;

    // Find the most recent *attended* appointment
    const pastAppointments = sorted.filter(appt => {
      return new Date(`${appt.date}T${appt.time}`) <= now && appt.status === 'attended';
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
    const now = new Date();
    appointments.forEach(appt => {
      const apptTime = new Date(`${appt.date}T${appt.time}`);
      const oneHourAfter = new Date(apptTime.getTime() + 60 * 60 * 1000);

      if (now > oneHourAfter && appt.status === 'booked') {
        appt.status = 'no show';
        appt.save();
      }
    });

    const filtered = appointments.filter(appt => appt.doctorId);
    const formatted = filtered.map(appt => ({
      _id: appt._id,
      doctor: appt.doctorId.name,
      specialization: appt.doctorId.specialization,
      date: appt.date,
      time: appt.time,
      notes: appt.notes || '',
      status: appt.status
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error fetching history');
  }
});

router.patch('/:id/status', authMiddleware, async (req, res) => {
  const { status } = req.body; // 'cancelled by user', etc.
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

    appointment.status = status;
    await appointment.save();

    // Also update the doctor slot status
    const doctor = await Doctor.findById(appointment.doctorId);
    if (doctor) {
      const dateSlot = doctor.availableSlots.find(s => s.date === appointment.date);
      if (dateSlot) {
        const timeSlot = dateSlot.times.find(t => t.time === appointment.time);
        if (timeSlot) {
          timeSlot.status = status === 'cancelled by user' || status === 'cancelled by doctor'
            ? 'available'
            : status;
          timeSlot.appointmentId = status === 'available' ? null : appointment._id;
        }
      }
      await doctor.save();
    }

    res.json({ message: 'Status updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error updating status' });
  }
});

router.patch('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

    const now = new Date();
    const diffMinutes = (now - new Date(appointment.bookedAt)) / (1000 * 60);

    const doctorId = appointment.doctorId;
    const date = appointment.date;
    const time = appointment.time;

    if (diffMinutes <= 15) {
      // Cancelled within 15 min → delete appointment entirely
      await Appointment.findByIdAndDelete(req.params.id);
    } else {
      // Cancelled after 15 min → mark as cancelled by user
      appointment.status = 'cancelled by user';
      await appointment.save();
    }

    // Free up slot in doctor's schedule
    const doctor = await Doctor.findById(doctorId);
    if (doctor) {
      const dateSlot = doctor.availableSlots.find(s => s.date === date);
      if (dateSlot) {
        const timeSlot = dateSlot.times.find(t => t.time === time);
        if (timeSlot) {
          timeSlot.status = 'available';
          timeSlot.appointmentId = null;
        }
      }
      await doctor.save();
    }

    res.json({ message: 'Appointment cancelled successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error cancelling appointment' });
  }
});

module.exports = router;
