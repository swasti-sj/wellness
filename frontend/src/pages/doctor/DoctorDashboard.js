import React, { useEffect, useState } from "react";
import axios from "axios";
import "../../styles/doctor/DoctorDashboard.css";
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  BarChart, Bar
} from "recharts";

export default function DoctorDashboard() {
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
        { _id: "Male", count: 45 },
        { _id: "Female", count: 55 },
      ],
      weeklyStats: [
        { week: "Week 1", count: 15 },
        { week: "Week 2", count: 25 },
        { week: "Week 3", count: 18 },
        { week: "Week 4", count: 30 },
      ],
      monthlyStats: [
        { month: "Jan", patients: 80 },
        { month: "Feb", patients: 95 },
        { month: "Mar", patients: 110 },
        { month: "Apr", patients: 130 },
      ],
      ageStats: [
        { range: "0-18", count: 10 },
        { range: "19-35", count: 45 },
        { range: "36-50", count: 30 },
        { range: "51+", count: 15 },
      ],
      statusStats: [
        { _id: "Completed", count: 60 },
        { _id: "Pending", count: 25 },
        { _id: "Cancelled", count: 15 },
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

  // useEffect(() => {
  //   axios
  //     .get("http://localhost:5000/api/dashboard/doctor-dashboard")
  //     .then((res) => {
  //       const data = res.data;

  //       // 🧩 Format each dataset for Recharts
  //       setSexData(
  //         data.sexStats.map((item) => ({
  //           name: item._id,
  //           value: item.count,
  //         }))
  //       );

  //       setWeeklyData(
  //         data.weeklyStats.map((item) => ({
  //           week: item.week,
  //           patients: item.count,
  //         }))
  //       );

  //       setMonthlyData(
  //         data.monthlyStats.map((item) => ({
  //           month: item.month,
  //           patients: item.patients,
  //         }))
  //       );

  //       setAgeData(
  //         data.ageStats.map((item) => ({
  //           range: item.range,
  //           count: item.count,
  //         }))
  //       );

  //       setStatusData(
  //         data.statusStats.map((item) => ({
  //           name: item._id,
  //           value: item.count,
  //         }))
  //       );

  //       setLoading(false);
  //     })
  //     .catch((err) => {
  //       console.error("Dashboard fetch error:", err);
  //       setLoading(false);
  //     });
  // }, []);

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
        <h2>Welcome to Doctor Dashboard</h2>
        <p>Here’s an overview of your patients and appointments.</p>
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
