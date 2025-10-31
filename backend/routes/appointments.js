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

    const overlappingAppointment = await Appointment.findOne({
      doctor: doctor._id,
      user: user._id,
      status: "booked",
      $or: [
        { 
          startDateTime: { $lt: new Date(endDateTime) }, 
          endDateTime: { $gt: new Date(startDateTime) } 
        }
      ]
    });

    if (overlappingAppointment) {
      return res.status(400).json({ error: "You already have an appointment overlapping this time." });
    }
    // --- Ensure fresh OAuth clients ---
    patientOAuth2Client = await ensureFreshAccessToken(user, "user");
    doctorOAuth2Client = await ensureFreshAccessToken(doctor, "doctor");

    const patientCalendar = google.calendar({ version: "v3", auth: patientOAuth2Client });
    const doctorCalendar = google.calendar({ version: "v3", auth: doctorOAuth2Client });

    // --- Create patient event ---
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

    // Rollback patient event if it exists
    if (patientResponse?.data?.id && patientOAuth2Client) {
      try {
        const rollbackCalendar = google.calendar({ version: "v3", auth: patientOAuth2Client });
        await rollbackCalendar.events.delete({
          calendarId: "primary",
          eventId: patientResponse.data.id,
        });
        console.log("Rolled back patient calendar event due to booking failure");
      } catch (rollbackErr) {
        console.error("Failed to rollback patient event:", rollbackErr);
      }
    }

    // Rollback doctor event if it exists
    if (doctorResponse?.data?.id && doctorOAuth2Client) {
      try {
        const rollbackCalendar = google.calendar({ version: "v3", auth: doctorOAuth2Client });
        await rollbackCalendar.events.delete({
          calendarId: "primary",
          eventId: doctorResponse.data.id,
        });
        console.log("Rolled back doctor calendar event due to booking failure");
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
      .populate("doctor", "name specialization weeklySlots")
      .sort({ startDateTime: 1 });

    // Setup patient calendar
    const patientOAuth2Client = await ensureFreshAccessToken(user, 'user');
    const patientCalendar = google.calendar({ version: "v3", auth: patientOAuth2Client });

    for (const appt of appointments) {
      let doctor = appt.doctor;

      // --- Check patient calendar ---
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

      // --- Check doctor calendar ---
      if (appt.doctorCalendarEventId && doctor) {
        try {
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
        } catch (err) {
          if (err?.code === 404) {
            console.log("Doctor event missing:", appt.doctorCalendarEventId);
            appt.status = "cancelled by doctor";
            appt.doctorCalendarEventId = null;
            await appt.save();
          }
        }
      }

      // --- Free doctor slot if cancelled ---
      if (!appt.patientCalendarEventId && !appt.doctorCalendarEventId && appt.status.includes("cancelled") && doctor) {
        const daySlot = doctor.weeklySlots.find(d => d.day === appt.slotDay);
        if (daySlot) {
          const timeSlot = daySlot.times.find(t => t.time === appt.slotTime);
          if (timeSlot) {
            timeSlot.status = "available";
            timeSlot.appointmentId = null;
            await doctor.save();
          }
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
    if (decoded.role !== "user") return res.status(403).json({ error: "Access denied. Not a user." });

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Find appointment
    const appointment = await Appointment.findById(appointmentId).populate("doctor user");
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    if (appointment.user._id.toString() !== user._id.toString())
      return res.status(403).json({ error: "This appointment does not belong to you" });

    const doctor = await Doctor.findById(appointment.doctor._id);

    // Time since booking
    const now = new Date();
    const diffMinutes = Math.floor((now - appointment.createdAt) / (1000 * 60));

    // --- Delete doctor calendar event ---
    if (appointment.doctorCalendarEventId && doctor) {
      try {
        const doctorOAuth2Client = await ensureFreshAccessToken(doctor, "doctor");
        const doctorCalendar = google.calendar({ version: "v3", auth: doctorOAuth2Client });

        await doctorCalendar.events.delete({
          calendarId: "primary",
          eventId: appointment.doctorCalendarEventId,
        });
        console.log("Deleted event from doctor's calendar:", appointment.doctorCalendarEventId);
      } catch (err) {
        console.warn("Could not cancel doctor's calendar event:", err.message);
        calendarDeletionErrors.push("doctor's calendar");
      }
    }

    // --- Delete patient calendar event ---
    if (appointment.patientCalendarEventId && user) {
      try {
        const patientOAuth2Client = await ensureFreshAccessToken(user, "user");
        const patientCalendar = google.calendar({ version: "v3", auth: patientOAuth2Client });

        await patientCalendar.events.delete({
          calendarId: "primary",
          eventId: appointment.patientCalendarEventId,
        });
        console.log("Deleted event from patient's calendar:", appointment.patientCalendarEventId);
      } catch (err) {
        console.warn("Could not cancel patient's calendar event:", err.message);
        calendarDeletionErrors.push("patient's calendar");
      }
    }

    // --- Free doctor slot ---
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

    // --- Delete or mark cancelled ---
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

router.post("/doctor-book", async (req, res) => {
  let user, doctor;
  let patientResponse = null;
  let doctorResponse = null;
  let appointment = null;

  try {
    console.log("[API] POST /doctor-book called");

    const { token, patientEmail, startDateTime, endDateTime, slotDay, slotTime } = req.body;
    if (!token) return res.status(400).json({ error: "Missing token" });

    // Verify doctor
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "doctor") return res.status(403).json({ error: "Access denied. Not a doctor." });

    doctor = await Doctor.findById(decoded.id);
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    user = await User.findOne({ email: patientEmail });
    if (!user) return res.status(404).json({ error: "User not found" });

    const overlappingAppointment = await Appointment.findOne({
      doctor: doctor._id,
      user: user._id,
      status: "booked",
      $or: [
        { 
          startDateTime: { $lt: new Date(endDateTime) }, 
          endDateTime: { $gt: new Date(startDateTime) } 
        }
      ]
    });

    if (overlappingAppointment) {
      return res.status(400).json({ error: "Patient already has an appointment overlapping this time." });
    }

    // --- Create event in doctor's calendar ---
    const doctorOAuth2Client = await ensureFreshAccessToken(doctor, "doctor");
    const doctorCalendar = google.calendar({ version: "v3", auth: doctorOAuth2Client });

    doctorResponse = await doctorCalendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: `Appointment with ${user.name || user.email}`,
        description: `Patient: ${user.name || "Unknown"}\nEmail: ${user.email}\nPhone: ${user.phone || "Not provided"}`,
        location: "Wellness Center, IIT Dharwad",
        start: { dateTime: startDateTime },
        end: { dateTime: endDateTime },
      },
    });
    console.log("Doctor calendar event created:", doctorResponse.data.id);

    // --- Save appointment in DB ---
    appointment = new Appointment({
      doctor: doctor._id,
      user: user._id,
      doctorCalendarEventId: doctorResponse.data.id,
      startDateTime,
      endDateTime,
      slotDay,
      slotTime,
      status: "booked",
      bookedBy: "doctor"
    });
    await appointment.save();

    // --- Create patient calendar event if possible ---
    let patientCalendarEventId = null;
    if (user.googleAccessToken) {
      try {
        const patientOAuth2Client = await ensureFreshAccessToken(user, "user");
        const patientCalendar = google.calendar({ version: "v3", auth: patientOAuth2Client });

        patientResponse = await patientCalendar.events.insert({
          calendarId: "primary",
          requestBody: {
            summary: `Medical Appointment with Dr. ${doctor.name}`,
            description: `Appointment booked by Dr. ${doctor.name}\nSpecialization: ${doctor.specialization || "General"}`,
            location: "Wellness Center, IIT Dharwad",
            start: { dateTime: startDateTime },
            end: { dateTime: endDateTime },
          },
        });
        patientCalendarEventId = patientResponse.data.id;
        appointment.patientCalendarEventId = patientCalendarEventId;
        await appointment.save();

        console.log("Patient calendar event created:", patientCalendarEventId);
      } catch (err) {
        console.warn("Could not add to patient calendar:", err.message);
      }
    }

    // --- Update doctor slot ---
    const daySlot = doctor.weeklySlots.find(d => d.day === slotDay);
    if (daySlot) {
      const timeSlot = daySlot.times.find(t => t.time === slotTime);
      if (timeSlot && timeSlot.status === "available") {
        timeSlot.status = "booked";
        timeSlot.appointmentId = appointment._id;
      }
    }
    await doctor.save();

    const populatedAppointment = await appointment.populate("user", "name email phone");

    res.json({
      success: true,
      appointment: populatedAppointment,
      doctorCalendarEventId: doctorResponse.data.id,
      patientCalendarEventId,
      message: `Appointment booked successfully${patientCalendarEventId ? " in both calendars" : " (patient calendar not available)"}.`
    });

  } catch (err) {
    console.error("Doctor booking error:", err);

    // --- Rollback patient calendar ---
    if (patientResponse?.data?.id && user) {
      try {
        const rollbackPatient = await ensureFreshAccessToken(user, "user");
        const patientCalendar = google.calendar({ version: "v3", auth: rollbackPatient });
        await patientCalendar.events.delete({
          calendarId: "primary",
          eventId: patientResponse.data.id
        });
        console.log("Rolled back patient calendar event");
      } catch (rollbackErr) {
        console.error("Failed to rollback patient event:", rollbackErr);
      }
    }

    // --- Rollback doctor calendar ---
    if (doctorResponse?.data?.id && doctor) {
      try {
        const rollbackDoctor = await ensureFreshAccessToken(doctor, "doctor");
        const doctorCalendar = google.calendar({ version: "v3", auth: rollbackDoctor });
        await doctorCalendar.events.delete({
          calendarId: "primary",
          eventId: doctorResponse.data.id
        });
        console.log("Rolled back doctor calendar event");
      } catch (rollbackErr) {
        console.error("Failed to rollback doctor event:", rollbackErr);
      }
    }

    // --- Delete DB appointment if created ---
    if (appointment?._id) {
      await Appointment.findByIdAndDelete(appointment._id);
      console.log("Rolled back appointment in DB");
    }

    res.status(500).json({ error: "Booking failed. " + err.message });
  }
});



// Doctor cancels appointment
router.delete("/:appointmentId/doctor-cancel", async (req, res) => {
  console.log("[API] DELETE /:appointmentId/doctor-cancel called");

  const { token } = req.body;
  const { appointmentId } = req.params;

  if (!token) return res.status(400).json({ error: "Missing token" });

  try {
    // Verify doctor token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "doctor") return res.status(403).json({ error: "Access denied. Not a doctor." });

    const doctor = await Doctor.findById(decoded.id);
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    // Find appointment
    const appointment = await Appointment.findById(appointmentId).populate("user");
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    if (appointment.doctor.toString() !== doctor._id.toString()) {
      return res.status(403).json({ error: "This appointment does not belong to you" });
    }

    const calendarDeletionErrors = [];

    // --- Delete doctor calendar event ---
    if (appointment.doctorCalendarEventId && doctor.googleAccessToken) {
      try {
        const doctorOAuth2Client = await ensureFreshAccessToken(doctor, "doctor");
        const doctorCalendar = google.calendar({ version: "v3", auth: doctorOAuth2Client });
        await doctorCalendar.events.delete({
          calendarId: "primary",
          eventId: appointment.doctorCalendarEventId,
        });
        console.log("Deleted event from doctor's calendar:", appointment.doctorCalendarEventId);
      } catch (err) {
        console.error("Could not cancel doctor's calendar event:", err.message);
        calendarDeletionErrors.push("doctor's calendar");
      }
    }

    // --- Delete patient calendar event ---
    if (appointment.patientCalendarEventId && appointment.user.googleAccessToken) {
      try {
        const patientOAuth2Client = await ensureFreshAccessToken(appointment.user, "user");
        const patientCalendar = google.calendar({ version: "v3", auth: patientOAuth2Client });
        await patientCalendar.events.delete({
          calendarId: "primary",
          eventId: appointment.patientCalendarEventId,
        });
        console.log("Deleted event from patient's calendar:", appointment.patientCalendarEventId);
      } catch (err) {
        console.error("Could not cancel patient's calendar event:", err.message);
        calendarDeletionErrors.push("patient's calendar");
      }
    }

    // --- Reset doctor slot ---
    const daySlot = doctor.weeklySlots.find(d => d.day === appointment.slotDay);
    if (daySlot) {
      const timeSlot = daySlot.times.find(t => t.time === appointment.slotTime);
      if (timeSlot) {
        timeSlot.status = "available";
        timeSlot.appointmentId = null;
      }
    }
    await doctor.save();

    // --- Update appointment status ---
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

router.get("/history", async (req, res) => {
  try {
    console.log("[API] GET /appointments/history called");

    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ error: "Authorization header missing" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(400).json({ error: "Missing token" });

    // Decode and verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Find only appointments with "attended" or "completed" status
    const history = await Appointment.find({
      user: user._id,
      status: {
        $in: [
          "attended",
          "no show",
          "cancelled by user",
          "cancelled by doctor",
          "walk in"
        ]
      }
    })
      .populate("doctor", "name specialization")
      .sort({ date: -1 }); // latest first

    const formattedHistory = history.map((appt) => ({
      _id: appt._id,
      doctor: appt.doctor,
      specialization: appt.doctor?.specialization || "-",
      date: appt.startDateTime || appt.date || null,
      time: appt.slotTime || "-",
      status: appt.status,
    }));
    
    res.json(formattedHistory);
  } catch (err) {
    console.error("Error fetching visit history:", err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

module.exports = router;


