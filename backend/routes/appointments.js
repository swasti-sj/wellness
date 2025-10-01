const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Appointment = require('../models/Appointment');
const mongoose = require("mongoose");

// ===============================
// PATIENT BOOK APPOINTMENT ENDPOINT
// ===============================
// POST /book → Creates a new appointment for a user with a doctor
router.post("/book", async (req, res) => {
  console.log("[API] POST /book called");

  let patientResponse, doctorResponse;
  let patientOAuth2Client, doctorOAuth2Client;
  let user, doctor;

  try {
    const { token, startDateTime, endDateTime, doctorId, slotDay, slotTime } = req.body;

    if (!token) return res.status(400).json({ error: "Missing token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "user") return res.status(403).json({ error: "Access denied. Not a user." });

    user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    // --- Create patient event first ---
    patientOAuth2Client = await ensureFreshAccessToken(user, "user");
    const patientCalendar = google.calendar({ version: "v3", auth: patientOAuth2Client });

    patientResponse = await patientCalendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: `Appointment with Dr. ${doctor.name}`,
        description: `Doctor: ${doctor.name}\nEmail: ${doctor.email || "Not provided"}`,
        location: "Wellness Center, IIT Dharwad",
        start: { dateTime: startDateTime },
        end: { dateTime: endDateTime },
      },
    });
    console.log("Patient event created:", patientResponse.data.id);

    // --- Create doctor event ---
    try {
      doctorOAuth2Client = await ensureFreshAccessToken(doctor, "doctor");
      const doctorCalendar = google.calendar({ version: "v3", auth: doctorOAuth2Client });

      doctorResponse = await doctorCalendar.events.insert({
        calendarId: "primary",
        requestBody: {
          summary: `Appointment with ${user.name}`,
          description: `Patient: ${user.name}\nEmail: ${user.email}`,
          location: "Wellness Center, IIT Dharwad",
          start: { dateTime: startDateTime },
          end: { dateTime: endDateTime },
        },
      });
      console.log("Doctor event created:", doctorResponse.data.id);

    } catch (doctorErr) {
      console.warn("Doctor calendar booking failed:", doctorErr.message);

      // Rollback patient event
      if (patientResponse?.data?.id) {
        try {
          await patientCalendar.events.delete({
            calendarId: "primary",
            eventId: patientResponse.data.id,
          });
          console.log("Rolled back patient event due to doctor failure");
        } catch (rollbackErr) {
          console.error("Failed to rollback patient event:", rollbackErr.message);
        }
      }

      return res.status(500).json({ error: "Booking failed: Doctor calendar error" });
    }

    // --- Save appointment in DB ---
    const appointment = new Appointment({
      _id: new mongoose.Types.ObjectId(),
      doctor: doctor._id,
      user: user._id,
      doctorCalendarEventId: doctorResponse.data.id,
      patientCalendarEventId: patientResponse.data.id,
      startDateTime,
      endDateTime,
      slotDay,
      slotTime,
      status: "booked",
      bookedBy: "user",
    });
    await appointment.save();

    // --- Update doctor availability ---
    const daySlot = doctor.weeklySlots.find(d => d.day === slotDay);
    if (daySlot) {
      const timeSlot = daySlot.times.find(t => t.time === slotTime);
      if (timeSlot) {
        timeSlot.status = "booked";
        timeSlot.appointmentId = appointment._id;
      }
    }
    await doctor.save();

    const populatedAppointment = await appointment.populate("doctor", "name email phone");

    res.json({
      success: true,
      appointment: populatedAppointment,
      doctorCalendarEventId: doctorResponse.data.id,
      patientCalendarEventId: patientResponse.data.id,
      message: "Appointment booked successfully in both calendars.",
    });

  } catch (err) {
    console.error("Booking error:", err);

    // Rollback patient if created
    if (patientResponse?.data?.id && patientOAuth2Client) {
      try {
        const rollbackCalendar = google.calendar({ version: "v3", auth: patientOAuth2Client });
        await rollbackCalendar.events.delete({
          calendarId: "primary",
          eventId: patientResponse.data.id,
        });
        console.log("Rolled back patient calendar event");
      } catch (rollbackErr) {
        console.error("Failed to rollback patient event:", rollbackErr);
      }
    }

    // Rollback doctor if created
    if (doctorResponse?.data?.id && doctorOAuth2Client) {
      try {
        const rollbackCalendar = google.calendar({ version: "v3", auth: doctorOAuth2Client });
        await rollbackCalendar.events.delete({
          calendarId: "primary",
          eventId: doctorResponse.data.id,
        });
        console.log("Rolled back doctor calendar event");
      } catch (rollbackErr) {
        console.error("Failed to rollback doctor event:", rollbackErr);
      }
    }

    res.status(500).json({ error: "Booking failed" });
  }
});


// ===============================
// PATIENT GET USER'S APPOINTMENTS ENDPOINT
// ===============================

// GET /my-appointments → Returns all appointments for the logged-in user
router.get("/my-appointments", async (req, res) => {
  try {
    console.log("[API] GET /my-appointments called");

    const { token } = req.query;
    if (!token) return res.status(400).json({ error: "Missing token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Fetch all appointments for this user
    const appointments = await Appointment.find({ user: user._id })
      .populate("doctor", "name specialization")
      .sort({ startDateTime: 1 });

    // Setup patient’s calendar client
    const patientOAuth2Client = await ensureFreshAccessToken(user, 'user');
    const patientCalendar = google.calendar({ version: "v3", auth: patientOAuth2Client });

    for (const appt of appointments) {
      // ✅ Check patient’s calendar
      if (appt.patientCalendarEventId) {
        try {
          const event = await patientCalendar.events.get({
            calendarId: "primary",
            eventId: appt.patientCalendarEventId,
          });
          if (event.data.status === "cancelled") {
            console.log("Patient event cancelled:", appt.patientCalendarEventId);
            appt.status = "cancelled by user";
            appt.patientCalendarEventId = null;
            await appt.save();
          }
        } catch (err) {
          if (err?.code === 404) {
            console.log("Patient event missing:", appt.patientCalendarEventId);
            appt.status = "cancelled by user";
            appt.patientCalendarEventId = null;
            await appt.save();
          }
        }
      }

      // ✅ Optionally check doctor’s calendar too
      if (appt.doctorCalendarEventId) {
        try {
          const doctor = await Doctor.findById(appt.doctor);
          if (doctor) {
            const doctorOAuth2Client = await ensureFreshAccessToken(doctor, 'doctor');
            const doctorCalendar = google.calendar({ version: "v3", auth: doctorOAuth2Client });

            const event = await doctorCalendar.events.get({
              calendarId: "primary",
              eventId: appt.doctorCalendarEventId,
            });

            if (event.data.status === "cancelled") {
              console.log("Doctor event cancelled:", appt.doctorCalendarEventId);
              appt.status = "cancelled by doctor";
              appt.doctorCalendarEventId = null;
              await appt.save();
            }
          }
        } catch (err) {
          if (err?.code === 404) {
            console.log("Doctor event missing:", appt.doctorCalendarEventId);
            appt.status = "cancelled by doctor";
            appt.doctorCalendarEventId = null;
            await appt.save();
          }
        }
      }

      // ✅ Free up doctor’s slot if cancelled
      if (!appt.patientCalendarEventId && !appt.doctorCalendarEventId && appt.status.includes("cancelled")) {
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
      }
    }

    res.json({ appointments });

  } catch (err) {
    console.error("my-appointments error:", err);
    res.status(500).json({ error: err.message });
  }
});
const ensureOAuthClient = async (entity) => {
  if (!entity?.googleAccessToken || !entity?.googleRefreshToken) return null;

  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oAuth2Client.setCredentials({
    access_token: entity.googleAccessToken,
    refresh_token: entity.googleRefreshToken,
  });

  try {
    const tokenResponse = await oAuth2Client.getAccessToken();
    if (tokenResponse.token) oAuth2Client.setCredentials({ access_token: tokenResponse.token });
    return oAuth2Client;
  } catch (err) {
    console.error("Failed to refresh token for", entity.email || entity.name, err.message);
    return null;
  }
};

// DELETE /appointments/:appointmentId/cancel
router.delete("/:appointmentId/cancel", async (req, res) => {
  console.log("[API] DELETE /:appointmentId/cancel called");

  const { token } = req.body;
  const { appointmentId } = req.params;
  const calendarDeletionErrors = [];

  if (!token) return res.status(400).json({ error: "Missing token" });

  try {
    // Verify user
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
     if (decoded.role !== "user") {
      return res.status(403).json({ error: "Access denied. Not a user." });
    }
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Find appointment
    const appointment = await Appointment.findById(appointmentId).populate("doctor user");
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    if (appointment.user._id.toString() !== user._id.toString())
      return res.status(403).json({ error: "This appointment does not belong to you" });

    const doctor = await Doctor.findById(appointment.doctor._id);

    // Calculate time since booking
    const now = new Date();
    const diffMinutes = Math.floor((now - appointment.createdAt) / (1000 * 60));

    let calendarDeletionErrors = [];
    // Delete doctor calendar event
    if (appointment.doctorCalendarEventId && doctor.googleAccessToken) {
      try {
        const oAuth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        oAuth2Client.setCredentials({
          access_token: doctor.googleAccessToken,
          refresh_token: doctor.googleRefreshToken,
        });

        const doctorCalendar = google.calendar({ version: "v3", auth: oAuth2Client });
        await doctorCalendar.events.delete({
          calendarId: "primary",
          eventId: appointment.doctorCalendarEventId,
        });
        console.log("Deleted event from doctor's calendar:", appointment.doctorCalendarEventId);
      } catch (err) {
        console.log("Could not cancel doctor's calendar event:", err.message);
        calendarDeletionErrors.push("doctor's calendar");
      }
    }

    // Delete patient calendar event
    if (appointment.patientCalendarEventId && appointment.user.googleAccessToken) {
      try {
        const oAuth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        oAuth2Client.setCredentials({
          access_token: appointment.user.googleAccessToken,
          refresh_token: appointment.user.googleRefreshToken,
        });

        const patientCalendar = google.calendar({ version: "v3", auth: oAuth2Client });
        await patientCalendar.events.delete({
          calendarId: "primary",
          eventId: appointment.patientCalendarEventId,
        });
        console.log("Deleted event from patient's calendar:", appointment.patientCalendarEventId);
      } catch (err) {
        console.log("Could not cancel patient's calendar event:", err.message);
        calendarDeletionErrors.push("patient's calendar");
      }
    }

    // Reset doctor slot
    if (doctor) {
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

    // Delete if booked <15 minutes, else mark cancelled
    if (diffMinutes <= 15) {
      await Appointment.findByIdAndDelete(appointment._id);
      return res.json({ success: true, message: "Appointment deleted (cancelled within 15 minutes)" });
    } else {
      appointment.status = "cancelled by user";
      appointment.patientCalendarEventId = null;
      appointment.doctorCalendarEventId = null;
      await appointment.save();

      let msg = "Appointment cancelled by user.";
      if (calendarDeletionErrors.length)
        msg += ` Note: Could not remove from ${calendarDeletionErrors.join(" and ")}.`;

      return res.json({ success: true, message: msg });
    }

  } catch (err) {
    console.error("Cancellation error:", err);
    return res.status(500).json({ error: "Failed to cancel appointment" });
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
  let user, doctor;
  try {
    console.log("[API] POST /doctor-book called");

    const { token, patientEmail, patientPhone, startDateTime, endDateTime, slotDay, slotTime } = req.body;
    if (!token) return res.status(400).json({ error: "Missing token" });

    // Verify doctor token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(decoded);
    if (decoded.role !== "doctor") {
      return res.status(403).json({ error: "Access denied. Not a doctor." });
    }

     user = await User.findOne({ email: patientEmail });
if (!user) return res.status(404).json({ error: "User not found" });

     doctor = await Doctor.findById(decoded.id);
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    // Debugging: show doctor record
    console.log("[Doctor Record]", {
      id: doctor._id,
      email: doctor.email,
      hasAccessToken: !!doctor.googleAccessToken,
      hasRefreshToken: !!doctor.googleRefreshToken,
      accessToken: doctor.googleAccessToken,
      refreshToken: doctor.googleRefreshToken
    });

    // Ensure doctor’s Google access token is fresh
    const doctorOAuth2Client = await ensureFreshAccessToken(doctor, "doctor");
    const doctorCalendar = google.calendar({ version: "v3", auth: doctorOAuth2Client });

    // Find or create patient
    let patient = await User.findOne({ email: patientEmail });
    

    // Create event in doctor's calendar
    const doctorEvent = {
      summary: `Appointment with ${patient.name || patient.email}`,
      description: `Patient: ${patient.name || "Unknown"}\nEmail: ${patient.email}\nPhone: ${patient.phone || "Not provided"}`,
      location: "Wellness Center, IIT Dharwad",
      start: { dateTime: startDateTime },
      end: { dateTime: endDateTime }
    };

    let doctorCalendarResponse;
    try {
      doctorCalendarResponse = await doctorCalendar.events.insert({
        calendarId: "primary",
        requestBody: doctorEvent
      });
      console.log("Created event in doctor's calendar:", doctorCalendarResponse.data.id);
    } catch (err) {
      console.error("Failed to create event in doctor's calendar:", err);
      return res.status(500).json({ error: "Failed to create calendar event. Please check your Google Calendar connection." });
    }

    // Save appointment in DB with doctor event ID first
    const appointment = new Appointment({
      doctor: doctor._id,
      user: patient._id,
      doctorCalendarEventId: doctorCalendarResponse.data.id,
      startDateTime,
      endDateTime,
      slotDay,
      slotTime,
      status: "booked",
      bookedBy: "doctor"
    });
    await appointment.save();
    console.log("[Appointment Saved in DB]", appointment);

    // Try to add to patient's calendar if they have an access token
    let patientCalendarEventId = null;
    if (patient.googleAccessToken) { // <- only check access token
      try {
        const patientOAuth2Client = await ensureFreshAccessToken(patient, "user"); // uses refresh token if available
        const patientCalendar = google.calendar({ version: "v3", auth: patientOAuth2Client });

        const patientEvent = {
          summary: `Medical Appointment with Dr. ${doctor.name}`,
          description: `Appointment booked by Dr. ${doctor.name}\nSpecialization: ${doctor.specialization || "General"}`,
          location: "Wellness Center, IIT Dharwad",
          start: { dateTime: startDateTime },
          end: { dateTime: endDateTime }
        };

        const patientResponse = await patientCalendar.events.insert({
          calendarId: "primary",
          requestBody: patientEvent
        });

        patientCalendarEventId = patientResponse.data.id;
        appointment.patientCalendarEventId = patientCalendarEventId; // update DB
        await appointment.save();

        console.log("Created event in patient's calendar:", patientCalendarEventId);
      } catch (calendarErr) {
        console.log("Could not add to patient calendar:", calendarErr.message);
      }
    }

    // Update doctor's slot
    const daySlot = doctor.weeklySlots.find(d => d.day === slotDay);
    if (daySlot) {
      const timeSlot = daySlot.times.find(t => t.time === slotTime);
      if (timeSlot && timeSlot.status === "available") {
        timeSlot.status = "booked";
        timeSlot.appointmentId = appointment._id;
        console.log("[Doctor Slot Updated]", slotDay, slotTime);
      } else {
        console.warn("Slot was already booked:", slotDay, slotTime);
      }
    }
    await doctor.save();

    const populatedAppointment = await appointment.populate("user", "name email phone");

    res.json({
      success: true,
      appointment: populatedAppointment,
      doctorCalendarEventId: doctorCalendarResponse.data.id,
      patientCalendarEventId: patientResponse.data.id,
      message: `Appointment booked successfully. Created in doctor's calendar${patientCalendarEventId ? " and patient's calendar" : " (patient calendar not available)"}.`
    });

  } catch (err) {
    console.error("Doctor booking error:", err);
    // Rollback patient event
if (patientResponse && patientResponse.data && patientResponse.data.id && user) {
  try {
    const rollbackOAuth2Client = await ensureFreshAccessToken(user, "user");
    const rollbackCalendar = google.calendar({ version: "v3", auth: rollbackOAuth2Client });
    await rollbackCalendar.events.delete({
      calendarId: "primary",
      eventId: patientResponse.data.id,
    });
    console.log("Rolled back patient calendar event");
  } catch (rollbackErr) {
    console.error("Failed to rollback patient event:", rollbackErr);
  }
}

// Rollback doctor event
if (doctorResponse && doctorResponse.data && doctorResponse.data.id && doctor) {
  try {
    const rollbackDoctor = await ensureFreshAccessToken(doctor, "doctor");
    const rollbackCalendar = google.calendar({ version: "v3", auth: rollbackDoctor });
    await rollbackCalendar.events.delete({
      calendarId: "primary",
      eventId: doctorResponse.data.id,
    });
    console.log("Rolled back doctor calendar event");
  } catch (rollbackErr) {
    console.error("Failed to rollback doctor event:", rollbackErr);
  }
}

    res.status(500).json({ error: err.message });
  }
});

// Doctor cancels appointment
router.delete("/:appointmentId/doctor-cancel", async (req, res) => {
  try {
    console.log("[API] DELETE /:appointmentId/doctor-cancel called");
    const { token } = req.body;
    const { appointmentId } = req.params;

    if (!token) return res.status(400).json({ error: "Missing token" });

    // Verify doctor token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "doctor") {
      return res.status(403).json({ error: "Access denied. Not a doctor." });
    }

    const doctor = await Doctor.findById(decoded.id);
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    // Find appointment
    const appointment = await Appointment.findById(appointmentId).populate("user");
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    if (appointment.doctor.toString() !== doctor._id.toString()) {
      return res.status(403).json({ error: "This appointment does not belong to you" });
    }

    let calendarDeletionErrors = [];

    // Delete doctor calendar event
    if (appointment.doctorCalendarEventId && doctor.googleAccessToken) {
      try {
        const oAuth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        oAuth2Client.setCredentials({
          access_token: doctor.googleAccessToken,
          refresh_token: doctor.googleRefreshToken,
        });

        const doctorCalendar = google.calendar({ version: "v3", auth: oAuth2Client });
        await doctorCalendar.events.delete({
          calendarId: "primary",
          eventId: appointment.doctorCalendarEventId,
        });
        console.log("Deleted event from doctor's calendar:", appointment.doctorCalendarEventId);
      } catch (err) {
        console.log("Could not cancel doctor's calendar event:", err.message);
        calendarDeletionErrors.push("doctor's calendar");
      }
    }

    // Delete patient calendar event
    if (appointment.patientCalendarEventId && appointment.user.googleAccessToken) {
      try {
        const oAuth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        oAuth2Client.setCredentials({
          access_token: appointment.user.googleAccessToken,
          refresh_token: appointment.user.googleRefreshToken,
        });

        const patientCalendar = google.calendar({ version: "v3", auth: oAuth2Client });
        await patientCalendar.events.delete({
          calendarId: "primary",
          eventId: appointment.patientCalendarEventId,
        });
        console.log("Deleted event from patient's calendar:", appointment.patientCalendarEventId);
      } catch (err) {
        console.log("Could not cancel patient's calendar event:", err.message);
        calendarDeletionErrors.push("patient's calendar");
      }
    }

    // Reset doctor slot
    const daySlot = doctor.weeklySlots.find(d => d.day === appointment.slotDay);
    if (daySlot) {
      const timeSlot = daySlot.times.find(t => t.time === appointment.slotTime);
      if (timeSlot) {
        timeSlot.status = "available";
        timeSlot.appointmentId = null;
      }
    }
    await doctor.save();

    // Update appointment status
    appointment.status = "cancelled by doctor";
    appointment.doctorCalendarEventId = null;
    appointment.patientCalendarEventId = null;
    await appointment.save();

    let message = "Appointment cancelled successfully.";
    if (calendarDeletionErrors.length) {
      message += ` Note: Could not remove from ${calendarDeletionErrors.join(" and ")}.`;
    }

    res.json({ success: true, message });
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
