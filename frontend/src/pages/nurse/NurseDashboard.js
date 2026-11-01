import React from "react";
import DoctorDashboard from "../doctor/DoctorDashboard";

export default function NurseDashboard() {
  return (
    <DoctorDashboard
      endpoint="/api/nurse-dashboard"
      title="Welcome to Nurse Dashboard"
      subtitle="Here's an overview of all patients and appointments across the system"
    />
  );
}
