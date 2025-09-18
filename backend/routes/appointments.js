const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Appointment = require('../models/Appointment');

// ===============================
// PATIENT BOOK APPOINTMENT ENDPOINT
// ===============================

// POST /book → Creates a new appointment for a user with a doctor
router.post("/book", async (req, res) => {
  try {
    console.log("[API] POST /book called");

    // Extract required data from the request body
    const { token, startDateTime, endDateTime, doctorId, slotDay, slotTime } = req.body;

    // 1️⃣ Validate: Token must be provided for authentication
    if (!token) return res.status(400).json({ error: "Missing token" });

    // 2️⃣ Decode and verify JWT token to get the logged-in user's ID
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3️⃣ Fetch the user from the database
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // 4️⃣ Fetch the doctor from the database
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    // 5️⃣ Setup Google OAuth2 client for accessing the user's Google Calendar
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    // Provide the user's saved Google tokens (from when they linked their account)
    oAuth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken
    });

    // 6️⃣ Create a Google Calendar API client
    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

    // 7️⃣ Define the calendar event details
    const event = {
      summary: `Appointment with ${doctor.name}`, // Event title
      location: "Wellness Center, IIT Dharwad",   // Event location
      start: { dateTime: startDateTime },         // Start time (ISO format)
      end: { dateTime: endDateTime },             // End time (ISO format)
    };

    // 8️⃣ Insert the event into the user's primary Google Calendar
    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: event
    });

    // 9️⃣ Save the appointment in our own database
    const appointment = new Appointment({
      doctor: doctor._id,
      user: user._id,
      calendarEventId: response.data.id, // Store Google Calendar event ID
      startDateTime,
      endDateTime,
      slotDay,
      slotTime,
      status: "booked"
    });
    await appointment.save();

    // 🔟 Update the doctor's availability in the DB
    const daySlot = doctor.weeklySlots.find(d => d.day === slotDay);
    if (daySlot) {
      const timeSlot = daySlot.times.find(t => t.time === slotTime);
      if (timeSlot) {
        timeSlot.status = "booked";
        timeSlot.appointmentId = appointment._id;
      }
    }
    await doctor.save();

    // ✅ Respond with both the Google Calendar event and our DB appointment
    res.json({ event: response.data, appointment });

  } catch (err) {
    // Handle unexpected errors
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// ===============================
// PATIENT GET USER'S APPOINTMENTS ENDPOINT
// ===============================

// GET /my-appointments → Returns all appointments for the logged-in user
router.get("/my-appointments", async (req, res) => {
  try {
    console.log("[API] GET /my-appointments called");

    // 1️⃣ Extract token from query params
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: "Missing token" });

    // 2️⃣ Decode and verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3️⃣ Fetch the user from DB
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // 4️⃣ Fetch all appointments for this user
    const appointments = await Appointment.find({ user: user._id })
      .populate("doctor", "name specialization") // Include doctor's name & specialization
      .sort({ startDateTime: 1 });               // Sort by upcoming first

    // 5️⃣ Setup Google Calendar API client (once for all appointments)
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oAuth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
    });
    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

    // 6️⃣ Loop through each appointment to verify its status in Google Calendar
    for (const appt of appointments) {
      if (appt.calendarEventId) {
        try {
          // Try to fetch the event from Google Calendar
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

            // Free the doctor's slot in DB
            const doctor = await Doctor.findById(appt.doctor);
            if (doctor) {
              const daySlot = doctor.weeklySlots.find(d => d.day === appt.slotDay);
              if (daySlot) {
                const timeSlot = daySlot.times.find(t => t.time === appt.slotTime);
                if (timeSlot) {
                  timeSlot.status = "available";
                  timeSlot.appointmentId = null;
                }
              }
              await doctor.save();
            }

          } else {
            // Event still exists and is active
            console.log(
              "Event exists:",
              appt.calendarEventId,
              event.data.summary,
              event.data.start
            );
          }

        } catch (err) {
          // If event not found in Google Calendar → mark as cancelled
          const isNotFound =
            err?.code === 404 ||
            err?.errors?.some(e => e.reason === "notFound");

          if (isNotFound) {
            console.log("Event missing, cancelling:", appt.calendarEventId);
            appt.status = "cancelled by user";
            appt.calendarEventId = null;
            await appt.save();
          } else {
            // Other Google Calendar API errors
            console.error("Calendar API error:", err);
          }
        }
      }
    }

    // ✅ Return the updated list of appointments
    res.json({ appointments });

  } catch (err) {
    // Handle unexpected errors
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Cancel appointment (original user cancellation)
router.delete("/:eventId/cancel", async (req, res) => {
  try {
    console.log("[API] DELETE /:eventId/cancel called");
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

// ===============================
// DOCTOR MANAGE APPOINTMENTS ENDPOINTS
// ===============================

/**
 * Helper: Ensure we have a fresh access token for Google API calls.
 * @param {Object} entity - Mongoose document (Doctor or User) with googleAccessToken & googleRefreshToken
 * @param {String} entityType - 'doctor' or 'user' (for saving back to correct collection)
 * @returns {OAuth2Client} Authenticated OAuth2 client with fresh token
 */
async function ensureFreshAccessToken(entity, entityType) {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oAuth2Client.setCredentials({
    access_token: entity.googleAccessToken,
    refresh_token: entity.googleRefreshToken
  });

  // Force refresh if token is expired or about to expire
  try {
    const { credentials } = await oAuth2Client.getAccessToken();
    if (credentials?.token) {
      // Update in DB if token changed
      if (credentials.token !== entity.googleAccessToken) {
        entity.googleAccessToken = credentials.token;
        await entity.save();
        console.log(`[Token Refresh] Updated ${entityType}'s access token in DB`);
      }
    }
  } catch (err) {
    console.error(`[Token Refresh] Failed for ${entityType}:`, err.message);
    throw new Error(`Google Calendar authentication failed for ${entityType}`);
  }

  return oAuth2Client;
}

// Doctor books appointment for patient
router.post("/doctor-book", async (req, res) => {
  try {
    console.log("[API] POST /doctor-book called");
    
    const { token, patientEmail, patientPhone, startDateTime, endDateTime, slotDay, slotTime } = req.body;
    if (!token) return res.status(400).json({ error: "Missing token" });

    // Verify doctor token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'doctor') {
      return res.status(403).json({ error: "Access denied. Not a doctor." });
    }
    
    const doctor = await Doctor.findById(decoded.id);
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });
    //debugging
    console.log("[Doctor Record]", {
      id: doctor._id,
      email: doctor.email,
      hasAccessToken: !!doctor.googleAccessToken,
      hasRefreshToken: !!doctor.googleRefreshToken,
      accessToken: doctor.googleAccessToken,
      refreshToken: doctor.googleRefreshToken
    });
    // Step 1: Create OAuth2 client right away
    const doctorOAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    // Step 2: If we have at least a refresh token, try to refresh
    if (doctor.googleRefreshToken) {
      doctorOAuth2Client.setCredentials({
        access_token: doctor.googleAccessToken || null,
        refresh_token: doctor.googleRefreshToken
      });

      try {
        const { credentials } = await doctorOAuth2Client.getAccessToken();
        if (credentials?.token) {
          doctor.googleAccessToken = credentials.token;
          await doctor.save();
          console.log("[Token Refresh] Doctor's access token updated");
        }
      } catch (err) {
        console.error("Failed to refresh doctor's token:", err.message);
        return res.status(400).json({ error: "Google Calendar refresh failed. Please reconnect your account." });
      }
    } else {
        if (!doctor.googleAccessToken ) {
            // Try to find linked user record for same email
            const linkedUser = await User.findOne({ email: doctor.email });
            if (linkedUser?.googleAccessToken && linkedUser?.googleRefreshToken) {
                doctor.googleAccessToken = linkedUser.googleAccessToken;
                doctor.googleRefreshToken = linkedUser.googleRefreshToken;
            } else {
                return res.status(400).json({ error: "Doctor's Google Calendar not connected. Please connect your Google account first." });
            }
        }
        doctorOAuth2Client.setCredentials({
            access_token: doctor.googleAccessToken
        });
      }

    // Find or create patient
    let patient = await User.findOne({ email: patientEmail });
    if (!patient) {
      patient = new User({
        googleId: `temp_${Date.now()}`,
        email: patientEmail,
        phone: patientPhone || '',
        name: patientEmail.split('@')[0],
        role: 'user',
        isVerified: false
      });
      await patient.save();
    }

    const doctorCalendar = google.calendar({ version: "v3", auth: doctorOAuth2Client });

    // Create event in doctor's calendar
    const doctorEvent = {
      summary: `Appointment with ${patient.name || patient.email}`,
      description: `Patient: ${patient.name || 'Unknown'}\nEmail: ${patient.email}\nPhone: ${patient.phone || 'Not provided'}`,
      location: "Wellness Center, IIT Dharwad",
      start: { dateTime: startDateTime },
      end: { dateTime: endDateTime },
    };

    let doctorCalendarResponse;
    try {
      doctorCalendarResponse = await doctorCalendar.events.insert({ 
        calendarId: "primary", 
        requestBody: doctorEvent 
      });
      console.log("Created event in doctor's calendar:", doctorCalendarResponse.data.id);
    } catch (calendarErr) {
      console.error("Failed to create event in doctor's calendar:", calendarErr);
      return res.status(500).json({ error: "Failed to create calendar event. Please check your Google Calendar connection." });
    }

    // Save appointment in DB
    const appointment = new Appointment({
      doctor: doctor._id,
      user: patient._id,
      calendarEventId: doctorCalendarResponse.data.id,
      startDateTime,
      endDateTime,
      slotDay,
      slotTime,
      status: "booked",
      bookedBy: "doctor"
    });
    await appointment.save();

    // ✅ Try to add to patient's calendar if connected
    let patientCalendarEventId = null;
    if (patient.googleAccessToken && patient.googleRefreshToken) {
      try {
        const patientOAuth2Client = await ensureFreshAccessToken(patient, 'user');
        const patientCalendar = google.calendar({ version: "v3", auth: patientOAuth2Client });

        const patientEvent = {
          summary: `Medical Appointment with Dr. ${doctor.name}`,
          description: `Appointment booked by Dr. ${doctor.name}\nSpecialization: ${doctor.specialization || 'General'}`,
          location: "Wellness Center, IIT Dharwad",
          start: { dateTime: startDateTime },
          end: { dateTime: endDateTime },
        };

        const patientResponse = await patientCalendar.events.insert({ 
          calendarId: "primary", 
          requestBody: patientEvent 
        });
        
        patientCalendarEventId = patientResponse.data.id;
        console.log("Created event in patient's calendar:", patientCalendarEventId);
      } catch (calendarErr) {
        console.log("Could not add to patient calendar:", calendarErr.message);
      }
    }

    // Update doctor's slot
    const daySlot = doctor.weeklySlots.find(d => d.day === slotDay);
    if (daySlot) {
      const timeSlot = daySlot.times.find(t => t.time === slotTime);
      if (timeSlot) {
        timeSlot.status = "booked";
        timeSlot.appointmentId = appointment._id;
      }
    }
    await doctor.save();

    const populatedAppointment = await appointment.populate("user", "name email phone");

    res.json({ 
      success: true, 
      appointment: populatedAppointment,
      doctorCalendarEventId: doctorCalendarResponse.data.id,
      patientCalendarEventId: patientCalendarEventId,
      message: `Appointment booked successfully. Created in doctor's calendar${patientCalendarEventId ? ' and patient\'s calendar' : ' (patient calendar not available)'}.`
    });
  } catch (err) {
    console.error("Doctor booking error:", err);
    res.status(500).json({ error: err.message });
  }
});


// Doctor cancels appointment
router.delete("/:appointmentId/doctor-cancel", async (req, res) => {
  try {
    console.log("[API] DELETE /:appointmentId/doctor-cancel called");
    const { token, slotDay, slotTime } = req.body;
    const { appointmentId } = req.params;
    
    if (!token) return res.status(400).json({ error: "Missing token" });

    // Verify doctor token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'doctor') {
      return res.status(403).json({ error: "Access denied. Not a doctor." });
    }

    const doctor = await Doctor.findById(decoded.id);
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    // Find appointment and populate user details
    const appointment = await Appointment.findById(appointmentId).populate('user');
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    // Verify this appointment belongs to this doctor
    if (appointment.doctor.toString() !== doctor._id.toString()) {
      return res.status(403).json({ error: "This appointment does not belong to you" });
    }

    let calendarDeletionErrors = [];

    // Cancel event in DOCTOR's calendar (primary calendar event)
    if (appointment.calendarEventId && doctor.googleAccessToken && doctor.googleRefreshToken) {
      try {
        const doctorOAuth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        doctorOAuth2Client.setCredentials({ 
          access_token: doctor.googleAccessToken, 
          refresh_token: doctor.googleRefreshToken 
        });

        const doctorCalendar = google.calendar({ version: 'v3', auth: doctorOAuth2Client });
        await doctorCalendar.events.delete({ 
          calendarId: 'primary', 
          eventId: appointment.calendarEventId 
        });
        console.log("Deleted event from doctor's calendar:", appointment.calendarEventId);
      } catch (calendarErr) {
        console.log("Could not cancel doctor's calendar event:", calendarErr.message);
        calendarDeletionErrors.push("doctor's calendar");
      }
    }

    // Try to cancel event in PATIENT's calendar if they have access
    // Note: We don't store patient's calendar event ID separately, so this is a best-effort search
    if (appointment.user && appointment.user.googleAccessToken && appointment.user.googleRefreshToken) {
      try {
        const patientOAuth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        patientOAuth2Client.setCredentials({ 
          access_token: appointment.user.googleAccessToken, 
          refresh_token: appointment.user.googleRefreshToken 
        });

        const patientCalendar = google.calendar({ version: 'v3', auth: patientOAuth2Client });
        
        // Search for events that match this appointment time and doctor
        const startTime = new Date(appointment.startDateTime);
        const endTime = new Date(appointment.endDateTime);
        
        const eventsResponse = await patientCalendar.events.list({
          calendarId: 'primary',
          timeMin: startTime.toISOString(),
          timeMax: endTime.toISOString(),
          q: `Dr. ${doctor.name}` // Search for events containing doctor's name
        });

        // Find and delete matching event
        if (eventsResponse.data.items && eventsResponse.data.items.length > 0) {
          for (const event of eventsResponse.data.items) {
            if (event.summary && event.summary.includes(doctor.name)) {
              await patientCalendar.events.delete({
                calendarId: 'primary',
                eventId: event.id
              });
              console.log("Deleted event from patient's calendar:", event.id);
              break; // Delete only the first matching event
            }
          }
        }
      } catch (calendarErr) {
        console.log("Could not cancel patient's calendar event:", calendarErr.message);
        calendarDeletionErrors.push("patient's calendar");
      }
    }

    // Reset doctor slot
    if (slotDay && slotTime) {
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

    // Update appointment status
    appointment.status = "cancelled by doctor";
    appointment.calendarEventId = null; // Clear the calendar event ID
    await appointment.save();

    let message = "Appointment cancelled successfully.";
    if (calendarDeletionErrors.length > 0) {
      message += ` Note: Could not remove from ${calendarDeletionErrors.join(' and ')}.`;
    }

    res.json({ 
      success: true, 
      message: message
    });

  } catch (err) {
    console.error("Doctor cancellation error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Update appointment status
router.patch("/:appointmentId/status", async (req, res) => {
  try {
    console.log("[API] PATCH /:appointmentId/status called");
    const { token, status } = req.body;
    const { appointmentId } = req.params;
    
    if (!token) return res.status(400).json({ error: "Missing token" });

    // Verify doctor token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'doctor') {
      return res.status(403).json({ error: "Access denied. Not a doctor." });
    }

    const doctor = await Doctor.findById(decoded.id);
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    // Find appointment
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    // Verify this appointment belongs to this doctor
    if (appointment.doctor.toString() !== doctor._id.toString()) {
      return res.status(403).json({ error: "This appointment does not belong to you" });
    }

    // Update status
    const validStatuses = ["booked","attended","no show","cancelled by user","cancelled by doctor","walk in","available"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    appointment.status = status;
    await appointment.save();

    // If marking as completed or no-show, free up the slot for future bookings
    if (status === "attended" || status === "no show") {
      const daySlot = doctor.weeklySlots.find(d => d.day === appointment.slotDay);
      if (daySlot) {
        const timeSlot = daySlot.times.find(t => t.time === appointment.slotTime);
        if (timeSlot) {
          timeSlot.status = "available";
          timeSlot.appointmentId = null;
        }
      }
      await doctor.save();
    }

    res.json({ 
      success: true, 
      message: `Appointment status updated to ${status}` 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get a doctor's appointments (enhanced)
router.get("/doctor-appointments", async (req, res) => {
  try {
    console.log("[API] GET /doctor-appointments called");
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
      .populate("user", "name email phone")
      .sort({ startDateTime: -1 });
      // Setup Google Calendar API
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oAuth2Client.setCredentials({
      access_token: doctor.googleAccessToken,
      refresh_token: doctor.googleRefreshToken,
    });

    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

    // Loop through each appointment → check if Google Calendar event exists
    for (const appt of appointments) {
      if (appt.calendarEventId) {
        try {
          const event = await calendar.events.get({
            calendarId: "primary",
            eventId: appt.calendarEventId,
          });

          if (event.data.status === "cancelled") {
            // Event exists but marked cancelled in Google Calendar
            console.log("Doctor event cancelled in calendar:", appt.calendarEventId);
            appt.status = "cancelled by doctor";
            appt.calendarEventId = null;
            await appt.save();
          }
        } catch (err) {
          // If Google Calendar says event not found → mark it cancelled
          const isNotFound =
            err?.code === 404 ||
            err?.errors?.some(e => e.reason === "notFound");

          if (isNotFound) {
            console.log("Doctor event missing in calendar:", appt.calendarEventId);
            appt.status = "cancelled by doctor";
            appt.calendarEventId = null;
            await appt.save();
          } else {
            console.error("Doctor Calendar API error:", err.message);
          }
        }
      }
    }

    res.json({ appointments });
  } catch (err) {
    console.error("Error fetching doctor's appointments:", err);
    res.status(500).json({ error: err.message });
  }
});


// Get doctor's available slots
router.get("/my-slots", async (req, res) => {
  try {
    console.log("[API] GET /my-slots called");
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: "Missing token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'doctor') {
      return res.status(403).json({ error: "Access denied. Not a doctor." });
    }

    const doctor = await Doctor.findById(decoded.id);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    res.json({ 
      slots: doctor.weeklySlots || [],
      message: "Slots retrieved successfully"
    });
  } catch (err) {
    console.error("Error fetching doctor slots:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
