const express = require("express");
const router = express.Router();
const Appointment = require("../models/Appointment");
const User = require("../models/User");

// 📊 Doctor Dashboard API
router.get("/doctor-dashboard", async (req, res) => {
  try {
    // 1️⃣ Patients by gender
    const sexStats = await User.aggregate([
      { $group: { _id: "$sex", count: { $sum: 1 } } }
    ]);

    // 2️⃣ Weekly appointments (only current year)
    const currentYear = new Date().getFullYear();
    const weeklyData = await Appointment.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(`${currentYear}-01-01T00:00:00Z`),
            $lt: new Date(`${currentYear + 1}-01-01T00:00:00Z`)
          }
        }
      },
      {
        $group: {
          _id: { week: { $isoWeek: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.week": 1 } }
    ]);

    // 🧮 Fill missing weeks (1–52)
    const weeklyStats = Array.from({ length: 52 }, (_, i) => ({
      week: `Week ${i + 1}`,
      count: 0
    }));
    weeklyData.forEach(item => {
      const weekIndex = item._id.week - 1;
      if (weekIndex >= 0 && weekIndex < 52) {
        weeklyStats[weekIndex].count = item.count;
      }
    });

    // 3️⃣ Monthly appointments (Jan–Dec)
    const monthlyRaw = await Appointment.aggregate([
      {
        $group: {
          _id: { $month: "$createdAt" },
          patients: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const monthlyStats = monthlyRaw.map(item => ({
      month: monthNames[item._id - 1],
      patients: item.patients
    }));

    // 4️⃣ Users by Age (5-year buckets)
    const ageData = await User.aggregate([
      {
        $bucket: {
          groupBy: "$age",
          boundaries: [
            0, 5, 10, 15, 20, 25, 30, 35, 40,
            45, 50, 55, 60, 65, 70, 75, 80,
            85, 90, 95, 100
          ],
          default: "100+",
          output: { count: { $sum: 1 } }
        }
      }
    ]);

    const ageStats = ageData.map(item => {
      if (item._id === "100+") return { range: "100+", count: item.count };
      const start = item._id;
      const end = start + 4;
      return { range: `${start}-${end}`, count: item.count };
    });

    // 5️⃣ Appointment Status Distribution
    const statusStats = await Appointment.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // ✅ Send all data together
    res.json({
      sexStats,
      weeklyStats,
      monthlyStats,
      ageStats,
      statusStats
    });

  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).json({ error: "Error fetching dashboard data" });
  }
});

module.exports = router;
