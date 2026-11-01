import React, { useEffect, useState } from "react";
import axios from "axios";
import "../../styles/doctor/DoctorDashboard.css";
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  BarChart, Bar
} from "recharts";
import { useApi } from "../../context/ApiContext";

const SEX_COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#bbbbbb"];
const STATUS_COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#a05195", "#d45087", "#665191", "#2f4b7c", "#888888"];

// Shared by the doctor and nurse dashboards — only the endpoint and copy differ
export default function DoctorDashboard({
  endpoint = "/api/doctor-dashboard",
  title = "Welcome to Doctor Dashboard",
  subtitle = "Here’s an overview of your patients and appointments",
}) {
  const [sexData, setSexData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [ageData, setAgeData] = useState([]);
  const [statusData, setStatusData] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [totalPatients, setTotalPatients] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const apiBaseUrl = useApi();

  useEffect(() => {
    if (!apiBaseUrl) return;
    const token = localStorage.getItem("token");
    axios
      .get(`${apiBaseUrl}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const data = res.data;

        // 🧩 Format each dataset for Recharts
        setSexData(data.sexStats.map((i) => ({ name: i._id, value: i.count })));
        setWeeklyData(data.weeklyStats.map((i) => ({ week: i.week, patients: i.count })));
        setMonthlyData(data.monthlyStats.map((i) => ({ month: i.month, patients: i.patients })));
        setAgeData(data.ageStats.map((i) => ({ range: i.range, count: i.count })));
        setStatusData(
          data.statusStats.map((i) => ({
            name: i._id ? i._id.charAt(0).toUpperCase() + i._id.slice(1) : "Unknown",
            value: i.count,
          }))
        );
        setYear(data.year);
        setTotalPatients(data.totalPatients);
      })
      .catch((err) => {
        console.error("Dashboard fetch error:", err);
        setError("Could not load dashboard data. Please try again later.");
      })
      .finally(() => setLoading(false));
  }, [apiBaseUrl, endpoint]);

  if (loading) {
    return (
      <div className="doctor-dashboard-content">
        <h2>Loading Dashboard...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="doctor-dashboard-content">
        <h2>{title}</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      {/* ✅ Dashboard Header */}
      <div className="doctor-dashboard-content">
        <h2>{title}</h2>
        <p>{subtitle} ({totalPatients} unique patients).</p>
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
              {sexData.map((_, i) => (
                <Cell key={i} fill={SEX_COLORS[i % SEX_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </section>

      {/* ✅ Weekly Patients Trend */}
      <section className="chart-section">
        <h2 className="chart-title">Weekly Appointment Trend ({year})</h2>
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
        <h2 className="chart-title">Monthly Appointment Overview ({year})</h2>
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
              {statusData.map((_, i) => (
                <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </section>
    </>
  );
}
