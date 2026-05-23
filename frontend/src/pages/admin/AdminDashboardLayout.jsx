import React from "react";
import { Outlet } from "react-router-dom";
import AdminNavbar from "./AdminNavbar";

export default function AdminDashboardLayout() {
  return (
    <>
      <AdminNavbar />
      <div style={{ paddingTop: "70px" }}>
        <Outlet />
      </div>
    </>
  );
}