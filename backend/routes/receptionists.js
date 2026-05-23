const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');
const Receptionist = require('../models/Receptionist');
const ReceptionistEntry = require('../models/ReceptionistEntry');
const Doctor = require('../models/Doctor');

// Get receptionist profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const receptionist = await Receptionist.findById(req.user.id).select('-googleAccessToken -googleRefreshToken');
    if (!receptionist) return res.status(404).json({ error: 'Receptionist not found' });
    res.json(receptionist);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching receptionist profile' });
  }
});

// Update receptionist profile
router.post('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, phone, age, sex } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (age !== undefined) updates.age = age;
    if (sex !== undefined) updates.sex = sex;

    const receptionist = await Receptionist.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-googleAccessToken -googleRefreshToken');

    if (!receptionist) return res.status(404).json({ error: 'Receptionist not found' });
    res.json(receptionist);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update receptionist profile' });
  }
});

// ===============================
// RECEPTIONIST ENTRIES ENDPOINTS
// ===============================

// CREATE - Add new receptionist entry
router.post("/entries", async (req, res) => {
  try {
    console.log("[API] POST /receptionist/entries called");

    const { patientName, roll, role, doctorId, doctorName, appointmentDate, appointmentTime, email, phone } = req.body;


    // Validate required fields
    if (!patientName || !roll || !doctorId || !doctorName) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify doctor exists
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    // Create (or reuse) a real User + real Appointment so doctors/nurses/patient can see it.
    // ReceptionistEntry remains for receptionist UI/history.

    const appointmentDateObj = appointmentDate ? new Date(appointmentDate) : new Date();
    // receptionist UI stores only time string, so we try to use it to build startDateTime.
    // If no time provided or parsing fails, default to 10:00.
    let startDateTime = new Date(appointmentDateObj);
    let endDateTime = new Date(appointmentDateObj);

    const defaultStart = { h: 10, m: 0 };

    if (appointmentTime && typeof appointmentTime === 'string' && appointmentTime.trim()) {
      // Expected formats might be: "14:30" or "2:30 PM".
      const t = appointmentTime.trim();
      const parsed = new Date(`${appointmentDateObj.toISOString().slice(0, 10)}T00:00:00`);
      // Try HH:MM (24h)
      const hhmm = t.match(/^(\d{1,2}):(\d{2})$/);
      if (hhmm) {
        parsed.setHours(parseInt(hhmm[1], 10), parseInt(hhmm[2], 10), 0, 0);
        startDateTime = parsed;
      } else {
        // Try Date-parsing for things like "2:30 PM" by setting time on a Date.
        const timeTry = new Date(`${appointmentDateObj.toISOString().slice(0, 10)} ${t}`);
        if (!isNaN(timeTry.getTime())) {
          startDateTime = timeTry;
        } else {
          startDateTime.setHours(defaultStart.h, defaultStart.m, 0, 0);
        }
      }
    } else {
      startDateTime.setHours(defaultStart.h, defaultStart.m, 0, 0);
    }

    // Appointment duration: default 30 mins (since receptionist UI doesn't send duration)
    endDateTime = new Date(startDateTime.getTime() + 30 * 60 * 1000);

    // Find patient user by roll or (email if provided)
    // Your User model is not shown here, so we keep it flexible.
    const patientQuery = { $or: [{ roll }, { email: email && email !== '-' ? email : undefined }] };
    // Remove undefined email query to avoid matching everything.
    if (patientQuery.$or) {
      patientQuery.$or = patientQuery.$or.filter(Boolean);
    }

    const User = require('../models/User');
    let patientUser = await User.findOne(patientQuery);
    if (!patientUser) {
      // Create minimal user so appointment foreign keys work.
      patientUser = new User({
        name: patientName,
        roll,
        email: email && email !== '-' ? email : undefined,
        phone: phone && phone !== '-' ? phone : undefined,
        role: 'user'
      });
      await patientUser.save();
    }


    const Appointment = require('../models/Appointment');
    const appointment = new Appointment({
      doctor: doctor._id,
      user: patientUser._id,
      startDateTime,
      endDateTime,
      slotDay: undefined,
      slotTime: appointmentTime || undefined,
      status: 'booked',
      bookedBy: 'receptionist'
    });
    await appointment.save();

    const newEntry = new ReceptionistEntry({
      patientName,
      roll,
      role: role || 'Student',
      doctorId,
      doctorName,
      appointmentDate: appointmentDateObj,
      appointmentTime: appointmentTime || null,
      email: email || "-",
      phone: phone || "-",
      status: 'booked'
    });

    // NOTE: receptionist entries here create a real Appointment (so doctor/nurse/patient UIs see it).
    // This receptionist entry record is kept only for receptionist dashboard history UI.


    await newEntry.save();

    res.json({
      success: true,
      message: "Entry added successfully",
      entry: newEntry,
      appointmentId: appointment._id
    });

  } catch (err) {
    console.error("Error creating receptionist entry:", err);
    res.status(500).json({ error: err.message });
  }
});

// READ - Get all receptionist entries
router.get("/entries", async (req, res) => {
  try {
    console.log("[API] GET /receptionist/entries called");

    const entries = await ReceptionistEntry.find()
      .populate("doctorId", "name specialization email _id")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      entries
    });

  } catch (err) {
    console.error("Error fetching receptionist entries:", err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE - Update receptionist entry
router.patch("/entries/:entryId", async (req, res) => {
  try {
    console.log("[API] PATCH /receptionist/entries/:entryId called");

    const { entryId } = req.params;
    const { patientName, roll, role, doctorId, doctorName, appointmentDate, appointmentTime, status, email, phone } = req.body;

    // Find entry
    const entry = await ReceptionistEntry.findById(entryId);
    if (!entry) {
      return res.status(404).json({ error: "Entry not found" });
    }

    // Verify doctor if being updated
    if (doctorId && doctorId !== entry.doctorId.toString()) {
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        return res.status(404).json({ error: "Doctor not found" });
      }
    }

    // Update fields
    if (patientName) entry.patientName = patientName;
    if (roll) entry.roll = roll;
    if (role) entry.role = role;
    if (doctorId) entry.doctorId = doctorId;
    if (doctorName) entry.doctorName = doctorName;
    if (appointmentDate !== undefined) entry.appointmentDate = appointmentDate ? new Date(appointmentDate) : null;
    if (appointmentTime !== undefined) entry.appointmentTime = appointmentTime;
    if (status) entry.status = status;
    if (email) entry.email = email;
    if (phone) entry.phone = phone;

    entry.updatedAt = new Date();
    await entry.save();

    res.json({
      success: true,
      message: "Entry updated successfully",
      entry
    });

  } catch (err) {
    console.error("Error updating receptionist entry:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Remove receptionist entry
router.delete("/entries/:entryId", async (req, res) => {
  try {
    console.log("[API] DELETE /receptionist/entries/:entryId called");

    const { entryId } = req.params;

    const entry = await ReceptionistEntry.findByIdAndDelete(entryId);
    if (!entry) {
      return res.status(404).json({ error: "Entry not found" });
    }

    res.json({
      success: true,
      message: "Entry deleted successfully"
    });

  } catch (err) {
    console.error("Error deleting receptionist entry:", err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE STATUS - Update entry status
router.patch("/entries/:entryId/status", async (req, res) => {
  try {
    console.log("[API] PATCH /receptionist/entries/:entryId/status called");

    const { entryId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const validStatuses = ['Added', 'booked', 'attended', 'no show', 'cancelled by user', 'cancelled by doctor', 'cancelled by nurse', 'cancelled by receptionist', 'walk in'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const entry = await ReceptionistEntry.findByIdAndUpdate(
      entryId,
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!entry) {
      return res.status(404).json({ error: "Entry not found" });
    }

    res.json({
      success: true,
      message: "Status updated successfully",
      entry
    });

  } catch (err) {
    console.error("Error updating entry status:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
