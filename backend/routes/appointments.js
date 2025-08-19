const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Doctor = require("../models/Doctor");

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
      extendedProperties: {
        private: { doctorId, slotDay, slotTime, startDateTime }
      }
    };

    const response = await calendar.events.insert({ calendarId: "primary", requestBody: event });

    // Update DB
    const daySlot = doctor.weeklySlots.find(d => d.day === slotDay);
    if (daySlot) {
      const timeSlot = daySlot.times.find(t => t.time === slotTime);
      if (timeSlot) {
        timeSlot.status = "booked";
        await doctor.save();
      }
    }

    res.json({ event: response.data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get appointments
router.get("/my-appointments", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: "Missing token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const oAuth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    oAuth2Client.setCredentials({ access_token: user.googleAccessToken, refresh_token: user.googleRefreshToken });

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    res.json({ events: response.data.items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
// Cancel appointment
router.delete("/:eventId/cancel", async (req, res) => {
  try {
    const { token, doctorId, slotDay, slotTime, startDateTime } = req.body;
    const { eventId } = req.params;
    if (!token) return res.status(400).json({ error: "Missing token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const oAuth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    oAuth2Client.setCredentials({ access_token: user.googleAccessToken, refresh_token: user.googleRefreshToken });

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    await calendar.events.delete({ calendarId: 'primary', eventId });

    // Reset DB
    const doctor = await Doctor.findById(doctorId);
if (doctor) {
  const daySlot = doctor.weeklySlots.find(d => d.day === slotDay);
  if (daySlot) {
    const timeSlot = daySlot.times.find(t => t.time === slotTime);
    if (timeSlot) {
      timeSlot.status = "available";  
      await doctor.save();
    }
  }
}


    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
