const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Doctor = require("../models/Doctor");
const Appointment = require('../models/Appointment');
const Note = require("../models/Note");
const Prescription = require("../models/Prescription");
const Vital = require("../models/Vital");
const Test = require("../models/Test");
const mongoose = require("mongoose");
const { logActivity, getClientIp, parseUserAgent } = require('../utils/audit');

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
    const { token, startDateTime, endDateTime, doctorId, slotDay, slotTime, dependantId } = req.body;
    if (!token) return res.status(400).json({ error: "Missing token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "patient") return res.status(403).json({ error: "Access denied. Not a patient." });

    user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    let dependant = null;
    if (dependantId) {
      dependant = user.dependants?.find((d) => d._id.toString() === dependantId);
      if (!dependant) {
        return res.status(400).json({ error: "Selected dependant not found" });
      }
    }

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

    let patientCalendar = null;
    let doctorCalendar = null;

    // --- Create patient event if possible ---
    const patientSummary = dependant ? `Appointment for ${dependant.name} with Dr. ${doctor.name}` : `Appointment with Dr. ${doctor.name}`;
    const patientDescription = dependant
      ? `Dependant: ${dependant.name} (${dependant.relationship || 'N/A'})\nPrimary Patient: ${user.name}\nDoctor: ${doctor.name}`
      : `Doctor: ${doctor.name}\nEmail: ${doctor.email || "Not provided"}`;

    if (patientOAuth2Client) {
      patientCalendar = google.calendar({ version: "v3", auth: patientOAuth2Client });
      try {
        patientResponse = await patientCalendar.events.insert({
          calendarId: "primary",
          requestBody: {
            summary: patientSummary,
            description: patientDescription,
            location: "Wellness Center, IIT Dharwad",
            start: { dateTime: startDateTime },
            end: { dateTime: endDateTime },
          },
        });
        console.log("Patient event created:", patientResponse.data.id);
      } catch (err) {
        console.warn("Could not create patient calendar event:", err.message);
        patientResponse = null;
      }
    } else {
      console.log("Skipping patient calendar event: no OAuth client available for user");
    }

    const doctorSummary = dependant ? `Appointment with ${dependant.name}` : `Appointment with ${user.name}`;
    const doctorDescription = dependant
      ? `Dependant: ${dependant.name} (${dependant.relationship || 'N/A'})\nPrimary Patient: ${user.name}\nEmail: ${user.email}`
      : `Patient: ${user.name}\nEmail: ${user.email}`;

    // --- Create doctor event if possible ---
    if (doctorOAuth2Client) {
      doctorCalendar = google.calendar({ version: "v3", auth: doctorOAuth2Client });
      try {
        doctorResponse = await doctorCalendar.events.insert({
          calendarId: "primary",
          requestBody: {
            summary: doctorSummary,
            description: doctorDescription,
            location: "Wellness Center, IIT Dharwad",
            start: { dateTime: startDateTime },
            end: { dateTime: endDateTime },
          },
        });
        console.log("Doctor event created:", doctorResponse.data.id);
      } catch (doctorErr) {
        console.warn("Doctor calendar booking failed:", doctorErr.message);

        // Rollback patient event only if we actually created it in Google
        if (patientResponse?.data?.id && patientCalendar) {
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
    } else {
      console.log("Skipping doctor calendar event: no OAuth client available for doctor");
    }

    // --- Save appointment in DB ---
    const appointment = new Appointment({
      _id: new mongoose.Types.ObjectId(),
      doctor: doctor._id,
      user: user._id,
      doctorCalendarEventId: doctorResponse?.data?.id || null,
      patientCalendarEventId: patientResponse?.data?.id || null,
      startDateTime,
      endDateTime,
      slotDay,
      slotTime,
      status: "booked",
      bookedBy: "user",
      dependant: dependant
        ? {
          _id: dependant._id,
          name: dependant.name,
          age: dependant.age,
          sex: dependant.sex,
          relationship: dependant.relationship,
          bloodGroup: dependant.bloodGroup,
          phone: dependant.phone,
          uhid: dependant.uhid,
        }
        : undefined,
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

    // Business-audit: Appointment booked
    try {
      await logActivity({
        userId: user._id,
        userName: user.name || user.email,
        userEmail: user.email || '',
        role: decoded.role || 'user',
        sessionId: decoded.sessionId || null,
        module: 'Appointments',
        action: 'BOOK_APPOINTMENT',
        description: `Booked appointment for ${user.name} with Dr ${doctor.name} (Appointment ID: ${appointment._id})`,
        severity: 'AUDIT',
        ipAddress: getClientIp(req),
        deviceInfo: req.headers['user-agent'] || '',
        browserInfo: req.headers['user-agent'] || '',
        details: { appointmentId: appointment._id, doctorId: doctor._id }
      });
    } catch (auditErr) {
      console.warn('Failed to write appointment audit log:', auditErr.message);
    }

    res.json({
      success: true,
      appointment: populatedAppointment,
      doctorCalendarEventId: doctorResponse?.data?.id || null,
      patientCalendarEventId: patientResponse?.data?.id || null,
      message: doctorResponse?.data?.id && patientResponse?.data?.id
        ? "Appointment booked successfully in both calendars."
        : "Appointment booked; calendar update unavailable for one or more participants.",
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

    // Setup patient calendar (may be null if user has no Google tokens)
    const patientOAuth2Client = await ensureFreshAccessToken(user, 'user');
    let patientCalendar = null;
    if (patientOAuth2Client) {
      patientCalendar = google.calendar({ version: "v3", auth: patientOAuth2Client });
    } else {
      console.log("Skipping patient calendar checks: no OAuth client for user");
    }

    for (const appt of appointments) {
      let doctor = appt.doctor;

      // --- Check patient calendar ---
      if (appt.patientCalendarEventId && patientCalendar) {
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
      } else if (appt.patientCalendarEventId && !patientCalendar) {
        console.log("Cannot check patient event (no OAuth client):", appt.patientCalendarEventId);
      }

      // --- Check doctor calendar ---
      if (appt.doctorCalendarEventId && doctor) {
        const doctorOAuth2Client = await ensureFreshAccessToken(doctor, 'doctor');
        if (doctorOAuth2Client) {
          try {
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
        } else {
          console.log("Cannot check doctor event (no OAuth client):", appt.doctorCalendarEventId);
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
    if (decoded.role !== "patient") return res.status(403).json({ error: "Access denied. Not a patient." });

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
        if (doctorOAuth2Client) {
          const doctorCalendar = google.calendar({ version: "v3", auth: doctorOAuth2Client });
          await doctorCalendar.events.delete({
            calendarId: "primary",
            eventId: appointment.doctorCalendarEventId,
          });
          console.log("Deleted event from doctor's calendar:", appointment.doctorCalendarEventId);
        } else {
          console.log('Skipping deletion on doctor calendar: no OAuth client');
          calendarDeletionErrors.push("doctor's calendar");
        }
      } catch (err) {
        console.warn("Could not cancel doctor's calendar event:", err.message);
        calendarDeletionErrors.push("doctor's calendar");
      }
    }

    // --- Delete patient calendar event ---
    if (appointment.patientCalendarEventId && user) {
      try {
        const patientOAuth2Client = await ensureFreshAccessToken(user, "user");
        if (patientOAuth2Client) {
          const patientCalendar = google.calendar({ version: "v3", auth: patientOAuth2Client });
          await patientCalendar.events.delete({
            calendarId: "primary",
            eventId: appointment.patientCalendarEventId,
          });
          console.log("Deleted event from patient's calendar:", appointment.patientCalendarEventId);
        } else {
          console.log('Skipping deletion on patient calendar: no OAuth client');
          calendarDeletionErrors.push("patient's calendar");
        }
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
      // Audit: Appointment deleted (early cancel)
      try {
        await logActivity({
          userId: user._id,
          userName: user.name || user.email,
          userEmail: user.email || '',
          role: decoded.role || 'user',
          sessionId: decoded.sessionId || null,
          module: 'Appointments',
          action: 'CANCEL_APPOINTMENT',
          description: `Cancelled appointment ID ${appointment._id} (deleted within 15 minutes)`,
          severity: 'AUDIT',
          ipAddress: getClientIp(req),
          deviceInfo: req.headers['user-agent'] || '',
          details: { appointmentId: appointment._id }
        });
      } catch (auditErr) {
        console.warn('Failed to write appointment cancellation audit log:', auditErr.message);
      }

      return res.json({ success: true, message: "Appointment deleted (cancelled within 15 minutes)" });
    } else {
      appointment.status = "cancelled by user";
      appointment.patientCalendarEventId = null;
      appointment.doctorCalendarEventId = null;
      await appointment.save();

      let msg = "Appointment cancelled by user.";
      if (calendarDeletionErrors.length)
        msg += ` Note: Could not remove from ${calendarDeletionErrors.join(" and ")}.`;

      // Audit: Appointment cancelled (marked)
      try {
        await logActivity({
          userId: user._id,
          userName: user.name || user.email,
          userEmail: user.email || '',
          role: decoded.role || 'user',
          sessionId: decoded.sessionId || null,
          module: 'Appointments',
          action: 'CANCEL_APPOINTMENT',
          description: `Cancelled appointment ID ${appointment._id}`,
          severity: 'AUDIT',
          ipAddress: getClientIp(req),
          deviceInfo: req.headers['user-agent'] || '',
          details: { appointmentId: appointment._id }
        });
      } catch (auditErr) {
        console.warn('Failed to write appointment cancellation audit log:', auditErr.message);
      }

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
  // If there is no refresh token available, we cannot reliably refresh
  if (!entity || (!entity.googleRefreshToken && !entity.googleAccessToken)) {
    console.warn(`[Token Refresh] No Google tokens available for ${entityType} (${entity?.email || entity?.name || 'unknown'})`);
    return null;
  }

  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oAuth2Client.setCredentials({
    access_token: entity.googleAccessToken,
    refresh_token: entity.googleRefreshToken
  });

  // Try to refresh/get a fresh access token; return null if refresh fails
  try {
    const tokenResponse = await oAuth2Client.getAccessToken();
    // tokenResponse can be {token: '...', res: ...} or {credentials: {token: '...'}} depending on lib version
    const newToken = tokenResponse?.token || tokenResponse?.credentials?.token;
    if (newToken && newToken !== entity.googleAccessToken) {
      entity.googleAccessToken = newToken;
      try { await entity.save(); } catch (saveErr) { console.warn('Could not save refreshed token to DB:', saveErr.message); }
      console.log(`[Token Refresh] Updated ${entityType}'s access token in DB`);
    }
    return oAuth2Client;
  } catch (err) {
    console.warn(`[Token Refresh] Failed for ${entityType}:`, err.message);
    // Don't throw here; caller should handle a null return (calendar unavailable)
    return null;
  }
}

router.post("/doctor-book", async (req, res) => {
  let user, doctor;
  let patientResponse = null;
  let doctorResponse = null;
  let appointment = null;

  try {
    console.log("[API] POST /doctor-book called");

    const { token, patientEmail, dependantId, startDateTime, endDateTime, slotDay, slotTime } = req.body;
    if (!token) return res.status(400).json({ error: "Missing token" });

    // Verify doctor
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "doctor") return res.status(403).json({ error: "Access denied. Not a doctor." });

    doctor = await Doctor.findById(decoded.id);
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    user = await User.findOne({ email: patientEmail });
    if (!user) return res.status(404).json({ error: "User not found" });

    const dependant = dependantId
      ? user.dependants?.find((item) => item._id.toString() === dependantId)
      : null;
    if (dependantId && !dependant) {
      return res.status(400).json({ error: "Dependant not found for this patient" });
    }

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

    // --- Create event in doctor's calendar (if OAuth available) ---
    const doctorOAuth2Client = await ensureFreshAccessToken(doctor, "doctor");
    if (!doctorOAuth2Client) {
      console.log('Doctor has no OAuth client; skipping doctor calendar event creation');
    } else {
      const doctorCalendar = google.calendar({ version: "v3", auth: doctorOAuth2Client });
      doctorResponse = await doctorCalendar.events.insert({
        calendarId: "primary",
        requestBody: {
          summary: dependant ? `Appointment with ${dependant.name}` : `Appointment with ${user.name || user.email}`,
          description: dependant
            ? `Dependant: ${dependant.name} (${dependant.relationship || "N/A"})\nPrimary Patient: ${user.name || "Unknown"}\nEmail: ${user.email}`
            : `Patient: ${user.name || "Unknown"}\nEmail: ${user.email}\nPhone: ${user.phone || "Not provided"}`,
          location: "Wellness Center, IIT Dharwad",
          start: { dateTime: startDateTime },
          end: { dateTime: endDateTime },
        },
      });
      console.log("Doctor calendar event created:", doctorResponse.data.id);
    }

    // --- Save appointment in DB ---
    appointment = new Appointment({
      doctor: doctor._id,
      user: user._id,
      doctorCalendarEventId: doctorResponse?.data?.id || null,
      startDateTime,
      endDateTime,
      slotDay,
      slotTime,
      status: "booked",
      bookedBy: "doctor",
      dependant: dependant
        ? {
          _id: dependant._id,
          name: dependant.name,
          age: dependant.age,
          sex: dependant.sex,
          relationship: dependant.relationship,
          bloodGroup: dependant.bloodGroup,
          phone: dependant.phone,
          uhid: dependant.uhid,
        }
        : undefined,
    });
    await appointment.save();

    // --- Create patient calendar event if possible ---
    let patientCalendarEventId = null;
    if (user.googleAccessToken) {
      try {
        const patientOAuth2Client = await ensureFreshAccessToken(user, "user");
        if (patientOAuth2Client) {
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
        } else {
          console.log('Skipping patient calendar event: no OAuth client for user');
        }
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
      doctorCalendarEventId: doctorResponse?.data?.id || null,
      patientCalendarEventId,
      message: `Appointment booked successfully${patientCalendarEventId ? " in both calendars" : " (patient calendar not available)"}.`
    });

  } catch (err) {
    console.error("Doctor booking error:", err);

    // --- Rollback patient calendar ---
    if (patientResponse?.data?.id && user) {
      try {
        const rollbackPatient = await ensureFreshAccessToken(user, "user");
        if (rollbackPatient) {
          const patientCalendar = google.calendar({ version: "v3", auth: rollbackPatient });
          await patientCalendar.events.delete({
            calendarId: "primary",
            eventId: patientResponse.data.id
          });
          console.log("Rolled back patient calendar event");
        } else {
          console.log('Could not rollback patient event: no OAuth client');
        }
      } catch (rollbackErr) {
        console.error("Failed to rollback patient event:", rollbackErr);
      }
    }

    // --- Rollback doctor calendar ---
    if (doctorResponse?.data?.id && doctor) {
      try {
        const rollbackDoctor = await ensureFreshAccessToken(doctor, "doctor");
        if (rollbackDoctor) {
          const doctorCalendar = google.calendar({ version: "v3", auth: rollbackDoctor });
          await doctorCalendar.events.delete({
            calendarId: "primary",
            eventId: doctorResponse.data.id
          });
          console.log("Rolled back doctor calendar event");
        } else {
          console.log('Could not rollback doctor event: no OAuth client');
        }
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
        if (doctorOAuth2Client) {
          const doctorCalendar = google.calendar({ version: "v3", auth: doctorOAuth2Client });
          await doctorCalendar.events.delete({
            calendarId: "primary",
            eventId: appointment.doctorCalendarEventId,
          });
          console.log("Deleted event from doctor's calendar:", appointment.doctorCalendarEventId);
        } else {
          console.log('Skipping doctor calendar deletion: no OAuth client');
          calendarDeletionErrors.push("doctor's calendar");
        }
      } catch (err) {
        console.error("Could not cancel doctor's calendar event:", err.message);
        calendarDeletionErrors.push("doctor's calendar");
      }
    }

    // --- Delete patient calendar event ---
    if (appointment.patientCalendarEventId && appointment.user.googleAccessToken) {
      try {
        const patientOAuth2Client = await ensureFreshAccessToken(appointment.user, "user");
        if (patientOAuth2Client) {
          const patientCalendar = google.calendar({ version: "v3", auth: patientOAuth2Client });
          await patientCalendar.events.delete({
            calendarId: "primary",
            eventId: appointment.patientCalendarEventId,
          });
          console.log("Deleted event from patient's calendar:", appointment.patientCalendarEventId);
        } else {
          console.log('Skipping patient calendar deletion: no OAuth client');
          calendarDeletionErrors.push("patient's calendar");
        }
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

    // Verify token and role
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'doctor' && decoded.role !== 'nurse' && decoded.role !== 'receptionist') {
      return res.status(403).json({ error: "Access denied. Only doctors, nurses, and receptionists can update appointment status." });
    }

    let appointment;
    let doctor; // Declare doctor here so it's accessible below

    // For doctors, verify ownership; for nurses and receptionists, allow all
    if (decoded.role === 'doctor') {
      doctor = await Doctor.findById(decoded.id);
      if (!doctor) return res.status(404).json({ error: "Doctor not found" });

      appointment = await Appointment.findById(appointmentId);
      if (!appointment) return res.status(404).json({ error: "Appointment not found" });

      if (appointment.doctor.toString() !== doctor._id.toString()) {
        return res.status(403).json({ error: "This appointment does not belong to you" });
      }
    } else if (decoded.role === 'nurse') {
      const Nurse = require("../models/Nurse");
      const nurse = await Nurse.findById(decoded.id);
      if (!nurse) return res.status(404).json({ error: "Nurse not found" });

      appointment = await Appointment.findById(appointmentId);
      if (!appointment) return res.status(404).json({ error: "Appointment not found" });

      doctor = await Doctor.findById(appointment.doctor);
    } else if (decoded.role === 'receptionist') {
      const Receptionist = require("../models/Receptionist");
      const receptionist = await Receptionist.findById(decoded.id);
      if (!receptionist) return res.status(404).json({ error: "Receptionist not found" });

      appointment = await Appointment.findById(appointmentId);
      if (!appointment) return res.status(404).json({ error: "Appointment not found" });

      doctor = await Doctor.findById(appointment.doctor);
    }

    // Update status
    const validStatuses = ["booked", "attended", "no show", "cancelled by user", "cancelled by doctor", "cancelled by nurse", "cancelled by receptionist", "walk in", "available"];
    if (!validStatuses.includes(status)) {
      console.log("[API] PATCH Status Error: Invalid status received:", status);
      return res.status(400).json({ error: "Invalid status: " + status });
    }

    appointment.status = status;
    await appointment.save();

    // If marking as completed or no-show, free up the slot for future bookings
    if ((status === "attended" || status === "no show") && doctor) {
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
    console.error("Error in PATCH status:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get ALL appointments from ALL doctors (for receptionist)
router.get("/all-appointments", async (req, res) => {
  try {
    console.log("[API] GET /all-appointments called");

    // Fetch all appointments and populate user and doctor details
    const appointments = await Appointment.find()
      .populate("user", "name roll email phone _id")
      .populate("doctor", "name specialization email _id")
      .sort({ startDateTime: -1 });

    res.json({ appointments });
  } catch (err) {
    console.error("Error fetching all appointments:", err);
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

// GET /api/appointments/my-records — complete clinical records for the logged-in patient
router.get("/my-records", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Authorization header missing" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "patient") return res.status(403).json({ error: "Patient access only" });

    const appointments = await Appointment.find({ user: decoded.id })
      .populate("doctor", "name specialization")
      .populate("user", "name email phone roll uhid")
      .sort({ startDateTime: -1 })
      .lean();

    const records = await Promise.all(appointments.map(async (appointment) => {
      const [vitals, notes, prescription, tests] = await Promise.all([
        Vital.findOne({ appointment: appointment._id }).lean(),
        Note.find({ appointment: appointment._id }).sort({ createdAt: -1 }).lean(),
        Prescription.findOne({ appointment: appointment._id }).lean(),
        Test.findOne({ appointment: appointment._id }).lean(),
      ]);

      return {
        ...appointment,
        vitals: vitals || null,
        notes,
        prescription: prescription || null,
        tests: tests || null,
      };
    }));

    res.json({ records });
  } catch (err) {
    console.error("Error fetching patient records:", err);
    res.status(500).json({ error: "Unable to load patient records" });
  }
});
// GET /api/appointments/patient-history?query=neha
async function verifyDoctorToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const doctor = await Doctor.findById(decoded.id);
    return doctor;
  } catch (err) {
    console.error("Token verification failed:", err.message);
    return null;
  }
}
router.get("/patient-history", async (req, res) => {
  try {
    const { token, query } = req.query;
    if (!token) return res.status(400).json({ error: "Token missing" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) return res.status(401).json({ error: "Invalid or expired token" });

    // Allow both doctors and nurses, but restrict doctors to their own appointments
    if (decoded.role === "doctor") {
      const doctor = await Doctor.findById(decoded.id);
      if (!doctor) return res.status(401).json({ error: "Doctor not found" });

      const regex = query ? new RegExp(query, "i") : /.*/;

      // Doctor sees only their own appointments
      const appointments = await Appointment.find({ doctor: doctor._id })
        .populate({
          path: "user",
          match: {
            $or: [
              { name: regex },
              { roll: regex },
              { email: regex }
            ],
          },
        })
        .populate("doctor")
        .sort({ startDateTime: -1 });

      const filtered = appointments.filter(a => a.user);

      const result = await Promise.all(
        filtered.map(async (a) => {
          const notes = await Note.find({ appointment: a._id });
          const prescriptions = await Prescription.find({ appointment: a._id });

          return {
            ...a.toObject(),
            notes: notes.map(n => n.text),
            prescriptions: prescriptions.map(p => p.prescriptions || ""),
          };
        })
      );

      res.json({ appointments: result });
    } else if (decoded.role === "nurse") {
      const Nurse = require("../models/Nurse");
      const nurse = await Nurse.findById(decoded.id);
      if (!nurse) return res.status(401).json({ error: "Nurse not found" });

      const regex = query ? new RegExp(query, "i") : /.*/;

      // Nurse sees ALL appointments (not filtered by doctor)
      const appointments = await Appointment.find()
        .populate({
          path: "user",
          match: {
            $or: [
              { name: regex },
              { roll: regex },
              { email: regex }
            ],
          },
        })
        .populate("doctor")
        .sort({ startDateTime: -1 });

      const filtered = appointments.filter(a => a.user);

      const result = await Promise.all(
        filtered.map(async (a) => {
          const notes = await Note.find({ appointment: a._id });
          const prescriptions = await Prescription.find({ appointment: a._id });

          return {
            ...a.toObject(),
            notes: notes.map(n => n.text),
            prescriptions: prescriptions.map(p => p.prescriptions || ""),
          };
        })
      );

      res.json({ appointments: result });
    } else {
      return res.status(403).json({ error: "Access denied. Only doctors and nurses can access patient history." });
    }
  } catch (err) {
    console.error("Error fetching patient history:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===============================
// NURSE BOOK APPOINTMENT ENDPOINT
// ===============================
router.post("/nurse-book", async (req, res) => {
  try {
    console.log("[API] POST /nurse-book called");

    const { token, patientEmail, patientPhone, dependantId, doctorId, startDateTime, endDateTime, slotDay, slotTime } = req.body;
    if (!token) return res.status(400).json({ error: "Missing token" });
    if (!doctorId) return res.status(400).json({ error: "Doctor ID is required" });

    // Verify nurse
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "nurse") return res.status(403).json({ error: "Access denied. Not a nurse." });

    const Nurse = require("../models/Nurse");
    const nurse = await Nurse.findById(decoded.id);
    if (!nurse) return res.status(404).json({ error: "Nurse not found" });

    // Verify doctor
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    // Find patient by email
    const user = await User.findOne({ email: patientEmail });
    if (!user) return res.status(404).json({ error: "Patient not found" });

    const dependant = dependantId
      ? user.dependants?.find((item) => item._id.toString() === dependantId)
      : null;
    if (dependantId && !dependant) {
      return res.status(400).json({ error: "Dependant not found for this patient" });
    }

    // Create appointment
    const appointment = new Appointment({
      doctor: doctor._id,
      user: user._id,
      startDateTime,
      endDateTime,
      slotDay,
      slotTime,
      status: "booked",
      bookedBy: "nurse",
      dependant: dependant
        ? {
          _id: dependant._id,
          name: dependant.name,
          age: dependant.age,
          sex: dependant.sex,
          relationship: dependant.relationship,
          bloodGroup: dependant.bloodGroup,
          phone: dependant.phone,
          uhid: dependant.uhid,
        }
        : undefined,
    });
    await appointment.save();

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate("user", "name email roll")
      .populate("doctor", "name specialization");

    res.json({ success: true, appointment: populatedAppointment });
  } catch (err) {
    console.error("Error booking appointment:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// NURSE CANCEL APPOINTMENT ENDPOINT
// ===============================
router.delete("/:appointmentId/nurse-cancel", async (req, res) => {
  try {
    console.log("[API] DELETE /:appointmentId/nurse-cancel called");

    const { appointmentId } = req.params;
    const { token, slotDay, slotTime } = req.body;

    if (!token) return res.status(400).json({ error: "Missing token" });

    // Verify nurse
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "nurse") return res.status(403).json({ error: "Access denied. Not a nurse." });

    const Nurse = require("../models/Nurse");
    const nurse = await Nurse.findById(decoded.id);
    if (!nurse) return res.status(404).json({ error: "Nurse not found" });

    // Find and update appointment
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    appointment.status = "cancelled by nurse";
    await appointment.save();

    res.json({ success: true, message: "Appointment cancelled" });
  } catch (err) {
    console.error("Error cancelling appointment:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
