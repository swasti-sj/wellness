import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  BarChart, Bar
} from "recharts";
import "../../styles/doctor/DoctorDashboard.css";

export default function NurseDashboard() {
  const [sexData, setSexData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [ageData, setAgeData] = useState([]);
  const [statusData, setStatusData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 🧪 MOCK DATA — Use this until your backend is ready
    const mockData = {
      sexStats: [
        { _id: "Male", count: 120 },
        { _id: "Female", count: 135 },
      ],
      weeklyStats: [
        { week: "Week 1", count: 45 },
        { week: "Week 2", count: 62 },
        { week: "Week 3", count: 58 },
        { week: "Week 4", count: 90 },
      ],
      monthlyStats: [
        { month: "Jan", patients: 150 },
        { month: "Feb", patients: 165 },
        { month: "Mar", patients: 200 },
        { month: "Apr", patients: 220 },
      ],
      ageStats: [
        { range: "0-18", count: 35 },
        { range: "19-35", count: 95 },
        { range: "36-50", count: 85 },
        { range: "51+", count: 40 },
      ],
      statusStats: [
        { _id: "Completed", count: 180 },
        { _id: "Pending", count: 60 },
        { _id: "Cancelled", count: 30 },
      ],
    };

    // 🧩 Format each dataset for Recharts
    setSexData(mockData.sexStats.map((i) => ({ name: i._id, value: i.count })));
    setWeeklyData(mockData.weeklyStats.map((i) => ({ week: i.week, patients: i.count })));
    setMonthlyData(mockData.monthlyStats.map((i) => ({ month: i.month, patients: i.patients })));
    setAgeData(mockData.ageStats.map((i) => ({ range: i.range, count: i.count })));
    setStatusData(mockData.statusStats.map((i) => ({ name: i._id, value: i.count })));

    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="doctor-dashboard-content">
        <h2>Loading Dashboard...</h2>
      </div>
    );
  }

  return (
    <>
      {/* ✅ Dashboard Header */}
      <div className="doctor-dashboard-content">
        <h2>Welcome to Nurse Dashboard</h2>
        <p>Here's an overview of all patients and appointments across the system.</p>
      </div>

      {/* ✅ Gender Distribution Pie */}
      <section className="chart-section">
        <h2 className="chart-title">Patients by Gender</h2>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={sexData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
            >
              <Cell fill="#8884d8" />
              <Cell fill="#82ca9d" />
              <Cell fill="#ffc658" />
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </section>

      {/* ✅ Weekly Patients Trend */}
      <section className="chart-section">
        <h2 className="chart-title">Weekly Patient Trend (Current Year)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={weeklyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="patients" stroke="#6c1b85" strokeWidth={2} activeDot={{ r: 8 }} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* ✅ Monthly Appointments */}
      <section className="chart-section">
        <h2 className="chart-title">Monthly Appointment Overview</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="patients" fill="#e49c43" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* ✅ Age Distribution */}
      <section className="chart-section">
        <h2 className="chart-title">Patient Age Distribution</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={ageData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* ✅ Appointment Status */}
      <section className="chart-section">
        <h2 className="chart-title">Appointments by Status</h2>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={statusData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
            >
              <Cell fill="#0088FE" />
              <Cell fill="#00C49F" />
              <Cell fill="#FFBB28" />
              <Cell fill="#FF8042" />
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </section>
    </>
  );
}