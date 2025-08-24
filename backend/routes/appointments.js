const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Doctor = require("../models/Doctor");

const Appointment = require('../models/Appointment');
// Book appointment
router.post("/book", async (req, res) => {
  try {
    const { token, startDateTime, endDateTime, doctorId, slotDay, slotTime } = req.body;
    if (!token) return res.status(400).json({ error: "Missing token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    const oAuth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    oAuth2Client.setCredentials({ access_token: user.googleAccessToken, refresh_token: user.googleRefreshToken });

    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });
    const event = {
      summary: `Appointment with ${doctor.name}`,
      location: "Wellness Center, IIT Dharwad",
      start: { dateTime: startDateTime },
      end: { dateTime: endDateTime },
    };

    const response = await calendar.events.insert({ calendarId: "primary", requestBody: event });

    // Save appointment in DB
    const appointment = new Appointment({
      doctor: doctor._id,
      user: user._id,
      calendarEventId: response.data.id,
      startDateTime,
      endDateTime,
      slotDay,
      slotTime,
      status: "booked"
    });
    await appointment.save();

    // Update DB
    const daySlot = doctor.weeklySlots.find(d => d.day === slotDay);
    if (daySlot) {
      const timeSlot = daySlot.times.find(t => t.time === slotTime);
      if (timeSlot) {
        timeSlot.status = "booked";
        timeSlot.appointmentId = appointment._id;
      }
    }
    await doctor.save();
     res.json({ event: response.data, appointment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get user's appointments
router.get("/my-appointments", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: "Missing token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const appointments = await Appointment.find({ user: user._id })
      .populate("doctor", "name specialization")
      .sort({ startDateTime: 1 });

    // setup calendar client ONCE
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oAuth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
    });
    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

    // check each appointment → update status if calendar event missing or cancelled
    for (const appt of appointments) {
      if (appt.calendarEventId) {
        try {
          const event = await calendar.events.get({
            calendarId: "primary",
            eventId: appt.calendarEventId,
          });

          if (event.data.status === "cancelled") {
            // Event exists but is cancelled → update DB
            console.log("Event cancelled in calendar:", appt.calendarEventId);
            appt.status = "cancelled by user";
            appt.calendarEventId = null;
            await appt.save();
            // Free the doctor's slot
            const doctor = await Doctor.findById(appt.doctor);  // use appt.doctor
            if (doctor) {
              const daySlot = doctor.weeklySlots.find(d => d.day === appt.slotDay); // use appt.slotDay
              if (daySlot) {
                const timeSlot = daySlot.times.find(t => t.time === appt.slotTime); // use appt.slotTime
                if (timeSlot) {
                  timeSlot.status = "available";
                  timeSlot.appointmentId = null;
                }
              }
              await doctor.save();
            }
          } else {
            // Event still active
            console.log(
              "Event exists:",
              appt.calendarEventId,
              event.data.summary,
              event.data.start
            );
          }
        } catch (err) {
          const isNotFound =
            err?.code === 404 ||
            err?.errors?.some(e => e.reason === "notFound");

          if (isNotFound) {
            console.log("Event missing, cancelling:", appt.calendarEventId);
            appt.status = "cancelled by user";
            appt.calendarEventId = null;
            await appt.save();
            
          } else {
            console.error("Calendar API error:", err);
          }
        }
      }
    }

    res.json({ appointments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get a doctor's appointments
router.get("/doctor-appointments", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: "Missing token" });
    }

    // Verify the token to get the doctor's ID
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'doctor') {
      return res.status(403).json({ error: "Access denied. Not a doctor." });
    }

    const doctor = await Doctor.findById(decoded.id);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    // Find all appointments for this doctor and populate patient details
    const appointments = await Appointment.find({ doctor: doctor._id })
      .populate("user", "name email phone") // Select which user fields to show
      .sort({ startDateTime: -1 }); // Sort by most recent first

    res.json({ appointments });
  } catch (err) {
    console.error("Error fetching doctor's appointments:", err);
    res.status(500).json({ error: err.message });
  }
});

// Cancel appointment
router.delete("/:eventId/cancel", async (req, res) => {
  try {
    const { token, doctorId, slotDay, slotTime } = req.body;
    const { eventId } = req.params;
    if (!token) return res.status(400).json({ error: "Missing token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Find appointment in DB
    const appointment = await Appointment.findOne({ calendarEventId: eventId, user: user._id });
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    // Check booking age
    const now = new Date();
    const diffMinutes = Math.floor((now - appointment.createdAt) / (1000 * 60)); // minutes since booking

    // Google Calendar setup
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oAuth2Client.setCredentials({ 
      access_token: user.googleAccessToken, 
      refresh_token: user.googleRefreshToken 
    });

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    await calendar.events.delete({ calendarId: 'primary', eventId });

    // Reset doctor slot
    const doctor = await Doctor.findById(doctorId);
    if (doctor) {
      const daySlot = doctor.weeklySlots.find(d => d.day === slotDay);
      if (daySlot) {
        const timeSlot = daySlot.times.find(t => t.time === slotTime);
        if (timeSlot) {
          timeSlot.status = "available";
          timeSlot.appointmentId = null;
        }
      }
      await doctor.save();
    }

    if (diffMinutes <= 15) {
      // Cancel within 15 minutes → delete appointment
      await Appointment.findByIdAndDelete(appointment._id);
      return res.json({ success: true, message: "Appointment deleted (cancelled within 15 minutes)" });
    } else {
      // After 15 minutes → mark as cancelled
      appointment.status = "cancelled by user";
      await appointment.save();
      return res.json({ success: true, message: "Appointment marked as cancelled by user" });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
