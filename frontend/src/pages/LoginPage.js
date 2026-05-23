import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/LoginPage.css";
import { useApi } from "../context/ApiContext";

export default function LoginPage() {
  const [token, setToken] = useState("");
  const navigate = useNavigate();
  const apiBaseUrl = useApi();

  useEffect(() => {
    document.body.classList.add("login-page");
    return () => document.body.classList.remove("login-page");
  }, []);

  // ONLY: capture token if redirected back (optional safety)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get("token");
    const role = urlParams.get("role");

    if (accessToken) {
      setToken(accessToken);
      localStorage.setItem("token", accessToken);
    }
    if (role) {
      localStorage.setItem("role", role);
    }
  }, []);

  if (token) {
    return <div>Redirecting...</div>;
  }

  return (
    <div className="login-container-horizontal">
      <div className="login-left">
        <img src="/college-logo.png" alt="College Logo" className="login-logo" />
        <h2>WELCOME BACK!</h2>
        <p className="login-subtitle" style={{ color: "black" }}>
          Access your dashboard and manage your profile.
        </p>
      </div>

      <div className="login-right">
        <a
          href={`${apiBaseUrl}/api/auth/google?role=patient`}
          className="google-btn pat"
        >
          Login as Patient
        </a>

        <a
          href={`${apiBaseUrl}/api/auth/google?role=doctor`}
          className="google-btn doc"
        >
          Login as Doctor
        </a>

        <button
          onClick={() => navigate("/others-login")}
          className="google-btn others"
        >
          Login as Others
        </button>
      </div>
    </div>
  );
}