import React, { useState, useEffect } from "react";
import axios from "axios";
import { useApi } from "../../context/ApiContext";
function CertificateSummary({ appointmentId }) {
  const [certificate, setCertificate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const token = localStorage.getItem("token");
 const apiBaseUrl = useApi();
  useEffect(() => {
    const fetchCertificate = async () => {
      if (!appointmentId) return;
      try {
        const res = await axios.get(`${apiBaseUrl}/api/tests/${appointmentId}`, {
          params: { token },
        });
        if (res.data.certificate) {
          setCertificate(res.data.certificate);
        }
      } catch (err) {
        console.error("Error fetching certificate:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCertificate();
  }, [appointmentId, token]);

  if (isLoading) return null;

  if (!certificate || !certificate.issued) {
    return (
      <div className="certificate-summary">
        <div className="summary-header">
          <h4>Medical Certificate</h4>
        </div>
        <p className="no-data">No certificate issued</p>
      </div>
    );
  }

  return (
    <div className="certificate-summary">
      <div className="summary-header">
        <h4>Medical Certificate</h4>
        <span className="issued-badge">✓ Issued</span>
      </div>
      {certificate.clinicalDetails && (
        <div className="certificate-details">
          <p>
            <strong>Clinical Details:</strong> {certificate.clinicalDetails}
          </p>
        </div>
      )}
      {certificate.imageUrl && (
        <div className="certificate-image-preview">
          <img
            src={certificate.imageUrl}
            alt="Certificate"
            style={{ maxWidth: "100%", borderRadius: "8px", marginTop: "0.5rem" }}
          />
        </div>
      )}
    </div>
  );
}

export default CertificateSummary;