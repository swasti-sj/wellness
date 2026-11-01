const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Appointment = require("../models/Appointment");
const authMiddleware = require("../middleware/auth");
const { requireDoctor, requireNurse } = require("../middleware/auth");

// Clinic dates are grouped in IST so an 11pm appointment doesn't land in the
// next day/week/month the way it would with MongoDB's default UTC.
const TZ = "Asia/Kolkata";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const AGE_BUCKETS = [
  { range: "0-17", min: 0, max: 18 },
  { range: "18-25", min: 18, max: 26 },
  { range: "26-35", min: 26, max: 36 },
  { range: "36-50", min: 36, max: 51 },
  { range: "51-65", min: 51, max: 66 },
  { range: "65+", min: 66, max: Infinity },
];

// 📊 Doctor Dashboard API — all stats are scoped to the logged-in doctor
router.get("/doctor-dashboard", authMiddleware, requireDoctor, async (req, res) => {
  try {
    const doctorId = new mongoose.Types.ObjectId(req.user.id);
    res.json(await buildDashboardStats({ doctor: doctorId }));
  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).json({ error: "Error fetching dashboard data" });
  }
});

// 📊 Nurse Dashboard API — clinic-wide stats across all doctors
router.get("/nurse-dashboard", authMiddleware, requireNurse, async (req, res) => {
  try {
    res.json(await buildDashboardStats({}));
  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).json({ error: "Error fetching dashboard data" });
  }
});

// Aggregates chart data over appointments matching `filter`
async function buildDashboardStats(filter) {
  const currentYear = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric" }).format(new Date())
  );

  // "available" entries are empty slots, not real appointments
  const baseMatch = { ...filter, status: { $ne: "available" } };

  const [result] = await Appointment.aggregate([
    { $match: baseMatch },
    {
      $facet: {
        // 1️⃣ + 4️⃣ Unique patients across the matched appointments. A booking for a
        // dependant counts the dependant, not the account holder.
        patients: [
          { $project: { user: 1, dependant: 1 } },
          { $lookup: { from: "users", localField: "user", foreignField: "_id", as: "u" } },
          { $unwind: { path: "$u", preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: { $ifNull: ["$dependant._id", "$user"] },
              // Pick the source by who the booking was for — never fall back to
              // the account holder's age/sex for a dependant with missing data
              sex: { $first: { $cond: [{ $ifNull: ["$dependant._id", false] }, "$dependant.sex", "$u.sex"] } },
              age: { $first: { $cond: [{ $ifNull: ["$dependant._id", false] }, "$dependant.age", "$u.age"] } },
            },
          },
        ],

        // 2️⃣ Weekly appointments for the current ISO year
        weekly: [
          {
            $match: {
              $expr: { $eq: [{ $isoWeekYear: { date: "$startDateTime", timezone: TZ } }, currentYear] },
            },
          },
          { $group: { _id: { $isoWeek: { date: "$startDateTime", timezone: TZ } }, count: { $sum: 1 } } },
        ],

        // 3️⃣ Monthly appointments for the current year
        monthly: [
          {
            $match: {
              $expr: { $eq: [{ $year: { date: "$startDateTime", timezone: TZ } }, currentYear] },
            },
          },
          { $group: { _id: { $month: { date: "$startDateTime", timezone: TZ } }, count: { $sum: 1 } } },
        ],

        // 5️⃣ Appointment status distribution
        status: [
          { $group: { _id: "$status", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
      },
    },
  ]);

  const sexCounts = {};
  const ageCounts = Object.fromEntries(AGE_BUCKETS.map((b) => [b.range, 0]));
  for (const p of result.patients) {
    const sex = p.sex || "Not specified";
    sexCounts[sex] = (sexCounts[sex] || 0) + 1;
    if (typeof p.age === "number") {
      const bucket = AGE_BUCKETS.find((b) => p.age >= b.min && p.age < b.max);
      if (bucket) ageCounts[bucket.range] += 1;
    }
  }
  const sexStats = Object.entries(sexCounts).map(([_id, count]) => ({ _id, count }));
  const ageStats = AGE_BUCKETS.map((b) => ({ range: b.range, count: ageCounts[b.range] }));

  // Fill weeks 1..max(current week, last week with data) so the line has no gaps
  const weekMap = Object.fromEntries(result.weekly.map((w) => [w._id, w.count]));
  const lastWeek = Math.max(currentIsoWeek(), ...result.weekly.map((w) => w._id));
  const weeklyStats = Array.from({ length: lastWeek }, (_, i) => ({
    week: `W${i + 1}`,
    count: weekMap[i + 1] || 0,
  }));

  const monthMap = Object.fromEntries(result.monthly.map((m) => [m._id, m.count]));
  const monthlyStats = MONTHS.map((month, i) => ({ month, patients: monthMap[i + 1] || 0 }));

  return {
    year: currentYear,
    totalPatients: result.patients.length,
    sexStats,
    weeklyStats,
    monthlyStats,
    ageStats,
    statusStats: result.status,
  };
}

// ISO week number of "today" in the clinic timezone
function currentIsoWeek() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(new Date());
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const d = new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

module.exports = router;
